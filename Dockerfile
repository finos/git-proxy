FROM node:20@sha256:c0280010525e13fdb12f34cdb2229f0f45e9f9cdd4b13c2e9cb8a66b791d65ca AS builder

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

FROM node:20@sha256:c0280010525e13fdb12f34cdb2229f0f45e9f9cdd4b13c2e9cb8a66b791d65ca AS production

COPY --from=builder /out/package*.json ./
COPY --from=builder /out/node_modules/ /app/node_modules/
COPY --from=builder /out/dist/ /app/dist/
COPY --from=builder /out/build /app/dist/build/
COPY proxy.config.json config.schema.json ./
COPY test-e2e.proxy.config.json /app/test-e2e.proxy.config.json
COPY docker-entrypoint.sh /docker-entrypoint.sh

USER root

RUN apt-get update && apt-get install -y \
    git tini \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /app/.data /app/.tmp /app/.remote \
    && chown -R 1000:1000 /app

USER 1000

WORKDIR /app

EXPOSE 8080 8000

ENTRYPOINT ["tini", "--", "/docker-entrypoint.sh"]
CMD ["node", "--enable-source-maps", "dist/index.js"]
