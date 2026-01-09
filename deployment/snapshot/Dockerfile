FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

RUN npm prune --production

EXPOSE 8000 8080
CMD ["npm", "run", "start"]
