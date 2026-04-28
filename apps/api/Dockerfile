# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@10.15.1 --activate

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS build

COPY turbo.json ./
COPY apps/api apps/api
COPY packages/shared-types packages/shared-types

RUN pnpm --filter api build

FROM base AS prod-deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json

RUN pnpm install --prod --frozen-lockfile

FROM node:22-alpine AS runner

ENV NODE_ENV=production
ENV PORT=3001

WORKDIR /app/apps/api

COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=prod-deps /app/apps/api/node_modules /app/apps/api/node_modules
COPY --from=build /app/packages/shared-types /app/packages/shared-types
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/package.json ./package.json

EXPOSE 3001

CMD ["node", "dist/main.js"]
