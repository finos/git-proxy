import type { AsyncResult } from '@/types';
import type { License, LicenseCreateUpdate } from './license';

export interface LicenseDataService {
  create: (licenseData: LicenseCreateUpdate) => AsyncResult<null>;

  getByUUID: (id: string) => AsyncResult<License | null>;

  patchByUUID: (id: string, licenseData: LicenseCreateUpdate) => AsyncResult<null>;

  deleteByUUID: (id: string) => AsyncResult<null>;

  // TODO: consider pagination
  list: () => AsyncResult<License[]>;
}

export interface DataService {
  licenses: LicenseDataService;
}
