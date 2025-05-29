const express = require('express');
const router = new express.Router();
const db = require('../../db');
const { getProxyURL } = require('../urls');

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
  if (req.user.admin) {
    const _id = req.params.id;

    await db.deleteRepo(_id);
    res.send({ message: 'deleted' });
  } else {
    res.status(401).send({
      message: 'You are not authorised to perform this action...',
    });
  }
});

router.post('/', async (req, res) => {
  if (req.user && req.user.admin) {
    const repo = await db.getRepoByUrl(req.body.url);
    if (repo) {
      res.status(409).send({
        message: `Repository ${req.body.url} already exists!`,
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
