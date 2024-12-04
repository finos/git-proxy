import express from 'express';
import { logger } from '@/logger';
import apiRouter from '@/routes/api';
import pinoHTTP from 'pino-http';
import bodyParser from 'body-parser';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
// import lusca from 'lusca';

// helmet and lusca comparison
// https://github.com/krakenjs/lusca/issues/42#issuecomment-65093906
// TODO: integrate lusca once added sessions/auth

const app = express();

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

export { app };
