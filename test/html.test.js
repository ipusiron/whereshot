const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];

test('I CSP・referrer・外部リソースの範囲とSRI', () => {
  const cspTag = html.match(/<meta[^>]+http-equiv="Content-Security-Policy"[^>]*>/)[0];
  const csp = attr(cspTag, 'content').replace(/\s+/g, ' ').trim();
  assert.doesNotMatch(csp, /frame-ancestors|'unsafe-inline'|'unsafe-eval'|https:(?!\/\/)/);
  assert.equal(csp, "default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com; "
    + "style-src 'self' https://cdnjs.cloudflare.com; img-src 'self' data: blob: https://tile.openstreetmap.org "
    + "https://server.arcgisonline.com https://*.tile.opentopomap.org; connect-src 'none'; font-src 'self'; "
    + "object-src 'none'; base-uri 'self'; form-action 'self'");
  // OSMタイル利用規約は有効なRefererを求めるためno-referrerにしない。
  assert.match(html, /<meta name="referrer" content="strict-origin-when-cross-origin">/);
  assert.match(html, /<noscript>/);
  assert.match(html, /<meta name="viewport"/);
  const remote = [...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="https?:[^>]+>/g)].map((m) => m[0]);
  assert.equal(remote.length, 2);
  const hashes = [
    'sha512-Zcn6bjR/8RZbLEpLIeOwNtzREBAJnUKESxces60Mpoj+2okopSAcSUIUOseddDm0cxnGQzxIR7vJgsLZbdLE3w==',
    'sha512-puJW3E/qXDqYp9IfhAI54BJEaWIfloJ7JWs7OeD5i6ruC9JZL1gERT1wjtwXFlh7CjE7ZJ+/vcRZRkIYIb6p4g==',
  ];
  remote.forEach((tag, i) => {
    assert.equal(attr(tag, 'integrity'), hashes[i]);
    assert.equal(attr(tag, 'crossorigin'), 'anonymous');
    assert.match(tag, /https:\/\/cdnjs.cloudflare.com\/ajax\/libs\/leaflet\/1.9.4\//);
  });
});

test('H-4 古典スクリプトをdefer付きで指定順に読み込む', () => {
  const tags = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
  const expected = [
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
    'vendor/exifreader/exif-reader.min.js', 'vendor/suncalc/suncalc.js', 'data/stations.js',
    'js/whereshot-logic.js', 'js/utils.js', 'js/exif-parser.js', 'js/sun-calculator.js',
    'js/map-controller.js', 'js/main.js',
  ];
  assert.deepEqual(tags.map((m) => attr(m[0], 'src')), expected);
  for (const tag of tags) {
    assert.match(tag[0], /\bdefer\b/);
    assert.doesNotMatch(tag[0], /type="module"/);
    assert.equal(tag[1].trim(), '');
  }
  assert.doesNotMatch(html, /\s(?:on\w+|style)\s*=|<style\b|exif-js|datetime-estimator\.js/i);
});

test('J ラベル・見出し・状態通知・ネイティブダイアログ', () => {
  const ids = ['file-input', 'file-select-btn', 'file-sha256', 'datetime-info', 'gps-info', 'direction-info',
    'analysis-date', 'utc-offset', 'utc-offset-source', 'map-layer-select', 'manual-location-btn',
    'direction-mode-btn', 'sun-elevation', 'sun-azimuth', 'sun-phase', 'shadow-direction', 'shadow-length',
    'copy-report-btn', 'report-preview', 'help-dialog'];
  for (const id of ids) assert.ok(html.includes(`id="${id}"`), id);
  for (const m of html.matchAll(/<(?:input|select)\b[^>]*>/g)) {
    assert.ok(html.includes(`for="${attr(m[0], 'id')}"`), m[0]);
  }
  assert.match(html, /<input[^>]*id="analysis-date"[^>]*step="1"/);
  assert.match(html, /<dialog id="help-dialog"[^>]*aria-labelledby="help-title"/);
  assert.match(html, /<button[^>]*class="modal-close"[^>]*aria-label="閉じる"/);
  const drop = html.match(/<div id="drop-zone"[^>]*>/)[0];
  assert.doesNotMatch(drop, /role=|tabindex=/);
  assert.match(drop, /aria-describedby=/);
  for (const id of ['estimation-warnings', 'utc-offset-source', 'sun-results', 'toast-region']) {
    assert.match(html.match(new RegExp(`<[^>]*id="${id}"[^>]*>`))[0], /aria-live="polite"/);
  }
  for (const id of ['manual-location-btn', 'direction-mode-btn']) {
    assert.match(html.match(new RegExp(`<[^>]*id="${id}"[^>]*>`))[0], /aria-pressed="false"/);
  }
  for (const m of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) {
    assert.equal(attr(m[0], 'rel'), 'noopener noreferrer');
  }
  let level = 0;
  for (const m of html.matchAll(/<h([1-6])\b/g)) {
    assert.ok(+m[1] <= level + 1, m[0]);
    level = +m[1];
  }
});

test('H・I DOMの安全な描画とロジックの環境非依存性', () => {
  const files = fs.readdirSync(path.join(root, 'js')).filter((name) => name.endsWith('.js'));
  assert.ok(!files.includes('datetime-estimator.js'));
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, 'js', file), 'utf8');
    assert.doesNotMatch(source,
      /innerHTML|insertAdjacentHTML|outerHTML|document\.write|console\.log|Math\.random|style\.cssText|\{s\}\.tile\.openstreetmap/);
    assert.doesNotMatch(source, /style\.display\s*=|\.onclick\s*=/);
  }
  const logic = fs.readFileSync(path.join(root, 'js/whereshot-logic.js'), 'utf8');
  const forbidden = /document|window|navigator|fetch\(|crypto|localStorage|Date\.now|console\.|getHours|getMinutes|getSeconds/;
  assert.doesNotMatch(logic, forbidden);
  assert.doesNotMatch(logic, /getDate\(|getMonth|getFullYear|getDay\(|getTimezoneOffset|toLocale/);
  assert.doesNotMatch(logic, /new Date\(\s*[A-Za-z_$][\w$.]*\s*,/);
  const map = fs.readFileSync(path.join(root, 'js/map-controller.js'), 'utf8');
  assert.ok(map.includes('https://tile.openstreetmap.org/{z}/{x}/{y}.png'));
  assert.doesNotMatch(map, /L\.control\.layers|style\.transform/);
});
