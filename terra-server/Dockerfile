# Base Node image (Debian based for better native module compatibility)
FROM node:18

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (will use prebuilt binaries for better-sqlite3)
RUN npm install

# Copy source code
COPY . .

# Create directory for database persistence
RUN mkdir -p db

# Expose port
EXPOSE 3001

# Start the server
CMD ["npm", "start"]
