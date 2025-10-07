# Build stage
FROM node:20 AS builder

USER root

WORKDIR /app

COPY tsconfig.json tsconfig.publish.json proxy.config.json config.schema.json integration-test.config.json vite.config.ts package*.json index.html index.ts ./
COPY src/ /app/src/
COPY public/ /app/public/

# Build the UI and server
RUN npm pkg delete scripts.prepare \
  && npm ci --include=dev \
  && npm run build-ui -dd \
  && npx tsc --project tsconfig.publish.json \
  && cp config.schema.json dist/ \
  && npm prune --omit=dev

# Production stage
FROM node:20-slim AS production

RUN apt-get update && apt-get install -y \
    git tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules/ /app/node_modules/
COPY --from=builder /app/dist/ /app/dist/
COPY --from=builder /app/build /app/dist/build/
COPY proxy.config.json config.schema.json ./

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8080 8000

ENTRYPOINT ["tini", "--", "/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
