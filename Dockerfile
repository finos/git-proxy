FROM node:18 AS build

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --omit=dev --ignore-scripts

FROM node:18-slim

WORKDIR /usr/src/app

COPY --from=build /usr/src/app/node_modules/ node_modules/
COPY src ./src/
COPY resources ./resources/
COPY index.js docker-entrypoint.sh ./

EXPOSE 8080

ENTRYPOINT [ "./docker-entrypoint.sh" ]
