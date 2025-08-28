import passport, { PassportStatic } from 'passport';
import * as local from './local';
import * as activeDirectory from './activeDirectory';
import * as oidc from './oidc';
import * as config from '../../config';
import { Authentication } from '../../config/types';

type StrategyModule = {
  configure: (passport: PassportStatic) => Promise<PassportStatic>;
  createDefaultAdmin?: () => Promise<void>;
  type: string;
};

export const authStrategies: Record<string, StrategyModule> = {
  local,
  activedirectory: activeDirectory,
  openidconnect: oidc,
};

export const configure = async (): Promise<PassportStatic> => {
  passport.initialize();

  const authMethods: Authentication[] = config.getAuthMethods();

  for (const auth of authMethods) {
    const strategy = authStrategies[auth.type.toLowerCase()];
    if (strategy && typeof strategy.configure === 'function') {
      await strategy.configure(passport);
    }
  }

  if (authMethods.some((auth) => auth.type.toLowerCase() === 'local')) {
    await local.createDefaultAdmin?.();
  }

  return passport;
};

export const getPassport = (): PassportStatic => passport;
