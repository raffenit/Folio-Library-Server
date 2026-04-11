# Multi-stage build for Folio PWA
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the PWA
RUN npm run build:pwa

# Production stage - Node.js with proxy
FROM node:20-alpine

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy Node.js server
COPY server.js /app/server.js

WORKDIR /app

# Expose port
EXPOSE 80

CMD ["node", "server.js"]
