const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const I18n = require('../js/i18n');
const L = require('../js/whereshot-logic');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = fs.readdirSync(path.join(root, 'js'))
  .filter((name) => name.endsWith('.js') && name !== 'i18n.js');
const sources = Object.fromEntries(scripts
  .map((name) => [name, fs.readFileSync(path.join(root, 'js', name), 'utf8')]));
// gフラグを付けるとlastIndexが残り、ループで交互にfalseになる。
const JP = /[぀-ヿ一-鿿]/;
const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test('L-1 日英でキーの集合が一致する', () => {
  const ja = Object.keys(I18n.ja);
  const en = Object.keys(I18n.en);
  assert.deepEqual(ja.filter((key) => !(key in I18n.en)), []);
  assert.deepEqual(en.filter((key) => !(key in I18n.ja)), []);
  assert.deepEqual(ja, en, 'キーの並びもそろえる');
  assert.ok(ja.length >= 200, String(ja.length));
  assert.deepEqual(I18n.LANGUAGES, ['ja', 'en']);
  assert.equal(I18n.STORAGE_KEY, 'whereshot-language');
});

test('L-1 差し込みの名前が日英で一致する', () => {
  for (const key of Object.keys(I18n.ja)) {
    assert.deepEqual(placeholders(I18n.en[key]), placeholders(I18n.ja[key]), key);
  }
});

test('L-1 英語の辞書に和文が残っていない', () => {
  const allowed = new Set(['app.langButton']);
  for (const [key, value] of Object.entries(I18n.en)) {
    if (allowed.has(key)) continue;
    assert.ok(!JP.test(value), `${key}: ${value}`);
  }
  assert.equal(I18n.en['app.langButton'], '日本語');
});

