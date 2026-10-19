'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../model.js');
const X = require('../exports.js');
const close = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected}`);
function minimal(row = {}) {
  const s = M.defaults(); s.containers = 3; s.cargoWeight = 12; s.sellingPrice = 100;
  s.expenses = [{ id: 'test', name: 'Synthetic expense', amount: 10, currency: 'USD', basis: 'train', category: 'Other', enabled: true, ...row }];
  return s;
}
test('RUB is divided by RUB-per-USD, without premature rounding', () => {
  const s = minimal({ amount: 86900, currency: 'RUB', basis: 'container' });
  close(M.calculate(s).totalCosts, 86900 / 85.1 * 3);
});
test('VND conversion', () => close(M.calculate(minimal({ amount: 260000, currency: 'VND' })).totalCosts, 10));
test('expense per MT', () => close(M.calculate(minimal({ basis: 'mt' })).totalCosts, 360));
test('expense per container', () => close(M.calculate(minimal({ basis: 'container' })).totalCosts, 30));
test('fixed expense per block train, including an empty shipment', () => {
  const s = minimal(); close(M.calculate(s).totalCosts, 10); s.containers = 0;
  const r = M.calculate(s); close(r.totalCosts, 10); close(r.profit, -10); assert.equal(r.costPerMT, null);
});
test('transport commission excludes goods, other costs, disabled rows, and all percentages', () => {
  const s = M.defaults(); const r = M.calculate(s);
  const base = 114 * (86900 / 85.1 + 925 + 450);
  close(r.transportationBase, base);
  close(r.rows.find(e => e.id === 'antin').total, base * .04);
  s.expenses.find(e => e.id === 'inland').enabled = false;
  s.expenses.push({ id: 'recursive', name: 'Synthetic transport fee', amount: 50, currency: 'USD', basis: 'transport', category: 'Transportation', enabled: true });
  const next = M.calculate(s), expected = 114 * (86900 / 85.1 + 925);
  close(next.transportationBase, expected);
  close(next.rows.find(e => e.id === 'antin').total, expected * .04);
  close(next.rows.find(e => e.id === 'recursive').total, expected * .5);
  close(next.transportationCosts, expected * 1.5);
});
test('revenue percentages always use gross revenue and do not compound', () => {
  const s = minimal({ basis: 'revenue', amount: 4 });
  s.expenses.push({ ...s.expenses[0], id: 'second', amount: 5 });
  const r = M.calculate(s); close(r.totalCosts, 3600 * .09); close(r.rows[0].total, 144); close(r.rows[1].total, 180);
});
test('enable and disable expenses, including invalid inactive rates', () => {
  const s = minimal({ amount: null, enabled: false }); assert.equal(M.calculate(s).valid, true); close(M.calculate(s).totalCosts, 0);
  s.expenses[0].enabled = true; assert.equal(M.calculate(s).valid, false);
  s.expenses[0].amount = 50; close(M.calculate(s).totalCosts, 50);
});
test('add, duplicate, and delete custom expenses', () => {
  const s = minimal(); s.expenses.push({ ...s.expenses[0], id: 'custom', amount: 100 }); close(M.calculate(s).totalCosts, 110);
  s.expenses.push({ ...s.expenses[1], id: 'copy' }); close(M.calculate(s).totalCosts, 210);
  s.expenses = s.expenses.filter(e => e.id !== 'custom'); close(M.calculate(s).totalCosts, 110);
  s.expenses = []; close(M.calculate(s).totalCosts, 0);
});
test('changing container count scales revenue, cargo and variable expenses, not fixed expenses', () => {
  const s = minimal({ basis: 'container' }); s.expenses.push({ ...s.expenses[0], id: 'fixed', basis: 'train', amount: 7 });
  const before = M.calculate(s); s.containers *= 2; const after = M.calculate(s);
  close(after.cargo, before.cargo * 2); close(after.revenue, before.revenue * 2); close(after.totalCosts, 67);
});
test('changing loading affects MT expenses and revenue, not per-container expenses', () => {
  const s = minimal({ basis: 'mt' }); s.expenses.push({ ...s.expenses[0], id: 'container', basis: 'container', amount: 7 });
  s.cargoWeight = 18; const r = M.calculate(s); close(r.cargo, 54); close(r.revenue, 5400); close(r.totalCosts, 561);
});
const expected = [16598.67, 27525.12, -15749.97, -4823.52, 52440.27, 61314.72, 21842.67, 30717.12];
M.presets().forEach((s, i) => test(`reference ${s.name}: profit ${expected[i]} USD within 0.02`, () => {
  const r = M.calculate(s); assert.equal(r.valid, true); close(r.profit, expected[i], .02);
  close(r.goodsCosts + r.transportationCosts + r.financialFees + r.otherExpenses, r.totalCosts);
  close(r.revenue - r.totalCosts, r.profit);
}));
test('comparisons and scenario copies are independent and use calculate()', () => {
  const scenarios = M.presets(); scenarios[0].expenses[0].amount = 50;
  close(M.calculate(scenarios[1]).profit, expected[1], .02);
  const copy = M.clone(scenarios[1]); copy.containers = 1;
  assert.equal(scenarios[1].containers, 114);
});
test('zero revenue/cargo/container count never divides by zero', () => {
  for (const key of ['containers', 'cargoWeight', 'sellingPrice']) {
    const s = M.defaults(); s[key] = 0; const r = M.calculate(s); assert.equal(r.valid, true); assert.equal(r.margin, null);
    for (const v of Object.values(r)) if (typeof v === 'number') assert.ok(Number.isFinite(v));
  }
});
test('invalid fields block all financial results, rather than silently using zero', () => {
  for (const [key, value] of [['containers', 1.5], ['cargoWeight', null], ['sellingPrice', -1], ['usdRub', 0], ['usdVnd', NaN]]) {
    const s = M.defaults(); s[key] = value; const r = M.calculate(s); assert.equal(r.valid, false); assert.equal(r.profit, null); assert.ok(r.rows.every(e => e.total === null));
  }
  const s = M.defaults(); s.expenses[0].amount = Infinity; assert.equal(M.calculate(s).valid, false);
});
test('overflow is detected', () => {
  const s = M.defaults(); s.cargoWeight = Number.MAX_VALUE; assert.equal(M.calculate(s).valid, false);
});
test('new container types require fresh loading and transport rates; returning restores correct quotes', () => {
  const original = M.defaults(), next = M.changeContainerType(original, "40'HC");
  assert.equal(next.cargoWeight, null); assert.equal(M.calculate(next).valid, false);
  assert.ok(next.expenses.filter(e => e.category === 'Transportation').every(e => e.amount === null));
  next.cargoWeight = 26; next.expenses.filter(e => e.category === 'Transportation').forEach(e => { e.amount = 100; });
  assert.equal(M.calculate(next).valid, true);
  const back = M.changeContainerType(next, "20'DC"); close(M.calculate(back).profit, expected[0], .02);
  const forward = M.changeContainerType(back, "40'HC"); assert.equal(forward.cargoWeight, 26); assert.equal(forward.expenses.find(e=>e.id==='rail').amount, 100);
  assert.equal(original.containerType, "20'DC");
});
test('container profiles also invalidate disabled transportation quotes and newly added transport rows', () => {
  const s = M.defaults(); s.expenses.find(e=>e.id==='inland').enabled = false;
  const n = M.changeContainerType(s, 'Custom'); assert.equal(n.expenses.find(e=>e.id==='inland').amount, null);
  n.expenses.push({ ...n.expenses[1], id: 'new', amount: 999 });
  const back = M.changeContainerType(n, "20'DC"); assert.equal(back.expenses.find(e=>e.id==='new').amount, null);
});
test('bag calculation preserves 22.5 and flags fractional bags', () => {
  const s = M.defaults(); close(M.loading(s).required, 25); assert.equal(M.loading(s).fractional, false);
  s.loading.target = 18; close(M.loading(s).required, 22.5); assert.equal(M.loading(s).fractional, true); assert.equal(s.cargoWeight, 20);
  s.loading.bags = 22.5; assert.equal(M.loading(s).valid, true); assert.equal(M.loading(s).enteredFractional, true); close(M.loading(s).weight, 18);
  s.loading.bagWeight = 0; assert.equal(M.loading(s).valid, false);
});
test('JSON export/import restores all fields, Unicode and container profiles', () => {
  let s = M.changeContainerType(M.defaults(), 'Custom'); s.name = 'Тест — сценарий';
  const result = M.deserialize(M.serialize(s)); assert.deepEqual(result, s);
  const back = M.changeContainerType(result, "20'DC"); close(M.calculate(back).profit, expected[0], .02);
});
test('share link roundtrip preserves parameters, full precision and results', () => {
  const s = M.defaults(); s.name = 'Сценарий с параметрами'; s.sellingPrice = 153.12345678;
  const restored = M.decode(M.encode(s)); assert.deepEqual(restored, s); close(M.calculate(restored).profit, M.calculate(s).profit);
});
test('browser persistence save and restore; independent saved snapshots', () => {
  const storage = { values: new Map(), setItem(k,v) { this.values.set(k,v); }, getItem(k) { return this.values.get(k) ?? null; } };
  const s = M.defaults(); M.save(storage, 'test', s); s.sellingPrice = 5;
  const restored = M.restore(storage, 'test'); assert.equal(restored.sellingPrice, 153); assert.equal(M.restore(storage, 'missing'), null);
});
test('temporarily empty text labels survive autosave and JSON restoration', () => {
  const s = M.defaults(); s.product = ''; s.name = ''; s.expenses[0].name = '';
  assert.deepEqual(M.deserialize(M.serialize(s)), s);
  close(M.calculate(s).profit, expected[0], .02);
});
test('expense ordering cannot change fee bases or total profit', () => {
  const s = M.defaults(), before = M.calculate(s); s.expenses.reverse(); const after = M.calculate(s);
  close(after.transportationBase, before.transportationBase); close(after.profit, before.profit);
});
test('reject invalid JSON, schema, duplicate IDs, unsupported options and hostile links', () => {
  assert.throws(()=>M.deserialize('{bad')); assert.throws(()=>M.decode('!bad'));
  for (const mutate of [s=>s.version=99, s=>s.containerType='Tanker', s=>s.expenses[0].amount=-5, s=>s.expenses[0].currency='EUR', s=>s.expenses.push(s.expenses[0]), s=>s.expenses[0].enabled='false', s=>s.expenses[0].id='"><script>']) {
    const s = M.defaults(); mutate(s); assert.throws(()=>M.normalize(s));
  }
  const s = M.defaults(); s.__proto__.pollutionTest = 'not-copied';
  try { assert.equal(Object.hasOwn(M.normalize(s), 'pollutionTest'), false); } finally { delete Object.prototype.pollutionTest; }
});
test('CSV includes input assumptions, all expenses, per-container/MT results and comparison', () => {
  const s = M.defaults(); const output = X.csv(s, M.presets());
  assert.ok(output.startsWith('\uFEFF')); assert.ok(output.includes('86900')); assert.ok(output.includes(String(M.calculate(s).profit))); assert.ok(output.includes('Costs per container')); assert.ok(output.includes('"A8"') === false); assert.ok(output.includes('"B4"'));
  assert.ok(output.includes('Transportation commission base')); assert.ok(output.includes('kg'));
});
test('CSV escapes quotes, commas, newlines and spreadsheet formula injection', () => {
  assert.equal(X.cell('a,"b"'), '"a,""b"""'); assert.equal(X.cell('=1+1'), '"\'=1+1"'); assert.equal(X.cell('-formula'), '"\'-formula"'); assert.equal(X.cell(-5), '"-5"');
  const s = M.defaults(); s.name = '=HYPERLINK("https://invalid")'; assert.ok(X.csv(s).includes("'=HYPERLINK"));
  s.expenses[0].amount = null; assert.throws(()=>X.csv(s));
});
