import path from 'path';
import { Action, Step } from '../../actions';
import { spawnSync } from 'child_process';
import fs from 'fs';

const exec = async (req: any, action: Action) => {
  const step = new Step('writePack');
  try {
    if (!action.proxyGitPath || !action.repoName) {
      throw new Error('proxyGitPath and repoName must be defined');
    }
    const repoPath = path.join(action.proxyGitPath, action.repoName);

    const packDir = path.join(repoPath, '.git', 'objects', 'pack');

    spawnSync('git', ['config', 'receive.unpackLimit', '0'], {
      cwd: repoPath,
      encoding: 'utf-8',
    });
    const before = new Set(fs.readdirSync(packDir).filter((f) => f.endsWith('.idx')));
    const content = spawnSync('git', ['receive-pack', action.repoName], {
      cwd: action.proxyGitPath,
      input: req.body,
    });
    const newIdxFiles = [
      ...new Set(fs.readdirSync(packDir).filter((f) => f.endsWith('.idx') && !before.has(f))),
    ];
    action.newIdxFiles = newIdxFiles;
    step.log(`new idx files: ${newIdxFiles}`);

    step.setContent(content);
  } catch (e: any) {
    step.setError(e.toString('utf-8'));
    throw e;
  } finally {
    action.addStep(step);
  }
  return action;
};

exec.displayName = 'writePack.exec';

export { exec };
