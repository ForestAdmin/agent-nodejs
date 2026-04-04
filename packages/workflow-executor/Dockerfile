# ---- Build stage ----
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root config files needed for workspace resolution and build
COPY package.json yarn.lock global.d.ts tsconfig.json ./

# Copy all packages (yarn workspaces need the full structure to resolve deps)
COPY packages/ packages/

# Install all dependencies (workspaces)
RUN yarn install --frozen-lockfile

# Build the workflow-executor and its internal dependencies
RUN yarn workspace @forestadmin/forestadmin-client build \
 && yarn workspace @forestadmin/datasource-toolkit build \
 && yarn workspace @forestadmin/agent-client build \
 && yarn workspace @forestadmin/ai-proxy build \
 && yarn workspace @forestadmin/workflow-executor build

# ---- Production stage ----
FROM node:22-alpine

WORKDIR /app

COPY package.json yarn.lock ./
COPY packages/workflow-executor/package.json packages/workflow-executor/
COPY packages/forestadmin-client/package.json packages/forestadmin-client/
COPY packages/datasource-toolkit/package.json packages/datasource-toolkit/
COPY packages/agent-client/package.json packages/agent-client/
COPY packages/ai-proxy/package.json packages/ai-proxy/

RUN yarn install --frozen-lockfile --production

# Copy built artifacts from builder
COPY --from=builder /app/packages/workflow-executor/dist packages/workflow-executor/dist
COPY --from=builder /app/packages/forestadmin-client/dist packages/forestadmin-client/dist
COPY --from=builder /app/packages/datasource-toolkit/dist packages/datasource-toolkit/dist
COPY --from=builder /app/packages/agent-client/dist packages/agent-client/dist
COPY --from=builder /app/packages/ai-proxy/dist packages/ai-proxy/dist

ENV NODE_ENV=production
ENV EXECUTOR_HTTP_PORT=4001

EXPOSE 4001

CMD ["node", "packages/workflow-executor/dist/main.js"]
