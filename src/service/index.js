const express = require('express');
const session = require('express-session');
const cors = require('cors')
const routes = require('./routes');
const passport = require('passport')
const Strategy = require('passport-local').Strategy;
const db = require('../db');
const app = express();
const port = 8080;

passport.use(new Strategy(
  function(username, password, cb) {
    console.log(`verifying user=${username}`);
    db.findByUsername(username, function(err, user) {
      if (err) { 
        return cb(err); 
      }
      if (!user) {
        return cb(null, false); 
      }
      if (user.password != password) { 
        return cb(null, false); 
      }
      return cb(null, user);
    });
  }));

passport.serializeUser(function(user, cb) {
  cb(null, user.id);
});

passport.deserializeUser(function(id, cb) {
  db.findById(id, function (err, user) {
    if (err) { return cb(err); }
    cb(null, user);
  });
});



// Setup the service middleware
app.use(cors());
app.use(session({ secret: 'keyboard cat', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.use('/', routes);




const start = () => { 
  app.listen(port, () => {
    console.log(`Service Listening on ${port}`);
  });
}

module.exports.start = start
