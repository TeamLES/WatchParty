# WatchParty Deployment Guide

This guide deploys the current WatchParty monorepo as:

- Frontend: Vercel, `apps/web`
- REST API backend: AWS ECS Fargate, `apps/api`
- Realtime: existing API Gateway WebSocket + Lambda
- Auth: Amazon Cognito
- Data: DynamoDB

The screenshots show these already exist in `eu-central-1`:

- Cognito user pool `eu-central-1_6ohxnBvfL`
- DynamoDB tables: `users`, `rooms`, `room-members`, `invites`, `chat-messages`, `highlights`, `websocket-connections`, `playback-snapshots`, `reaction-events`, `scheduled-parties`, `idempotency-events`
- API Gateway WebSocket API `watchparty-ws`
- Lambda functions `watchparty-ws-router` and `watchparty-ws-authorizer`

Do not paste secrets into Git. Put production values into AWS/Vercel environment variables.

## 1. Required Local Tools

Install these locally:

- Docker Desktop
- AWS CLI v2
- GitHub repository connected to Vercel
- Vercel account

Check:

```bash
docker --version
aws --version
pnpm --version
```

Configure AWS:

```bash
aws configure sso
# or, if you use access keys:
aws configure
```

Set the region:

```bash
export AWS_REGION=eu-central-1
```

## 2. Validate The App Locally

From repo root:

```bash
pnpm install
pnpm check-types
pnpm --filter api build
pnpm --filter web build
```

## 3. Production Environment Values

Your local files are:

- `apps/api/.env.local`
- `apps/web/.env.local`

For deployment, copy the same keys, but change localhost URLs to deployed URLs.

### API Environment Variables For ECS

Set these on the ECS task definition:

```env
PORT=3001
AWS_REGION=eu-central-1
ROOMS_REPOSITORY_DRIVER=dynamodb

DDB_USERS_TABLE=users
DDB_ROOMS_TABLE=rooms
DDB_ROOM_MEMBERS_TABLE=room-members
DDB_INVITES_TABLE=invites
DDB_CHAT_MESSAGES_TABLE=chat-messages
DDB_HIGHLIGHTS_TABLE=highlights
DDB_WS_CONNECTIONS_TABLE=websocket-connections
DDB_PLAYBACK_SNAPSHOTS_TABLE=playback-snapshots
DDB_REACTION_EVENTS_TABLE=reaction-events
DDB_SCHEDULED_PARTIES_TABLE=scheduled-parties
DDB_IDEMPOTENCY_EVENTS_TABLE=idempotency-events

COGNITO_USER_POOL_ID=eu-central-1_6ohxnBvfL
COGNITO_APP_CLIENT_ID=<your-cognito-app-client-id>
COGNITO_ISSUER=https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_6ohxnBvfL
COGNITO_HOSTED_UI_DOMAIN=<your-cognito-domain>
COGNITO_SWAGGER_SCOPES=openid profile email
SWAGGER_OAUTH2_REDIRECT_URL=<backend-public-url>/api/docs/oauth2-redirect.html
```

Do not set `AWS_PROFILE`, `AWS_ACCESS_KEY_ID`, or `AWS_SECRET_ACCESS_KEY` in ECS. ECS should use an IAM task role.

### Web Environment Variables For Vercel

Set these in Vercel Project Settings -> Environment Variables:

```env
NEXT_PUBLIC_API_BASE_URL=<backend-public-url>
NEXT_PUBLIC_AWS_REGION=eu-central-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=eu-central-1_6ohxnBvfL
NEXT_PUBLIC_COGNITO_CLIENT_ID=<your-cognito-app-client-id>
NEXT_PUBLIC_COGNITO_DOMAIN=<your-cognito-domain>
NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_IN=https://<your-vercel-domain>/auth/callback
NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_OUT=https://<your-vercel-domain>/auth/login
NEXT_PUBLIC_WS_URL=wss://<api-id>.execute-api.eu-central-1.amazonaws.com/<stage>
WS_TICKET_SECRET=<same-secret-as-websocket-lambda>
WS_TICKET_TTL_SECONDS=300
```

