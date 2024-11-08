# Based on example: 
FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
COPY . /usr/src/app
WORKDIR /usr/src/app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run -r build
RUN pnpm deploy --filter=./apps/processing --prod /prod/processing

FROM base AS processing
COPY --from=build /prod/processing /prod/processing
WORKDIR /prod/processing
CMD [ "pnpm", "start" ]
