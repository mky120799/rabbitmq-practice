FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm install

FROM dependencies AS build
WORKDIR /app
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./

CMD ["node", "dist/api.js"]
