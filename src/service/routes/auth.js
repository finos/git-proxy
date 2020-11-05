const express = require('express');
const router = new express.Router();
const passport = require('../passport').getPassport();
const passportType = passport.type;

console.log(`routes:auth authType = ${passportType}`);

router.post('/login', passport.authenticate(passportType), (req, res) => {
  console.log('logged in!');
  res.send({
    message: 'success',
  });
});

// when login is successful, retrieve user info
router.get('/success', (req, res) => {
  if (req.user) {
    res.json({
      success: true,
      message: 'user has successfully authenticated',
      user: req.user,
      cookies: req.cookies,
    });
  } else {
    res.status(401).end();
  }
});

// when login failed, send failed msg
router.get('failed', (req, res) => {
  res.status(401).json({
    success: false,
    message: 'user failed to authenticate.',
  });
});

router.post('/logout', (req, res) => {
  console.log('logging out');
  req.logout();
  res.send({
    message: 'logged out',
  });
});


router.get('/profile', (req, res) => {
  if (req.user) {
    res.send(req.user);
  }
});

module.exports = router;
