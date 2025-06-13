import * as users from './users';
import * as repo from './repo';
import * as pushes from './pushes';

export const {
  getPushes,
  writeAudit,
  getPush,
  deletePush,
  authorise,
  cancel,
  reject,
  canUserCancelPush,
  canUserApproveRejectPush,
} = pushes;

export const {
  getRepos,
  getRepo,
  createRepo,
  addUserCanPush,
  addUserCanAuthorise,
  removeUserCanPush,
  removeUserCanAuthorise,
  deleteRepo,
  isUserPushAllowed,
  canUserApproveRejectPushRepo,
} = repo;

export const { findUser, findUserByOIDC, getUsers, createUser, deleteUser, updateUser } = users;
