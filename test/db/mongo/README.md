# MongoDB Integration Testing

This directory contains comprehensive integration tests for the MongoDB client implementation in git-proxy.

## Overview

The MongoDB integration tests ensure that:

- All MongoDB client functions work correctly with a real database
- Database operations behave identically between file and MongoDB implementations
- Error handling works properly
- Test coverage is improved from 31.46% to match file DB coverage (91.41%)

## Test Files

- `integration.test.js` - Comprehensive MongoDB integration tests
- `database-comparison.test.js` - Tests comparing file DB vs MongoDB behavior
- `test-config.json` - Configuration for MongoDB testing
- `run-mongo-tests.js` - Test runner for local MongoDB
- `run-mongo-tests-docker.js` - Test runner using Docker

## Running Tests

### Prerequisites

- Node.js and npm installed
- MongoDB instance running (local or Docker)

### Local MongoDB Testing

1. **Start MongoDB locally:**

   ```bash
   # Using MongoDB service
   brew services start mongodb-community

   # Or using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:4.4
   ```

2. **Set environment variable:**

   ```bash
   export GIT_PROXY_MONGO_CONNECTION_STRING="mongodb://localhost:27017/git-proxy-test"
   ```

3. **Run tests:**
   ```bash
   npm run test:mongo
   ```

### Docker-based Testing

1. **Run tests with Docker:**

   ```bash
   npm run test:mongo:docker
   ```

   This will:
   - Start a MongoDB container using `docker-compose.mongo-test.yml`
   - Run the integration tests
   - Stop the container when done

## Test Coverage

The integration tests cover:

### Repository Operations

- Create repository
- Get repository by name, URL, and ID
- Get all repositories
- Add/remove users from canPush and canAuthorise
- Delete repository
- Case-insensitive operations
- Error handling

### User Operations

- Create user
- Find user by username, email, and OIDC
- Get all users
- Update user
- Delete user
- Error handling

### Database Comparison

- Ensures file and MongoDB implementations behave identically
- Tests all major operations in both databases
- Validates error handling consistency

## CI Integration

The tests are integrated into the CI pipeline:

1. MongoDB service starts using `supercharge/mongodb-github-action`
2. Environment variable `GIT_PROXY_MONGO_CONNECTION_STRING` is set
3. Tests run automatically after MongoDB is ready

## Troubleshooting

### Common Issues

1. **MongoDB Connection Failed:**
   - Ensure MongoDB is running
   - Check connection string format
   - Verify network connectivity

2. **Test Timeouts:**
   - Increase timeout in test configuration
   - Check MongoDB performance
   - Ensure proper cleanup between tests

3. **Docker Issues:**
   - Ensure Docker is running
   - Check port 27017 is available
   - Verify Docker Compose file syntax

### Debug Mode

Run tests with debug output:

```bash
DEBUG=* npm run test:mongo
```

## Configuration

The test configuration is managed through:

- `test-config.json` - MongoDB-specific settings
- Environment variables for connection strings
- Docker Compose for containerized testing

## Contributing

When adding new MongoDB client functions:

1. Add corresponding integration tests
2. Add database comparison tests
3. Update this README if needed
4. Ensure tests pass in both local and CI environments
