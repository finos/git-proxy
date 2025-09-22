import express, { Request, Response } from 'express';
import * as db from '../../db';
import { PushQuery } from '../../db/types';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  const query: Partial<PushQuery> = {
    type: 'push',
  };

  for (const key in req.query) {
    if (!key) continue;
    if (key === 'limit' || key === 'skip') continue;

    const rawValue = req.query[key];
    let parsedValue: boolean | undefined;
    if (rawValue === 'false') parsedValue = false;
    if (rawValue === 'true') parsedValue = true;
    query[key] = parsedValue ?? rawValue?.toString();
  }

  res.send(await db.getPushes(query));
});

router.get('/:id', async (req: Request, res: Response) => {
  const id = req.params.id;
  const push = await db.getPush(id);
  if (push) {
    res.send(push);
  } else {
    res.status(404).send({
      message: 'not found',
    });
  }
});

router.post('/:id/reject', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).send({
      message: 'not logged in',
    });
    return;
  }

  const id = req.params.id;
  const { username } = req.user as { username: string };

  // Get the push request
  const push = await getValidPushOrRespond(id, res);
  if (!push) return;

  // Get the committer of the push via their email
  const committerEmail = push.userEmail;
  const list = await db.getUsers({ email: committerEmail });

  if (list.length === 0) {
    res.status(401).send({
      message: `There was no registered user with the committer's email address: ${committerEmail}`,
    });
    return;
  }

  if (list[0].username.toLowerCase() === username.toLowerCase() && !list[0].admin) {
    res.status(401).send({
      message: `Cannot reject your own changes`,
    });
    return;
  }

  const isAllowed = await db.canUserApproveRejectPush(id, username);
  console.log({ isAllowed });

  if (isAllowed) {
    const result = await db.reject(id, null);
    console.log(`user ${username} rejected push request for ${id}`);
    res.send(result);
  } else {
    res.status(401).send({
      message: 'User is not authorised to reject changes',
    });
  }
});

router.post('/:id/authorise', async (req: Request, res: Response) => {
  const questions = req.body.params?.attestation;
  console.log({ questions });

  // TODO: compare attestation to configuration and ensure all questions are answered
  // - we shouldn't go on the definition in the request!
  const attestationComplete = questions?.every(
    (question: { checked: boolean }) => !!question.checked,
  );
  console.log({ attestationComplete });

  if (req.user && attestationComplete) {
    const id = req.params.id;
    console.log({ id });

    const { username } = req.user as { username: string };

    const push = await getValidPushOrRespond(id, res);
    if (!push) return;

    // Get the committer of the push via their email address
    const committerEmail = push.userEmail;
    const list = await db.getUsers({ email: committerEmail });
    console.log({ list });

    if (list.length === 0) {
      res.status(401).send({
        message: `There was no registered user with the committer's email address: ${committerEmail}`,
      });
      return;
    }

    if (list[0].username.toLowerCase() === username.toLowerCase() && !list[0].admin) {
      res.status(401).send({
        message: `Cannot approve your own changes`,
      });
      return;
    }

    // If we are not the author, now check that we are allowed to authorise on this repo
    const isAllowed = await db.canUserApproveRejectPush(id, username);
    if (!isAllowed) {
      res.status(401).send({
        message: 'User is not authorised to authorise changes',
      });
      return;
    }

    console.log(`user ${username} approved push request for ${id}`);

    const reviewerList = await db.getUsers({ username });
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
        username,
        gitAccount: reviewerGitAccount,
      },
    };
    const result = await db.authorise(id, attestation);
    res.send(result);
  } else {
    res.status(401).send({
      message: 'You are unauthorized to perform this action...',
    });
  }
});

router.post('/:id/cancel', async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).send({
      message: 'not logged in',
    });
    return;
  }

  const id = req.params.id;
  const { username } = req.user as { username: string };

  const isAllowed = await db.canUserCancelPush(id, username);

  if (isAllowed) {
    const result = await db.cancel(id);
    console.log(`user ${username} canceled push request for ${id}`);
    res.send(result);
  } else {
    console.log(`user ${username} not authorised to cancel push request for ${id}`);
    res.status(401).send({
      message: 'User ${req.user.username)} not authorised to cancel push requests on this project.',
    });
  }
});

async function getValidPushOrRespond(id: string, res: Response) {
  console.log('getValidPushOrRespond', { id });
  const push = await db.getPush(id);
  console.log({ push });

  if (!push) {
    res.status(404).send({ message: `Push request not found` });
    return null;
  }

  if (!push.userEmail) {
    res.status(400).send({ message: `Push request has no user email` });
    return null;
  }

  return push;
}

export default router;
