# Use official Playwright image with Chromium dependencies
FROM mcr.microsoft.com/playwright:v1.41.2-jammy

# Set working directory
WORKDIR /app

# Copy package files first (better Docker caching)
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --only=production

# Copy rest of app
COPY . .

# Optional: ensure proper permissions
RUN chown -R pwuser:pwuser /app
USER pwuser

# Default command
CMD ["node", "worker.js"]