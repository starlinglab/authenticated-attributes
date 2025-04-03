FROM node:22-alpine

WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./

RUN npm install

COPY src ./src
COPY server.js ./

EXPOSE 3001

ENV HYPERBEE_SIGKEY_PATH=/sigkey.pem
ENV HYPERCORE=/server.hypercore

CMD ["node", "server.js"]
