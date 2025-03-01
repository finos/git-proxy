const passport = require('./index').getPassport();

/**
 * Dynamic authentication middleware that supports JWT and session auth.
 * If JWT strategy is set up, it will be prioritized. Otherwise, it will fallback to session auth.
 * If either strategy is successful, it calls the next middleware in the chain.
 * @param {*} passport the passport instance
 * @returns a middleware function that handles authentication dynamically
 */
const dynamicAuthHandler = () => {
  return (req, res, next) => {
    console.log(`Dynamic Auth triggered - Requested URL: ${req.originalUrl}`);
    const hasJwtStrategy = !!passport._strategy('jwt');
    console.log('hasJwtStrategy: ' + hasJwtStrategy);
    if (hasJwtStrategy) {
      // Try JWT authentication first
      passport.authenticate('jwt', { session: false }, (err, user, info) => {
        console.log(`JWT Auth triggered - User: ${user} - Error: ${err}`);
        if (err) return next(err);
        if (user) {
          req.user = user; // JWT authenticated user
          return next();
        }
        // Fallback to session if available
        if (req.isAuthenticated && req.isAuthenticated()) return next();
        return res.status(401).json({ message: 'Unauthorized: Valid token or session required.' });
      })(req, res, next);
    } else {
      // Default to session auth
      if (req.isAuthenticated && req.isAuthenticated()) return next();
      return res.status(401).json({ message: 'Unauthorized: No active session.' });
    }
  };
}

module.exports = dynamicAuthHandler;
