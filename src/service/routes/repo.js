const express = require('express');
const db = require('../../db');
const { getProxyURL } = require('../urls');
const { getAllProxiedHosts } = require('../../proxy/routes/helper');

// create a reference to the proxy service as arrow functions will lose track of the `proxy` parameter
// used to restart the proxy when a new host is added
let theProxy = null;
const repo = (proxy) => {
  theProxy = proxy;
  const router = new express.Router();

  router.get('/', async (req, res) => {
    const proxyURL = getProxyURL(req);
    const query = {};

    for (const k in req.query) {
      if (!k) continue;

      if (k === 'limit') continue;
      if (k === 'skip') continue;
      let v = req.query[k];
      if (v === 'false') v = false;
      if (v === 'true') v = true;
      query[k] = v;
    }

    const qd = await db.getRepos(query);
    res.send(qd.map((d) => ({ ...d, proxyURL })));
  });

  router.get('/:id', async (req, res) => {
    const proxyURL = getProxyURL(req);
    const _id = req.params.id;
    const qd = await db.getRepoById(_id);
    res.send({ ...qd, proxyURL });
  });

  router.patch('/:id/user/push', async (req, res) => {
    if (req.user && req.user.admin) {
      const _id = req.params.id;
      const username = req.body.username.toLowerCase();
      const user = await db.findUser(username);

      if (!user) {
        res.status(400).send({ error: 'User does not exist' });
        return;
      }

      await db.addUserCanPush(_id, username);
      res.send({ message: 'created' });
    } else {
      res.status(401).send({
        message: 'You are not authorised to perform this action...',
      });
    }
  });

  router.patch('/:id/user/authorise', async (req, res) => {
    if (req.user && req.user.admin) {
      const _id = req.params.id;
      const username = req.body.username;
      const user = await db.findUser(username);

      if (!user) {
        res.status(400).send({ error: 'User does not exist' });
        return;
      }

      await db.addUserCanAuthorise(_id, username);
      res.send({ message: 'created' });
    } else {
      res.status(401).send({
        message: 'You are not authorised to perform this action...',
      });
    }
  });

  router.delete('/:id/user/authorise/:username', async (req, res) => {
    if (req.user && req.user.admin) {
      const _id = req.params.id;
      const username = req.params.username;
      const user = await db.findUser(username);

      if (!user) {
        res.status(400).send({ error: 'User does not exist' });
        return;
      }

      await db.removeUserCanAuthorise(_id, username);
      res.send({ message: 'created' });
    } else {
      res.status(401).send({
        message: 'You are not authorised to perform this action...',
      });
    }
  });

  router.delete('/:id/user/push/:username', async (req, res) => {
    if (req.user && req.user.admin) {
      const _id = req.params.id;
      const username = req.params.username;
      const user = await db.findUser(username);

      if (!user) {
        res.status(400).send({ error: 'User does not exist' });
        return;
      }

      await db.removeUserCanPush(_id, username);
      res.send({ message: 'created' });
    } else {
      res.status(401).send({
        message: 'You are not authorised to perform this action...',
      });
    }
  });

  router.delete('/:id/delete', async (req, res) => {
    if (req.user && req.user.admin) {
      const _id = req.params.id;

      // determine if we need to restart the proxy
      const previousHosts = await getAllProxiedHosts();
      await db.deleteRepo(_id);
      const currentHosts = await getAllProxiedHosts();

      if (currentHosts.length < previousHosts.length) {
        // restart the proxy
        console.log('Restarting the proxy to remove a host');
        await theProxy.stop();
        await theProxy.start();
      }

      res.send({ message: 'deleted' });
    } else {
      res.status(401).send({
        message: 'You are not authorised to perform this action...',
      });
    }
  });

  router.post('/', async (req, res) => {
    if (req.user && req.user.admin) {
      if (!req.body.url) {
        res.status(400).send({
          message: 'Repository url is required',
        });
        return;
      }

      const repo = await db.getRepoByUrl(req.body.url);
      if (repo) {
        res.status(409).send({
          message: `Repository ${req.body.url} already exists!`,
        });
      } else {
        try {
          // figure out if this represent a new domain to proxy
          let newOrigin = true;

          const existingHosts = await getAllProxiedHosts();
          existingHosts.forEach((h) => {
            // assume SSL is in use and that our origins are missing the protocol
            if (req.body.url.startsWith(`https://${h}`)) {
              newOrigin = false;
            }
          });

          console.log(
            `API request to proxy repository ${req.body.url} is for a new origin: ${newOrigin},\n\texisting origin list was: ${JSON.stringify(existingHosts)}`,
          );

          // create the repository
          const repoDetails = await db.createRepo(req.body);
          const proxyURL = getProxyURL(req);

          // return data on the new repoistory (including it's _id and the proxyUrl)
          res.send({ ...repoDetails, proxyURL, message: 'created' });

          // restart the proxy if we're proxying a new domain
          if (newOrigin) {
            console.log('Restarting the proxy to handle an additional host');
            await theProxy.stop();
            await theProxy.start();
          }
        } catch (e) {
          console.error('Repository creation failed due to error: ', e.message ? e.message : e);
          console.error(e.stack);
          res.status(500).send({ message: 'Failed to create repository due to error' });
        }
      }
    } else {
      res.status(401).send({
        message: 'You are not authorised to perform this action...',
      });
    }
  });

  return router;
};

module.exports = repo;
