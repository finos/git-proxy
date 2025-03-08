const express = require('express');
const router = new express.Router();
const db = require('../../db');
const { getProxyURL } = require('../urls');

router.get('/', async (req, res) => {
  const proxyURL = getProxyURL(req);
  const query = {
    type: 'push',
  };

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

router.get('/:name', async (req, res) => {
  const proxyURL = getProxyURL(req);
  const name = req.params.name;
  const qd = await db.getRepo(name);
  res.send({ ...qd, proxyURL });
});

router.patch('/:name/user/push', async (req, res) => {
  if (req.user && req.user.admin) {
    const repoName = req.params.name;
    const username = req.body.username.toLowerCase();
    const user = await db.findUser(username);

    if (!user) {
      res.status(400).send({ error: 'User does not exist' });
      return;
    }

    await db.addUserCanPush(repoName, username);
    res.send({ message: 'created' });
  } else {
    res.status(401).send({
      message: 'You are not authorised to perform this action...',
    });
  }
});

router.patch('/:name/user/authorise', async (req, res) => {
  if (req.user && req.user.admin) {
    const repoName = req.params.name;
    const username = req.body.username;
    const user = await db.findUser(username);

    if (!user) {
      res.status(400).send({ error: 'User does not exist' });
      return;
    }

    await db.addUserCanAuthorise(repoName, username);
    res.send({ message: 'created' });
  } else {
    res.status(401).send({
      message: 'You are not authorised to perform this action...',
    });
  }
});

router.delete('/:name/user/authorise/:username', async (req, res) => {
  if (req.user && req.user.admin) {
    const repoName = req.params.name;
    const username = req.params.username;
    const user = await db.findUser(username);

    if (!user) {
      res.status(400).send({ error: 'User does not exist' });
      return;
    }

    await db.removeUserCanAuthorise(repoName, username);
    res.send({ message: 'created' });
  } else {
    res.status(401).send({
      message: 'You are not authorised to perform this action...',
    });
  }
});

router.delete('/:name/user/push/:username', async (req, res) => {
  if (req.user && req.user.admin) {
    const repoName = req.params.name;
    const username = req.params.username;
    const user = await db.findUser(username);

    if (!user) {
      res.status(400).send({ error: 'User does not exist' });
      return;
    }

    await db.removeUserCanPush(repoName, username);
    res.send({ message: 'created' });
  } else {
    res.status(401).send({
      message: 'You are not authorised to perform this action...',
    });
  }
});

router.delete('/:name/delete', async (req, res) => {
  if (req.user.admin) {
    const repoName = req.params.name;

    await db.deleteRepo(repoName);
    res.send({ message: 'deleted' });
  } else {
    res.status(401).send({
      message: 'You are not authorised to perform this action...',
    });
  }
});

router.post('/', async (req, res) => {
  if (req.user && req.user.admin) {
    const repo = await db.getRepo(req.body.name);
    if (repo) {
      res.status(409).send({
        message: 'Repository already exists!',
      });
    } else {
      try {
        await db.createRepo(req.body);
        res.send({ message: 'created' });
      } catch {
        res.send('Failed to create repository');
      }
    }
  } else {
    res.status(401).send({
      message: 'You are not authorised to perform this action...',
    });
  }
});

module.exports = router;
