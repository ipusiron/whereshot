const fs = require('node:fs');
const path = require('node:path');
const L = require('../../js/whereshot-logic');
const ExifReader = require('../../vendor/exifreader/exif-reader.min');
const SunCalc = require('../../vendor/suncalc/suncalc');
const stations = require('../../data/stations.json');
const buffer = fs.readFileSync(path.join(__dirname, '../../assets/2016-07-24 10.33.57.jpg'));
const exif = L.normalizeTags(ExifReader.load(buffer, { expanded: true }));
const nowMs = Date.UTC(2026, 8, 20);
const wall = { year: 2016, month: 7, day: 24, hour: 10, minute: 33, second: 57 };
const latitude = 34.28611372222222;
const longitude = 133.79983519444446;
const utcMs = 1469324037000;
const sha256 = 'a08e3c4742a0a910e2df04a71f0b165fd87281695a26ac7fe5056a15752aaff8';
const sun = L.sunReport(SunCalc, latitude, longitude, utcMs);
const reportInput = {
  fileName: '2016-07-24 10.33.57.jpg', fileSize: 3571592, fileType: 'image/jpeg', sha256,
  wall, offsetMin: 540, offsetSource: 'gps', residualSec: -1, dateSourceLabel: 'Exif撮影日時',
  confidence: 0.95, latitude, longitude, locationSource: 'exif', directionDeg: null, sun,
  station: '高松', stationKm: 23, generatedAtUtcMs: nowMs,
};
module.exports = { L, ExifReader, SunCalc, stations, buffer, exif, nowMs, wall, latitude, longitude, utcMs, sha256, sun, reportInput };
