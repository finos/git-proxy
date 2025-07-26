const bcrypt = require("bcryptjs");
const LocalStrategy = require("passport-local").Strategy;
const db = require("../../db");

const type = "local";

const configure = async (passport) => {
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await db.findUser(username);
        if (!user) {
          return done(null, false, { message: "Incorrect username." });
        }

        const passwordCorrect = await bcrypt.compare(password, user.password);
        if (!passwordCorrect) {
          return done(null, false, { message: "Incorrect password." });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => {
    done(null, user.username);
  });

  passport.deserializeUser(async (username, done) => {
    try {
      const user = await db.findUser(username);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });

  return passport;
};

/**
 * Create the default admin and regular test users.
 */
const createDefaultAdmin = async () => {
  const createIfNotExists = async (username, password, email, type, isAdmin) => {
    const user = await db.findUser(username);
    if (!user) {
      await db.createUser(username, password, email, type, isAdmin);
    }
  };

  await createIfNotExists('admin', 'admin', 'admin@place.com', 'none', true);
  await createIfNotExists('user', 'user', 'user@place.com', 'none', false);
};

module.exports = { configure, createDefaultAdmin, type };
