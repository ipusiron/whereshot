const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('./fixtures/sample.cjs');
const { L, wall: W, exif, nowMs, stations, latitude: lat, longitude: lng, reportInput } = S;

test('A-6 壁時計・オフセット・UTCの厳密な変換', () => {
  assert.deepEqual(L.parseExifDateTime('2016:07:24 10:33:57'), W);
  for (const v of ['0000:00:00 00:00:00', '    :  :     :  :  ', '2024:02:30 10:00:00',
    '2024:01:01 24:00:00', '2016-07-24T10:33:57', 20160724]) assert.equal(L.parseExifDateTime(v), null);
  assert.deepEqual(L.parseExifDateTime('2024:02:29 23:59:59'),
    { year: 2024, month: 2, day: 29, hour: 23, minute: 59, second: 59 });
  for (const [input, expected] of [['+09:00', 540], ['-03:30', -210], ['+14:00', 840],
    ['-12:00', -720], ['Z', 0], ['+15:00', null], ['0900', null], ['+01:60', null]]) {
    assert.equal(L.parseOffset(input), expected);
  }
  for (const [input, expected] of [[540, '+09:00'], [-210, '-03:30'], [0, '+00:00'], [345, '+05:45']]) {
    assert.equal(L.formatOffset(input), expected);
  }
  assert.equal(L.wallToUtcMs(W, 540), 1469324037000);
  assert.equal(L.formatUtc(1469324037000), '2016-07-24 01:33:57 UTC');
  assert.deepEqual(L.utcMsToWall(1469324037000, 540), W);
  assert.equal(L.formatWall(L.utcMsToWall(1469324037000, 120), 120), '2016/07/24 03:33:57（UTC+02:00）');
  assert.equal(L.formatWall(W, 540), '2016/07/24 10:33:57（UTC+09:00）');
  assert.equal(L.formatWall(W, null), '2016/07/24 10:33:57');
  assert.equal(L.wallToInputValue(W), '2016-07-24T10:33:57');
  assert.deepEqual(L.inputValueToWall('2016-07-24T10:33'), { ...W, second: 0 });
  assert.equal(L.inputValueToWall('2016-13-24T10:33'), null);
  for (const seconds of [58, 58.75]) {
    assert.equal(L.gpsDateTimeToUtcMs('2016:07:24', [1, 33, seconds]), 1469324038000);
  }
  assert.equal(L.gpsDateTimeToUtcMs('2016-07-24', [1, 33, 58]), null);
  assert.equal(L.gpsDateTimeToUtcMs('2016:07:24', [1, 33]), null);
  assert.deepEqual(L.inferOffsetFromGps(W, 1469324038000), { offsetMin: 540, residualSec: -1 });
  for (const [wall, date, time, expected] of [
    ['2024:03:01 12:00:10', '2024:03:01', [6, 15, 0], { offsetMin: 345, residualSec: 10 }],
    ['2024:07:04 20:00:00', '2024:07:05', [3, 0, 2], { offsetMin: -420, residualSec: -2 }],
    ['2024:03:01 12:07:00', '2024:03:01', [3, 0, 0], null],
  ]) assert.deepEqual(L.inferOffsetFromGps(L.parseExifDateTime(wall), L.gpsDateTimeToUtcMs(date, time)), expected);
});

test('A-6 オフセットの優先順位と経度の参考値', () => {
  const args = { wall: W, gpsUtcMs: 1469324038000, browserOffsetMin: -480 };
  assert.deepEqual(L.decideOffset({ ...args, exifOffset: '+02:00' }),
    { offsetMin: 120, source: 'exif', residualSec: null, conflict: true });
  assert.deepEqual(L.decideOffset({ ...args, exifOffset: '+09:00' }),
    { offsetMin: 540, source: 'exif', residualSec: null, conflict: false });
  assert.deepEqual(L.decideOffset({ ...args, exifOffset: null }),
    { offsetMin: 540, source: 'gps', residualSec: -1, conflict: false });
  assert.deepEqual(L.decideOffset({ exifOffset: null, wall: W, gpsUtcMs: null, browserOffsetMin: 120 }),
    { offsetMin: 120, source: 'browser', residualSec: null, conflict: false });
  assert.equal(L.decideOffset({ ...args, wall: null }).source, 'browser');
  for (const [input, expected] of [[133.8, 540], [2.2945, 0], [-74.006, -300], [178.4, 720], [NaN, null]]) {
    assert.equal(L.longitudeOffsetHint(input), expected);
  }
  assert.equal(L.OFFSET_CHOICES.length, 38);
  assert.equal(L.OFFSET_CHOICES[0], -720);
  assert.equal(L.OFFSET_CHOICES.at(-1), 840);
  assert.ok(L.OFFSET_CHOICES.includes(345));
  assert.ok(L.OFFSET_CHOICES.every((n, i, a) => i === 0 || n > a[i - 1]));
});

