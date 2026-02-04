import bcrypt from 'bcryptjs';
import { IVerifyOptions, Strategy as LocalStrategy } from 'passport-local';
import type { PassportStatic } from 'passport';
import * as db from '../../db';

export const type = 'local';

// Dynamic import to always get the current db module instance
// This is necessary for test environments where modules may be reset
const getDb = () => import('../../db');

export const configure = async (passport: PassportStatic): Promise<PassportStatic> => {
  passport.use(
    new LocalStrategy(
      async (
        username: string,
        password: string,
        done: (err: unknown, user?: Partial<db.User>, info?: IVerifyOptions) => void,
      ) => {
        try {
          const dbModule = await getDb();
          const user = await dbModule.findUser(username);
          if (!user) {
            return done(null, undefined, { message: 'Incorrect username.' });
          }

          const passwordCorrect = await bcrypt.compare(password, user.password ?? '');
          if (!passwordCorrect) {
            return done(null, undefined, { message: 'Incorrect password.' });
          }

          return done(null, user);
        } catch (error: unknown) {
          return done(error);
        }
      },
    ),
  );

  passport.serializeUser((user: Partial<db.User>, done) => {
    done(null, user.username);
  });

  passport.deserializeUser(async (username: string, done) => {
    try {
      const dbModule = await getDb();
      const user = await dbModule.findUser(username);
      done(null, user);
    } catch (error: unknown) {
      done(error, null);
    }
  });

  return passport;
};

/**
 * Create the default admin and regular test users.
 */
export const createDefaultAdmin = async () => {
  const createIfNotExists = async (
    username: string,
    password: string,
    email: string,
    type: string,
    isAdmin: boolean,
  ) => {
    const user = await db.findUser(username);
    if (!user) {
      await db.createUser(username, password, email, type, isAdmin);
    }
  };

  await createIfNotExists('admin', 'admin', 'admin@place.com', 'none', true);
  await createIfNotExists('user', 'user', 'user@place.com', 'none', false);
};
