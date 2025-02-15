import express from 'express';
import createV0Router from './v0';
import { LicenseDataService } from '@/services/data';

const createRouter = (lds: LicenseDataService) => {
  const router = express.Router();

  router.use('/v0', createV0Router(lds));
  return router;
};

export default createRouter;
