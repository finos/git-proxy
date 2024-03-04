const express = require('express');
const router = new express.Router();
const db = require('../../db');
const logger = require('/src/logs/logger');

router.get('/', async (req, res) => {
  if (req.user) {
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

    res.send(await db.getUsers(query));
  } else {
    res.status(401).send({
      message: 'not logged in',
    });
  }
});

router.get('/:id', async (req, res) => {
  const username = req.params.id;
  logger.info(`Retrieving details for user: ${username}`);
  if (!req.user) {
    res.status(401).send({
      message: 'not logged in',
    });
    return;
  }
  if (!req.user.admin) {
    console.error(`Retrieving details for user: ${username} - NOT AUTHORISED`);
    // User is not an admin and forbidden form seeing other user profiles
    res.status(403).end();
    return;
  }
  const data = await db.findUser(username);
  const user = JSON.parse(JSON.stringify(data));
  delete user.password;
  res.send(user);
});

module.exports = router;
