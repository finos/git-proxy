import express, { Request, Response } from 'express';
import * as db from '../../db';
import { PushQuery } from '../../db/types';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  const query: Partial<PushQuery> = {
    type: 'push',
  };

  for (const k in req.query) {
    if (!k) continue;

    if (k === 'limit') continue;
    if (k === 'skip') continue;
    let v = req.query[k];
    if (v === 'false') v = false as any;
    if (v === 'true') v = true as any;
    query[k as keyof PushQuery] = v as any;
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
  if (req.user) {
    const id = req.params.id;

    // Get the push request
    const push = await db.getPush(id);

    // Get the committer of the push via their email
    const committerEmail = push?.userEmail;
    const list = await db.getUsers({ email: committerEmail });

    if (list.length === 0) {
      res.status(401).send({
        message: `There was no registered user with the committer's email address: ${committerEmail}`,
      });
      return;
    }

    if (list[0].username.toLowerCase() === (req.user as any).username.toLowerCase() && !list[0].admin) {
      res.status(401).send({
        message: `Cannot reject your own changes`,
      });
      return;
    }

    const isAllowed = await db.canUserApproveRejectPush(id, (req.user as any).username);
    console.log({ isAllowed });

    if (isAllowed) {
      const result = await db.reject(id, null);
      console.log(`user ${(req.user as any).username} rejected push request for ${id}`);
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

router.post('/:id/authorise', async (req: Request, res: Response) => {
  console.log({ req });

  const questions = req.body.params?.attestation;
  console.log({ questions });

  // TODO: compare attestation to configuration and ensure all questions are answered
  // - we shouldn't go on the definition in the request!
  const attestationComplete = questions?.every((question: any) => !!question.checked);
  console.log({ attestationComplete });

  if (req.user && attestationComplete) {
    const id = req.params.id;
    console.log({ id });

    // Get the push request
    const push = await db.getPush(id);
    console.log({ push });

    // Get the committer of the push via their email address
    const committerEmail = push?.userEmail;
    const list = await db.getUsers({ email: committerEmail });
    console.log({ list });

    if (list.length === 0) {
      res.status(401).send({
        message: `There was no registered user with the committer's email address: ${committerEmail}`,
      });
      return;
    }

    if (list[0].username.toLowerCase() === (req.user as any).username.toLowerCase() && !list[0].admin) {
      res.status(401).send({
        message: `Cannot approve your own changes`,
      });
      return;
    }

    // If we are not the author, now check that we are allowed to authorise on this
    // repo
    const isAllowed = await db.canUserApproveRejectPush(id, (req.user as any).username);
    if (isAllowed) {
      console.log(`user ${(req.user as any).username} approved push request for ${id}`);

      const reviewerList = await db.getUsers({ username: (req.user as any).username });
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
          username: (req.user as any).username,
          gitAccount: reviewerGitAccount,
        },
      };
      const result = await db.authorise(id, attestation);
      res.send(result);
    } else {
      res.status(401).send({
        message: `user ${(req.user as any).username} not authorised to approve push's on this project`,
      });
    }
  } else {
    res.status(401).send({
      message: 'You are unauthorized to perform this action...',
    });
  }
});

router.post('/:id/cancel', async (req: Request, res: Response) => {
  if (req.user) {
    const id = req.params.id;

    const isAllowed = await db.canUserCancelPush(id, (req.user as any).username);

    if (isAllowed) {
      const result = await db.cancel(id);
      console.log(`user ${(req.user as any).username} canceled push request for ${id}`);
      res.send(result);
    } else {
      console.log(`user ${(req.user as any).username} not authorised to cancel push request for ${id}`);
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

export default router;