`WS_TICKET_SECRET` must be identical in Vercel and the WebSocket authorizer Lambda.

## 4. Update Cognito Callback URLs

In AWS Console:

1. Open Cognito.
2. Open User pool `WatchParty`.
3. Go to Applications -> App clients.
4. Open your public client.
5. In Hosted UI / Login pages, add:
   - Allowed callback URL: `https://<your-vercel-domain>/auth/callback`
   - Allowed sign-out URL: `https://<your-vercel-domain>/auth/login`
6. Keep local URLs too while developing:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/auth/login`
7. Save changes.

## 5. Confirm WebSocket API

Your API Gateway WebSocket already has routes. Confirm these exist:

- `$connect`
- `$disconnect`
- `$default`
- `joinRoom`
- `leaveRoom`
- `syncPlayback`
- `getPlaybackSnapshot`
- `ping`
- `chatMessage`
- `reaction`

Open API Gateway -> `watchparty-ws` -> Stages and copy the WebSocket URL:

```txt
wss://<api-id>.execute-api.eu-central-1.amazonaws.com/<stage>
```

Put it into Vercel as `NEXT_PUBLIC_WS_URL`.

## 6. Build The Backend Docker Image

This repo now has `apps/api/Dockerfile`.

From repo root:

```bash
docker buildx build \
  --platform linux/amd64 \
  -f apps/api/Dockerfile \
  -t watchparty-api:latest \
  .
```

Why `linux/amd64`: if you are on Apple Silicon, Docker may build an ARM image by default. ECS task definitions must match the image architecture. The easiest first deploy is `linux/amd64`.

Optional local smoke test:

```bash
docker run --rm -p 3001:3001 \
  --env-file apps/api/.env.local \
  watchparty-api:latest
```

Then open:

```txt
http://localhost:3001/
http://localhost:3001/api/docs
```

## 7. Push The Image To Amazon ECR

Create an ECR repository:

```bash
aws ecr create-repository \
  --repository-name watchparty-api \
  --region eu-central-1
```

Get your account ID:

```bash
aws sts get-caller-identity --query Account --output text
```

Set variables:

```bash
export AWS_ACCOUNT_ID=<your-account-id>
export AWS_REGION=eu-central-1
export ECR_REPO=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/watchparty-api
```

Login Docker to ECR:

```bash
aws ecr get-login-password --region $AWS_REGION \
  | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
```

Tag and push:

```bash
docker tag watchparty-api:latest $ECR_REPO:latest
docker push $ECR_REPO:latest
```

AWS ECR docs describe this same `get-login-password`, `docker tag`, and `docker push` flow.

## 8. Create IAM Roles For ECS

You need two roles.

### Task Execution Role

This role lets ECS pull from ECR and write logs.

In IAM:

1. Roles -> Create role.
2. Trusted entity: AWS service.
3. Use case: Elastic Container Service -> Elastic Container Service Task.
4. Add policy: `AmazonECSTaskExecutionRolePolicy`.
5. Name: `watchparty-ecs-task-execution-role`.

### Task Role

This role is used by your Nest API code to access DynamoDB.

Create role:

1. Roles -> Create role.
2. Trusted entity: AWS service.
3. Use case: Elastic Container Service -> Elastic Container Service Task.
4. Name: `watchparty-api-task-role`.

Add inline policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "WatchPartyDynamoDbAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:eu-central-1:<account-id>:table/users",
        "arn:aws:dynamodb:eu-central-1:<account-id>:table/users/index/*",
        "arn:aws:dynamodb:eu-central-1:<account-id>:table/rooms",
        "arn:aws:dynamodb:eu-central-1:<account-id>:table/rooms/index/*",
        "arn:aws:dynamodb:eu-central-1:<account-id>:table/room-members",
        "arn:aws:dynamodb:eu-central-1:<account-id>:table/room-members/index/*",
        "arn:aws:dynamodb:eu-central-1:<account-id>:table/invites",
        "arn:aws:dynamodb:eu-central-1:<account-id>:table/invites/index/*",
        "arn:aws:dynamodb:eu-central-1:<account-id>:table/chat-messages",
        "arn:aws:dynamodb:eu-central-1:<account-id>:table/chat-messages/index/*",
        "arn:aws:dynamodb:eu-central-1:<account-id>:table/highlights",
        "arn:aws:dynamodb:eu-central-1:<account-id>:table/highlights/index/*",
        "arn:aws:dynamodb:eu-central-1:<account-id>:table/websocket-connections",
        "arn:aws:dynamodb:eu-central-1:<account-id>:table/websocket-connections/index/*",
        "arn:aws:dynamodb:eu-central-1:<account-id>:table/playback-snapshots",
        "arn:aws:dynamodb:eu-central-1:<account-id>:table/playback-snapshots/index/*",
        "arn:aws:dynamodb:eu-central-1:<account-id>:table/reaction-events",
        "arn:aws:dynamodb:eu-central-1:<account-id>:table/reaction-events/index/*",
        "arn:aws:dynamodb:eu-central-1:<account-id>:table/scheduled-parties",
        "arn:aws:dynamodb:eu-central-1:<account-id>:table/scheduled-parties/index/*",
        "arn:aws:dynamodb:eu-central-1:<account-id>:table/idempotency-events",
        "arn:aws:dynamodb:eu-central-1:<account-id>:table/idempotency-events/index/*"
      ]
    }
  ]
}
```

