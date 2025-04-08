# Build stage
FROM node:20-alpine AS builder

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

WORKDIR /app

# Copy necessary files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Clean install production dependencies
RUN npm ci --only=production && \
    rm -rf /app/node_modules/.cache

# Set environment variable
ENV NODE_ENV=production

# Expose the port your app runs on
EXPOSE 3000

# Start the application in production mode
CMD ["node", "dist/index.js"]