const filenameCases = [
  ['2016-07-24 10.33.57.jpg', 'ymd-hms-sep', '2016-07-24 10.33.57', '2016/07/24 10:33:57', true],
  ['IMG_20240101_123456.jpg', 'ymd-hms-compact', '20240101_123456', '2024/01/01 12:34:56', true],
  ['VID_20240101_123456.mp4', 'ymd-hms-compact', '20240101_123456', '2024/01/01 12:34:56', true],
  ['20240101_123456.jpg', 'ymd-hms-compact', '20240101_123456', '2024/01/01 12:34:56', true],
  ['Screenshot_20240101-123456.png', 'ymd-hms-compact', '20240101-123456', '2024/01/01 12:34:56', true],
  ['PXL_20240101_123456789.jpg', 'pxl-utc', 'PXL_20240101_123456789', '2024-01-01 12:34:56 UTC', true],
  ['Screenshot_2024-01-01-12-34-56.png', 'ymd-hms-sep', '2024-01-01-12-34-56', '2024/01/01 12:34:56', true],
  ['WhatsApp Image 2024-01-01 at 12.34.56.jpeg', 'ymd-hms-sep', '2024-01-01 at 12.34.56', '2024/01/01 12:34:56', true],
  ['signal-2024-01-01-123456.jpg', 'ymd-sep-hms-compact', '2024-01-01-123456', '2024/01/01 12:34:56', true],
  ['スクリーンショット 2024-01-01 123456.png', 'ymd-sep-hms-compact', '2024-01-01 123456', '2024/01/01 12:34:56', true],
  ['20160724103357.jpg', 'ymdhms-14', '20160724103357', '2016/07/24 10:33:57', true],
  ['2024年1月1日12時34分56秒.jpg', 'ja-full', '2024年1月1日12時34分56秒', '2024/01/01 12:34:56', true],
  ['IMG-20240101-WA0001.jpg', 'ymd-8', '20240101', '2024/01/01 12:00:00', false],
  ['image_1920x1080_20240101.jpg', 'ymd-8', '20240101', '2024/01/01 12:00:00', false],
  ['1609459200.jpg', 'unix-s', '1609459200', '2021-01-01 00:00:00 UTC', true],
  ['FB_IMG_1609459200123.jpg', 'unix-ms', '1609459200123', '2021-01-01 00:00:00 UTC', true],
  ['2024-01-01 25.61.61.jpg', 'ymd-sep', '2024-01-01', '2024/01/01 12:00:00', false],
];
for (const [name, pattern, matched, formatted, hasTime] of filenameCases) {
  test('C-4 ファイル名 ' + name, () => {
    const results = L.extractDatesFromFilename(name, nowMs);
    assert.equal(results.length, 1);
    const r = results[0];
    assert.equal(r.pattern, pattern);
    assert.equal(r.matched, matched);
    assert.equal(r.hasTime, hasTime);
    assert.equal(r.wall ? L.formatWall(r.wall, null) : L.formatUtc(r.utcMs), formatted);
    const reliability = !hasTime ? 0.4 : pattern.startsWith('unix') ? 0.5 : pattern === 'ymdhms-14' ? 0.55 : 0.6;
    assert.equal(r.reliability, reliability);
  });
}
test('C-4 不正・範囲外のファイル名を繰り上げたりUnix時刻として誤読しない', () => {
  for (const name of ['2024-02-31 10.00.00.jpg', '2024-13-01.jpg', 'IMG_1234.JPG', 'DSC01234.JPG',
    'P1000123.JPG', 'received_1234567890123456.jpeg', '0724103357.jpg', '2031-01-01.jpg', '1989-12-31.jpg']) {
    assert.deepEqual(L.extractDatesFromFilename(name, nowMs), [], name);
  }
  assert.equal(L.extractDatesFromFilename('PXL_20240101_123456789.jpg', nowMs)[0].utcMs, Date.UTC(2024, 0, 1, 12, 34, 56));
});

