const express = require('express');
const router = new express.Router();
const db = require('../../db');

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
  if (req.user) {
    const id = req.params.id;
    res.send(await db.findUser(id));
  } else {
    res.status(401).send({
      message: 'not logged in',
    });
  }
});


module.exports = router;
