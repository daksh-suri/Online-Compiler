FROM node:20-alpine

RUN apk add --no-cache g++ python3

WORKDIR /app

COPY package.json .
RUN npm install

COPY . .

EXPOSE 4444

CMD ["node", "app.js"]