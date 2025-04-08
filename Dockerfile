# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for backend
COPY package*.json ./

# Install dependencies with correct permissions
RUN mkdir -p /app/node_modules/.cache && \
    chmod -R 777 /app/node_modules/.cache && \
    npm install

# Copy backend source files
COPY . .

# Build backend
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built assets and package files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Set environment variable
ENV NODE_ENV=production

# Expose the port your app runs on
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
