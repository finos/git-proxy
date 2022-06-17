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
    let userName = req.user.displayName;

    if (req.user.id) {
      userName = (req.user.id).split('@')[0];
    }

    const isAllowed = await db.canUserApproveRejectPush(id, userName);
    if (isAllowed) {
      const result = await db.reject(id);
      sendEmailNotification(id, 'REJECT');
      res.send(result);
    } else {
      res.status(401).send({
        message: 'User not authorise to Reject.',
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
    let userName = req.user.displayName;

    if (req.user.id) {
      userName = (req.user.id).split('@')[0];
    }

    const isAllowed = await db.canUserApproveRejectPush(id, userName);
    if (isAllowed) {
      const result = await db.authorise(id);
      sendEmailNotification(id, 'APPROVE');
      res.send(result);
    } else {
        res.status(401).send({
        message: 'User not authorise to Approve.',
      });
    }
  } else {
    res.status(401).send({
      message: 'not logged in',
    });
  }
});

router.post('/:id/cancel', async (req, res) => {
  if (req.user) {
    const id = req.params.id;
    let userName = req.user.displayName;

    if (req.user.id) {
      userName = (req.user.id).split('@')[0];
    }

    const isAllowed = await db.canUserCanclePush(id, userName);

    if (isAllowed) {
      const result = await db.cancel(id);
      sendEmailNotification(id, 'CANCEL');
      res.send(result);
    } else {
      res.status(401).send({
        message: 'User not authorise to Cancel.',
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

  emailBody = emailBody + `<p>Link: <a href="http://${hostname}:3000/requests/${id}">http://${hostname}:3000/requests/${id}</a></p>`;

  if (type == 'APPROVE') {
    emailBody = emailBody +
      '<p>Request you to execute push (git push)' +
      'on approval to commit code into repository.</p>.';
  }
  emailBody = emailBody + `<p>Thank you,</p><p>Git Proxy Team.</p>`;
  return emailBody;
};

module.exports = router;

