const express = require('express');
const router = new express.Router();
const passport = require('../passport').getPassport();
const db = require('../../db');
const passportType = passport.type;
const generator = require('generate-password');
const passwordHash = require('password-hash');


router.post('/login', passport.authenticate(passportType), async (req, res) => {
  if (req.user.admin == undefined) {
    res.status(403).send({'message': 'not part of any group'});
  } else {
    let userName = req.user._json.givenName;

    if (req.user._json.mail != null) {
      userName = req.user._json.mail.split('@')[0];
    }

    userName = userName.toUpperCase();
    let isAdmin = req.user.adminGroup;

    if (req.user.adminGroup == null) {
      isAdmin = false;
    }

    await db.updateUser(
      {
        admin: isAdmin,
        username: userName,
        email: req.user._json.mail,
      });

    try {
      const userVal = await db.findUser(userName);

      if (userVal.gitAccount == undefined || userVal.gitAccount == '') {
        res.status(307).send({message: 'no git account'});
        return;
      }
    } catch (e) {
      res.status(500).send(e).end();
      return;
    }
    res.send({
      message: 'success',
      user: req.user,
    });
  }
});

router.get('/', (req, res) => {
  res.status(200).json(
    {
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

router.post('/logout', (req, res) => {
  req.logout();
  res.send({
    message: 'logged out',
  });
});


router.get('/profile', async (req, res) => {
  if (req.user) {
    const user = JSON.parse(JSON.stringify(req.user));
    delete user.password;
    let login = req.user.id;
    login = login.split('@')[0].toUpperCase();
    const userVal = await db.findUser(login);
    if (userVal != undefined) {
      if (userVal.gitAccount = undefined) {
        user.gitAccount = '';
      } else if (userVal.gitAccount != null && userVal.gitAccount != '') {
        user.gitAccount = userVal.gitAccount;
      }
    }
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

router.post('/gitAccount', async (req, res) => {
  if (req.user) {
    try {
      let login = req.body.username == null ||
        req.body.username == 'undefined' ?
        req.body.id : req.body.username;

      login = login.split('@')[0];

      const user = await db.findUser(login);

      console.log('Adding gitAccount' + req.body.gitAccount);
      user.gitAccount = req.body.gitAccount;
      db.updateUser(user);
      res.status(200).end();
    } catch (e) {
      res.status(500).send(e).end();
    }
  } else {
    res.status(401).end();
  }
});

router.get('/userLoggedIn', async (req, res) => {
  if (req.user) {
    const user = JSON.parse(JSON.stringify(req.user));
    delete user.password;
    let login = req.user.id;
    login = login.split('@')[0];
    const userVal = await db.findUser(login);
    res.send(userVal);
  } else {
    res.status(401).end();
  }
});
module.exports = router;