test('L-2 HTMLが指すキーがすべて辞書にある', () => {
  const keys = [...html.matchAll(/data-i18n(?:-[\w-]+)?="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length >= 70, String(keys.length));
  for (const key of new Set(keys)) assert.ok(key in I18n.ja, key);
  // 切り替えボタンは検証プローブが決め打ちで押すので id を固定する。
  const toggle = html.match(/<button[^>]*id="langToggle"[^>]*>/)[0];
  assert.match(toggle, /data-i18n="app\.langButton"/);
  assert.match(toggle, /data-i18n-aria-label="app\.langAria"/);
});

test('L-2 スクリプトが呼ぶキーがすべて辞書にある', () => {
  // t('x') だけでなく msg('x')・key: 'x'・dataset.i18n の三項演算子も拾えるよう、
  // 文字列リテラルを集めてから名前空間で絞る。
  const spaces = new Set(Object.keys(I18n.ja).map((key) => key.split('.')[0]));
  const found = new Set();
  for (const source of Object.values(sources)) {
    for (const m of source.matchAll(/'([a-z][A-Za-z0-9_]*\.[A-Za-z0-9_.-]*[A-Za-z0-9_])'/g)) {
      const value = m[1];
      if (/\.(js|cjs|json|css|md|html)$/.test(value)) continue;
      if (spaces.has(value.split('.')[0])) found.add(value);
    }
  }
  assert.ok(found.size >= 40, String(found.size));
  for (const key of found) assert.ok(key in I18n.ja, key);
  // 組み立てるキーは別に数え上げる（'phase.' + phase の形）。
  for (const phase of L.PHASE_KEYS) assert.ok(L.phaseKey(phase) in I18n.ja, phase);
  assert.equal(L.phaseKey('nope'), 'report.unknown');
  for (const key of L.CARDINAL_KEYS) assert.ok(key in I18n.ja, key);
  for (const table of [L.SOURCE_KEYS, L.OFFSET_SOURCE_KEYS, L.LOCATION_SOURCE_KEYS]) {
    for (const key of Object.values(table)) assert.ok(key in I18n.ja, key);
  }
});

test('L-3 t()は差し込みを埋め、知らないキーで例外になる', () => {
  assert.equal(I18n.t('estimation.confidence', { percent: 95 }), '整合度: 95%');
  assert.equal(I18n.tIn('en', 'estimation.confidence', { percent: 95 }), 'Consistency: 95%');
  // 値を渡さなかった差し込みは、そのまま残して欠落に気づけるようにする。
  assert.equal(I18n.t('estimation.confidence'), '整合度: {percent}%');
  assert.throws(() => I18n.t('no.such.key'), /Unknown message key: no\.such\.key/);
  assert.throws(() => I18n.tIn('en', 'no.such.key'), /Unknown message key/);
  assert.equal(I18n.language, 'ja', '既定は日本語（DOMなしでも壊れない）');
});

test('L-3 入れ子の{key, params}は表示の直前に訳す', () => {
  const entry = L.msg('report.offsetBasis', {
    source: L.msg('report.offsetGps'), residual: L.msg('report.residual', { seconds: -1 }),
  });
  assert.equal(I18n.message(entry, 'ja'), 'UTCオフセットの根拠: GPS時刻との差から推定（残差 -1 秒）');
  assert.equal(I18n.message(entry, 'en'),
    'Basis of the UTC offset: inferred from the gap with the GPS time (residual -1 s)');
  assert.equal(I18n.messages([L.msg('report.title'), L.msg('report.caution')], 'en').split('\n').length, 2);
  assert.equal(I18n.message(null), '');
  assert.equal(I18n.message('report.title', 'en'), 'WhereShot analysis report');
});

test('L-4 data-i18nを付けた要素が子要素を抱えていない', () => {
  // 閉じタグの中で改行することがあるため </\\1\\s*> にする。
  const pattern = /<(\w+)[^>]*\sdata-i18n="[^"]+"[^>]*>([\s\S]*?)<\/\1\s*>/g;
  let count = 0;
  for (const m of html.matchAll(pattern)) {
    assert.ok(!m[2].includes('<'), m[0].slice(0, 120));
    count++;
  }
  assert.ok(count >= 60, String(count));
});

test('L-4 状態で変わるスロットと属性にdata-i18nを付けない', () => {
  const slots = ['upload-title', 'upload-filename', 'toggle-preview-btn', 'preview-message',
    'file-name', 'file-size', 'file-type', 'file-modified', 'file-sha256',
    'datetime-info', 'gps-info', 'camera-info', 'settings-info',
    'estimated-datetime-value', 'estimation-confidence', 'datetime-sources',
    'map-coordinates', 'direction-info', 'utc-offset-source', 'weather-link', 'weather-note',
    'sun-elevation', 'sun-azimuth', 'sun-phase', 'shadow-direction', 'shadow-length',
    'report-preview', 'estimation-warnings'];
  for (const id of slots) {
    const tag = html.match(new RegExp(`<[^>]*id="${id}"[^>]*>`))[0];
    assert.doesNotMatch(tag, /data-i18n/, id);
  }
  // 状態から組み立てる文言は、辞書の両方に存在することだけを固定する。
  for (const key of ['preview.show', 'preview.hide', 'upload.title', 'upload.done',
    'external.weather', 'external.weatherStation', 'map.statusLoading', 'map.statusReady',
    'map.statusFailed', 'file.hashUnavailable', 'time.unknown']) {
    assert.ok(key in I18n.ja && key in I18n.en, key);
  }
});

test('L-5 metaのcontentも訳す', () => {
  const metas = [...html.matchAll(/<meta\b[^>]*>/g)].map((m) => m[0]);
  const translated = metas.filter((tag) => /data-i18n-content="/.test(tag));
  assert.equal(translated.length, 6);
  for (const name of ['description', 'keywords', 'og:title', 'og:description',
    'twitter:title', 'twitter:description']) {
    const tag = metas.find((m) => new RegExp(`(?:name|property)="${name}"`).test(m));
    assert.ok(tag, name);
    assert.match(tag, /data-i18n-content="app\.(title|description|keywords)"/, name);
  }
  // 和文のcontentを持つmetaに訳し忘れがない（英語で共有したときOGPが日本語にならない）。
  for (const tag of metas) {
    const content = tag.match(/\bcontent="([^"]*)"/)?.[1] || '';
    if (JP.test(content)) assert.match(tag, /data-i18n-content=/, tag.slice(0, 90));
  }
});

test('L-5 noscriptは日英を1つのテキストノードで併記する', () => {
  const noscript = html.match(/<noscript>([\s\S]*?)<\/noscript>/)[1];
  assert.doesNotMatch(noscript, /</);
  assert.ok(JP.test(noscript));
  assert.match(noscript, /Enable JavaScript/);
});

test('L-6 HTMLに残る和文は、data-i18n以外では表題とnoscriptだけ', () => {
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(\w+)[^>]*\sdata-i18n="[^"]+"[^>]*>[\s\S]*?<\/\1\s*>/g, '')
    .replace(/<[^>]*data-i18n-[\w-]+="[^"]*"[^>]*>/g, '');
  const left = stripped.split('\n').map((line) => line.trim()).filter((line) => JP.test(line));
  assert.deepEqual(left, [
    '<title>WhereShot - 撮影時刻・場所解析ツール</title>',
    '<noscript>このツールを使うにはJavaScriptを有効にしてください。画像とExifは送信しません。'
      + ' / Enable JavaScript to use this tool. Images and Exif are never uploaded.</noscript>',
  ]);
});

