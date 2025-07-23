# Multi-stage build for optimized production image
FROM node:24.4-slim AS builder

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --ignore-scripts && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:24.4-slim AS production

# Install security updates, curl for health checks, and build tools for native modules
RUN apt-get update && apt-get install -y curl python3 make g++ && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home jobdorker

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies (disable prepare scripts to avoid Husky)
RUN npm ci --omit=dev --ignore-scripts && \
    npm rebuild better-sqlite3 && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=jobdorker:nodejs /app/dist ./dist

# Copy migration files (needed at runtime)
COPY --chown=jobdorker:nodejs src/database/migrations/*.sql ./src/database/migrations/

# Copy necessary config files
COPY --chown=jobdorker:nodejs .env.example .env

# Create directories for data and reports
RUN mkdir -p data reports && chown -R jobdorker:nodejs data reports

# Switch to non-root user
USER jobdorker

# Expose port for web server
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start the web server
CMD ["node", "dist/web/cli.js", "start", "--host", "0.0.0.0", "--port", "3001"]
