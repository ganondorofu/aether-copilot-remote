FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 8787
ENV NODE_ENV=production
CMD ["node", "start.js"]