test('L-6 スクリプトに残る和文は、コメントと日本語ファイル名のパターンだけ', () => {
  const left = [];
  for (const [name, source] of Object.entries(sources)) {
    for (const line of source.split('\n')) {
      const text = line.trim();
      if (!JP.test(text) || /^(\*|\/\/|\/\*)/.test(text)) continue;
      left.push(`${name}: ${text}`);
    }
  }
  assert.deepEqual(left, [
    'map-controller.js: center: [35.6762, 139.6503], // 東京',
    'whereshot-logic.js: re: /(\\d{4})年(\\d{1,2})月(\\d{1,2})日\\s?(\\d{1,2})時(\\d{1,2})分(\\d{1,2})秒/g,',
    "whereshot-logic.js: { id: 'ja-date', kind: 'wall', hasTime: false, reliability: 0.4,"
      + ' re: /(\\d{4})年(\\d{1,2})月(\\d{1,2})日/g },',
  ]);
});

test('L-6 表示中の文字列との一致で状態を判定していない', () => {
  for (const [name, source] of Object.entries(sources)) {
    // 和文リテラルとの比較も、和文の書き戻しも残っていないこと。
    assert.doesNotMatch(source, /[=!]==?\s*'[^']*[぀-ヿ一-鿿]/, name);
    assert.doesNotMatch(source, /textContent\s*=\s*'[^']*[぀-ヿ一-鿿]/, name);
    assert.doesNotMatch(source, /toCardinalJa|PHASE_JA|SOURCE_LABEL|OFFSET_SOURCE_JA/, name);
  }
  // 純ロジックはI18nを知らない（DOM層と分ける設計上の理由）。
  assert.doesNotMatch(sources['whereshot-logic.js'], /I18n/);
});

test('L-7 言語を切り替えても解析レポートの行数と構造が変わらない', () => {
  const S = require('./fixtures/sample.cjs');
  const report = L.buildReport(S.reportInput);
  const ja = I18n.messages(report, 'ja').split('\n');
  const en = I18n.messages(report, 'en').split('\n');
  assert.equal(ja.length, en.length);
  assert.equal(ja.length, 15);
  for (let i = 0; i < ja.length; i++) {
    assert.ok(ja[i].length > 0 && en[i].length > 0, String(i));
    assert.ok(!JP.test(en[i]) || en[i].includes('高松'), en[i]);
  }
});
