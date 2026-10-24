FROM node:20-bookworm-slim

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./

# Solo dependencias de producción (nodemon, eslint, etc. no van en la imagen)
RUN npm ci --omit=dev

COPY src ./src

# Los documentos subidos por los participantes viven en un volumen, no en la
# imagen: así no se pierden al recrear el contenedor ni se copian al construirla
RUN mkdir -p /app/src/documentos && chown -R node:node /app/src/documentos
VOLUME ["/app/src/documentos"]

# La clave de Firebase se monta al ejecutar y se indica con
# FIREBASE_CREDENTIALS_PATH (ver .env.example)

USER node

EXPOSE 4000

CMD ["node", "src/index.js"]
