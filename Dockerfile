
# Stage 1: Build React App
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production Server
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
# Install production dependencies only (including express)
RUN npm install --production && npm install express dotenv

# Copy built assets from builder
COPY --from=builder /app/dist ./dist
# Copy server script
COPY --from=builder /app/server.js ./

EXPOSE 3000
CMD ["node", "server.js"]
