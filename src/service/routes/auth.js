const express = require('express');
const router = express.Router();
const passport = require('passport');


router.post('/login', passport.authenticate('local'), (req, res) => {  
  res.send({
    message: "success"
  })
});


// when login is successful, retrieve user info
router.get("/success", (req, res) => {
  if (req.user) {
    res.json({
      success: true,
      message: "user has successfully authenticated",
      user: req.user,
      cookies: req.cookies
    });
  } else {
    res.status(401).end()
  }
});

// when login failed, send failed msg
router.get("failed", (req, res) => {
  res.status(401).json({
    success: false,
    message: "user failed to authenticate."
  });
});

router.post('/logout', (req, res) => {
  console.log('logging out');
  req.logout();  
  res.send({
    message: 'logged out'
  })
});

router.get('/profile', require('connect-ensure-login').ensureLoggedIn(), (req, res) => {
  res.send(req.user);
});

module.exports = router;
