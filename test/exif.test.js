const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { L, exif, buffer, sha256 } = require('./fixtures/sample.cjs');

test('B-8 実画像をExifReaderで読み、平たいメタデータへ正規化する', () => {
  for (const key of ['dateTimeOriginal', 'dateTimeDigitized', 'dateTime']) {
    assert.equal(exif[key], '2016:07:24 10:33:57');
  }
  for (const key of ['offsetTimeOriginal', 'offsetTime', 'imgDirection', 'software', 'lensModel', 'hPositioningError']) {
    assert.equal(exif[key], null);
  }
  assert.equal(exif.gpsUtcMs, 1469324038000);
  assert.ok(Math.abs(exif.latitude - 34.28611372222222) < 1e-9);
  assert.ok(Math.abs(exif.longitude - 133.79983519444446) < 1e-9);
  assert.equal(exif.altitude, 65);
  assert.equal(exif.make, 'JIAYU');
  assert.equal(exif.model, 'S3');
  assert.equal(exif.exposureTime, 0.000501);
  assert.equal(exif.fNumber, 2);
  assert.equal(exif.iso, 114);
  assert.equal(exif.focalLength, 3.5);
  assert.equal(createHash('sha256').update(buffer).digest('hex'), sha256);
  assert.equal(buffer.length, 3571592);
});

test('B-8 カメラ名・ExposureTime・空のタグ・Unicode', () => {
  assert.equal(L.formatCamera('JIAYU', 'S3'), 'JIAYU S3');
  assert.equal(L.formatCamera('Canon', 'Canon EOS R5'), 'Canon EOS R5');
  assert.equal(L.formatCamera(null, null), '不明');
  for (const [v, expected] of [[0.000501, '1/1996s'], [1 / 250, '1/250s'], [2, '2s'], [0.5, '1/2s'], [0, null], [null, null]]) {
    assert.equal(L.formatExposure(v), expected);
  }
  for (const tags of [{}, null, { exif: {}, gps: {} }]) {
    const n = L.normalizeTags(tags);
    assert.equal(Object.keys(n).length, 20);
    assert.ok(Object.values(n).every((v) => v === null));
  }
  assert.equal(L.normalizeTags({ exif: { Make: { value: ['Société Française'] } } }).make, 'Société Française');
  assert.equal(L.normalizeTags({ exif: { Make: { value: ['\u0000 한국어 \u007f'] } } }).make, '한국어');
  assert.equal(L.normalizeTags({ exif: { Make: { value: ['あ'.repeat(201)] } } }).make.length, 200);
  const tags = { exif: {
    GPSImgDirection: { value: [27126, 100] }, GPSImgDirectionRef: { value: ['M'] },
    GPSHPositioningError: { value: [5, 2] }, GPSDOP: { value: [100, 1] },
  }, gps: { Latitude: 0, Longitude: 0 } };
  assert.equal(L.normalizeTags(tags).imgDirection, 271.26);
  assert.equal(L.normalizeTags(tags).imgDirectionRef, 'M');
  assert.equal(L.normalizeTags(tags).hPositioningError, 2.5);
  assert.equal(L.normalizeTags(tags).latitude, 0);
  tags.gps.Latitude = 91;
  assert.equal(L.normalizeTags(tags).latitude, null);
  assert.equal(L.normalizeTags(tags).longitude, null);
});

test('B-3 破損4種・読み取り失敗は必ず決着し、空の結果とreadFailedを返す', async () => {
  const context = { window: {}, WhereShotLogic: L,
    ExifReader: require('../vendor/exifreader/exif-reader.min.js') };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/exif-parser.js'), 'utf8'), context);
  const parser = context.window.WhereShotExifParser;
  const damaged = [
    Buffer.concat([Buffer.from('FFD8FFE1001045786966000049492A00', 'hex'), Buffer.alloc(40, 255)]),
    Buffer.from('FFD8FFD9', 'hex'),
    Buffer.concat([Buffer.from('89504E470D0A1A0A', 'hex'), Buffer.alloc(64)]),
    Buffer.alloc(64),
  ];
  for (const data of damaged) {
    const result = await parser.extractExifData({ arrayBuffer: async () => data });
    assert.ok(Object.values(result).every(value => value === null));
    assert.equal(parser.readFailed, true);
  }
  const result = await parser.extractExifData({ arrayBuffer: async () => { throw new Error('read failed'); } });
  assert.ok(Object.values(result).every(value => value === null));
  assert.equal(parser.readFailed, true);
  await parser.extractExifData({ arrayBuffer: async () => buffer });
  assert.equal(parser.readFailed, false);
  assert.equal(parser.getExtractedData().make, 'JIAYU');
});
