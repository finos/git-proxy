import bcrypt from 'bcryptjs';
import { Strategy as LocalStrategy } from 'passport-local';
import type { PassportStatic } from 'passport';
import * as db from '../../db';

export const type = 'local';

export const configure = async (passport: PassportStatic): Promise<PassportStatic> => {
  passport.use(
    new LocalStrategy(
      async (username: string, password: string, done: (err: any, user?: any, info?: any) => void) => {
      try {
        const user = await db.findUser(username);
        if (!user) {
          return done(null, false, { message: 'Incorrect username.' });
        }

        const passwordCorrect = await bcrypt.compare(password, user.password ?? '');
        if (!passwordCorrect) {
          return done(null, false, { message: 'Incorrect password.' });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }),
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.username);
  });

  passport.deserializeUser(async (username: string, done) => {
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
 * Create the default admin user if it doesn't exist
 */
export const createDefaultAdmin = async () => {
  const admin = await db.findUser('admin');
  if (!admin) {
    await db.createUser('admin', 'admin', 'admin@place.com', 'none', true);
  }
};
