'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const files = ['index.html', 'styles.css', 'model.js', 'app.js', 'i18n.js', 'exports.js', '.nojekyll'];
fs.mkdirSync(output, { recursive: true });
for (const entry of fs.readdirSync(output)) {
  if (!files.includes(entry) || !fs.lstatSync(path.join(output, entry)).isFile()) {
    throw new Error(`Unexpected deployment file: ${entry}`);
  }
}
for (const file of files) fs.copyFileSync(path.join(root, file), path.join(output, file));
console.log(`Packaged ${files.length} static files in dist/. No documentation, tests or saved scenarios are deployed.`);
