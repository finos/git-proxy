const express = require('express');
const session = require('express-session');
const cors = require('cors');
const app = express();
const port = 8080;

const corsOptions = {
  origin: 'http://localhost:3000',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  preflightContinue: false,
  credentials: true,
};

const start = async () => {
  // confiugraiton of passport is async
  // Before we can bind the routes - we need the passport
  const passport = await require('./passport').configure();
  const routes = require('./routes');
  app.use(cors(corsOptions));
  app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: false,
  }));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(express.json());
  app.use(express.urlencoded({extended: true}));
  app.use('/', routes);
  app.listen(port, () => {
    console.log(`Service Listening on ${port}`);
  });
};

module.exports.start = start;
