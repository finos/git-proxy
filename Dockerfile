FROM node:18

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --omit=dev --ignore-scripts

COPY src ./src/
COPY resources ./resources/
COPY index.js docker-entrypoint.sh ./

EXPOSE 8080

ENTRYPOINT [ "./docker-entrypoint.sh" ]
