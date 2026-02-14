import { Readable } from 'stream';

declare module 'express-serve-static-core' {
  interface Request {
    bodyRaw?: Buffer;
  }
}
