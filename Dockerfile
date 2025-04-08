# Build stage
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files for backend
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN mkdir -p /app/node_modules/.cache && \
    chmod -R 777 /app/node_modules/.cache && \
    npm install

# Copy backend source files
COPY . .

# Build TypeScript files
RUN npm run check && \
    npm run build

# Production stage
FROM node:20-alpine

# Install Chrome and its dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    nodejs

WORKDIR /app

# Copy necessary files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Clean install production dependencies
RUN npm ci --only=production && \
    rm -rf /app/node_modules/.cache

# Set environment variables
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Expose the port your app runs on
EXPOSE 3000

# Start the application in production mode
CMD ["node", "dist/index.js"]
