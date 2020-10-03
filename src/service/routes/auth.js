const express = require('express');
const router = express.Router();
const passport = require('passport');

router.get('/login', (req, res) => {
  res.send({
    message: 'login page!',
  })
});

router.post('/login', passport.authenticate('local', { failureRedirect: '/login' }), (req, res) => {
  res.send({
    message: 'ok',
  })
});
  
router.post('/logout', (req, res) => {
  req.logout();  
});

router.get('/profile', require('connect-ensure-login').ensureLoggedIn(), (req, res) => {
  res.send(req.user);
});

module.exports = router;
