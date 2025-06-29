import { Request } from 'express';
import { User } from '../../db/types';

export interface AuthenticatedRequest extends Request {
  user: User;
}
