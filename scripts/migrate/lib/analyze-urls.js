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

function detectScheme(url) {
  const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//.exec(url);
  return m ? m[1].toLowerCase() : 'unknown';
}

function normalizeRepoUrl(raw) {
  const rawUrl = (raw ?? '').toString().trim();
  if (!rawUrl) {
    return { ok: false, rawUrl, normalizedUrl: '', reason: 'blank', scheme: 'unknown' };
  }

  const normalizedUrl = rawUrl.replace(/\/+$/, '');
  const scheme = detectScheme(normalizedUrl);
  const isHttp = normalizedUrl.startsWith('http://') || normalizedUrl.startsWith('https://');
  if (!isHttp) {
    return { ok: false, rawUrl, normalizedUrl, reason: 'unsupported-scheme', scheme };
  }

  return { ok: true, rawUrl, normalizedUrl, scheme: scheme === 'unknown' ? 'http' : scheme };
}

function buildUrlNormalizationReport(repos) {
  const report = {
    totalRepos: repos.length,
    reposNeedingUpdate: 0,
    reposAlreadyFixed: 0,
    changes: [],
    issues: [],
    issueCount: 0,
  };

  for (const repo of repos) {
    const repoId = repo._id?.toString?.() ?? String(repo._id ?? '');
    const repoName = repo.name ?? '';

    const norm = normalizeRepoUrl(repo.url);
    if (!norm.ok) {
      report.issues.push({
        repoId,
        repoName,
        rawUrl: norm.rawUrl,
        normalizedUrl: norm.normalizedUrl,
        reason: norm.reason,
        scheme: norm.scheme,
      });
      report.issueCount++;
      continue;
    }

    const currentUrl = norm.normalizedUrl;
    const needsUpdate = !currentUrl.endsWith('.git');

    if (needsUpdate) {
      report.reposNeedingUpdate++;
      const newUrl = `${currentUrl}.git`;
      report.changes.push({
        repoId,
        repoName,
        oldUrl: currentUrl,
        newUrl: newUrl,
        status: 'pending',
      });
    } else {
      report.reposAlreadyFixed++;
    }
  }

  return report;
}

function logUrlAnalysis(allRepos, report) {
  for (const repo of allRepos) {
    const repoName = repo.name ?? '';
    const norm = normalizeRepoUrl(repo.url);
    if (!norm.ok) {
      console.log(
        `  WARNING ${repoName}: invalid url "${norm.rawUrl}" (reason: ${norm.reason}, scheme: ${norm.scheme})`,
      );
      continue;
    }

    const currentUrl = norm.normalizedUrl;
    if (!currentUrl.endsWith('.git')) {
      const newUrl = `${currentUrl}.git`;
      console.log(`  INFO ${repoName}: ${currentUrl} -> ${newUrl}`);
    } else {
      console.log(`  OK ${repoName}: already has .git`);
    }
  }

  console.log(`\nRepos needing update: ${report.reposNeedingUpdate}`);
  console.log(`Repos already fixed: ${report.reposAlreadyFixed}`);
  console.log(`URL issues (manual fix): ${report.issueCount}`);
}

async function analyzeReposWithDatastore(datastore) {
  console.log('\n=== ANALYSIS PHASE ===');
  const allRepos = await datastore.listRepos();

  console.log(`Total repos in database: ${allRepos.length}`);
  const report = buildUrlNormalizationReport(allRepos);
  logUrlAnalysis(allRepos, report);

  return { allRepos, report };
}

module.exports = {
  analyzeReposWithDatastore,
  buildUrlNormalizationReport,
  normalizeRepoUrl,
};
