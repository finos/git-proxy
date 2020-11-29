const express = require('express');
const auth = require('./auth');
const push = require('./push');
const home = require('./home');
const repo = require('./repo');
const healthcheck = require('./healthcheck');
const router = new express.Router();

router.use('/', home);
router.use('/auth', auth);
router.use('/api/v1/healthcheck', healthcheck);
router.use('/api/v1/push', push);
router.use('/api/v1/repo', repo);

module.exports = router;
