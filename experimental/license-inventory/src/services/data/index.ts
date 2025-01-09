import type { AsyncResult } from '@/types';
import type { License, LicenseNoID, LicenseNoIDPartial } from './license';

export interface LicenseDataService {
  create: (licenseData: LicenseNoID) => AsyncResult<License>;

  getByUUID: (id: string) => AsyncResult<License | null>;

  patchByUUID: (id: string, licenseData: LicenseNoIDPartial) => AsyncResult<License>;

  deleteByUUID: (id: string) => AsyncResult<null>;

  // TODO: consider pagination
  list: () => AsyncResult<License[]>;
}

export interface DataService {
  licenses: LicenseDataService;
}