## 9. Create ECS Cluster

In AWS Console:

1. Open ECS.
2. Clusters -> Create cluster.
3. Cluster name: `watchparty-cluster`.
4. Infrastructure: AWS Fargate.
5. Create.

ECS is the service that runs containers. Fargate means AWS manages the servers for you.

## 10. Create CloudWatch Log Group

In CloudWatch:

1. Logs -> Log groups.
2. Create log group.
3. Name: `/ecs/watchparty-api`.
4. Retention: 7 or 14 days for school project.

## 11. Create ECS Task Definition

In ECS:

1. Task definitions -> Create new task definition.
2. Task definition family: `watchparty-api`.
3. Launch type: AWS Fargate.
4. Operating system: Linux.
5. CPU architecture: `X86_64`.
6. CPU: `0.25 vCPU`.
7. Memory: `0.5 GB` or `1 GB`.
8. Task execution role: `watchparty-ecs-task-execution-role`.
9. Task role: `watchparty-api-task-role`.

Container settings:

- Name: `watchparty-api`
- Image URI: `<account-id>.dkr.ecr.eu-central-1.amazonaws.com/watchparty-api:latest`
- Container port: `3001`
- Protocol: TCP
- Essential: yes

Environment variables: paste the API env variables from section 3.

Logging:

- Log driver: `awslogs`
- Log group: `/ecs/watchparty-api`
- Region: `eu-central-1`
- Stream prefix: `ecs`

Create the task definition.

## 12. Create Application Load Balancer

ECS tasks need a public URL. The clean production route is:

```txt
Internet -> Application Load Balancer -> ECS Fargate task on port 3001
```

In EC2 Console:

1. Load Balancers -> Create load balancer.
2. Choose Application Load Balancer.
3. Name: `watchparty-api-alb`.
4. Scheme: Internet-facing.
5. IP address type: IPv4.
6. Select your VPC.
7. Select at least 2 public subnets.

Security groups:

- ALB security group:
  - inbound HTTP 80 from `0.0.0.0/0`
  - inbound HTTPS 443 from `0.0.0.0/0` if using certificate
  - outbound all

Target group:

- Type: IP addresses
- Name: `watchparty-api-tg`
- Protocol: HTTP
- Port: `3001`
- Health check path: `/`
- Expected success code: `200`

For real HTTPS:

1. Request an ACM certificate for your API domain, e.g. `api.yourdomain.com`.
2. Add an HTTPS listener on port 443.
3. Attach the certificate.
4. Forward to `watchparty-api-tg`.

Minimum school-demo option: use the ALB HTTP DNS name as backend URL. It works server-to-server from Vercel API routes, but HTTPS with a custom domain is better.

## 13. Create ECS Service

In ECS cluster `watchparty-cluster`:

1. Services -> Create.
2. Launch type: Fargate.
3. Task definition: `watchparty-api`.
4. Service name: `watchparty-api-service`.
5. Desired tasks: `1`.
6. Networking:
   - VPC: same as ALB
   - Subnets: public subnets for simplest setup
   - Public IP: Enabled
