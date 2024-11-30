const Step = require('../../actions').Step;
const config = require('../../../config');
const parseDiff = require('parse-diff')

const commitConfig = config.getCommitConfig();
const privateOrganizations = config.getPrivateOrganizations();

const BLOCK_TYPE = {
  LITERAL: 'Offending Literal',
  PATTERN: 'Offending Pattern',
  PROVIDER: 'PROVIDER'
}


const getDiffViolations = (diff, organization) => {
  // Commit diff is empty, i.e. '', null or undefined
  if (!diff) {
    console.log('No commit diff...');
    return 'No commit diff...';
  }

  // Validation for configured block pattern(s) check...
  if (typeof diff !== 'string') {
    console.log('A non-string value has been captured for the commit diff...');
    return 'A non-string value has been captured for the commit diff...';
  }

  const parsedDiff = parseDiff(diff);
  const combinedMatches = combineMatches(organization);


  const res = collectMatches(parsedDiff, combinedMatches);
  // Diff matches configured block pattern(s)
  if (res.length > 0) {
    console.log('Diff is blocked via configured literals/patterns/providers...');
    // combining matches with file and line number
    return res
  }

  return null;
};

const combineMatches = (organization) => {

  // Configured blocked literals
  const blockedLiterals = commitConfig.diff.block.literals;

  // Configured blocked patterns
  const blockedPatterns = commitConfig.diff.block.patterns;

  // Configured blocked providers
  const blockedProviders = organization && privateOrganizations.includes(organization) ? [] :
    Object.entries(commitConfig.diff.block.providers);

  // Combine all matches (literals, paterns)
  const combinedMatches = [
    ...blockedLiterals.map(literal => ({
      type: BLOCK_TYPE.LITERAL,
      match: new RegExp(literal, 'gi')
    })),
    ...blockedPatterns.map(pattern => ({
      type: BLOCK_TYPE.PATTERN,
      match: new RegExp(pattern, 'gi')
    })),
    ...blockedProviders.map(([key, value]) => ({
      type: key,
      match: new RegExp(value, 'gi')
    })),
  ];
  return combinedMatches;
}

const collectMatches = (parsedDiff, combinedMatches) => {
  const allMatches = {};
  parsedDiff.forEach(file => {
    const fileName = file.to || file.from;
    console.log("CHANGE", file.chunks)

    file.chunks.forEach(chunk => {
      chunk.changes.forEach(change => {
        if (change.add) {
          // store line number
          const lineNumber = change.ln;
          // Iterate through each match types - literal, patterns, providers
          combinedMatches.forEach(({ type, match }) => {
            // using Match all to find all occurences of the pattern in the line
            const matches = [...change.content.matchAll(match)]

            matches.forEach(matchInstance => {
              const matchLiteral = matchInstance[0];
              const matchKey = `${type}_${matchLiteral}_${fileName}`; // unique key


              if (!allMatches[matchKey]) {
                // match entry 
                allMatches[matchKey] = {
                  type,
                  literal: matchLiteral,
                  file: fileName,
                  lines: [],
                  content: change.content.trim()
                };
              }

              // apend line numbers to the list of lines
              allMatches[matchKey].lines.push(lineNumber)
            })
          });
        }
      });
    });
  });

  // convert matches into  a final result array, joining line numbers
  const result = Object.values(allMatches).map(match => ({
    ...match,
    lines: match.lines.join(',') // join the line numbers into a comma-separated string
  }))

  console.log("RESULT", result)
  return result;
}

const formatMatches = (matches) => {
  return matches.map((match, index) => {
    return `---------------------------------- #${index + 1} ${match.type} ------------------------------
    Policy Exception Type: ${match.type}
    DETECTED: ${match.literal} 
    FILE(S) LOCATED: ${match.file}
    Line(s) of code: ${match.lines}`
  });
}

const exec = async (req, action) => {
  const step = new Step('scanDiff');

  const { steps, commitFrom, commitTo } = action;
  console.log(`Scanning diff: ${commitFrom}:${commitTo}`);

  const diff = steps.find((s) => s.stepName === 'diff')?.content;

  console.log(diff)
  const diffViolations = getDiffViolations(diff, action.project);

  if (diffViolations) {
    const formattedMatches = Array.isArray(diffViolations) ? formatMatches(diffViolations).join('\n\n') : diffViolations;
    const errorMsg = [];
    errorMsg.push(`\n\n\n\nYour push has been blocked.\n`);
    errorMsg.push(`Please ensure your code does not contain sensitive information or URLs.\n\n`);
    errorMsg.push(formattedMatches)
    errorMsg.push('\n')

    console.log(`The following diff is illegal: ${commitFrom}:${commitTo}`);

    step.error = true;
    step.log(`The following diff is illegal: ${commitFrom}:${commitTo}`);
    step.setError(
      errorMsg.join('\n')
    );


    action.addStep(step);
    return action;
  }

  action.addStep(step);
  return action;
};

exec.displayName = 'scanDiff.exec';
exports.exec = exec;
