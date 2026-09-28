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

import { describe, it, expect } from 'vitest';
import { Action, RequestType, buildPushId } from '../../src/proxy/actions/Action';

const REPO_1_URL = 'https://example.com/repo1.git';
const REPO_2_URL = 'https://example.com/repo2.git';
const COMMIT_FROM = 'a'.repeat(40);
const COMMIT_TO = 'b'.repeat(40);
const HEX_64 = /^[0-9a-f]{64}$/;

const makeAction = (url: string): Action =>
  new Action('initial-id', RequestType.PUSH, 'POST', 1234567890, url);

describe('Action', () => {
  describe('push id scoping', () => {
    describe('buildPushId', () => {
      const base = {
        url: REPO_1_URL,
        branch: 'refs/heads/main',
        commitFrom: COMMIT_FROM,
        commitTo: COMMIT_TO,
      };

      it('should return 64 lowercase hex characters', () => {
        expect(buildPushId(base)).toMatch(HEX_64);
      });

      it('should be deterministic', () => {
        expect(buildPushId(base)).toBe(buildPushId({ ...base }));
      });

      it('should differ when the url differs', () => {
        expect(buildPushId(base)).not.toBe(buildPushId({ ...base, url: REPO_2_URL }));
      });

      it('should differ when the branch differs', () => {
        expect(buildPushId(base)).not.toBe(buildPushId({ ...base, branch: 'refs/heads/spike' }));
      });

      it('should differ when the branch is absent', () => {
        expect(buildPushId(base)).not.toBe(buildPushId({ ...base, branch: undefined }));
      });

      it('should differ when commitFrom differs', () => {
        expect(buildPushId(base)).not.toBe(buildPushId({ ...base, commitFrom: 'c'.repeat(40) }));
      });

      it('should differ when commitTo differs', () => {
        expect(buildPushId(base)).not.toBe(buildPushId({ ...base, commitTo: 'c'.repeat(40) }));
      });

      it('should be the same regardless of tag order', () => {
        const tagParts = { ...base, branch: undefined };
        const id1 = buildPushId({ ...tagParts, tags: ['refs/tags/v1.0.0', 'refs/tags/v2.0.0'] });
        const id2 = buildPushId({ ...tagParts, tags: ['refs/tags/v2.0.0', 'refs/tags/v1.0.0'] });
        expect(id1).toBe(id2);
      });

      it('should differ when the tags differ', () => {
        const tagParts = { ...base, branch: undefined };
        const id1 = buildPushId({ ...tagParts, tags: ['refs/tags/v1.0.0'] });
        const id2 = buildPushId({ ...tagParts, tags: ['refs/tags/v1.0.1'] });
        expect(id1).not.toBe(id2);
      });

      it('should treat undefined tags and empty tags identically', () => {
        expect(buildPushId({ ...base, tags: undefined })).toBe(buildPushId({ ...base, tags: [] }));
      });

      it('should differ from the legacy `${commitFrom}__${commitTo}` format', () => {
        expect(buildPushId(base)).not.toBe(`${COMMIT_FROM}__${COMMIT_TO}`);
      });
    });

    describe('setCommit', () => {
      it('should yield different ids for different urls with the same commit range', () => {
        const repo1 = makeAction(REPO_1_URL);
        const repo2 = makeAction(REPO_2_URL);
        repo1.setBranch('refs/heads/main');
        repo2.setBranch('refs/heads/main');

        repo1.setCommit(COMMIT_FROM, COMMIT_TO);
        repo2.setCommit(COMMIT_FROM, COMMIT_TO);

        expect(repo1.id).toMatch(HEX_64);
        expect(repo2.id).toMatch(HEX_64);
        expect(repo1.id).not.toBe(repo2.id);
      });

      it('should yield identical ids for the same url, branch and commit range', () => {
        const a = makeAction(REPO_1_URL);
        const b = makeAction(REPO_1_URL);
        a.setBranch('refs/heads/main');
        b.setBranch('refs/heads/main');

        a.setCommit(COMMIT_FROM, COMMIT_TO);
        b.setCommit(COMMIT_FROM, COMMIT_TO);

        expect(a.id).toBe(b.id);
      });

      it('should set the id to buildPushId of the action url, branch, tags and range', () => {
        const action = makeAction(REPO_1_URL);
        action.setBranch('refs/heads/main');
        action.setCommit(COMMIT_FROM, COMMIT_TO);

        expect(action.commitFrom).toBe(COMMIT_FROM);
        expect(action.commitTo).toBe(COMMIT_TO);
        expect(action.id).toBe(
          buildPushId({
            url: action.url,
            branch: action.branch,
            tags: action.tags,
            commitFrom: COMMIT_FROM,
            commitTo: COMMIT_TO,
          }),
        );
      });

      it('should include the tags in the id for tag pushes', () => {
        const action = makeAction(REPO_1_URL);
        action.tags = ['refs/tags/v2.0.0', 'refs/tags/v1.0.0'];
        action.setCommit(COMMIT_FROM, COMMIT_TO);

        expect(action.id).toBe(
          buildPushId({
            url: REPO_1_URL,
            branch: undefined,
            tags: ['refs/tags/v1.0.0', 'refs/tags/v2.0.0'],
            commitFrom: COMMIT_FROM,
            commitTo: COMMIT_TO,
          }),
        );
      });

      it('should yield different ids for different branches with the same url and range', () => {
        const spike = makeAction(REPO_1_URL);
        const release = makeAction(REPO_1_URL);
        spike.setBranch('refs/heads/spike');
        release.setBranch('refs/heads/release-x');

        spike.setCommit(COMMIT_FROM, COMMIT_TO);
        release.setCommit(COMMIT_FROM, COMMIT_TO);

        expect(spike.id).not.toBe(release.id);
      });

      it('should not use the legacy `${commitFrom}__${commitTo}` id format', () => {
        const action = makeAction(REPO_1_URL);
        action.setCommit(COMMIT_FROM, COMMIT_TO);
        expect(action.id).not.toBe(`${COMMIT_FROM}__${COMMIT_TO}`);
      });
    });

    describe('setBranch', () => {
      it('should recompute the id when called after setCommit', () => {
        const action = makeAction(REPO_1_URL);
        action.setBranch('refs/heads/spike');
        action.setCommit(COMMIT_FROM, COMMIT_TO);
        const idBefore = action.id;

        action.setBranch('refs/heads/release-x');

        expect(action.branch).toBe('refs/heads/release-x');
        expect(action.id).not.toBe(idBefore);
        expect(action.id).toBe(
          buildPushId({
            url: REPO_1_URL,
            branch: 'refs/heads/release-x',
            tags: undefined,
            commitFrom: COMMIT_FROM,
            commitTo: COMMIT_TO,
          }),
        );
      });

      it('should leave the id untouched when called before setCommit', () => {
        const action = makeAction(REPO_1_URL);

        action.setBranch('refs/heads/spike');

        expect(action.branch).toBe('refs/heads/spike');
        expect(action.id).toBe('initial-id');
      });
    });
  });
});
