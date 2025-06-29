import ActiveDirectoryStrategy from 'passport-activedirectory';
import { PassportStatic } from 'passport';
import * as ldaphelper from './ldaphelper';
import * as db from '../../db';
import { getAuthMethods } from '../../config';

export const type = 'activedirectory';

export const configure = async (passport: PassportStatic): Promise<PassportStatic> => {
  const authMethods = getAuthMethods();
  const config = authMethods.find((method) => method.type.toLowerCase() === type);

  if (!config || !config.adConfig) {
    throw new Error('AD authentication method not enabled');
  }

  const adConfig = config.adConfig;

  if (!adConfig) {
    throw new Error('Invalid Active Directory configuration');
  }

  // Handle legacy config
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

          console.log(
            `passport.activeDirectory: resolved login ${
              profile._json.userPrincipalName
            }, profile=${JSON.stringify(profile)}`,
          );
          // First check to see if the user is in the AD user group
          try {
            const isUser = await ldaphelper.isUserInAdGroup(req, profile, ad, domain, userGroup);
            if (!isUser) {
              const message = `User it not a member of ${userGroup}`;
              return done(message, null);
            }
          } catch (err: any) {
            const message = `An error occurred while checking if the user is a member of the user group: ${JSON.stringify(err)}`;
            return done(message, null);
          }
        
          // Now check if the user is an admin
          let isAdmin = false;
          try {
            isAdmin = await ldaphelper.isUserInAdGroup(req, profile, ad, domain, adminGroup);

          } catch (err: any) {
            const message = `An error occurred while checking if the user is a member of the admin group: ${JSON.stringify(err)}`;
            console.error(message, err); // don't return an error for this case as you may still be a user
          }

          profile.admin = isAdmin;
          console.log(`passport.activeDirectory: ${profile.username} admin=${isAdmin}`);

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
