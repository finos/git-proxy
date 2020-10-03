const path = require('path');
const express = require('express');
const session = require('express-session');
const cors = require('cors')
const routes = require('./routes');
const passport = require('./passport').configure();
const app = express();
const port = 8080;

// Setup the service middleware
app.use(cors());
app.use(session({ secret: 'keyboard cat', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());
app.use('/', routes);

app.use(express.static(path.join(__dirname, 'build')))

app.get('/ping', (req, res) => {
  return res.send('pong')
})

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'))
})

const start = () => { 
  app.listen(port, () => {
    console.log(`Service Listening on ${port}`);
  });
}

module.exports.start = start
