import express, { Request, Response, NextFunction } from 'express';
import { getPassport, authStrategies } from '../passport';
import { getAuthMethods } from '../../config';

import * as db from '../../db';
import * as passportLocal from '../passport/local';
import * as passportAD from '../passport/activeDirectory';

import { User } from '../../db/types';
import { Authentication } from '../../config/types';

const router = express.Router();
const passport = getPassport();

const {
  GIT_PROXY_UI_HOST: uiHost = 'http://localhost',
  GIT_PROXY_UI_PORT: uiPort = '3000',
} = process.env;

router.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    login: { action: 'post', uri: '/api/auth/login' },
    profile: { action: 'get', uri: '/api/auth/profile' },
    logout: { action: 'post', uri: '/api/auth/logout' },
  });
});

// login strategies that will work with /login e.g. take username and password
const appropriateLoginStrategies = [passportLocal.type, passportAD.type];
// getLoginStrategy fetches the enabled auth methods and identifies if there's an appropriate
// auth method for username and password login. If there isn't it returns null, if there is it
// returns the first.
const getLoginStrategy = () => {
  // returns only enabled auth methods
  // returns at least one enabled auth method
  const enabledAppropriateLoginStrategies = getAuthMethods().filter((am: Authentication) =>
    appropriateLoginStrategies.includes(am.type.toLowerCase()),
  );
  // for where no login strategies which work for /login are enabled
  // just return null
  if (enabledAppropriateLoginStrategies.length === 0) {
    return null;
  }
  // return the first enabled auth method
  return enabledAppropriateLoginStrategies[0].type.toLowerCase();
};

// TODO: provide separate auth endpoints for each auth strategy or chain compatibile auth strategies
// TODO: if providing separate auth methods, inform the frontend so it has relevant UI elements and appropriate client-side behavior
router.post(
  '/login',
  (req: Request, res: Response, next: NextFunction) => {
    const authType = getLoginStrategy();
    if (authType === null) {
      res.status(403).send('Username and Password based Login is not enabled at this time').end();
      return;
    }
    console.log('going to auth with', authType);
    return passport.authenticate(authType)(req, res, next);
  },
  async (req: Request, res: Response) => {
    try {
      const currentUser = { ...req.user } as User;
      delete (currentUser as any).password;
      console.log(
        `serivce.routes.auth.login: user logged in, username=${
          currentUser.username
        } profile=${JSON.stringify(currentUser)}`,
      );
      res.send({
        message: 'success',
        user: currentUser,
      });
    } catch (e: any) {
      console.log(`service.routes.auth.login: Error logging user in ${JSON.stringify(e)}`);
      res.status(500).send('Failed to login').end();
      return;
    }
  },
);

router.get(
  '/oidc',
  passport.authenticate(authStrategies['openidconnect'].type)
);

router.get('/oidc/callback', (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate(authStrategies['openidconnect'].type, (err: any, user: any, info: any) => {
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

router.post('/logout', (req: Request, res: Response, next: NextFunction) => {
  req.logout((err) => {
    if (err) return next(err);
    res.clearCookie('connect.sid');
    res.send({ isAuth: req.isAuthenticated?.(), user: req.user });
  });
});

router.get('/profile', async (req: Request, res: Response) => {
  if (req.user) {
    const userVal = await db.findUser((req.user as User).username);
    delete (userVal as any).password;
    res.send(userVal);
  } else {
    res.status(401).end();
  }
});

router.post('/gitAccount', async (req: Request, res: Response) => {
  if (req.user) {
    try {
      let username: string =
        req.body.username == null || req.body.username === 'undefined'
          ? req.body.id
          : req.body.username;

      username = username.split('@')[0];

      if (!username) {
        res.status(400).send('Error: Missing username. Git account not updated').end();
        return;
      }

      const user = await db.findUser(username);
      console.log('Adding gitAccount:', req.body.gitAccount);

      user.gitAccount = req.body.gitAccount;
      await db.updateUser(user);
      res.status(200).end();
    } catch (e: any) {
      res
        .status(500)
        .send({
          message: `Error updating git account: ${e.message}`,
        })
        .end();
    }
  } else {
    res.status(401).end();
  }
});

router.get('/me', async (req: Request, res: Response) => {
  if (req.user) {
    const user = JSON.parse(JSON.stringify(req.user));
    if (user && user.password) delete user.password;

    const login = user.username;
    const userVal = await db.findUser(login);

    if (userVal?.password) delete userVal.password;
    res.send(userVal);
  } else {
    res.status(401).end();
  }
});

export default router;
