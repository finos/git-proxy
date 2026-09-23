/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { CommitData } from './types';

export const BRANCH_PREFIX = 'refs/heads/';
export const EMPTY_COMMIT_HASH = '0000000000000000000000000000000000000000';
// Matches a well-formed Git object ID (40-char lowercase hex).
export const GIT_OBJECT_ID_REGEX = /^[0-9a-f]{40}$/;
export const FLUSH_PACKET = '0000';
export const PACK_SIGNATURE = 'PACK';
export const PACKET_SIZE = 4;
export const GIT_OBJECT_TYPE_COMMIT = 1;

/** Bit mask for the seven bits used in variable length size encodings
 * (size and ofs_delta offset) to encode the value. */
export const SEVEN_BIT_MASK = 0x7f;
/** Bit mask for the continuation bit (8th bit) used in the variable length
 * size encodings (size and ofs_delta offsets) in Git object headers used in
 * PACK files. */
export const EIGHTH_BIT_MASK = 0x80;

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

export const SAMPLE_REPO = {
  project: 'myrepo',
  name: 'myrepo',
  url: 'https://github.com/myrepo.git',
  users: {
    canPush: ['alice'],
    canAuthorise: ['bob'],
  },
};
