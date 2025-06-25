import ActiveDirectoryStrategy from 'passport-activedirectory';
import { PassportStatic } from 'passport';
import * as ldaphelper from './ldaphelper';
import * as db from '../../db';
import { getAuthMethods } from '../../config';

export const type = 'activedirectory';

export const configure = async (passport: PassportStatic): Promise<PassportStatic> => {
  const authMethods = getAuthMethods();
  const config = authMethods.find((method) => method.type.toLowerCase() === type);

  if (!config) {
    throw new Error('AD authentication method not enabled');
  }

  const adConfig = config.adConfig;

  if (!adConfig) {
    throw new Error('Invalid Active Directory configuration');
  }

  const userGroup = adConfig.userGroup || config.userGroup;
  const adminGroup = adConfig.adminGroup || config.adminGroup;
  const domain = adConfig.domain || config.domain;

  if (!userGroup || !adminGroup || !domain) {
    throw new Error('Invalid Active Directory configuration');
  }

  console.log(`AD User Group: ${userGroup}, AD Admin Group: ${adminGroup}`);

  passport.use(
    type,
    new ActiveDirectoryStrategy(
      {
        passReqToCallback: true,
        integrated: false,
        ldap: adConfig,
      },
      async function (req: any, profile: any, ad: any, done: (err: any, user: any) => void) {
        try {
          profile.username = profile._json.sAMAccountName?.toLowerCase();
          profile.email = profile._json.mail;
          profile.id = profile.username;
          req.user = profile;

          const isUser = await ldaphelper.isUserInAdGroup(profile.username, domain, userGroup);

          if (!isUser) {
            const message = `User is not a member of ${userGroup}`;
            return done(message, null);
          }

          const isAdmin = await ldaphelper.isUserInAdGroup(profile.username, domain, adminGroup);
          profile.admin = isAdmin;

          const user = {
            username: profile.username,
            admin: isAdmin,
            email: profile._json.mail,
            displayName: profile.displayName,
            title: profile._json.title,
          };

          await db.updateUser(user);

          return done(null, user);
        } catch (err: any) {
          console.log(`Error authenticating AD user: ${err.message}`);
          return done(err, null);
        }
      }
    )
  );

  passport.serializeUser(function (user: any, done: (err: any, user: any) => void) {
    done(null, user);
  });

  passport.deserializeUser(function (user: any, done: (err: any, user: any) => void) {
    done(null, user);
  });

  return passport;
};
