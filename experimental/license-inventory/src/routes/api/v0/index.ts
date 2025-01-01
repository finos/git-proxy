import express from 'express';
import licensesRouter from './licenses';
const router = express.Router();

router.use('/licenses', licensesRouter);

export default router;
