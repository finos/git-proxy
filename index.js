const proxy = require('express-http-proxy');
const app = require('express')();
const port = 8080;

app.use('/', proxy('https://github.com', {
  filter: function(req, res) {
    console.log('hello');
    return req.method === 'GET';
  },
}));

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`));
