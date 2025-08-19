# Use official Python image with Node installed (or add Node manually)
FROM python:3.11-slim

# Install Node.js and npm (needed for frontend)
RUN apt-get update && apt-get install -y curl gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    apt-get install -y supervisor && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy everything to /app in container
COPY . .

# Copy supervisor config to the right place
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Expose backend and frontend ports
EXPOSE 8000 3000

# Run supervisord
CMD ["/usr/bin/supervisord"]
