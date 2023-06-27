const express = require('express');
const router = new express.Router();
const passport = require('../passport').getPassport();
const db = require('../../db');
const passportType = passport.type;
const generator = require('generate-password');
const passwordHash = require('password-hash');

router.post('/login', passport.authenticate(passportType), (req, res) => {
  res.send({
    message: 'success',
  });
});

router.get('/', (req, res) => {
  res.status(200).json(
      {
        login: {
          action: 'post',
          uri: 'auth/login',
        },
        profile: {
          action: 'get',
          uri: 'auth/profile',
        },
        logout: {
          action: 'post',
          uri: 'auth/logout',
        },
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

router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) { return next(err); }
    res.redirect('/');
  });
});


router.get('/profile', (req, res) => {
  if (req.user) {
    const user = JSON.parse(JSON.stringify(req.user));
    delete user.password;
    res.send(user);
  } else {
    res.status(401).end();
  }
});

router.post('/profile', async (req, res) => {
  if (req.user) {
    try {
      const password = generator.generate({
        length: 10,
        numbers: true,
      });

      console.log(JSON.stringify(req.body));

      const newUser = await db.createUser(
          req.body.username,
          password,
          req.body.email,
          req.body.gitAccount,
          req.body.admin);

      res.send(newUser);
    } catch (e) {
      console.log(e);
      res.status(500).send({
        message: e.message,
      }).end();
    }
  } else {
    res.status(401).end();
  }
});

router.post('/password', async (req, res) => {
  if (req.user) {
    try {
      const user = await db.findUser(req.user.username);

      if (passwordHash.verify(req.body.oldPassword, user.password)) {
        user.password = passwordHash.generate(req.body.newPassword);
        user.changePassword = false;
        db.updateUser(user);
        res.status(200).end();
      } else {
        throw new Error('current password did not match the given');
      }
    } catch (e) {
      res.status(500).send(e).end();
    }
  } else {
    res.status(401).end();
  }
});

module.exports = router;