7. Security group for ECS task:
   - inbound TCP `3001` from the ALB security group only
   - outbound all
8. Load balancing:
   - Application Load Balancer
   - choose `watchparty-api-alb`
   - container `watchparty-api:3001`
   - target group `watchparty-api-tg`
9. Create service.

Wait until:

- task is `RUNNING`
- target group target is `healthy`

Test:

```txt
http://<alb-dns-name>/
http://<alb-dns-name>/api/docs
```

If you configured HTTPS:

```txt
https://api.yourdomain.com/
https://api.yourdomain.com/api/docs
```

## 14. Deploy Frontend To Vercel

Push your repo to GitHub first.

In Vercel:

1. Add New -> Project.
2. Import the GitHub repo.
3. Framework preset: Next.js.
4. Root Directory: `apps/web`.
5. Enable: `Include source files outside of the Root Directory in the Build Step`.
6. Install command: keep default or set:
   ```bash
   pnpm install --frozen-lockfile
   ```
7. Build command:
   ```bash
   pnpm build
   ```
   Because root directory is `apps/web`, this runs `apps/web/package.json` -> `next build`.
8. Add all web environment variables from section 3.
9. Deploy.

Vercel docs note that shared packages outside the root directory need the outside-root build option in monorepos.

## 15. Update Cognito After Vercel Gives You A URL

After first Vercel deploy, copy the production URL:

```txt
https://watchparty-xxxxx.vercel.app
```

Update:

```env
NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_IN=https://watchparty-xxxxx.vercel.app/auth/callback
NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_OUT=https://watchparty-xxxxx.vercel.app/auth/login
```

In Cognito App Client, add the same URLs to allowed callback/sign-out URLs.

Redeploy Vercel after changing env vars.

## 16. Final Smoke Test

1. Open Vercel production URL.
2. Sign in with Cognito.
3. Create a room.
4. Open the invite in another browser/profile.
5. Host changes video.
6. Host clicks play/pause/seek.
7. Viewer should sync.
8. Send chat message.
9. Send reaction.
10. Reload viewer; it should reconnect and receive latest playback snapshot.

Watch logs:

- ECS API logs: CloudWatch `/ecs/watchparty-api`
- WebSocket Lambda logs: CloudWatch logs for `watchparty-ws-router` and `watchparty-ws-authorizer`
- Vercel logs: Project -> Deployments -> latest deployment -> Functions/logs

## 17. Updating Backend After Code Changes

Build and push a new image:

```bash
docker buildx build \
  --platform linux/amd64 \
  -f apps/api/Dockerfile \
  -t watchparty-api:latest \
  .

docker tag watchparty-api:latest $ECR_REPO:latest
docker push $ECR_REPO:latest
```

Then in ECS:

1. Open cluster.
2. Open `watchparty-api-service`.
3. Click Update.
4. Check Force new deployment.
5. Save.

ECS pulls the new `latest` image and replaces the running task.

## 18. Common Problems

### ECS task starts and immediately stops

Check CloudWatch logs. Usually one env variable is missing or the task role lacks DynamoDB permissions.

### API returns Cognito unauthorized

Check:

- `COGNITO_USER_POOL_ID`
- `COGNITO_APP_CLIENT_ID`
- `COGNITO_ISSUER`
- frontend `NEXT_PUBLIC_COGNITO_CLIENT_ID`

### Frontend login redirects to localhost

Update Vercel env:

- `NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_IN`
- `NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_OUT`

Then update Cognito App Client allowed URLs and redeploy Vercel.

### WebSocket says unauthorized

`WS_TICKET_SECRET` differs between Vercel and Lambda. Make them identical and redeploy both.

### ECS target is unhealthy

Check:

- target group path is `/`
- container port is `3001`
- ECS security group allows inbound `3001` from ALB security group
- app has `PORT=3001`

### Docker image architecture mismatch

If you built on Apple Silicon without `--platform linux/amd64`, either rebuild with `--platform linux/amd64` or set ECS task CPU architecture to ARM64.
