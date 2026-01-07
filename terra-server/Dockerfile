# Base Node image
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install dependencies needed for sqlite3 build (if necessary)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Create directory for database persistence
RUN mkdir -p db

# Expose port
EXPOSE 3001

# Start the server
CMD ["npm", "start"]
