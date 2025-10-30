import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import { exec as clearBareClone } from '../../src/proxy/processors/push-action/clearBareClone';
import { exec as pullRemote } from '../../src/proxy/processors/push-action/pullRemote';
import { Action } from '../../src/proxy/actions/Action';

const actionId = '123__456';
const timestamp = Date.now();

describe('clear bare and local clones', () => {
  it('pull remote generates a local .remote folder', async () => {
    const action = new Action(actionId, 'type', 'get', timestamp, 'finos/git-proxy.git');
    action.url = 'https://github.com/finos/git-proxy.git';
    const authorization = `Basic ${Buffer.from('JamieSlome:test').toString('base64')}`;

    await pullRemote(
      {
        headers: {
          authorization,
        },
      },
      action,
    );

    expect(fs.existsSync(`./.remote/${actionId}`)).toBe(true);
  }, 20000);

  it('clear bare clone function purges .remote folder and specific clone folder', async () => {
    const action = new Action(actionId, 'type', 'get', timestamp, 'finos/git-proxy.git');
    await clearBareClone(null, action);

    expect(fs.existsSync(`./.remote`)).toBe(false);
    expect(fs.existsSync(`./.remote/${actionId}`)).toBe(false);
  });

  afterEach(() => {
    if (fs.existsSync(`./.remote`)) {
      fs.rmSync(`./.remote`, { recursive: true });
    }
  });
});
