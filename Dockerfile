# Use an official Node.js runtime as a parent image
FROM node:16-slim AS build

# Set the working directory to /app
WORKDIR /app

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Install project dependencies
# Use `npm install` instead of `npm ci` to include dev dependencies
RUN npm install

# Copy the rest of the application code to the container
COPY . .

# We don't need to expose ports in the build stage; it's for documentation
# EXPOSE 8000
# EXPOSE 8080

# We should define an environment variable for your Node.js app
# It's a good practice to specify a non-root user for security reasons
ENV NODE_ENV=production
USER node

# Define the command to run your application
CMD ["node", "index.js"]
