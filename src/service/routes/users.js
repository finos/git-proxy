const express = require('express');
const router = new express.Router();
const db = require('../../db');
const { logger } = require('../../logging/index');

router.get('/', async (req, res) => {
  const query = {};

  logger.info(`fetching users = query path =${JSON.stringify(req.query)}`);
  for (const k in req.query) {
    if (!k) continue;

    if (k === 'limit') continue;
    if (k === 'skip') continue;
    let v = req.query[k];
    if (v === 'false') v = false;
    if (v === 'true') v = true;
    query[k] = v;
  }

  res.send(await db.getUsers(query));
});

router.get('/:id', async (req, res) => {
  const username = req.params.id.toLowerCase();
  logger.info(`Retrieving details for user: ${username}`);
  const data = await db.findUser(username);
  const user = JSON.parse(JSON.stringify(data));
  delete user.password;
  res.send(user);
});

module.exports = router;
