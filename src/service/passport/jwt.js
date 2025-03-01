const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');

const type = "jwt";

const configure = (passport) => {
  const JWT_SECRET = process.env.JWT_SECRET;
  
  if (!JWT_SECRET) {
    console.log('JWT secret not provided. Skipping JWT strategy registration.');
    return; // Skip JWT registration if not configured
  }

  const opts = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: JWT_SECRET,
  };

  passport.use('jwt', new JwtStrategy(opts, (jwtPayload, done) => {
    if (!jwtPayload) return done(null, false);
    return done(null, jwtPayload);
  }));

  console.log('JWT strategy registered successfully.');
};

module.exports = { configure, type };
