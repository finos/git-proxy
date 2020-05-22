const exec = (req, result) => {
  result.repo = getRepoNameFromUrl(result.url);
  result.repoFullUrl = `https://github.com/${result.repo}`;
  result.repoName = result.repo.split('/')[1].replace('.git', '');

  return result;
};

const getRepoNameFromUrl = (url) => {
  console.log(url);
  const parts = url.split('/');

  for (let i = 0, len = parts.length; i < len; i++) {
    const part = parts[i];
    if (part.endsWith('.git')) {
      const repo = `${parts[i -1]}/${part}`;
      return repo.trim();
    }
  };
  return 'NOT-FOUND';
};

exec.displayName = 'parseRepo.exec';
exports.exec = exec;
