import express from 'express';
import auth from './auth';
import push from './push';
import home from './home';
import repo from './repo';
import users from './users';
import healthcheck from './healthcheck';
import config from './config';
import { jwtAuthHandler } from '../passport/jwtAuthHandler';
import Proxy from '../../proxy';

const routes = (proxy: Proxy) => {
  const router = express.Router();
  router.use('/api', home);
  router.use('/api/auth', auth.router);
  router.use('/api/v1/healthcheck', healthcheck);
  router.use('/api/v1/push', jwtAuthHandler(), push);
  router.use('/api/v1/repo', jwtAuthHandler(), repo(proxy));
  router.use('/api/v1/user', jwtAuthHandler(), users);
  router.use('/api/v1/config', config);
  return router;
};

export default routes;
