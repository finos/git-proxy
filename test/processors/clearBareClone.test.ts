import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import { exec as clearBareClone } from '../../src/proxy/processors/push-action/clearBareClone';
import { exec as pullRemote } from '../../src/proxy/processors/push-action/pullRemote';
import { Action } from '../../src/proxy/actions/Action';

const actionId = '123__456';
const timestamp = Date.now();

describe('clear bare and local clones', () => {
  it('pull remote generates a local .remote folder with hybrid cache structure', async () => {
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

    // Hybrid cache creates: .remote/cache (bare repos) and .remote/work (working copies)
    expect(fs.existsSync(`./.remote/work/${actionId}`)).toBe(true);
    expect(fs.existsSync(`./.remote/cache/git-proxy.git`)).toBe(true);
  }, 120000);

  it('clear bare clone function removes working copy and enforces cache limits', async () => {
    const action = new Action(actionId, 'type', 'get', timestamp, 'finos/git-proxy.git');
    await clearBareClone(null, action);

    // clearBareClone removes only the working copy for this push
    expect(fs.existsSync(`./.remote/work/${actionId}`)).toBe(false);
    expect(action.steps.some((s) => s.stepName === 'clearBareClone')).toBe(true);
  });

  afterEach(() => {
    if (fs.existsSync(`./.remote`)) {
      fs.rmSync(`./.remote`, { recursive: true });
    }
  });
});