test('C-4 推定の順位、整合度、更新日時の注記', () => {
  const estimate = (input) => L.estimateDateTime({ offsetMin: 540, nowMs, ...input });
  const result = estimate({ exif, fileName: '2016-07-24 10.33.57.jpg', lastModifiedMs: 1469324036000 });
  assert.deepEqual(result.sources.map((s) => s.type),
    ['exif_original', 'gps_utc', 'exif_digitized', 'filename', 'exif_modified', 'file_modified']);
  assert.equal(result.conflicts.length, 0);
  assert.equal(result.confidence, 0.95);
  assert.equal(result.estimatedUtcMs, 1469324037000);
  const lastModifiedMs = Date.UTC(2024, 0, 1, 3, 34, 58);
  const filename = estimate({ fileName: 'IMG_20240101_123456.jpg', lastModifiedMs });
  assert.equal(filename.best.type, 'filename');
  assert.equal(filename.confidence, 0.6);
  assert.equal(filename.estimatedUtcMs, Date.UTC(2024, 0, 1, 3, 34, 56));
  const modified = estimate({ fileName: 'photo.jpg', lastModifiedMs });
  assert.equal(modified.best.type, 'file_modified');
  assert.equal(modified.confidence, 0.3);
  const original = { dateTimeOriginal: '2016:07:24 10:33:57' };
  const downloaded = estimate({ exif: original, fileName: 'photo.jpg', lastModifiedMs: Date.UTC(2025, 4, 5) });
  assert.equal(downloaded.confidence, 0.95);
  assert.equal(downloaded.conflicts.length, 0);
  assert.deepEqual(downloaded.notes.map((n) => n.type), ['file_modified']);
  const conflict = estimate({ exif: original, fileName: 'IMG_20240101_123456.jpg' });
  assert.equal(conflict.conflicts.length, 1);
  assert.equal(conflict.agreement, 0);
  assert.equal(conflict.confidence, 0.48);
  const edited = estimate({
    exif: { ...original, dateTime: '2016:08:01 09:00:00' }, fileName: '2016-07-24 10.33.57.jpg',
  });
  assert.equal(edited.confidence, 0.95);
  assert.deepEqual(edited.notes.map((n) => n.type), ['exif_modified']);
  assert.equal(estimate({ exif: { dateTime: '2016:08:01 09:00:00' }, fileName: 'IMG_20160724_103357.jpg' }).best.type, 'filename');
  const pxl = estimate({ fileName: 'PXL_20240101_033456789.jpg' });
  assert.equal(L.formatWall(L.utcMsToWall(pxl.estimatedUtcMs, 540), 540), '2024/01/01 12:34:56（UTC+09:00）');
  const empty = estimate({ fileName: 'photo.jpg', lastModifiedMs: null });
  assert.equal(empty.best, null);
  assert.equal(empty.confidence, 0);
  assert.equal(empty.estimatedUtcMs, null);
});

test('E-9 方位・距離・度分秒・ゼロ座標', () => {
  assert.equal(L.bearing(34.286114, 133.799835, 34.291114, 133.799835), 0);
  assert.equal(L.bearing(34.286114, 133.799835, 34.286114, 133.804835).toFixed(4), '89.9986');
  const p = L.destinationPoint(34.286114, 133.799835, 90, 200);
  assert.equal(p.lat.toFixed(6), '34.286114');
  assert.equal(p.lng.toFixed(6), '133.802012');
  assert.equal(L.distanceM(34.286114, 133.799835, p.lat, p.lng).toFixed(1), '200.0');
  for (const [value, isLat, expected] of [
    [35.9999999, true, `36°0'0.00"N`], [-0.5, true, `0°30'0.00"S`], [-74.006, false, `74°0'21.60"W`],
    [0, false, `0°0'0.00"E`], [lat, true, `34°17'10.01"N`], [lng, false, `133°47'59.41"E`],
  ]) assert.equal(L.decimalToDms(value, isLat), expected);
  assert.equal(L.isValidLatLng(0, 0), true);
  assert.equal(L.isValidLatLng(-90, 180), true);
  assert.equal(L.isValidLatLng(90.1, 0), false);
  assert.equal(L.isValidLatLng('35', 139), false);
});

