const express = require('express');
const router = new express.Router();
const db = require('../../db');

router.get('/', async (req, res) => {
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

  res.send(await db.getPushes(query));
});

router.get('/:id', async (req, res) => {
  const id = req.params.id;
  res.send(await db.getPush(id));
});

router.post('/:id/reject', async (req, res) => {
  if (req.user) {
    const id = req.params.id;
    console.log({ id });

    // Get the push request
    const push = await db.getPush(id);
    console.log({ push });

    // Get the Internal Author of the push via their Git Account name
    const gitAccountauthor = push.user;
    const list = await db.getUsers({ gitAccount: gitAccountauthor });
    console.log({ list });

    if (list.length === 0) {
      res.status(401).send({
        message: `The git account ${gitAccountauthor} could not be found`,
      });
      return;
    }

    if (list[0].username.toLowerCase() === req.user.username.toLowerCase() && !list[0].admin) {
      res.status(401).send({
        message: `Cannot reject your own changes`,
      });
      return;
    }

    const isAllowed = await db.canUserApproveRejectPush(id, req.user.username);
    console.log({ isAllowed });

    if (isAllowed) {
      const result = await db.reject(id);
      console.log(`user ${req.user.username} rejected push request for ${id}`);
      res.send(result);
    } else {
      res.status(401).send({
        message: 'User is not authorised to reject changes',
      });
    }
  } else {
    res.status(401).send({
      message: 'not logged in',
    });
  }
});

router.post('/:id/authorise', async (req, res) => {
  console.log({ req });

  const questions = req.body.params.attestation;
  console.log({ questions });

  const attestationComplete = questions.every((question) => !!question.checked);
  console.log({ attestationComplete });

  if (req.user && attestationComplete) {
    const id = req.params.id;
    console.log({ id });

    // Get the push request
    const push = await db.getPush(id);
    console.log({ push });

    // Get the Internal Author of the push via their Git Account name
    const gitAccountauthor = push.user;
    const list = await db.getUsers({ gitAccount: gitAccountauthor });
    console.log({ list });

    if (list.length === 0) {
      res.status(401).send({
        message: `The git account ${gitAccountauthor} could not be found`,
      });
      return;
    }

    if (list[0].username.toLowerCase() === req.user.username.toLowerCase() && !list[0].admin) {
      res.status(401).send({
        message: `Cannot approve your own changes`,
      });
      return;
    }

    // If we are not the author, now check that we are allowed to authorise on this
    // repo
    const isAllowed = await db.canUserApproveRejectPush(id, req.user.username);
    if (isAllowed) {
      console.log(`user ${req.user.username} approved push request for ${id}`);

      const reviewerList = await db.getUsers({ username: req.user.username });
      console.log({ reviewerList });

      const reviewerGitAccount = reviewerList[0].gitAccount;
      console.log({ reviewerGitAccount });

      if (!reviewerGitAccount) {
        res.status(401).send({
          message: 'You must associate a GitHub account with your user before approving...',
        });
        return;
      }

      const attestation = {
        questions,
        timestamp: new Date(),
        reviewer: {
          username: req.user.username,
          gitAccount: reviewerGitAccount,
        },
      };
      const result = await db.authorise(id, attestation);
      res.send(result);
    } else {
      res.status(401).send({
        message: `user ${req.user.username} not authorised to approve push's on this project`,
      });
    }
  } else {
    res.status(401).send({
      message: 'You are unauthorized to perform this action...',
    });
  }
});

router.post('/:id/cancel', async (req, res) => {
  if (req.user) {
    const id = req.params.id;

    const isAllowed = await db.canUserCancelPush(id, req.user.username);

    if (isAllowed) {
      const result = await db.cancel(id);
      console.log(`user ${req.user.username} canceled push request for ${id}`);
      res.send(result);
    } else {
      console.log(`user ${req.user.username} not authorised to cancel push request for ${id}`);
      res.status(401).send({
        message:
          'User ${req.user.username)} not authorised to cancel push requests on this project.',
      });
    }
  } else {
    res.status(401).send({
      message: 'not logged in',
    });
  }
});

module.exports = router;
