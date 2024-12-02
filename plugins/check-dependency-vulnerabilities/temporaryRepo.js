import { spawnSync } from "child_process";
import fs from "fs";

const dir = './.tempRepo';

export const createTempRepo = (req, action) => {
  const tempRepoPush_dir = `${dir}/${action.timestamp}`;

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  if (!fs.existsSync(tempRepoPush_dir)) {
    fs.mkdirSync(tempRepoPush_dir, '0777', true);
  }

  const cmnd = `git clone ${action.url} --bare`;

  const response = spawnSync('git', ['clone', action.url, '--bare', '--progress'], {
    cwd: tempRepoPush_dir,
    encoding: 'utf-8',
  });

  const cmd = `git receive-pack ${action.repoName}`;

  const content = spawnSync('git', ['receive-pack', action.repoName], {
    cwd: tempRepoPush_dir,
    input: req.body,
    encoding: 'utf-8',
  }).stdout;

  return `${dir}/${action.timestamp}/${action.repoName}`;
}

export const deleteTempRepo = () => {
  fs.rm(dir, { recursive: true, force: true }, (err) => {
    if (err) {
      throw err;
    }
    console.log(`.tempRepo is deleted!`);
  });
}