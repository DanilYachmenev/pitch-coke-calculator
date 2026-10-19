(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./model.js'));
  else root.TradeExports = factory(root.TradeModel);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (M) {
  'use strict';
  // Neutralize spreadsheet formulas in user-controlled text. Numeric cells retain full precision.
  const cell = v => {
    let s = v === null || v === undefined ? '' : String(v);
    if (typeof v === 'string' && /^[\s]*[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  function csv(s, comparisons = []) {
    const r = M.calculate(s);
    if (!r.valid) throw new Error('Invalid financial inputs');
    const rows = [
      ['Pitch Coke — scenario calculation'], ['Scenario', s.name], ['Product', s.product], ['Origin', s.origin], ['Destination', s.destination],
      ['Container type', s.containerType], ['Containers', s.containers], ['Cargo MT per container', s.cargoWeight], ['Selling USD per MT', s.sellingPrice], ['RUB per USD', s.usdRub], ['VND per USD', s.usdVnd], [],
      ['Financial metric', 'Value', 'Unit'],
      ...[['Total cargo', 'cargo', 'MT'], ['Gross revenue', 'revenue', 'USD'], ['Goods purchase', 'goodsCosts', 'USD'], ['Transportation costs', 'transportationCosts', 'USD'], ['Transportation commission base', 'transportationBase', 'USD'], ['Financial fees', 'financialFees', 'USD'], ['Other expenses', 'otherExpenses', 'USD'], ['Total costs', 'totalCosts', 'USD'], ['Profit before tax', 'profit', 'USD'], ['Profit margin', 'margin', '%'], ['Transportation per MT', 'transportationPerMT', 'USD/MT'], ['Total costs per MT', 'costPerMT', 'USD/MT'], ['Profit per MT', 'profitPerMT', 'USD/MT'], ['Revenue per container', 'revenuePerContainer', 'USD'], ['Transportation per container', 'transportationPerContainer', 'USD'], ['Costs per container', 'costPerContainer', 'USD'], ['Profit per container', 'profitPerContainer', 'USD']].map(([label, k, unit]) => [label, r[k], unit]), [],
      ['Enabled', 'Expense', 'Rate', 'Currency / unit', 'Basis', 'Category', 'Total USD'],
      ...r.rows.map(e => [e.enabled ? 'Yes' : 'No', e.name, e.amount, M.isPercent(e) ? '%' : e.currency, e.basis, e.category, e.total]), [],
      ['Commission base: enabled non-percentage Transportation rows only. Percentage rows never compound.'],
      ['All monetary results in USD, before tax. No intermediate rounding.'], [],
      ['Bag weight kg', s.loading.bagWeight], ['Bag volume m3', s.loading.bagVolume], ['Bags per container', s.loading.bags], ['Target cargo MT', s.loading.target], ['Bags required', M.loading(s).required],
      ['Bag arithmetic does not confirm physical fit or payload approval.']
    ];
    if (comparisons.length) {
      rows.push([], ['Scenario comparison'], ['Scenario', 'Cargo MT', 'Revenue USD', 'Transportation USD', 'Costs USD', 'Cost USD/MT', 'Profit USD/MT', 'Profit USD', 'Margin %']);
      for (const c of comparisons) { const v = M.calculate(c); rows.push([c.name, ...['cargo', 'revenue', 'transportationCosts', 'totalCosts', 'costPerMT', 'profitPerMT', 'profit', 'margin'].map(k => v[k])]); }
    }
    return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
  }
  return { csv, cell };
});
