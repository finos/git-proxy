import express from 'express';
import v0Router from './v0';
const router = express.Router();

router.use('/v0', v0Router);

export default router;
