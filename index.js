const proxy = require('express-http-proxy');
const fs = require('fs');
const app = require('express')();
const https = require('https');
const port = 8080;


app.use('/', proxy('https://github.com', {
  filter: function(req, res) {
    console.log('hello');
    return req.method === 'GET';
  },
}));


https.createServer({
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.cert'),
}, app).listen(port, function() {
  console.log(`Example app listening on port ${port} Go to https://localhost:${port}/`);
});


