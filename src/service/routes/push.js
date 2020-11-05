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
      console.log(`${k}==${v}`);
      query[k] = v;
    }

    console.log(query);

    res.send(await db.getPushes(query));
  } else {
    res.status(401).send({
      message: 'not logged in',
    });
  }
});

router.get('/:id', async (req, res) => {
  if (req.user) {
    const id = req.params.id;
    res.send(await db.getPush(id));
  } else {
    res.status(401).send({
      message: 'not logged in',
    });
  }
});

router.post('/:id/reject', async (req, res) => {
  if (req.user) {
    const id = req.params.id;
    const result = await db.reject(id);
    res.send(result);
  } else {
    res.status(401).send({
      message: 'not logged in',
    });
  }
});

router.post('/:id/authorise', async (req, res) => {
  if (req.user) {
    const id = req.params.id;
    const result = await db.authorise(id);
    res.send(result);
  } else {
    res.status(401).send({
      message: 'not logged in',
    });
  }
});

router.post('/:id/cancel', async (req, res) => {
  if (req.user) {
    const id = req.params.id;
    const result = await db.cancel(id);
    res.send(result);
  } else {
    res.status(401).send({
      message: 'not logged in',
    });
  }
});

module.exports = router;
