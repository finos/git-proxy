import express from 'express';
import { logger } from '@/logger';
import apiRouter from '@/routes/api';
import pinoHTTP from 'pino-http';
import bodyParser from 'body-parser';
import { connectDB } from './db/connect';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
// import lusca from 'lusca';
import env from '@/env';

// helmet and lusca comparison
// https://github.com/krakenjs/lusca/issues/42#issuecomment-65093906
// TODO: integrate lusca once added sessions/auth

const app = express();
const port = env.PORT;

const run = async () => {
  logger.info('starting server', { port });
  const dbConnectionRes = connectDB(env.MONGO_URI);

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // in memory store
  });

  app.use(helmet());
  app.use(limiter);
  app.use(bodyParser.json());
  app.use(
    pinoHTTP({
      logger,
      autoLogging: process.env.NODE_ENV === 'development',
      // overrides core logger redaction
      // please update in logger.ts
      // redact: [],
    }),
  );

  app.use('/api', apiRouter);

  const { error } = await dbConnectionRes;
  if (error !== null) {
    logger.error(error);
    throw new Error('failed to connect to mongo');
  }

  app.listen(port, () => {
    logger.info('started server', { port });
  });
};
run();
