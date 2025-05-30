const express = require('express');
const router = new express.Router();

const config = require('../../config');

router.get('/attestation', function ({ res }) {
  res.send(config.getAttestationConfig());
});

router.get('/urlShortener', function ({ res }) {
  res.send(config.getURLShortener());
});

router.get('/contactEmail', function ({ res }) {
  res.send(config.getContactEmail());
});

router.get('/uiRouteAuth', function ({ res }) {
  res.send(config.getUIRouteAuth());
});

module.exports = router;
