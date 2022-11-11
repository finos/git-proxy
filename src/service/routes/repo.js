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

    res.send(await db.getRepos(query));
  } else {
    res.status(401).send({
      message: 'not logged in',
    });
  }
});

router.get('/:name', async (req, res) => {
  if (req.user) {
    const name = req.params.name;
    res.send(await db.getRepo(name));
  } else {
    res.status(401).send({
      message: 'not logged in',
    });
  }
});

router.patch('/:name/user/push', async (req, res) => {
  if (req.user) {
    const repoName = req.params.name;
    const username = req.body.username.toLowerCase();
    const user = await db.findUser(username);

    if (!user) {
      res.status(400).send({error: `user ${username} does not exist`});
      return;
    }

    await db.addUserCanPush(repoName, username);
    res.send({message: 'created'});
  } else {
    res.status(401).send({
      message: 'not logged in',
    });
  }
});

router.patch('/:name/user/authorise', async (req, res) => {
  if (req.user) {
    const repoName = req.params.name;
    const username = req.body.username;
    const user = await db.findUser(username);

    if (!user) {
      res.status(400).send({error: `user ${username} does not exist`});
      return;
    }

    await db.addUserCanAuthorise(repoName, username);
    res.send({message: 'created'});
  } else {
    res.status(401).send({
      message: 'not logged in',
    });
  }
});

router.delete('/:name/user/authorise/:username', async (req, res) => {
  if (req.user) {
    const repoName = req.params.name;
    const username = req.params.username;
    const user = await db.findUser(username);

    if (!user) {
      res.status(400).send({error: `user ${username} does not exist`});
      return;
    }

    await db.removeUserCanAuthorise(repoName, username);
    res.send({message: 'created'});
  } else {
    res.status(401).send({
      message: 'not logged in',
    });
  }
});

router.delete('/:name/user/push/:username', async (req, res) => {
  if (req.user) {
    const repoName = req.params.name;
    const username = req.params.username;
    const user = await db.findUser(username);

    if (!user) {
      res.status(400).send({error: `user ${username} does not exist`});
      return;
    }

    await db.removeUserCanPush(repoName, username);
    res.send({message: 'created'});
  } else {
    res.status(401).send({
      message: 'not logged in',
    });
  }
});

router.post('/', async (req, res) => {
  if (req.user) {
    const repo = await db.getRepo(req.body.name);
    if (repo) {
        res.status(409).send({
           message: 'Repository already exists!',
        });
     } else {
        try {
          await db.createRepo(req.body);
          res.send({message: 'created'});
        } catch (e) {
          res.send(e);
        }
      }
   } else {
    res.status(401).send({
      message: 'not logged in',
    });
  }
});

module.exports = router;
