import express, { Request, Response, NextFunction } from 'express';
import { getPassport, authStrategies } from '../passport';
import * as db from '../../db';
import { User } from '../../db/types';

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

router.post(
  '/login',
  passport.authenticate(authStrategies['local'].type),
  async (req: Request, res: Response) => {
    try {
      const currentUser = { ...req.user } as User;
      delete (currentUser as any).password;

      console.log(
        `service.routes.auth.login: user logged in, username=${currentUser.username}, profile=${JSON.stringify(
          currentUser
        )}`
      );

      res.send({ message: 'success', user: currentUser });
    } catch (e) {
      console.error(`service.routes.auth.login: Error logging user in`, e);
      res.status(500).send('Failed to login').end();
    }
  }
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

router.get('/success', (req: Request, res: Response) => {
  console.log('authenticated', JSON.stringify(req.user));
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

router.get('/failed', (_req: Request, res: Response) => {
  res.status(401).json({
    success: false,
    message: 'user failed to authenticate.',
  });
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
      let login =
        req.body.username == null || req.body.username === 'undefined'
          ? req.body.id
          : req.body.username;

      login = login.split('@')[0];

      const user = await db.findUser(login);
      console.log('Adding gitAccount:', req.body.gitAccount);

      user.gitAccount = req.body.gitAccount;
      await db.updateUser(user);
      res.status(200).end();
    } catch {
      res.status(500).send({ message: 'An error occurred' }).end();
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
