const service = require('express')();
const session = require('express-session');
const cors = require('cors')
const routes = require('./routes');
const passportProvider = require('./passport');
const port = 8080;


// Get thee authentication mechanism
const passport = passportProvider.configure();

// Setup the service middleware
service.use(cors());
service.use(session({ secret: 'keyboard cat', resave: false, saveUninitialized: false }));
service.use(passport.initialize());
service.use(passport.session());
service.use('/', routes);

const start = () => { 
  service.listen(port, () => {
    console.log(`Service Listening on ${port}`);
  });
}

module.exports.start = start
