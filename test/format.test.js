const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const name = path.join(dir, entry.name);
    return entry.isDirectory() ? files(name) : [name];
  });
}
test('H-8 minifyをせず、読みやすい行の長さとファイル構造を保つ', () => {
  const list = ['js', 'css', 'test'].flatMap((dir) => files(path.join(root, dir)))
    .filter((file) => /\.(js|cjs|css)$/.test(file));
  list.push(path.join(root, 'index.html'));
  const errors = [];
  for (const file of list) {
    const limit = file.endsWith('.html') ? 250 : 160;
    fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, i) => {
      if (Array.from(line).length > limit) errors.push(`${path.relative(root, file)}:${i + 1} (${Array.from(line).length})`);
    });
  }
  assert.deepEqual(errors, []);
  for (const [file, minimum] of [['css/style.css', 900], ['js/main.js', 700],
    ['js/map-controller.js', 400], ['js/whereshot-logic.js', 350]]) {
    assert.ok(fs.readFileSync(path.join(root, file), 'utf8').split('\n').length >= minimum, file);
  }
});
