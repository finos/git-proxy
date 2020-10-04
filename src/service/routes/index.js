const express = require('express');
const auth = require('./auth');
const pushes = require('./git-push');
const home = require('./home');
const healthcheck = require('./healthcheck');
const router = express.Router();

router.use('/', home);
router.use('/auth', auth);
router.use('/api/v1/healthcheck', healthcheck);
router.use('/api/v1/push', pushes);

module.exports = router;
