const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const S = require('./fixtures/sample.cjs');
const { L, nowMs, exif, wall, latitude: lat, longitude: lng, utcMs, sun, stations, buffer } = S;
const root = path.join(__dirname, '..');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
function section(title, level = 3) {
  const marker = '#'.repeat(level) + ' ' + title;
  const start = readme.indexOf(marker);
  assert.ok(start >= 0, title);
  const end = readme.indexOf('\n' + '#'.repeat(level), start + marker.length);
  const higher = readme.indexOf('\n## ', start + marker.length);
  return readme.slice(start, Math.min(...[end, higher, readme.length].filter((n) => n >= 0)));
}
function rows(text) {
  const lines = text.split('\n').filter((line) => line.startsWith('|'));
  assert.ok(lines.length > 2);
  return lines.slice(2).map((line) => line.split('|').slice(1, -1).map((v) => v.trim()));
}

test('K 対応形式表はvalidateFileの6つのMIMEと一致', () => {
  const table = rows(section('対応形式'));
  assert.equal(table.length, 5);
  const types = table.flatMap((r) => r[1].split('、'));
  assert.equal(types.length, 6);
  const source = fs.readFileSync(path.join(root, 'js/utils.js'), 'utf8');
  const allowed = [...source.match(/const allowedTypes = \[([^]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(types, allowed);
  const context = { window: {} };
  vm.runInNewContext(source, context);
  for (const type of types) assert.equal(context.window.WhereShotUtils.FileUtils.validateFile({ type, size: 1 }).isValid, true);
  assert.equal(context.window.WhereShotUtils.FileUtils.validateFile({ type: 'video/mp4', size: 1 }).isValid, false);
});

test('K ファイル名の表9行を再計算', () => {
  const table = rows(section('ファイル名の形式'));
  assert.equal(table.length, 9);
  for (const [name, pattern, value, base] of table) {
    const result = L.extractDatesFromFilename(name, nowMs);
    assert.equal(result.length, 1, name);
    const r = result[0];
    assert.equal(r.pattern, pattern, name);
    assert.equal(r.wall ? L.formatWall(r.wall, null) : L.formatUtc(r.utcMs), value, name);
    assert.equal(base.startsWith('UTC'), r.utcMs !== undefined, name);
    assert.equal(base.includes('日付のみ'), !r.hasTime, name);
  }
});

test('K サンプル解析例10行を実画像から再計算', () => {
  const table = rows(section('サンプル画像の解析例'));
  assert.equal(table.length, 10);
  const values = Object.fromEntries(table);
  const offset = L.decideOffset({ exifOffset: exif.offsetTimeOriginal, wall, gpsUtcMs: exif.gpsUtcMs, browserOffsetMin: -420 });
  assert.equal(values['撮影日時（現地）'], L.formatWall(wall, null));
  assert.equal(values['撮影日時（UTC）'], L.formatUtc(utcMs));
  assert.equal(values['UTCオフセット'], `${L.formatOffset(offset.offsetMin)}（GPS時刻との差、残差${offset.residualSec}秒）`);
  assert.equal(values['太陽高度'], sun.altitudeDeg.toFixed(1) + '°');
  assert.equal(values['太陽方位'], `${sun.azimuthDeg.toFixed(1)}°（${L.toCardinalJa(sun.azimuthDeg)}）`);
  assert.equal(values['影の方向'], `${sun.shadowDirectionDeg.toFixed(1)}°（${L.toCardinalJa(sun.shadowDirectionDeg)}）`);
  assert.equal(values['影の長さ'], `高さの${sun.shadowRatio.toFixed(2)}倍`);
  const estimate = L.estimateDateTime({ exif, fileName: '2016-07-24 10.33.57.jpg', offsetMin: 540, nowMs });
  assert.equal(values['整合度'], `${Math.round(estimate.confidence * 100)}%`);
  const jma = L.jmaHourlyUrl(lat, lng, utcMs, stations);
  assert.equal(values['最寄りの観測所'], `${jma.station}（約${jma.distanceKm}km）`);
  assert.equal(values['SHA-256'], createHash('sha256').update(buffer).digest('hex'));
});

test('K 通信表5行、CSP、スクリプトとタイルURL', () => {
  const table = rows(section('通信先'));
  assert.equal(table.length, 5);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const map = fs.readFileSync(path.join(root, 'js/map-controller.js'), 'utf8');
  for (const row of table.slice(0, 4)) assert.ok(html.includes('https://' + row[1]), row[1]);
  assert.ok(html.includes('src="https://' + table[0][1]));
  for (const row of table.slice(1, 4)) {
    assert.ok(map.includes(row[1].replace('*.', '{s}.')), row[1]);
  }
  const url = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  assert.ok(map.includes(url));
  assert.ok(readme.includes(url));
  assert.ok(readme.includes('strict-origin-when-cross-origin'));
  assert.match(table[4][0], /外部リンクを押したときだけ/);
});

test('K 画像参照と構成図の全パスが実在する', () => {
  const images = [...readme.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)]
    .map((m) => m[1]).filter((p) => !/^https?:/.test(p));
  assert.equal(images.length, 3);
  for (const file of images) assert.ok(fs.existsSync(path.join(root, decodeURIComponent(file))), file);
  const tree = section('📁 ディレクトリー構造', 2).match(/```text\n([^]*?)```/)[1];
  const stack = [];
  const checked = [];
  for (const line of tree.split('\n').slice(1)) {
    const match = line.match(/^([│ ]*)(?:├── |└── )([^#]+?)(?:\s+#.*)?$/);
    if (!match) continue;
    const depth = match[1].length / 4;
    stack.length = depth;
    const name = match[2].trim();
    const file = [...stack, name].join('/');
    assert.ok(fs.existsSync(path.join(root, file)), file);
    checked.push(file);
    if (name.endsWith('/')) stack[depth] = name.slice(0, -1);
  }
  assert.equal(checked.length, 26);
});

test('K YAML構造・保護値・シリーズ表記・未実装機能の範囲', () => {
  const yaml = readme.match(/^<!--\r?\n---\r?\n([^]*?)\r?\n---\r?\n-->/)?.[1];
  assert.ok(yaml);
  const keys = [...yaml.matchAll(/^(\w+):/gm)].map((m) => m[1]);
  assert.deepEqual(keys, ['id', 'slug', 'title', 'subtitle_ja', 'subtitle_en', 'description_ja', 'description_en',
    'category_ja', 'category_en', 'difficulty', 'tags', 'repo_url', 'demo_url', 'hub']);
  for (const key of ['category_ja', 'category_en', 'tags']) assert.match(yaml, new RegExp(`${key}:\\r?\\n  - `));
  assert.match(yaml, /^id: day013$/m);
  assert.match(yaml, /^slug: whereshot$/m);
  const head = execFileSync('git', ['show', 'HEAD:README.md'], { cwd: root, encoding: 'utf8' });
  for (const key of ['id', 'slug', 'repo_url', 'demo_url', 'hub']) {
    const re = new RegExp(`^${key}:.*$`, 'm');
    assert.equal(yaml.match(re)[0], head.match(re)[0]);
  }
  assert.ok(readme.includes('Day013 - 生成AIで作るセキュリティツール100'));
  assert.ok(readme.includes('https://akademeia.info/?page_id=42163'));
  const withoutFuture = readme.replace(/## 🧭 今後の候補[^]*?(?=\n## )/, '');
  assert.doesNotMatch(withoutFuture, /バッチ処理|CSV|座標系変換|UTM|JGD2011|視野角|磁気偏角|季節判定|自動削除|一時ストレージ/);
});
