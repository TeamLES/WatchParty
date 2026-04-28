# WatchParty Deployment Summary

## Overview

WatchParty was deployed as a cloud-based web application using Vercel for the frontend and AWS for backend, realtime communication, authentication, and persistence.

The final architecture separates the application into:

- Frontend hosting on Vercel
- REST API backend running as a Docker container on AWS ECS Fargate
- Realtime video sync, chat, and reactions through API Gateway WebSocket and Lambda
- User authentication through Amazon Cognito
- Application data stored in DynamoDB

## High-Level Architecture

```text
Browser
  -> Vercel Next.js frontend
  -> ECS Fargate REST API through Application Load Balancer
  -> DynamoDB + Cognito

Browser
  -> API Gateway WebSocket
  -> Lambda authorizer/router
  -> DynamoDB
```

## Deployment Flow

```text
Local Docker build
  -> Amazon ECR
  -> ECS Fargate task definition
  -> ECS service
  -> Application Load Balancer
  -> Vercel frontend connects to backend URL
```

## Services Used

## Vercel

Purpose:

- Hosts the Next.js frontend application from `apps/web`.
- Provides the public production domain for users.

Configured:

- Production deployment for `watch-party-web`.
- Environment variables for API, Cognito, and WebSocket URLs.
- Redeploy after changing environment variables.

Important environment variables:

```env
NEXT_PUBLIC_API_BASE_URL=http://watchparty-api-alb-1431246635.eu-central-1.elb.amazonaws.com
NEXT_PUBLIC_WS_URL=wss://w0sq12hywh.execute-api.eu-central-1.amazonaws.com/<stage>
NEXT_PUBLIC_COGNITO_USER_POOL_ID=eu-central-1_6ohxnBvfL
NEXT_PUBLIC_COGNITO_CLIENT_ID=<cognito-app-client-id>
NEXT_PUBLIC_COGNITO_DOMAIN=<cognito-domain>
NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_IN=https://watch-party-web.vercel.app/auth/callback
NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_OUT=https://watch-party-web.vercel.app/auth/login
WS_TICKET_SECRET=<same-secret-as-lambda-authorizer>
WS_TICKET_TTL_SECONDS=300
```

## Amazon ECR

Purpose:

- Stores the Docker image for the backend API.
- ECS pulls the backend image from this registry.

Configured:

- Repository: `watchparty-api`
- Pushed Docker image: `watchparty-api:latest`

Image URI:

```text
758626605511.dkr.ecr.eu-central-1.amazonaws.com/watchparty-api:latest
```

## Amazon ECS + AWS Fargate

Purpose:

- Runs the NestJS backend API as a managed container.
- Fargate removes the need to manage EC2 servers manually.

Configured:

- Cluster: `watchparty-cluster`
- Task definition: `watchparty-api`
- Service: `watchparty-api-service`
- Container port: `3001`
- Docker image from Amazon ECR
- Backend environment variables
- Service connected to an Application Load Balancer

Key backend variables:

```env
PORT=3001
AWS_REGION=eu-central-1
ROOMS_REPOSITORY_DRIVER=dynamodb
DDB_USERS_TABLE=users
DDB_ROOMS_TABLE=rooms
DDB_ROOM_MEMBERS_TABLE=room-members
DDB_INVITES_TABLE=invites
DDB_CHAT_MESSAGES_TABLE=chat-messages
DDB_WS_CONNECTIONS_TABLE=websocket-connections
DDB_PLAYBACK_SNAPSHOTS_TABLE=playback-snapshots
DDB_REACTION_EVENTS_TABLE=reaction-events
DDB_SCHEDULED_PARTIES_TABLE=scheduled-parties
DDB_IDEMPOTENCY_EVENTS_TABLE=idempotency-events
COGNITO_USER_POOL_ID=eu-central-1_6ohxnBvfL
COGNITO_APP_CLIENT_ID=<cognito-app-client-id>
COGNITO_ISSUER=https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_6ohxnBvfL
COGNITO_HOSTED_UI_DOMAIN=<cognito-domain>
```

## Application Load Balancer

Purpose:

- Provides a public HTTP endpoint for the ECS backend service.
- Routes incoming traffic to healthy ECS tasks.

Configured:

- Load balancer: `watchparty-api-alb`
- Type: Application Load Balancer
- Scheme: Internet-facing
- Listener: `HTTP:80`
- Target group: `watchparty-api-tg`
- Target type: IP
- Backend target port: `3001`
- Health check path: `/`

Public backend URL:

```text
http://watchparty-api-alb-1431246635.eu-central-1.elb.amazonaws.com
```

## VPC And Security Groups

Purpose:

- Controls network access between the internet, load balancer, and ECS tasks.

Configured:

- ALB security group: `watchparty-api-alb-sg`
- ECS task security group: `watchparty-api-task-sg`

ALB security group:

```text
Inbound:  HTTP 80 from 0.0.0.0/0
Outbound: All traffic to 0.0.0.0/0
```

ECS task security group:

```text
Inbound:  Custom TCP 3001 from watchparty-api-alb-sg
Outbound: All traffic to 0.0.0.0/0
```

This fixed the `504 Gateway Time-out` issue because the load balancer could finally reach the ECS task.

