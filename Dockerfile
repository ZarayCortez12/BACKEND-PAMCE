FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY src ./src

EXPOSE 4000

CMD ["npm", "start"]