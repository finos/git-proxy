import express from 'express';
import { License } from '@/db/collections';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { licenseValidation } from '@/db/schemas/license/license';
import { trace } from '@opentelemetry/api';

const router = express.Router();

// CREATE
const createSchema = z.object({
  body: licenseValidation.strict().omit({ id: true }),
});
router.post('/', async (req, res) => {
  // TODO: add auth
  const { error, data } = await createSchema.safeParseAsync(req);
  if (error) {
    req.log.error(error);
    res.status(500).json({ error: 'invalid format' }).end();
    return;
  }
  const { body: submittedLicense } = data;
  if (submittedLicense.spdxID) {
    const spdxMatch = await License.findOne({ spdxID: data.body.spdxID }).exec();
    // already exists
    if (spdxMatch !== null) {
      res.status(500).json({ error: 'license with SPDX ID already exists' }).end();
      return;
    }
  }
  const _id = uuidv4();
  await License.create({
    _id,
    ...submittedLicense,
  });
  res.status(200).json({ created: _id }).end();
});

// READ
const readSchema = z.object({
  params: licenseValidation.pick({ id: true }).strict(),
});
router.get('/:id', async (req, res) => {
  const { error, data } = await readSchema.safeParseAsync(req);
  if (error) {
    req.log.error(error);
    res.status(500).json({ error: 'invalid format' }).end();
    return;
  }
  const {
    params: { id },
  } = data;
  const license = await (await License.findOne({ _id: id }).exec()).toJSON();
  res.status(200).json({ license }).end();
});

// UPDATE
const updateSchema = z.object({
  params: licenseValidation.pick({ id: true }).strict(),
  body: licenseValidation.strict().partial().omit({ id: true }),
});
router.patch('/:id', async (req, res) => {
  const { error, data } = await updateSchema.safeParseAsync(req);
  if (error) {
    req.log.error(error);
    res.status(500).json({ error: 'invalid format' }).end();
    return;
  }
  const {
    body: updateLicense,
    params: { id },
  } = data;
  await License.findOneAndUpdate({ _id: id }, updateLicense);
  res.status(204).json({ status: 'ok' }).end();
});

// DELETE
const deleteSchema = z.object({
  params: licenseValidation.pick({ id: true }).strict(),
});
router.delete('/:id', async (req, res) => {
  const { error, data } = await deleteSchema.safeParseAsync(req);
  if (error) {
    req.log.error(error);
    res.status(500).json({ error: 'invalid format' }).end();
    return;
  }
  const {
    params: { id },
  } = data;
  await License.deleteOne({ _id: id }).exec();
  res.status(204).json({ status: 'ok' }).end();
});

// LIST
router.get('/', async (req, res) => {
  const tracer = trace.getTracer('licenses-list');
  // TODO: pagination
  const results = await License.find().exec();
  const jsonifyResultsSpan = tracer.startSpan('jsonify-results');
  const jsonResults = await Promise.allSettled(results.map(async (doc) => doc.toJSON()));
  const jsonOutput = jsonResults
    .filter(<T>(r: PromiseSettledResult<T>): r is PromiseFulfilledResult<T> => {
      if (r.status === 'rejected') {
        res.log.warn('failed to convert an object', r.reason);
        return false;
      }
      return true;
    })
    .map((r) => r.value);
  jsonifyResultsSpan.end();
  res.status(200).json(jsonOutput).end();
});

export default router;
