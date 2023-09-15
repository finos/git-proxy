# Use an official Node.js runtime as a parent image
FROM node:16-slim AS build

# Set the working directory to /app
WORKDIR /app

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Install project dependencies
RUN npm ci --omit=dev --ignore-scripts

# Copy the rest of the application code to the container
COPY --from=build /app/node_modules/ node_modules/
COPY . .

# Expose the port that your application listens on
EXPOSE 8000

EXPOSE 8080

# Define the command to run your application
CMD ["node", "index.js"]
