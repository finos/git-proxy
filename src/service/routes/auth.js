const express = require('express');
const router = new express.Router();
const passport = require('../passport').getPassport();
const authStrategies = require('../passport').authStrategies;
const db = require('../../db');
const { GIT_PROXY_UI_HOST: uiHost = 'http://localhost', GIT_PROXY_UI_PORT: uiPort = 3000 } = process.env;

router.get('/', (req, res) => {
  res.status(200).json({
    login: {
      action: 'post',
      uri: '/api/auth/login',
    },
    profile: {
      action: 'get',
      uri: '/api/auth/profile',
    },
    logout: {
      action: 'post',
      uri: '/api/auth/logout',
    },
  });
});

router.post('/login', passport.authenticate(authStrategies['local'].type), async (req, res) => {
  try {
    const currentUser = { ...req.user };
    delete currentUser.password;
    console.log(
      `serivce.routes.auth.login: user logged in, username=${
        currentUser.username
      } profile=${JSON.stringify(currentUser)}`,
    );
    res.send({
      message: 'success',
      user: currentUser,
    });
  } catch (e) {
    console.log(`service.routes.auth.login: Error logging user in ${JSON.stringify(e)}`);
    res.status(500).send('Failed to login').end();
    return;
  }
});

router.get('/oidc', passport.authenticate(authStrategies['openidconnect'].type));

router.get('/oidc/callback', (req, res, next) => {
  passport.authenticate(authStrategies['openidconnect'].type, (err, user, info) => {
    if (err) {
      console.error('Authentication error:', err);
      return res.status(401).end();
    }
    if (!user) {
      console.error('No user found:', info);
      return res.status(401).end();
    }
    req.logIn(user, (err) => {
      if (err) {
        console.error('Login error:', err);
        return res.status(401).end();
      }
      console.log('Logged in successfully. User:', user);
      return res.redirect(`${uiHost}:${uiPort}/dashboard/profile`);
    });
  })(req, res, next);
});

// when login is successful, retrieve user info
router.get('/success', (req, res) => {
  console.log('authenticated' + JSON.stringify(req.user));
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
  req.logout(req.user, (err) => {
    if (err) return next(err);
  });
  res.clearCookie('connect.sid');
  res.send({ isAuth: req.isAuthenticated(), user: req.user });
});

router.get('/profile', async (req, res) => {
  if (req.user) {
    const userVal = await db.findUser(req.user.username);
    delete userVal.password;
    res.send(userVal);
  } else {
    res.status(401).end();
  }
});

router.post('/gitAccount', async (req, res) => {
  if (req.user) {
    try {
      let login =
        req.body.username == null || req.body.username == 'undefined'
          ? req.body.id
          : req.body.username;

      login = login.split('@')[0];

      const user = await db.findUser(login);

      console.log('Adding gitAccount' + req.body.gitAccount);
      user.gitAccount = req.body.gitAccount;
      db.updateUser(user);
      res.status(200).end();
    } catch {
      res
        .status(500)
        .send({
          message: 'An error occurred',
        })
        .end();
    }
  } else {
    res.status(401).end();
  }
});

router.get('/me', async (req, res) => {
  if (req.user) {
    const user = JSON.parse(JSON.stringify(req.user));
    if (user && user.password) delete user.password;
    const login = user.username;
    const userVal = await db.findUser(login);
    if (userVal && userVal.password) delete userVal.password;
    res.send(userVal);
  } else {
    res.status(401).end();
  }
});
module.exports = router;
