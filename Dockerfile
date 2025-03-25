FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

ARG ENVIO_ALCHEMY_API_KEY
ENV ENVIO_ALCHEMY_API_KEY=${ENVIO_ALCHEMY_API_KEY}

RUN npm install -g corepack@latest
RUN corepack enable

FROM base AS build
COPY . /usr/src/app
WORKDIR /usr/src/app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run -r build
RUN pnpm deploy --filter=./apps/processing  /prod/processing
RUN pnpm deploy --filter=./scripts/hasura  /prod/hasura-config

FROM base AS processing
COPY --from=build /prod/processing /prod/processing
WORKDIR /prod/processing
CMD ["node", "dist/index.js"]

