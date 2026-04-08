# syntax=docker/dockerfile:1

# Comments are provided throughout this file to help you get started.
# If you need more help, visit the Dockerfile reference guide at
# https://docs.docker.com/engine/reference/builder/

# Default version; CI overrides with value from .nvmrc via --build-arg
ARG NODE_VERSION=22.21.1
ARG COMMIT_SHA=unknown

################################################################################
# Use node image for base image for all stages.
FROM node:${NODE_VERSION}-alpine AS base

# Set working directory for all build stages.
WORKDIR /usr/src/app


################################################################################
# Create a stage for installing production dependencies.
FROM base AS deps

# Download dependencies as a separate step to take advantage of Docker's caching.
# Leverage a cache mount to /root/.npm to speed up subsequent builds.
# Leverage bind mounts to package.json and package-lock.json to avoid having to copy them
# into this layer.
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts

################################################################################
# Create a stage for building the application.
FROM deps AS build

# Download additional development dependencies before building, as some projects require
# "devDependencies" to be installed to build. If you don't need this, remove this step.
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts

# Copy the rest of the source files into the image.
COPY . .
# Run the build script.
RUN npm run build

################################################################################
# Create a new stage to run the application with minimal runtime dependencies
# where the necessary files are copied from the build stage.
FROM base AS final

ARG COMMIT_SHA=unknown

# Use production node environment by default.
ENV NODE_ENV=production
ENV COMMIT_SHA=${COMMIT_SHA}

# Run the application as a non-root user.
USER node

# Copy package.json so that package manager commands can be used.
COPY package.json .

# Copy .env.example for dotenv-safe.
COPY .env.example .

# Copy helper files.
COPY tsconfig.json .
COPY biome.jsonc .
COPY .editorconfig .

# Copy the production dependencies from the deps stage.
#COPY --from=build /usr/src/app/node_modules ./node_modules
#COPY --from=build /usr/src/app/package-lock.json ./package-lock.json
#COPY --from=build /usr/src/app/tsconfig.tsbuildinfo ./tsconfig.tsbuildinfo
#COPY --from=build /usr/src/app/src ./src
COPY --from=build /usr/src/app .

# Expose the port that the application listens on.
EXPOSE 4000

# Run migrations and start the application.
CMD ["sh", "-c", "npm run db:migrate && npm start"]
