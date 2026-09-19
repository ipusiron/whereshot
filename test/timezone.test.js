const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('H-8 4つのTZで同じ推定・太陽・リンク・レポート・ファイル名の結果', () => {
  const zones = ['UTC', 'Asia/Tokyo', 'America/Los_Angeles', 'Pacific/Kiritimati'];
  const results = zones.map((TZ) => {
    const child = spawnSync(process.execPath, [path.join(__dirname, 'fixtures/tz-probe.js'), '--probe'], {
      env: { ...process.env, TZ }, encoding: 'utf8',
    });
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.stderr, '');
    return JSON.parse(child.stdout);
  });
  assert.deepEqual(results.map((r) => r.timezoneOffset), [0, -540, 420, -840]);
  assert.equal(new Set(results.map((r) => r.timezoneOffset)).size, 4);
  for (const r of results) assert.equal(JSON.stringify(r.data), JSON.stringify(results[0].data));
});
