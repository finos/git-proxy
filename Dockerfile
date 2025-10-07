# Build stage
FROM node:20 AS builder

USER root

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for building)
RUN npm pkg delete scripts.prepare && npm ci --include=dev

# Copy source files and config files needed for build
COPY tsconfig.json tsconfig.publish.json proxy.config.json config.schema.json integration-test.config.json vite.config.ts index.html index.ts ./
COPY src/ /app/src/
COPY public/ /app/public/

# Build the UI and server
RUN npm run build-ui \
  && npx tsc --project tsconfig.publish.json \
  && cp config.schema.json dist/

# Prune dev dependencies after build is complete  
RUN npm prune --omit=dev

# Production stage
FROM node:20-slim AS production

RUN apt-get update && apt-get install -y \
    git tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the modified package.json (without prepare script) and production node_modules from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules/ /app/node_modules/

# Copy built artifacts from builder stage
COPY --from=builder /app/dist/ /app/dist/
COPY --from=builder /app/build /app/dist/build/

# Copy configuration files needed at runtime
COPY proxy.config.json config.schema.json ./

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8080 8000

ENTRYPOINT ["tini", "--", "/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
