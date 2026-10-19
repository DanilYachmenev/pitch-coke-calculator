(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TradeModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 1;
  const TYPES = ["20'DC", "40'DC", "40'HC", "40'HC High Payload", 'Custom'];
  const BASES = ['mt', 'container', 'train', 'revenue', 'transport'];
  const CATEGORIES = ['Goods', 'Transportation', 'Financial', 'Other'];
  const CURRENCIES = ['USD', 'RUB', 'VND'];
  const clone = value => JSON.parse(JSON.stringify(value));
  const isPercent = row => row.basis === 'revenue' || row.basis === 'transport';
  function defaults() {
    return {
      version: VERSION, name: 'A1 · Base case', product: 'Pitch Coke', origin: 'Biklyan, Russia',
      destination: 'Haiphong, Vietnam', containerType: TYPES[0], containers: 114,
      cargoWeight: 20, sellingPrice: 153, usdRub: 85.10, usdVnd: 26000,
      loading: { bagWeight: 800, bagVolume: 1, bags: 25, target: 20 }, profiles: {},
      expenses: [
        { id: 'purchase', name: 'Coke Purchase', amount: 5, currency: 'USD', basis: 'mt', category: 'Goods', enabled: true },
        { id: 'rail', name: 'Railway Freight', amount: 86900, currency: 'RUB', basis: 'container', category: 'Transportation', enabled: true },
        { id: 'sea', name: 'Sea Freight', amount: 925, currency: 'USD', basis: 'container', category: 'Transportation', enabled: true },
        { id: 'inland', name: 'Inland Transportation', amount: 450, currency: 'USD', basis: 'container', category: 'Transportation', enabled: true },
        { id: 'additional', name: 'Additional Expenses', amount: 200, currency: 'USD', basis: 'container', category: 'Other', enabled: true },
        { id: 'conversion', name: 'Currency Conversion', amount: 4, currency: 'USD', basis: 'revenue', category: 'Financial', enabled: true },
        { id: 'antin', name: 'Antin Commission', amount: 4, currency: 'USD', basis: 'transport', category: 'Financial', enabled: true }
      ]
    };
  }
  function calculate(s) {
    const errors = [];
    const valid = (v, field, positive = false, integer = false) => {
      if (typeof v !== 'number' || !Number.isFinite(v) || (positive ? v <= 0 : v < 0) || (integer && !Number.isInteger(v))) errors.push(field);
    };
    valid(s.containers, 'containers', false, true);
    valid(s.cargoWeight, 'cargoWeight'); valid(s.sellingPrice, 'sellingPrice');
    valid(s.usdRub, 'usdRub', true); valid(s.usdVnd, 'usdVnd', true);
    const cargo = s.containers * s.cargoWeight;
    const revenue = cargo * s.sellingPrice;
    const usd = row => row.currency === 'RUB' ? row.amount / s.usdRub : row.currency === 'VND' ? row.amount / s.usdVnd : row.amount;
    const baseRows = s.expenses.map(row => {
      if (!row.enabled) return { ...row, total: 0 };
      valid(row.amount, row.id);
      if (!BASES.includes(row.basis) || !CURRENCIES.includes(row.currency) || !CATEGORIES.includes(row.category)) errors.push(row.id);
      let total = 0;
      if (!isPercent(row)) total = usd(row) * (row.basis === 'mt' ? cargo : row.basis === 'container' ? s.containers : 1);
      return { ...row, total };
    });
    // Only enabled monetary Transportation rows enter the commission base.
    // All percentages are evaluated once against these immutable first-pass bases.
    const transportationBase = baseRows.reduce((sum, r) => sum + (r.category === 'Transportation' && !isPercent(r) ? r.total : 0), 0);
    const rows = baseRows.map(r => ({ ...r, total: r.enabled && isPercent(r) ? r.amount / 100 * (r.basis === 'revenue' ? revenue : transportationBase) : r.total }));
    const byCategory = Object.fromEntries(CATEGORIES.map(c => [c, rows.reduce((sum, r) => sum + (r.category === c ? r.total : 0), 0)]));
    const totalCosts = rows.reduce((sum, r) => sum + r.total, 0);
    const profit = revenue - totalCosts;
    const ratio = (a, b) => b === 0 ? null : a / b;
    const result = {
      cargo, revenue, transportationBase, transportationCosts: byCategory.Transportation,
      goodsCosts: byCategory.Goods, financialFees: byCategory.Financial, otherExpenses: byCategory.Other,
      totalCosts, profit, margin: ratio(profit * 100, revenue),
      transportationPerMT: ratio(byCategory.Transportation, cargo), costPerMT: ratio(totalCosts, cargo), profitPerMT: ratio(profit, cargo),
      revenuePerContainer: ratio(revenue, s.containers), transportationPerContainer: ratio(byCategory.Transportation, s.containers),
      costPerContainer: ratio(totalCosts, s.containers), profitPerContainer: ratio(profit, s.containers)
    };
    if ([...Object.values(result), ...rows.map(r => r.total)].some(v => v !== null && !Number.isFinite(v))) errors.push('overflow');
    const unique = [...new Set(errors)];
    if (unique.length) return { valid: false, errors: unique, rows: rows.map(r => ({ ...r, total: null })), byCategory: {}, ...Object.fromEntries(Object.keys(result).map(k => [k, null])) };
    return { valid: true, errors: [], rows, byCategory, ...result };
  }
  function presets() {
    return ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'].map((name, index) => {
      const s = defaults(); s.name = name;
      s.sellingPrice = index < 4 ? 153 : 145;
      s.cargoWeight = index % 4 < 2 ? 20 : 18;
      s.loading.target = s.cargoWeight;
      s.expenses.find(r => r.id === 'inland').enabled = index < 4;
      s.expenses.find(r => r.id === 'antin').enabled = index % 2 === 0;
      return s;
    });
  }
  function changeContainerType(s, target) {
    if (!TYPES.includes(target)) throw new Error('Unsupported container type');
    const next = clone(s);
    if (target === s.containerType) return next;
    const transport = next.expenses.filter(r => r.category === 'Transportation' && !isPercent(r));
    next.profiles[s.containerType] = { cargoWeight: s.cargoWeight, rates: transport.map(r => ({ id: r.id, amount: r.amount, currency: r.currency, basis: r.basis })) };
    const saved = next.profiles[target];
    next.containerType = target; next.cargoWeight = saved ? saved.cargoWeight : null;
    for (const r of transport) {
      const quote = saved && saved.rates.find(q => q.id === r.id);
      r.amount = quote ? quote.amount : null;
      if (quote) { r.currency = quote.currency; r.basis = quote.basis; }
    }
    return next;
  }
  function loading(s) {
    const l = s.loading;
    if (![l.bagWeight, l.bagVolume, l.bags, l.target].every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0) || l.bagWeight === 0 || l.bagVolume === 0) return { valid: false };
    const required = l.target * 1000 / l.bagWeight;
    const fractional = Math.abs(required - Math.round(required)) > 1e-9;
    return { valid: true, required, fractional, enteredFractional: !Number.isInteger(l.bags), weight: l.bags * l.bagWeight / 1000, volume: l.bags * l.bagVolume, requiredVolume: required * l.bagVolume };
  }
  // Strict, whitelisted schema; imported files and URL fragments are untrusted.
  function normalize(input) {
    if (!input || typeof input !== 'object' || input.version !== VERSION) throw new Error('Unsupported scenario version');
    const str = (v, max = 200) => { if (typeof v !== 'string' || v.length > max) throw new Error('Invalid text field'); return v; };
    const num = v => { if (v !== null && (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1e12)) throw new Error('Invalid number'); return v; };
    const choice = (v, choices) => { if (!choices.includes(v)) throw new Error('Invalid option'); return v; };
    const id = v => { if (typeof v !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(v)) throw new Error('Invalid expense ID'); return v; };
    const s = { version: VERSION };
    for (const k of ['name', 'product', 'origin', 'destination']) s[k] = str(input[k]);
    s.containerType = choice(input.containerType, TYPES);
    for (const k of ['containers', 'cargoWeight', 'sellingPrice', 'usdRub', 'usdVnd']) s[k] = num(input[k]);
    if (s.containers !== null && !Number.isInteger(s.containers)) throw new Error('Containers must be an integer');
    if (!input.loading || !Array.isArray(input.expenses) || input.expenses.length > 250) throw new Error('Invalid scenario');
    s.loading = Object.fromEntries(['bagWeight', 'bagVolume', 'bags', 'target'].map(k => [k, num(input.loading[k])]));
    s.expenses = input.expenses.map(r => {
      if (typeof r.enabled !== 'boolean') throw new Error('Invalid enabled flag');
      return { id: id(r.id), name: str(r.name), amount: num(r.amount), currency: choice(r.currency, CURRENCIES), basis: choice(r.basis, BASES), category: choice(r.category, CATEGORIES), enabled: r.enabled };
    });
    if (new Set(s.expenses.map(r => r.id)).size !== s.expenses.length) throw new Error('Duplicate expense ID');
    s.profiles = {};
    if (input.profiles) for (const type of TYPES) {
      if (!Object.hasOwn(input.profiles, type)) continue;
      const p = input.profiles[type];
      if (!p || !Array.isArray(p.rates) || p.rates.length > 250) throw new Error('Invalid container profile');
      s.profiles[type] = { cargoWeight: num(p.cargoWeight), rates: p.rates.map(r => ({ id: id(r.id), amount: num(r.amount), currency: choice(r.currency, CURRENCIES), basis: choice(r.basis, BASES.filter(b => !['revenue', 'transport'].includes(b))) })) };
    }
    return s;
  }
  const serialize = s => JSON.stringify(normalize(s), null, 2);
  function deserialize(text) { if (text.length > 300000) throw new Error('Scenario too large'); return normalize(JSON.parse(text)); }
  function encode(s) {
    const bytes = new TextEncoder().encode(serialize(s));
    let binary = ''; for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decode(fragment) {
    if (fragment.length > 400000 || !/^[\w-]+$/.test(fragment)) throw new Error('Invalid scenario link');
    const binary = atob(fragment.replace(/-/g, '+').replace(/_/g, '/'));
    return deserialize(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, c => c.charCodeAt(0))));
  }
  function save(storage, key, value) { storage.setItem(key, JSON.stringify(value)); }
  function restore(storage, key) {
    const raw = storage.getItem(key); return raw === null ? null : deserialize(raw);
  }
  return { VERSION, TYPES, BASES, CATEGORIES, CURRENCIES, clone, isPercent, defaults, calculate, presets, changeContainerType, loading, normalize, serialize, deserialize, encode, decode, save, restore };
});
