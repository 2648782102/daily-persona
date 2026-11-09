FROM node:24-alpine

ENV NODE_ENV=production \
    DAILY_PERSONA_HOST=0.0.0.0 \
    DAILY_PERSONA_PORT=3399

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY catalog ./catalog
COPY src ./src

USER node
EXPOSE 3399

CMD ["node", "src/http-server.js"]
