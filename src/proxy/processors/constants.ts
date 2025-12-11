import { CommitData } from './types';

export const BRANCH_PREFIX = 'refs/heads/';
export const EMPTY_COMMIT_HASH = '0000000000000000000000000000000000000000';
export const FLUSH_PACKET = '0000';
export const PACK_SIGNATURE = 'PACK';
export const PACKET_SIZE = 4;
export const GIT_OBJECT_TYPE_COMMIT = 1;

export const SAMPLE_COMMIT: CommitData = {
  tree: '1234567890',
  parent: '0000000000000000000000000000000000000000',
  author: 'test',
  committer: 'test',
  authorEmail: 'test@test.com',
  committerEmail: 'test@test.com',
  commitTimestamp: '1234567890',
  message: 'test',
};
