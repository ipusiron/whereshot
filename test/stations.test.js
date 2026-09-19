const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('H-3 観測所のJSONと古典スクリプトが同じ54件', () => {
  const root = path.join(__dirname, '..');
  const json = JSON.parse(fs.readFileSync(path.join(root, 'data/stations.json'), 'utf8'));
  const context = {};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'data/stations.js'), 'utf8'), context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.WhereShotStations)), json);
  assert.equal(json.length, 54);
  assert.equal(new Set(json.map((s) => s.name)).size, 54);
  for (const station of json) {
    assert.equal(typeof station.name, 'string');
    assert.ok(station.lat >= 20 && station.lat <= 46);
    assert.ok(station.lng >= 122 && station.lng <= 154);
    assert.ok(Number.isInteger(station.prec_no));
    assert.ok(Number.isInteger(station.block_no));
    assert.match(String(station.block_no), /^\d{5}$/);
  }
});
