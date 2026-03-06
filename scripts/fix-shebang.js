#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const distIndexPath = path.join(__dirname, '..', 'dist', 'index.js');

if (fs.existsSync(distIndexPath)) {
  let content = fs.readFileSync(distIndexPath, 'utf-8');
  // Replace tsx with node in the shebang (first line)
  content = content.replace(/^#!.*tsx/, '#!/usr/bin/env node');
  fs.writeFileSync(distIndexPath, content);
  console.log('Fixed shebang in dist/index.js');
} else {
  console.log('dist/index.js not found, skipping shebang fix');
}
