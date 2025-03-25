import pino from 'pino';
import pinoCaller from 'pino-caller';

const p = pino({
  redact: ['req.headers.host'],
});

export const logger =
  process.env.NODE_ENV === 'development' ? pinoCaller(p, { relativeTo: __dirname }) : p;
