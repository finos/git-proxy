import { logger } from '@/logger';
import { connectDB } from './db/connect';
import env from '@/env';
import { createApp } from './app';
import { MongooseLicenseDataService } from './services/data/mongoose';
import { Database } from './db';

const port = env.PORT;

const run = async () => {
  logger.info('starting server', { port });

  const { error, data: dbConnection } = await connectDB(env.MONGO_URI);
  if (error !== null) {
    logger.error(error);
    throw new Error('failed to connect to mongo');
  }
  const db = new Database(dbConnection);

  const running = () => {
    logger.info('started server', { port });
  };

  const lds = new MongooseLicenseDataService(db);
  const app = createApp(lds);
  app.listen(port, running);
};
run();
