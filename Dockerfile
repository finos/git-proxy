FROM node:24@sha256:5a593d74b632d1c6f816457477b6819760e13624455d587eef0fa418c8d0777b AS builder

USER root

WORKDIR /out

COPY package*.json ./
COPY tsconfig.json tsconfig.publish.json proxy.config.json config.schema.json test-e2e.proxy.config.json vite.config.ts index.html index.ts ./

RUN npm pkg delete scripts.prepare && npm ci --include=dev

COPY src/ /out/src/
COPY public/ /out/public/

RUN npm run build-ui \
  && npx tsc --project tsconfig.publish.json \
  && cp config.schema.json dist/ \
  && npm prune --omit=dev

FROM node:24@sha256:5a593d74b632d1c6f816457477b6819760e13624455d587eef0fa418c8d0777b AS production

WORKDIR /app

# Install deps and create data dirs once
RUN apt-get update && apt-get install -y --no-install-recommends git tini \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/.data /app/.tmp /app/.remote \
    && chown 1000:1000 /app /app/.data /app/.tmp /app/.remote

COPY --chown=1000:1000 --from=builder /out/package*.json ./
COPY --chown=1000:1000 --from=builder /out/node_modules/ ./node_modules/
COPY --chown=1000:1000 --from=builder /out/dist/ ./dist/
COPY --chown=1000:1000 --from=builder /out/build ./dist/build/
COPY --chown=1000:1000 proxy.config.json config.schema.json ./
COPY docker-entrypoint.sh /docker-entrypoint.sh


USER 1000

EXPOSE 8080 8000 8444

ENTRYPOINT ["tini", "--", "/docker-entrypoint.sh"]
CMD ["node", "--enable-source-maps", "dist/index.js"]
