import { model } from 'mongoose';
import { licenseSchema } from './schemas/license/license';

// licenses collection
export const License = model('License', licenseSchema);
