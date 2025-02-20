FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g corepack
RUN corepack enable
COPY . /app
WORKDIR /app

RUN --mount=type=cache,id=pnpm,target=$PNPM_HOME/store pnpm install --frozen-lockfile
RUN pnpm envio codegen

CMD pnpm envio local db-migrate up && pnpm envio start