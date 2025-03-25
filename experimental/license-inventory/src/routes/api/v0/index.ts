import express from 'express';
import createLicensesRouter from './licenses';
import { LicenseDataService } from '@/services/data';

const createRouter = (lds: LicenseDataService) => {
  const router = express.Router();

  router.use('/licenses', createLicensesRouter(lds));
  return router;
};

export default createRouter;
