import { LicenseDataService } from '@/services/data';
import { jest } from '@jest/globals';

export const genMockLicenseDataService = (): jest.Mocked<LicenseDataService> => {
  return {
    create: jest.fn(),
    getByUUID: jest.fn(),
    patchByUUID: jest.fn(),
    deleteByUUID: jest.fn(),
    list: jest.fn(),
  };
};
