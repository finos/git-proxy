const proxy = require('express-http-proxy');
const fs = require('fs');
const app = require('express')();
const https = require('https');
const httpPort = 3000;
const httpsPort = 3001;

app.use('/', proxy('https://github.com', {
  filter: function(req, res) {
    const message = JSON.stringify(req.headers);
    console.log(message);
  },
}));

app.listen(httpPort, () => {
  console.log(`Listening on ${httpPort}`);
});

https.createServer({
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.cert'),
}, app).listen(httpsPort, function() {
  console.log(`Listening on ${httpsPort}`);
});
