/* eslint-disable max-len */
const express = require('express');
const router = new express.Router();
const db = require('../../db');
const emailSender = require('../emailSender');
const os = require('os');
const hostname = os.hostname();

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

    const isAllowed = await db.canUserApproveRejectPush(id, req.user.username);
    if (isAllowed) {
      const result = await db.reject(id);
      sendEmailNotification(id, 'REJECT');
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
  if (req.user) {
    const id = req.params.id;

    // Get the push request
    const push = await db.getPush(id);

    // Get the Internal Author of the push via their Git Account name
    const gitAccountauthor = push.user;
    const list = await db.getUsers({'gitAccount': gitAccountauthor});

    if (list.length === 0) {
      res.status(500).send(
        {
          message: `The git account ${gitAccountauthor} could not be found`,
        });
    }

    if (list[0].username.toLowerCase() === req.user.username.toLowerCase()) {
      res.status(500).send(
        {
          message: `Cannot approve your own changes`,
        });
    }

    // If we are not the author, now check that we are allowed to authorise on this
    // repo
    const isAllowed = await db.canUserApproveRejectPush(id, req.user.username);
    if (isAllowed) {
      console.log(`user ${req.user.username} approved push request for ${id}`);
      const result = await db.authorise(id);
      sendEmailNotification(id, 'APPROVE');
      res.send(result);
    } else {
        res.status(401).send({
        message: `user ${userName} not authorised to approve push's on this project`,
      });
    }
  } else {
    res.status(401).send({
      message: 'User is not logged in',
    });
  }
});

router.post('/:id/cancel', async (req, res) => {
  if (req.user) {
    const id = req.params.id;

    const isAllowed = await db.canUserCanclePush(id, req.user.username);

    if (isAllowed) {
      const result = await db.cancel(id);
      console.log(`user ${req.user.username} canceled push request for ${id}`);
      sendEmailNotification(id, 'CANCEL');
      res.send(result);
    } else {
      console.log(`user ${req.user.username} not authorised to cancel push request for ${id}`);
      res.status(401).send({
        message: 'User ${req.user.username)} not authorised to cancel push requests on this project.',
      });
    }
  } else {
    res.status(401).send({
      message: 'not logged in',
    });
  }
});

const sendEmailNotification = async (id, type) => {
  const push = await db.getPush(id);
  if ( push == null) {
    return;
  }

  const toAddress = await getPushUserEmail(push.user);
  const emailBody = getEmailBody(type, id);
  emailSender.sendEmail(toAddress, `GITProxy:Push Request ${type}`, emailBody);
};

const getPushUserEmail = async (userName) => {
  const userVal = await db.findUser(userName);
  if ( userVal == null) {
    return;
  }
  console.log(`User: ${userVal.username} Email: ${userVal.email}`);
  return userVal.email;
};

const getEmailBody = (type, id) => {
  let emailBody = '';

  if (type == 'REJECT') {
    emailBody = emailBody + `<p>Push Request is Rejected.</p>`;
  } else if (type == 'CANCEL') {
    emailBody = emailBody + `<p>Push Request is Cancelled.</p>`;
  } else if (type == 'APPROVE') {
    emailBody = emailBody + `<p>Push Request is Approved.</p>`;
  }
  emailBody = emailBody + `</p> <p>Tracking Id: ${id}</p>`;

  emailBody = emailBody + `<p>Link: <a href="http://${hostname}/requests/${id}">http://${hostname}/requests/${id}</a></p>`;

  if (type == 'APPROVE') {
    emailBody = emailBody +
      '<p>Request you to execute push (git push)' +
      'on approval to commit code into repository.</p>.';
  }
  emailBody = emailBody + `<p>Thank you,</p><p>Git Proxy Team.</p>`;
  return emailBody;
};

module.exports = router;

