import express, { Request, Response, NextFunction } from 'express';
import { getPassport, authStrategies } from '../passport';
import { getAuthMethods } from '../../config';

import * as db from '../../db';
import * as passportLocal from '../passport/local';
import * as passportAD from '../passport/activeDirectory';

import { User } from '../../db/types';
import { AuthenticationElement } from '../../config/generated/config';

import { isAdminUser, toPublicUser } from './utils';

const router = express.Router();
const passport = getPassport();

const { GIT_PROXY_UI_HOST: uiHost = 'http://localhost', GIT_PROXY_UI_PORT: uiPort = 3000 } =
  process.env;

router.get('/', (_req: Request, res: Response) => {
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

// login strategies that will work with /login e.g. take username and password
const appropriateLoginStrategies = [passportLocal.type, passportAD.type];
// getLoginStrategy fetches the enabled auth methods and identifies if there's an appropriate
// auth method for username and password login. If there isn't it returns null, if there is it
// returns the first.
const getLoginStrategy = () => {
  // returns only enabled auth methods
  // returns at least one enabled auth method
  const enabledAppropriateLoginStrategies = getAuthMethods().filter((am: AuthenticationElement) =>
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

const loginSuccessHandler = () => async (req: Request, res: Response) => {
  try {
    const currentUser = toPublicUser({ ...req.user } as User);
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
  }
};

router.get('/config', (req, res) => {
  const usernamePasswordMethod = getLoginStrategy();
  res.send({
    // enabled username /password auth method
    usernamePasswordMethod: usernamePasswordMethod,
    // other enabled auth methods
    otherMethods: getAuthMethods()
      .map((am) => am.type.toLowerCase())
      .filter((authType) => authType !== usernamePasswordMethod),
  });
});

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
  loginSuccessHandler(),
);

router.get('/openidconnect', passport.authenticate(authStrategies['openidconnect'].type));

router.get('/openidconnect/callback', (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate(authStrategies['openidconnect'].type, (err: any, user: any, info: any) => {
    if (err) {
      console.error('Authentication error:', err);
      return res.status(500).end();
    }
    if (!user) {
      console.error('No user found:', info);
      return res.status(401).end();
    }
    req.logIn(user, (err) => {
      if (err) {
        console.error('Login error:', err);
        return res.status(500).end();
      }
      console.log('Logged in successfully. User:', user);
      return res.redirect(`${uiHost}:${uiPort}/dashboard/profile`);
    });
  })(req, res, next);
});

router.post('/logout', (req: Request, res: Response, next: NextFunction) => {
  req.logout((err: any) => {
    if (err) return next(err);
  });
  res.clearCookie('connect.sid');
  res.send({ isAuth: req.isAuthenticated(), user: req.user });
});

router.get('/profile', async (req: Request, res: Response) => {
  if (!req.user) {
    res
      .status(401)
      .send({
        message: 'Not logged in',
      })
      .end();
    return;
  }

  const userVal = await db.findUser((req.user as User).username);
  if (!userVal) {
    res.status(404).send({ message: 'User not found' }).end();
    return;
  }

  res.send(toPublicUser(userVal));
});

router.post('/gitAccount', async (req: Request, res: Response) => {
  if (!req.user) {
    res
      .status(401)
      .send({
        message: 'Not logged in',
      })
      .end();
    return;
  }

  try {
    let username =
      req.body.username == null || req.body.username === 'undefined'
        ? req.body.id
        : req.body.username;
    username = username?.split('@')[0];

    if (!username) {
      res
        .status(400)
        .send({
          message: 'Missing username. Git account not updated',
        })
        .end();
      return;
    }

    const reqUser = await db.findUser((req.user as User).username);
    if (username !== reqUser?.username && !reqUser?.admin) {
      res
        .status(403)
        .send({
          message: 'Must be an admin to update a different account',
        })
        .end();
      return;
    }

    const user = await db.findUser(username);
    if (!user) {
      res
        .status(404)
        .send({
          message: 'User not found',
        })
        .end();
      return;
    }

    user.gitAccount = req.body.gitAccount;
    db.updateUser(user);
    res.status(200).end();
  } catch (e: any) {
    res
      .status(500)
      .send({
        message: `Failed to update git account: ${e.message}`,
      })
      .end();
  }
});

router.post('/create-user', async (req: Request, res: Response) => {
  if (!isAdminUser(req.user)) {
    res
      .status(403)
      .send({
        message: 'Not authorized to create users',
      })
      .end();
    return;
  }

  try {
    const { username, password, email, gitAccount, admin: isAdmin = false } = req.body;

    if (!username || !password || !email || !gitAccount) {
      res
        .status(400)
        .send({
          message:
            'Missing required fields: username, password, email, and gitAccount are required',
        })
        .end();
      return;
    }

    await db.createUser(username, password, email, gitAccount, isAdmin);
    res
      .status(201)
      .send({
        message: 'User created successfully',
        username,
      })
      .end();
  } catch (error: any) {
    console.error('Error creating user:', error);
    res.status(500).send({
      message: error.message || 'Failed to create user',
    });
  }
});

export default { router, loginSuccessHandler };
