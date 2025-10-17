import express, { Request, Response } from 'express';
import * as config from '../../config';

const router = express.Router();

router.get('/attestation', (_req: Request, res: Response) => {
  res.send(config.getAttestationConfig());
});

router.get('/urlShortener', (_req: Request, res: Response) => {
  res.send(config.getURLShortener());
});

router.get('/contactEmail', (_req: Request, res: Response) => {
  res.send(config.getContactEmail());
});

router.get('/uiRouteAuth', (_req: Request, res: Response) => {
  res.send(config.getUIRouteAuth());
});

export default router;
