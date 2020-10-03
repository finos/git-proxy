const express = require('express');
const router = express.Router();

const resource = {
  healthcheck: '/api/v1/healhcheck',
  push: '/api/v1/push',
  auth: '/api/v1/auth'
}

router.get('/', function(req, res) {  
  res.send(resource);
})

module.exports = router;
