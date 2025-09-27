const express = require('express');
const router = new express.Router();
const db = require('../../db');
const { toPublicUser } = require('./publicApi');

router.get('/', async (req, res) => {
  console.log(`fetching users`);
  const users = await db.getUsers({});
  res.send(users.map(toPublicUser));
});

router.get('/:id', async (req, res) => {
  const username = req.params.id.toLowerCase();
  console.log(`Retrieving details for user: ${username}`);
  const user = await db.findUser(username);
  res.send(toPublicUser(user));
});

module.exports = router;
