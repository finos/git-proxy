import path from 'path';
import { Action, Step } from '../../actions';
import { spawnSync } from 'child_process';

const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('checkHiddenCommits');

  try {
    const repoPath = `${action.proxyGitPath}/${action.repoName}`;

    const introducedCommits = new Set<string>();

    // Retrieve the single ref update
    const oldOid = action.commitFrom;
    const newOid = action.commitTo;
    if (!oldOid || !newOid) {
      throw new Error('Both action.commitFrom and action.commitTo must be defined');
    }

    const revisionRange: string =
      oldOid === '0000000000000000000000000000000000000000' ? newOid : `${oldOid}..${newOid}`;

    const revListOutput = spawnSync('git', ['rev-list', revisionRange], {
      cwd: repoPath,
      encoding: 'utf-8',
    }).stdout;
    revListOutput
      .trim()
      .split('\n')
      .filter(Boolean)
      .forEach((sha) => introducedCommits.add(sha));
    step.log(`Total introduced commits: ${introducedCommits.size}`);
    const packPath = path.join('.git', 'objects', 'pack');

    const packCommits = new Set<string>();

    (action.newIdxFiles || []).forEach((idxFile) => {
      const idxPath = path.join(packPath, idxFile);
      const out = spawnSync('git', ['verify-pack', '-v', idxPath], {
        cwd: repoPath,
        encoding: 'utf-8',
      }).stdout;

      out
        .trim()
        .split('\n')
        .forEach((line) => {
          const [sha, type] = line.split(/\s+/);
          if (type === 'commit') packCommits.add(sha);
        });
    });
    step.log(`Commits nel pack: ${packCommits.size}`);
    console.log('Pack commits:', packCommits);

    const referenced: string[] = [];
    const unreferenced: string[] = [];
    [...packCommits].forEach((sha) => {
      if (introducedCommits.has(sha)) referenced.push(sha);
      else unreferenced.push(sha);
    });

    step.log(`✅ Referenced commits: ${referenced.length}`);
    step.log(`❌ Unreferenced commits: ${unreferenced.length}`);

    if (unreferenced.length > 0) {
      step.setError(
        `Unreferenced commits in pack (${unreferenced.length}): ${unreferenced.join(', ')}`,
      );
      action.error = true;
    }
    step.setContent(`Referenced: ${referenced.length}, Unreferenced: ${unreferenced.length}`);
  } catch (e: any) {
    step.setError(e.message);
    throw e;
  } finally {
    action.addStep(step);
  }

  return action;
};

exec.displayName = 'checkHiddenCommits.exec';
export { exec };
