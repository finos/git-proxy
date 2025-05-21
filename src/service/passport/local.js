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

  passport.type = 'local';
  return passport;
};

/**
 * Create the default admin user if it doesn't exist
 */
const createDefaultAdmin = async () => {
  const admin = await db.findUser("admin");
  if (!admin) {
    await db.createUser("admin", "admin", "admin@place.com", "none", true);
  }
};

module.exports = { configure, createDefaultAdmin, type };
