import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import fs from 'fs';
import { exec as clearBareClone } from '../../src/proxy/processors/post-processor/clearBareClone';
import { exec as pullRemote } from '../../src/proxy/processors/push-action/pullRemote';
import { Action } from '../../src/proxy/actions/Action';

const actionId = '123__456';
const timestamp = Date.now();
const remoteFolder = `./.remote`;

describe('clear local clones', () => {
  beforeAll(() => {
    //make sure the remote folder exists (normally created on proxy startup)
    if (!fs.existsSync(remoteFolder)) {
      fs.mkdirSync(remoteFolder);
    }
  });

  it('pullRemote generates a local .remote/* folder that clearBareClone purges afterwards', async () => {
    let action = new Action(actionId, 'type', 'get', timestamp, 'finos/git-proxy.git');
    action.url = 'https://github.com/finos/git-proxy.git';
    const authorization = `Basic ${Buffer.from('JamieSlome:test').toString('base64')}`;

    action = await pullRemote(
      {
        headers: {
          authorization,
        },
      },
      action,
    );

    expect(fs.existsSync(`${remoteFolder}/${actionId}`)).toBe(true);

    action = await clearBareClone(null, action);

    expect(fs.existsSync(`${remoteFolder}/${actionId}`)).toBe(false);
  }, 20000);

  afterAll(() => {
    if (fs.existsSync(remoteFolder)) {
      fs.rmSync(remoteFolder, { recursive: true, force: true });
    }
  });
});
