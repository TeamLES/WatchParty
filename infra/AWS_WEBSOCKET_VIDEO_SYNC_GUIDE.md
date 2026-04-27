# WatchParty WebSocket Playback Sync Guide

This guide sets up low-cost realtime playback sync for WatchParty. API Gateway
WebSocket carries room control events only: `play`, `pause`, `seek`, and periodic
`position` snapshots. Every browser still loads the same YouTube video locally.

References:

- API Gateway WebSocket route selection expressions: https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api-selection-expressions.html
- API Gateway WebSocket routes and integrations: https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api-routes-integrations.html
- API Gateway WebSocket Lambda REQUEST authorizers: https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api-lambda-auth.html
- API Gateway `@connections` callback API: https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-how-to-call-websocket-api.html
- DynamoDB TTL: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html

## Architecture

- `apps/web` mints a short-lived WebSocket ticket from the existing httpOnly
  Cognito session at `/api/realtime/ws-ticket`.
- Browser connects to `NEXT_PUBLIC_WS_URL?ticket=...`.
- API Gateway runs the `$connect` Lambda REQUEST authorizer and exposes
  `userId` to the router Lambda.
- Router Lambda stores active connections in DynamoDB and broadcasts playback
  events through the API Gateway Management API.
- Latest playback state is stored in DynamoDB so reconnecting clients can ask
  for `getPlaybackSnapshot`.

## Client Protocol

Inbound messages:

```json
{"action":"joinRoom","roomId":"abc123def456gh78"}
{"action":"getPlaybackSnapshot","roomId":"abc123def456gh78"}
{"action":"syncPlayback","roomId":"abc123def456gh78","sequence":1,"eventType":"play","state":"playing","positionMs":0,"eventId":"uuid","sentAt":"2026-04-27T12:00:00.000Z"}
{"action":"leaveRoom"}
{"action":"ping"}
```

Outbound events:

```json
{"type":"playback.sync","roomId":"abc123def456gh78","sequence":1,"eventType":"play","state":"playing","positionMs":0,"updatedByUserId":"user-sub","updatedAt":"2026-04-27T12:00:00.100Z","eventId":"uuid","sentAt":"2026-04-27T12:00:00.000Z"}
{"type":"playback.snapshot","roomId":"abc123def456gh78","sequence":1,"state":"playing","positionMs":0,"updatedByUserId":"user-sub","updatedAt":"2026-04-27T12:00:00.100Z","eventId":"uuid"}
{"type":"presence.updated","roomId":"abc123def456gh78","onlineCount":2,"updatedAt":"2026-04-27T12:00:05.000Z"}
{"type":"error","message":"Only the room host can sync playback"}
```

Only the room host may send `syncPlayback`. Viewers receive events and apply
them locally.

## AWS Setup

Use `eu-central-1` unless you intentionally move the rest of the app.

### 1. Create DynamoDB Tables

Create `websocket-connections`:

- Partition key: `connectionId` (String)
- TTL attribute: `expiresAt` (Number)
- GSI `room-index`: partition key `roomId` (String), sort key `connectedAt` (String)
- GSI `user-index`: partition key `userId` (String), sort key `connectedAt` (String)

Create `playback-snapshots`:

- Partition key: `roomId` (String)
- Sort key: `sequence` (Number)

The existing `rooms` table is read for host authorization.

### 2. Create Router Lambda

Create a Node.js 20 Lambda named `watchparty-ws-router`.

Use `infra/examples/websocket-lambda/handler.ts` as the starter source. Exported
functions:

- `handler` for WebSocket routes
- `authorizer` for `$connect`

Environment variables:

```env
AWS_REGION=eu-central-1
DDB_WS_CONNECTIONS_TABLE=websocket-connections
DDB_PLAYBACK_SNAPSHOTS_TABLE=playback-snapshots
DDB_ROOMS_TABLE=rooms
CONNECTION_TTL_SECONDS=7200
WS_TICKET_SECRET=<same-long-random-secret-as-web>
WS_CUSTOM_DOMAIN=false
```

For local-only experiments without the authorizer, you can set
`ALLOW_UNAUTHENTICATED_WS=true`, but do not use that in shared environments.

### 3. Add Lambda IAM Permissions

Attach an inline policy to the Lambda execution role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DynamoDbAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:GetItem",
        "dynamodb:Query"
      ],
      "Resource": [
        "arn:aws:dynamodb:eu-central-1:<ACCOUNT_ID>:table/websocket-connections",
        "arn:aws:dynamodb:eu-central-1:<ACCOUNT_ID>:table/websocket-connections/index/*",
        "arn:aws:dynamodb:eu-central-1:<ACCOUNT_ID>:table/playback-snapshots",
        "arn:aws:dynamodb:eu-central-1:<ACCOUNT_ID>:table/rooms"
      ]
    },
    {
      "Sid": "WebSocketManageConnections",
      "Effect": "Allow",
      "Action": ["execute-api:ManageConnections"],
      "Resource": "arn:aws:execute-api:eu-central-1:<ACCOUNT_ID>:<API_ID>/<STAGE>/POST/@connections"
    },
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
```

If API Gateway does not add invoke permission automatically:

```bash
aws lambda add-permission \
  --function-name watchparty-ws-router \
  --statement-id apigw-ws-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:eu-central-1:<ACCOUNT_ID>:<API_ID>/*"
```

### 4. Create API Gateway WebSocket API

1. API Gateway -> Create API -> WebSocket API.
2. API name: `watchparty-ws`.
3. Route selection expression: `$request.body.action`.
4. Add routes:
   - `$connect`
   - `$disconnect`
   - `$default`
   - `joinRoom`
   - `leaveRoom`
   - `syncPlayback`
   - `getPlaybackSnapshot`
   - `ping`
5. Attach every route to `watchparty-ws-router` with Lambda proxy integration.
6. Create a stable stage, for example `dev`.

WebSocket URL format:

```txt
wss://{api-id}.execute-api.{region}.amazonaws.com/{stage}
```

### 5. Add `$connect` Authorizer

Create a Lambda REQUEST authorizer:

- Lambda function: `watchparty-ws-router`
- Handler export: `authorizer`
- Identity source: `route.request.querystring.ticket`
- Attach it only to `$connect`

API Gateway WebSocket auth runs at connection time, so keep tickets short-lived.

### 6. Configure Web App Env

In `apps/web/.env.local`:

```env
NEXT_PUBLIC_WS_URL=wss://{api-id}.execute-api.eu-central-1.amazonaws.com/dev
WS_TICKET_SECRET=<same-long-random-secret-as-lambda>
WS_TICKET_TTL_SECONDS=300
```

Restart `pnpm --filter web dev` after changing these values.

## Smoke Test

1. Open the same room in two browsers with different users.
2. Host clicks play. Viewer should receive `playback.sync` and start locally.
3. Host seeks. Viewer should correct only when drift exceeds the client
   threshold.
4. Reload the viewer. It should join and receive `playback.snapshot`.
5. Stop one browser. Lambda should remove stale connection IDs when
   `GoneException` appears during fanout.

You can also use `wscat` after minting a ticket from the web route:

```bash
wscat -c "wss://{api-id}.execute-api.eu-central-1.amazonaws.com/dev?ticket=<ticket>"
```