test('F-6 外部リンクは撮影地の日付と安全な座標を使う', () => {
  const nasa = 'https://worldview.earthdata.nasa.gov/?v=132.799835%2C33.286114%2C134.799835%2C35.286114&t=2016-07-24'
    + '&l=MODIS_Terra_CorrectedReflectance_TrueColor%2CMODIS_Aqua_CorrectedReflectance_TrueColor'
    + '%2CVIIRS_SNPP_CorrectedReflectance_TrueColor%2CReference_Labels_15m%2CReference_Features_15m';
  assert.equal(L.nasaWorldviewUrl(lat, lng, W), nasa);
  const early = { ...W, hour: 5, minute: 0, second: 0 };
  assert.match(L.nasaWorldviewUrl(lat, lng, early), /t=2016-07-24/);
  assert.equal(L.sunCalcOrgUrl(lat, lng, W), 'https://www.suncalc.org/#/34.286114,133.799835,15/2016.07.24/10:33/1/3');
  assert.equal(L.sunCalcOrgUrl(lat, lng, early), 'https://www.suncalc.org/#/34.286114,133.799835,15/2016.07.24/05:00/1/3');
  for (const [photo, base] of [[false, 'std'], [true, 'ort']]) {
    assert.equal(L.gsiMapUrl(lat, lng, photo),
      `https://maps.gsi.go.jp/#15/34.286114/133.799835/&base=${base}&ls=${base}&disp=1&vs=c1j0h0k0l0u0t0z0r0s0m0f1`);
  }
  const sv = 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=';
  assert.equal(L.streetViewUrl(lat, lng, null), sv + '34.286114,133.799835');
  assert.equal(L.streetViewUrl(lat, lng, 89.6), sv + '34.286114,133.799835&heading=90');
  assert.equal(L.streetViewUrl(51.4779, -0.0015, -30), sv + '51.4779,-0.0015&heading=330');
  assert.equal(L.streetViewUrl(0, 0, null), sv + '0,0');
  assert.equal(L.nasaWorldviewUrl(91, 0, W), null);
  const jma = 'https://www.data.jma.go.jp/stats/etrn/view/hourly_s1.php'
    + '?prec_no=72&block_no=47891&year=2016&month=7&day=24&view=';
  assert.deepEqual(L.jmaHourlyUrl(lat, lng, 1469324037000, stations), { url: jma, station: '高松', distanceKm: 23 });
  assert.equal(L.jmaHourlyUrl(lat, lng, Date.parse('2016-07-23T20:00:00Z'), stations).url, jma);
  assert.deepEqual(L.jmaHourlyUrl(48.8584, 2.2945, 1469324037000, stations),
    { url: 'https://www.data.jma.go.jp/stats/etrn/index.php', station: null, distanceKm: null });
  const naha = L.nearestStation(26.2124, 127.6809, stations);
  assert.equal(naha.station.name, '那覇');
  assert.equal(naha.distanceKm, 1);
  for (const [lat, lng] of [[27.0944, 142.1917], [35.1796, 129.0756], [37.5665, 126.978],
    [48.8584, 2.2945], [0, 0], [NaN, 0]]) assert.equal(L.nearestStation(lat, lng, stations), null);
});

test('G-4 レポートの15行と最小入力の8行', () => {
  const expected = [
    'WhereShot 解析レポート',
    'ファイル: 2016-07-24 10.33.57.jpg（3,571,592 バイト、image/jpeg）',
    'SHA-256: a08e3c4742a0a910e2df04a71f0b165fd87281695a26ac7fe5056a15752aaff8',
    '撮影日時（現地）: 2016/07/24 10:33:57（UTC+09:00）',
    '撮影日時（UTC）: 2016-07-24 01:33:57 UTC',
    'UTCオフセットの根拠: GPS時刻との差から推定（残差 -1 秒）',
    '日時の根拠: Exif撮影日時（整合度 95%）',
    `位置: 34.286114, 133.799835（34°17'10.01"N, 133°47'59.41"E）`,
    '位置の根拠: ExifのGPS',
    '撮影方位: 記録なし',
    '太陽: 高度 64.0°、方位 117.3°（東南東）、午前',
    '影: 297.3°（西北西）方向、長さは高さの 0.49 倍',
    '最寄りの気象庁観測所: 高松（約 23 km）',
    'レポート作成: 2026-09-20 00:00:00 UTC',
    '注意: Exif・ファイル名・更新日時は書き換えられる。この結果だけで撮影の事実を断定しないこと。',
  ];
  assert.equal(expected.length, 15);
  assert.equal(L.buildReport(reportInput), expected.join('\n'));
  const minimal = { fileName: 'photo.png', fileSize: 72, fileType: '', sha256: null, wall: null,
    latitude: null, longitude: null, directionDeg: 271.26, sun: null, station: null, generatedAtUtcMs: nowMs };
  assert.equal(L.buildReport(minimal), [
    'WhereShot 解析レポート', 'ファイル: photo.png（72 バイト、種類不明）', 'SHA-256: 未計算',
    '撮影日時: 不明', '位置: 不明', '撮影方位: 271.3°（西）', 'レポート作成: 2026-09-20 00:00:00 UTC', expected.at(-1),
  ].join('\n'));
});

test('H-8 不正入力は例外にしない', () => {
  for (const v of [null, undefined, '', 42, 'x'.repeat(10000), '😀', '\u0000\u001f']) {
    for (const fn of [L.parseExifDateTime, L.parseOffset, L.normalizeTags, L.buildReport]) {
      assert.doesNotThrow(() => fn(v));
    }
    assert.doesNotThrow(() => L.extractDatesFromFilename(v, nowMs));
    assert.doesNotThrow(() => L.nearestStation(v, v, stations));
    assert.doesNotThrow(() => L.nearestStation(0, 0, v));
  }
});
