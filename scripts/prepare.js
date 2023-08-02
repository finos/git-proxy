// =======
// Import.
// =======

const { execSync } = require('child_process');
const { existsSync } = require('fs');

// ===========
// File paths.
// ===========

const FILE_COMMIT = './.husky/commit-msg';
const FILE_HUSKY = './.husky/_/husky.sh';

// =========
// Commands.
// =========

const COMMIT_MSG_STRING = `'npx --no -- commitlint --edit $'{1}''`
const CLI_COMMIT = `npx husky add .husky/commit-msg ${COMMIT_MSG_STRING}`;
const CLI_HUSKY = 'npx husky install';

// ==============
// Husky install.
// ==============

// this will create .husky/_/husky.sh if it does not yet exist.
if (!existsSync(FILE_HUSKY)) {
	global.console.log(CLI_HUSKY);
	execSync(CLI_HUSKY);
}

// ====================
// Add pre-commit hook.
// ====================

// this will create .husky/commit-msg if it does not yet exist.
if (!existsSync(FILE_COMMIT)) {
	global.console.log(CLI_COMMIT);
	execSync(CLI_COMMIT);
}