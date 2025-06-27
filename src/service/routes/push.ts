import express, { Request, Response } from 'express';
import * as db from '../../db';
import { AuthenticatedRequest } from './types';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  const query: Record<string, unknown> = { type: 'push' };

  for (const k in req.query) {
    if (!k || k === 'limit' || k === 'skip') continue;
    let v = req.query[k];
    if (v === 'false') v = false as any;
    if (v === 'true') v = true as any;
    query[k] = v;
  }

  res.send(await db.getPushes(query));
});

router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const push = await db.getPush(id);
  if (push) {
    res.send(push);
  } else {
    res.status(404).send({ message: 'not found' });
  }
});

router.post('/:id/reject', async (req: AuthenticatedRequest, res: any) => {
  try {
  if (!req.user) {
    return res.status(401).send({ message: 'not logged in' });
  }

  const { id } = req.params;
  const push = await db.getPush(id);
  const gitAccountAuthor = push.user;
  const users = await db.getUsers({ gitAccount: gitAccountAuthor });

  if (users.length === 0) {
    return res.status(401).send({ message: `The git account ${gitAccountAuthor} could not be found` });
  }

  if (users[0].username.toLowerCase() === req.user.username.toLowerCase() && !users[0].admin) {
    return res.status(401).send({ message: `Cannot reject your own changes` });
  }

  const isAllowed = await db.canUserApproveRejectPush(id, req.user.username);
  if (isAllowed) {
    const result = await db.reject(id);
    return res.status(200).send(result);
  } else {
      return res.status(401).send({ message: 'User is not authorised to reject changes' });
    }
  } catch (error) {
    console.error('Error rejecting push:', error);
    return res.status(500).send({ message: 'Internal server error' });
  }
});

router.post('/:id/authorise', async (req: AuthenticatedRequest, res: any) => {
  const questions = req.body.params?.attestation;

  const attestationComplete = Array.isArray(questions)
    ? questions.every((q) => !!q.checked)
    : false;

  if (!req.user || !attestationComplete) {
    return res.status(401).send({ message: 'You are unauthorized to perform this action...' });
  }

  const { id } = req.params;
  const push = await db.getPush(id);
  const gitAccountAuthor = push.user;
  const users = await db.getUsers({ gitAccount: gitAccountAuthor });

  if (users.length === 0) {
    return res.status(401).send({ message: `The git account ${gitAccountAuthor} could not be found` });
  }

  if (users[0].username.toLowerCase() === req.user.username.toLowerCase() && !users[0].admin) {
    return res.status(401).send({ message: `Cannot approve your own changes` });
  }

  const isAllowed = await db.canUserApproveRejectPush(id, req.user.username);
  if (!isAllowed) {
    return res.status(401).send({
      message: `user ${req.user.username} not authorised to approve push's on this project`,
    });
  }

  const reviewerList = await db.getUsers({ username: req.user.username });
  const reviewerGitAccount = reviewerList[0].gitAccount;

  if (!reviewerGitAccount) {
    return res.status(401).send({
      message: 'You must associate a GitHub account with your user before approving...',
    });
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
});

router.post('/:id/cancel', async (req: AuthenticatedRequest, res: any) => {
  if (!req.user) {
    return res.status(401).send({ message: 'not logged in' });
  }

  const { id } = req.params;
  const isAllowed = await db.canUserCancelPush(id, req.user.username);

  if (isAllowed) {
    const result = await db.cancel(id);
    res.send(result);
  } else {
    res.status(401).send({
      message: `User ${req.user.username} not authorised to cancel push requests on this project.`,
    });
  }
});

export default router;
