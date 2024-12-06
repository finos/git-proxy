import { logger } from '@/logger';
import { connectDB } from './db/connect';
import env from '@/env';
import { app } from './app';

const port = env.PORT;

const run = async () => {
  logger.info('starting server', { port });
  const dbConnectionRes = connectDB(env.MONGO_URI);

  const { error } = await dbConnectionRes;
  if (error !== null) {
    logger.error(error);
    throw new Error('failed to connect to mongo');
  }

  const running = () => {
    logger.info('started server', { port });
  };
  app.listen(port, running);
};
run();
