const bcrypt = require('bcrypt');
/* eslint-disable max-len */
const configure = async () => {
  const passport = require('passport');
  const Strategy = require('passport-local').Strategy;
  const db = require('../../db');

  passport.use(
    new Strategy((username, password, cb) => {
      db.findUser(username)
        .then(async (user) => {
          if (!user) {
            return cb(null, false);
          }

          const passwordCorrect = await bcrypt.compare(password, user.password);

          if (!passwordCorrect) {
            return cb(null, false);
          }

          return cb(null, user);
        })
        .catch((err) => {
          return cb(err);
        });
    }),
  );

  passport.serializeUser(function (user, cb) {
    cb(null, user.username);
  });

  passport.deserializeUser(function (username, cb) {
    db.findUser(username)
      .then((user) => {
        cb(null, user);
      })
      .catch((err) => {
        db(err, null);
      });
  });

  const admin = await db.findUser('admin');

  if (!admin) {
    await db.createUser('admin', 'admin', 'admin@place.com', 'none', true, true, true, true);
  }

  passport.type = 'local';
  return passport;
};

module.exports.configure = configure;
