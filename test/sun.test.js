const test = require('node:test');
const assert = require('node:assert/strict');
const { L, SunCalc } = require('./fixtures/sample.cjs');

const cases = [
  [34.28611372222222, 133.79983519444446, 1469324037000, '64.0', '117.3', 'morning', '297.3', '0.49'],
  [35.6812, 139.7671, '2024-06-21T02:45:00Z', '77.8', '182.1', 'afternoon', '2.1', '0.22'],
  [35.6812, 139.7671, '2024-12-21T06:00:00Z', '14.2', '226.6', 'afternoon', '46.6', '3.95'],
  [35.6812, 139.7671, '2024-06-20T19:10:00Z', '-3.6', '57.6', 'dawn', null, null],
  [69.6492, 18.9553, '2024-06-21T23:00:00Z', '3.1', '3.1', 'golden-morning'],
  [69.6492, 18.9553, '2024-12-21T11:00:00Z', '-3.1', '184.0', 'dusk', null, null],
  [-33.8688, 151.2093, '2024-12-21T02:00:00Z', '79.5', '351.8', 'afternoon'],
  [0, 0, '2024-03-20T12:00:00Z', '88.0', '90.4', 'morning'],
  [48.8584, 2.2945, '2024-07-14T12:00:00Z', '62.8', '181.5', 'afternoon'],
];
for (const [lat, lng, time, altitude, azimuth, phase, shadow, ratio] of cases) {
  test(`D-6 太陽 ${lat},${lng} ${time}`, () => {
    const r = L.sunReport(SunCalc, lat, lng, typeof time === 'number' ? time : Date.parse(time));
    assert.equal(r.altitudeDeg.toFixed(1), altitude);
    assert.equal(r.azimuthDeg.toFixed(1), azimuth);
    assert.equal(r.phase, phase);
    if (shadow !== undefined) assert.equal(r.shadowDirectionDeg?.toFixed(1) ?? null, shadow);
    if (ratio !== undefined) assert.equal(r.shadowRatio?.toFixed(2) ?? null, ratio);
  });
}
test('D-6 日本語16方位と時間帯の境界', () => {
  for (const [angle, name] of [[0, '北'], [11.24, '北'], [11.26, '北北東'], [90, '東'], [180, '南'],
    [270, '西'], [348.74, '北北西'], [348.76, '北'], [360, '北'], [-90, '西']]) assert.equal(L.toCardinalJa(angle), name);
  assert.equal(L.sunPhaseKey(-6.01, 90), 'night');
  assert.equal(L.sunPhaseKey(-6, 90), 'dawn');
  assert.equal(L.sunPhaseKey(-0.833, 90), 'golden-morning');
  assert.equal(L.sunPhaseKey(5.99, 180), 'golden-evening');
  assert.equal(L.sunPhaseKey(6, 90), 'morning');
  assert.equal(L.sunPhaseKey(6, 180), 'afternoon');
});
