import type { LicenseDataService } from '@/services/data';
import { type Mocked, vi } from 'vitest';

export const genMockLicenseDataService = (): Mocked<LicenseDataService> => {
  return {
    create: vi.fn(),
    getByUUID: vi.fn(),
    patchByUUID: vi.fn(),
    deleteByUUID: vi.fn(),
    list: vi.fn(),
  };
};
