import { describe, expect, it } from '@jest/globals';
import { License } from '@/db/collections';
import { licenseValidation } from './license';
import { v4 as uuidv4 } from 'uuid';

// these tests require a mongodb instance
const describeDB = process.env.MONGO_URI?.startsWith('mongodb') ? describe : describe.skip;

describeDB('license', () => {
  it('can insert a basic license', async () => {
    const _id = uuidv4();
    await License.create({
      _id,
      name: 'hello',
    });

    const insertedLicense = await License.findOne({ _id: _id });
    expect(insertedLicense).not.toBeNull();
    expect(insertedLicense.name).toBe('hello');
  });

  it('can insert a complex license', async () => {
    const _id = uuidv4();
    await License.create({
      _id,
      name: 'complex',
      spdxID: 'sample',
      chooseALicenseInfo: {
        permissions: {
          commercialUse: true,
        },
        conditions: {
          networkUseDisclose: false,
        },
      },
    });

    const insertedLicense = await License.findOne({ _id: _id });
    expect(insertedLicense).not.toBeNull();
    expect(insertedLicense.name).toBe('complex');
    expect(insertedLicense.chooseALicenseInfo.permissions.commercialUse).toBe(true);
  });

  it('complex license conforms to output validation', async () => {
    const _id = uuidv4();
    await License.create({
      _id,
      name: 'complex2',
      spdxID: 'sample2',
      chooseALicenseInfo: {
        permissions: {
          commercialUse: true,
        },
        conditions: {
          networkUseDisclose: false,
        },
      },
    });

    const insertedLicense = await (await License.findOne({ _id }).exec()).toJSON();
    const { error, data } = licenseValidation.safeParse(insertedLicense);
    expect(error).toBeUndefined();
    expect(data.id).toBe(_id);
    expect(!Object.keys(data).includes('_id'));
  });
});
