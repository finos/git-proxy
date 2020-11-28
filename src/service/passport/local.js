const passwordHash = require('password-hash');

const configure = async () => {
  console.log(`configuring local passport authentication`);
  const passport = require('passport');
  const Strategy = require('passport-local').Strategy;
  const db = require('../../db');

  passport.use(new Strategy(
      (username, password, cb) => {
        console.log(`verifying user=${username}`);
        db.findUser(username).then((user) => {
          console.log(user);
          if (!user) {
            console.log(`could not find user ${username}`);
            return cb(null, false);
          }

          const passwordCorrect = passwordHash.verify(password, user.password);

          if (!passwordCorrect) {
            console.log(`passowrd for ${username} incorrect`);
            return cb(null, false);
          }
          console.log(`found ${user}`);
          return cb(null, user);
        }).catch((err) => {
          console.error(err);
          return cb(err);
        });
      }));

  passport.serializeUser(function(user, cb) {
    cb(null, user.username);
  });

  passport.deserializeUser(function(username, cb) {
    db.findUser(username).then((user) => {
      cb(null, user);
    }).catch((err) => {
      db(err, null);
    });
  });

  const admin = await db.findUser('admin');
  console.log(`trying to find default admin user`);

  if (!admin) {
    console.log(`admin not found, creating default account`);
    const hashedPassword = passwordHash.generate('admin');
    await db.createUser(
        'admin', hashedPassword, 'admin@place.com', true, true, true, true);
  }

  passport.type = 'local';
  return passport;
};

module.exports.configure = configure;
