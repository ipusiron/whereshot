const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const expected = [
  ['exifreader/exif-reader.min.js', 68450, 'fa388e973a8280d360ac833588a084cbf856b41de51169b533b306f59b8cc110'],
  ['exifreader/LICENSE', 16726, '3f3d9e0024b1921b067d6f7f88deb4a60cbe7a78e76c64e3f1d7fc3b779b9d04'],
  ['suncalc/suncalc.js', 9116, '5bfe4127cb91b7436295135d491e2d8abeccacbc8c4d450fb30771183b1e24d2'],
  ['suncalc/LICENSE', 1321, '9010b843aad8e450890fc18dae2dfec00e68c10da775515801c42878afbb0da1'],
];
for (const [file, bytes, sha256] of expected) {
  test('vendorを無改変で保持: ' + file, () => {
    const buffer = fs.readFileSync(path.join(__dirname, '../vendor', file));
    assert.equal(buffer.length, bytes);
    assert.equal(createHash('sha256').update(buffer).digest('hex'), sha256);
  });
}
