const express = require('express');
const router = new express.Router();
const db = require('../../db');

const toPublicUser = (user) => {
  return {
    username: user.username || '',
    displayName: user.displayName || '',
    email: user.email || '',
    title: user.title || '',
    gitAccount: user.gitAccount || '',
    admin: user.admin || false,
  }
}

router.get('/', async (req, res) => {
  const query = {};

  console.log(`fetching users = query path =${JSON.stringify(req.query)}`);
  for (const k in req.query) {
    if (!k) continue;

    if (k === 'limit') continue;
    if (k === 'skip') continue;
    let v = req.query[k];
    if (v === 'false') v = false;
    if (v === 'true') v = true;
    query[k] = v;
  }

  const users = await db.getUsers(query);
  res.send(users.map(toPublicUser));
});

router.get('/:id', async (req, res) => {
  const username = req.params.id.toLowerCase();
  console.log(`Retrieving details for user: ${username}`);
  const data = await db.findUser(username);
  const user = JSON.parse(JSON.stringify(data));
  res.send(toPublicUser(user));
});

module.exports = router;
