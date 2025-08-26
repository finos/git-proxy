import * as users from './users';
import * as repo from './repo';
import * as pushes from './pushes';

export const { getPushes, writeAudit, getPush, deletePush, authorise, cancel, reject } = pushes;

export const {
  getRepos,
  getRepo,
  getRepoByUrl,
  getRepoById,
  createRepo,
  addUserCanPush,
  addUserCanAuthorise,
  removeUserCanPush,
  removeUserCanAuthorise,
  deleteRepo,
} = repo;

export const {
  findUser,
  findUserByEmail,
  findUserByOIDC,
  getUsers,
  createUser,
  deleteUser,
  updateUser,
} = users;
