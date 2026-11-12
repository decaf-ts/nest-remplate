ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /app

COPY package*.json .npmrc tsconfig*.json nest-cli.json ./
# the npm token is only needed for private registries; an empty secret is fine for public packages
RUN --mount=type=secret,id=TOKEN NPM_TOKEN="$(cat /run/secrets/TOKEN 2>/dev/null || true)" npm ci --ignore-scripts && npm cache clean --force

COPY ./src ./src
RUN npm run build && npm prune --omit=dev

FROM node:${NODE_VERSION}-alpine AS production

ENV NODE_ENV="production" \
    PORT=3000

WORKDIR /app

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/lib ./lib
COPY --from=builder --chown=node:node /app/package.json ./package.json

USER node

EXPOSE 3000

ENTRYPOINT ["node", "lib/main.js"]

LABEL name="Decaf Nest Template" description="decaf-ts NestJS backend: model APIs, Keycloak auth and live events"
