import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoInstance: MongoMemoryServer | undefined;

export async function setup() {
  const mongoVersion = process.env.MONGODB_VERSION || '8.0.4';

  mongoInstance = await MongoMemoryServer.create({
    binary: {
      version: mongoVersion,
    },
  });
  const uri = mongoInstance.getUri();

  // Set the connection string for tests to use
  process.env.MONGO_URI = uri.slice(0, uri.lastIndexOf('/'));
  process.env.GIT_PROXY_MONGO_CONNECTION_STRING = `${process.env.MONGO_URI}/gitproxy`;

  console.log(`MongoDB Memory Server (v${mongoVersion}) started at ${process.env.MONGO_URI}`);
}

export async function teardown() {
  if (mongoInstance) {
    await mongoInstance.stop();
    console.log('MongoDB Memory Server stopped');
  }
}
