FROM node:20-slim
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy root workspace files first
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json tsconfig.build.json tsconfig.json ./

# Copy the package's files
COPY scripts/hasura scripts/hasura/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Set working directory to the hasura package
WORKDIR /app/scripts/hasura

# Build the project
RUN pnpm build

# Run the configure script
CMD ["pnpm", "api:configure"] 