## IAM

Purpose:

- Gives AWS services permission to perform required actions securely.

Configured:

- ECS service-linked role: `AWSServiceRoleForECS`
- ECS task execution role: `watchparty-ecs-task-execution-role`
- ECS task role: `watchparty-api-task-role`

Task execution role responsibilities:

- Pull Docker images from ECR.
- Write container logs to CloudWatch.

Task role responsibilities:

- Allow the backend API to access DynamoDB tables.

## CloudWatch

Purpose:

- Stores logs from backend containers and Lambda functions.
- Used for debugging deployment and runtime issues.

Configured:

- ECS log group: `/ecs/watchparty-api`
- Lambda logs for:
  - `watchparty-ws-authorizer`
  - `watchparty-ws-router`

Useful for debugging:

- Missing environment variables
- Backend startup errors
- WebSocket authorization errors
- Runtime exceptions

## DynamoDB

Purpose:

- Main database layer for WatchParty.
- Stores users, rooms, memberships, messages, reactions, invites, and playback sync state.

Tables used:

- `users`
- `rooms`
- `room-members`
- `invites`
- `chat-messages`
- `websocket-connections`
- `playback-snapshots`
- `reaction-events`
- `scheduled-parties`
- `idempotency-events`

Used by:

- ECS backend API
- WebSocket Lambda router

## Amazon Cognito

Purpose:

- Provides authentication and user management.
- Handles sign-in, sign-out, and access tokens.

Configured:

- User pool: `WatchParty`
- User pool ID: `eu-central-1_6ohxnBvfL`
- App client for the frontend
- Hosted UI callback and sign-out URLs

Production URLs added:

```text
https://watch-party-web.vercel.app/auth/callback
https://watch-party-web.vercel.app/auth/login
```

Local development URLs kept:

```text
http://localhost:3000/auth/callback
http://localhost:3000/auth/login
```

## API Gateway WebSocket

Purpose:

- Provides realtime communication for rooms.
- Used for playback sync, chat, reactions, and presence.

Configured:

- WebSocket API: `watchparty-ws`
- Route selection expression: `$request.body.action`

Routes:

- `$connect`
- `$disconnect`
- `$default`
- `joinRoom`
- `leaveRoom`
- `syncPlayback`
- `getPlaybackSnapshot`
- `chatMessage`
- `reaction`
- `ping`

Frontend connects through:

```env
NEXT_PUBLIC_WS_URL=wss://w0sq12hywh.execute-api.eu-central-1.amazonaws.com/<stage>
```

## AWS Lambda

Purpose:

- Handles WebSocket authorization and realtime event routing.

Functions:

- `watchparty-ws-authorizer`
- `watchparty-ws-router`

Authorizer responsibility:

- Validates short-lived WebSocket tickets.
- Uses the same `WS_TICKET_SECRET` as Vercel.

Router responsibility:

- Handles room joins/leaves.
- Broadcasts playback sync events.
- Broadcasts chat messages.
- Broadcasts reactions.
- Persists connection and playback state in DynamoDB.

## Final Result

The deployed WatchParty application consists of:

- Vercel-hosted frontend
- ECS-hosted backend API
- ALB public backend URL
- Cognito authentication
- DynamoDB persistence
- API Gateway WebSocket realtime layer
- Lambda-based WebSocket authorizer and router

## Key Lessons

- ECR stores backend Docker images, but ECS actually runs them.
- ECS Fargate needs task definitions, services, IAM roles, and networking.
- Application Load Balancer exposes the backend publicly.
- Security groups are critical: ALB receives public traffic, ECS task receives only ALB traffic.
- Vercel environment variables must be updated in the dashboard and redeployed.
- Cognito callback URLs must match the deployed frontend domain.
- WebSocket secrets must match between Vercel and Lambda.

## Presentation Slide Outline

1. Project Deployment Goal
   - Deploy WatchParty as a production-like cloud app.
   - Frontend on Vercel, backend and realtime services on AWS.

2. Frontend Hosting
   - Vercel hosts the Next.js frontend.
   - Environment variables connect frontend to backend, Cognito, and WebSocket API.

3. Backend Containerization
   - NestJS API was packaged as a Docker image.
   - Image was pushed to Amazon ECR.

4. Backend Runtime
   - ECS Fargate runs the backend container.
   - Task definition describes image, port, environment, CPU, memory, and IAM roles.

5. Public Backend Access
   - Application Load Balancer exposes the ECS service.
   - Target group forwards traffic to container port `3001`.

6. Security And Networking
   - ALB security group allows public HTTP traffic.
   - ECS task security group allows port `3001` only from the ALB.

7. Authentication
   - Cognito manages user authentication.
   - Callback URLs were updated for the Vercel production domain.

8. Database Layer
   - DynamoDB stores users, rooms, members, messages, reactions, and playback snapshots.

9. Realtime Layer
   - API Gateway WebSocket handles live room events.
   - Lambda authorizer validates tickets.
   - Lambda router processes sync, chat, and reaction events.

10. Final Architecture
    - Browser -> Vercel -> ECS API -> DynamoDB/Cognito
    - Browser -> API Gateway WebSocket -> Lambda -> DynamoDB

