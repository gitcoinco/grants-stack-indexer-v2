FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY . /app
WORKDIR /app

RUN --mount=type=cache,id=pnpm,target=$PNPM_HOME/store pnpm install --frozen-lockfile
RUN pnpm dlx envio codegen

CMD pnpm dlx envio local db-migrate up && pnpm dlx envio start