# syntax=docker/dockerfile:1

ARG NODE_VERSION=22.15.1
ARG NEXT_PUBLIC_BACKEND_URL=http://localhost:4000/
ARG APP_ENV=production

FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /usr/src/app

FROM base AS deps
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts

FROM deps AS build
ARG NEXT_PUBLIC_BACKEND_URL
ARG APP_ENV
ENV NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}
ENV APP_ENV=${APP_ENV}

RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts

COPY . .
RUN npm run build

FROM base AS final
ARG NEXT_PUBLIC_BACKEND_URL
ARG APP_ENV

ENV NODE_ENV=production
ENV NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}
ENV APP_ENV=${APP_ENV}
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

USER node

COPY --from=build --chown=node:node /usr/src/app/package.json ./package.json
COPY --from=build --chown=node:node /usr/src/app/package-lock.json ./package-lock.json
COPY --from=build --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --from=build --chown=node:node /usr/src/app/.next ./.next
COPY --from=build --chown=node:node /usr/src/app/public ./public
COPY --from=build --chown=node:node /usr/src/app/next.config.js ./next.config.js

EXPOSE 3000

CMD ["npm", "start"]
