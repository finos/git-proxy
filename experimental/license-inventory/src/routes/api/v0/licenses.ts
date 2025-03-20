import express from 'express';
import { z } from 'zod';
import { licenseValidation } from '@/db/schemas/license/license';
import { LicenseDataService } from '@/services/data';

const createRouter = (licenseService: LicenseDataService) => {
  const router = express.Router();

  // CREATE
  const createSchema = z.object({
    body: licenseValidation.strict().omit({ id: true }),
  });
  router.post('/', async (req, res) => {
    // TODO: add auth
    const { error: parseErr, data: parseData } = await createSchema.safeParseAsync(req);
    if (parseErr) {
      req.log.error(parseErr);
      res.status(500).json({ error: 'invalid format' }).end();
      return;
    }
    const { body: submittedLicense } = parseData;
    const { error, data } = await licenseService.create(submittedLicense);
    if (error) {
      req.log.error(error);
      res.status(500).json({ error: 'failed to create' }).end();
      return;
    }
    res.status(201).json(data).end();
  });

  // READ
  const readSchema = z.object({
    params: licenseValidation.pick({ id: true }).strict(),
  });
  router.get('/:id', async (req, res) => {
    const { error: parseErr, data: parseData } = await readSchema.safeParseAsync(req);
    if (parseErr) {
      req.log.error(parseErr);
      res.status(500).json({ error: 'invalid format' }).end();
      return;
    }
    const {
      params: { id },
    } = parseData;

    const { error, data: license } = await licenseService.getByUUID(id);
    if (error) {
      req.log.error(error);
      res.status(500).json({ error: 'failed to read' }).end();
      return;
    }
    res.status(200).json({ license }).end();
  });

  // UPDATE
  const updateSchema = z.object({
    params: licenseValidation.pick({ id: true }).strict(),
    body: licenseValidation.strict().partial().omit({ id: true }),
  });
  router.patch('/:id', async (req, res) => {
    const { error: parseErr, data: parseData } = await updateSchema.safeParseAsync(req);
    if (parseErr) {
      req.log.error(parseErr);
      res.status(500).json({ error: 'invalid format' }).end();
      return;
    }
    const {
      body: licenseData,
      params: { id },
    } = parseData;

    const { error, data } = await licenseService.patchByUUID(id, licenseData);
    if (error) {
      req.log.error(error);
      res.status(500).json({ error: 'failed to update' }).end();
      return;
    }
    res.status(204).json(data).end();
  });

  // DELETE
  const deleteSchema = z.object({
    params: licenseValidation.pick({ id: true }).strict(),
  });
  router.delete('/:id', async (req, res) => {
    const { error: parseErr, data: parseData } = await deleteSchema.safeParseAsync(req);
    if (parseErr) {
      req.log.error(parseErr);
      res.status(500).json({ error: 'invalid format' }).end();
      return;
    }
    const {
      params: { id },
    } = parseData;

    const { error } = await licenseService.deleteByUUID(id);
    if (error) {
      req.log.error(error);
      res.status(500).json({ error: 'failed to delete' }).end();
      return;
    }
    res.status(204).json({ status: 'ok' }).end();
  });

  // LIST
  router.get('/', async (req, res) => {
    const { error, data } = await licenseService.list();
    if (error) {
      req.log.error(error);
      res.status(500).json({ error: 'failed to list' }).end();
      return;
    }
    res.status(200).json(data).end();
  });
  return router;
};

export default createRouter;
