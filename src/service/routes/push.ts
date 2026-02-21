import express, { Request, Response } from 'express';
import * as db from '../../db';
import { PushQuery } from '../../db/types';
import { AttestationConfig } from '../../config/generated/config';
import { getAttestationConfig } from '../../config';
import { AttestationAnswer } from '../../proxy/processors/types';

interface AuthoriseRequest {
  params: {
    attestation: AttestationAnswer[];
  };
}

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

router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
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

router.post('/:id/reject', async (req: Request<{ id: string }>, res: Response) => {
  if (!req.user) {
    res.status(401).send({
      message: 'Not logged in',
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
    res.status(404).send({
      message: `No user found with the committer's email address: ${committerEmail}`,
    });
    return;
  }

  if (list[0].username.toLowerCase() === username.toLowerCase() && !list[0].admin) {
    res.status(403).send({
      message: `Cannot reject your own changes`,
    });
    return;
  }

  const isAllowed = await db.canUserApproveRejectPush(id, username);

  if (isAllowed) {
    const result = await db.reject(id);
    console.log(`User ${username} rejected push request for ${id}`);
    res.send(result);
  } else {
    res.status(403).send({
      message: `User ${username} is not authorised to reject changes on this project`,
    });
  }
});

router.post(
  '/:id/authorise',
  async (req: Request<{ id: string }, unknown, AuthoriseRequest>, res: Response) => {
    if (!req.user) {
      res.status(401).send({
        message: 'Not logged in',
      });
      return;
    }

    const answers = req.body.params?.attestation;

    const attestationComplete = validateAttestation(answers, getAttestationConfig());

    if (!attestationComplete) {
      res.status(400).send({
        message: 'Attestation is not complete',
      });
      return;
    }

    const id = req.params.id;

    const { username } = req.user as { username: string };

    const push = await db.getPush(id);
    if (!push) {
      res.status(404).send({
        message: 'Push request not found',
      });
      return;
    }

    // Get the committer of the push via their email address
    const committerEmail = push.userEmail;

    const list = await db.getUsers({ email: committerEmail });

    if (list.length === 0) {
      res.status(404).send({
        message: `No user found with the committer's email address: ${committerEmail}`,
      });
      return;
    }

    if (list[0].username.toLowerCase() === username.toLowerCase() && !list[0].admin) {
      res.status(403).send({
        message: `Cannot approve your own changes`,
      });
      return;
    }

    // If we are not the author, now check that we are allowed to authorise on this
    // repo
    const isAllowed = await db.canUserApproveRejectPush(id, username);
    if (isAllowed) {
      console.log(`User ${username} approved push request for ${id}`);

      const reviewerList = await db.getUsers({ username });
      const reviewerEmail = reviewerList[0].email;

      if (!reviewerEmail) {
        res.status(404).send({
          message: `There was no registered email address for the reviewer: ${username}`,
        });
        return;
      }

      const attestation = {
        answers,
        timestamp: new Date(),
        reviewer: {
          username,
          email: reviewerEmail,
        },
      };
      const result = await db.authorise(id, attestation);
      res.send(result);
    } else {
      res.status(403).send({
        message: `User ${username} not authorised to approve pushes on this project`,
      });
    }
  },
);

router.post('/:id/cancel', async (req: Request<{ id: string }>, res: Response) => {
  if (!req.user) {
    res.status(401).send({
      message: 'Not logged in',
    });
    return;
  }

  const id = req.params.id;
  const { username } = req.user as { username: string };

  const isAllowed = await db.canUserCancelPush(id, username);

  if (isAllowed) {
    const result = await db.cancel(id);
    console.log(`User ${username} canceled push request for ${id}`);
    res.send(result);
  } else {
    console.log(`User ${username} not authorised to cancel push request for ${id}`);
    res.status(403).send({
      message: `User ${username} not authorised to cancel push requests on this project`,
    });
  }
});

async function getValidPushOrRespond(id: string, res: Response) {
  console.log('getValidPushOrRespond', { id });
  const push = await db.getPush(id);

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

function validateAttestation(answers: AttestationAnswer[], config: AttestationConfig): boolean {
  const configQuestions = config.questions ?? [];

  if (answers.length !== configQuestions.length) {
    return false;
  }

  const configLabels = new Set(configQuestions.map((q) => q.label));

  return answers.every((answer) => configLabels.has(answer.label) && answer.checked === true);
}

export default router;
