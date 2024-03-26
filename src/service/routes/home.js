const express = require('express');
const router = new express.Router();

const resource = {
  healthcheck: '/api/v1/healthcheck',
  push: '/api/v1/push',
  auth: '/api/v1/auth',
};

router.get('/', function (req, res) {
  res.send(resource);
});

module.exports = router;
