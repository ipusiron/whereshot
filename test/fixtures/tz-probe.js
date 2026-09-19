// TZ設定が効いた診断値と、TZに依存してはいけない計算結果を分けて出す。
const S = require('./sample.cjs');
const { L, exif, nowMs, wall, latitude: lat, longitude: lng, utcMs, reportInput, sun, stations } = S;
const filenames = [
  '2016-07-24 10.33.57.jpg', 'IMG_20240101_123456.jpg', 'VID_20240101_123456.mp4', '20240101_123456.jpg',
  'Screenshot_20240101-123456.png', 'PXL_20240101_123456789.jpg', 'Screenshot_2024-01-01-12-34-56.png',
  'WhatsApp Image 2024-01-01 at 12.34.56.jpeg', 'signal-2024-01-01-123456.jpg', 'スクリーンショット 2024-01-01 123456.png',
  '20160724103357.jpg', '2024年1月1日12時34分56秒.jpg', 'IMG-20240101-WA0001.jpg', 'image_1920x1080_20240101.jpg',
  '1609459200.jpg', 'FB_IMG_1609459200123.jpg', '2024-01-01 25.61.61.jpg', '2024-02-31 10.00.00.jpg',
  '2024-13-01.jpg', 'IMG_1234.JPG', 'DSC01234.JPG', 'P1000123.JPG', 'received_1234567890123456.jpeg',
  '0724103357.jpg', '2031-01-01.jpg', '1989-12-31.jpg',
];
const data = {
  estimate: L.estimateDateTime({ exif, fileName: '2016-07-24 10.33.57.jpg', lastModifiedMs: 1469324036000, offsetMin: 540, nowMs }),
  sun,
  links: [L.nasaWorldviewUrl(lat, lng, wall), L.sunCalcOrgUrl(lat, lng, wall), L.gsiMapUrl(lat, lng),
    L.streetViewUrl(lat, lng, null), L.jmaHourlyUrl(lat, lng, utcMs, stations)],
  report: L.buildReport(reportInput),
  filenames: filenames.map((name) => L.extractDatesFromFilename(name, nowMs)),
};
if (process.argv.includes('--probe')) {
  process.stdout.write(JSON.stringify({ timezoneOffset: new Date(2016, 6, 24).getTimezoneOffset(), data }));
}
