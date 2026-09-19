const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname, '../css/style.css'), 'utf8');
const root = css.match(/:root\s*\{([^}]+)\}/)[1];
const colors = Object.fromEntries([...root.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)].map((m) => [m[1], m[2]]));
function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map((v) => parseInt(v, 16) / 255);
  const linear = rgb.map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
const groups = [
  ['text', ['surface', 'surface-2', 'bg', 'bg-peak'], 4.5],
  ['text-secondary', ['surface', 'surface-2', 'bg-peak'], 4.5],
  ['text-muted', ['surface', 'surface-2', 'bg-peak'], 4.5],
  ['text-accent', ['surface', 'surface-2'], 4.5],
  ['#ffffff', ['primary', 'danger', 'success', 'external'], 4.5],
  ['#1f1300', ['warning'], 4.5],
  ['info', ['surface', 'surface-2'], 4.5],
  ['link', ['surface', 'bg-peak'], 4.5],
  ['ok', ['surface', 'surface-2'], 4.5],
  ['warn', ['surface', 'surface-2'], 4.5],
  ['err', ['surface', 'surface-2'], 4.5],
  ['border', ['surface', 'surface-2', 'bg-peak'], 3],
  ['focus', ['surface', 'bg', 'bg-peak'], 3],
];
test('J-2 WCAG 2.2の相対輝度からすべての指定ペアを計算', () => {
  let checked = 0;
  for (const [foreground, backgrounds, minimum] of groups) {
    for (const background of backgrounds) {
      const value = contrast(colors[foreground] || foreground, colors[background]);
      assert.ok(value >= minimum, `${foreground}/${background}: ${value}`);
      checked++;
    }
  }
  assert.equal(checked, 33);
  for (const name of ['surface', 'surface-2', 'bg', 'bg-peak']) assert.match(colors[name], /^#[0-9a-f]{6}$/);
  assert.doesNotMatch(css, /(?:outline|accent-color|border(?:-color)?):[^;]*var\(--primary\)/);
});
