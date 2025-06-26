import express, { Request, Response } from 'express';

const router = express.Router();

const resource = {
  healthcheck: '/api/v1/healthcheck',
  push: '/api/v1/push',
  auth: '/api/auth',
};

router.get('/', function (req: Request, res: Response) {
  res.send(resource);
});

export default router;
