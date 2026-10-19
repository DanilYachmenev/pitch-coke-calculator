(function () {
  'use strict';
  const M = window.TradeModel, X = window.TradeExports;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KEYS = { current: 'pitch.current.v1', library: 'pitch.library.v1', lang: 'pitch.language.v1' };
  let state = M.defaults(), library = [], lang = 'en', tab = 'calculator', selected = new Set(M.presets().map(s => s.name));
  let startupMessage = '', storageFailed = false, sharedLoaded = false;
  try {
    lang = localStorage.getItem(KEYS.lang) === 'ru' ? 'ru' : 'en';
    const saved = M.restore(localStorage, KEYS.current); if (saved) state = saved;
    const raw = localStorage.getItem(KEYS.library);
    if (raw) {
      const entries = JSON.parse(raw);
      if (!Array.isArray(entries) || entries.length > 100) throw new Error('Invalid library');
      library = entries.map(e => ({ id: String(e.id), scenario: M.normalize(e.scenario) }));
      library.forEach(e => selected.add(e.id));
    }
  } catch { startupMessage = 'storageCorrupt'; }
  function readHash() {
    if (!location.hash.startsWith('#scenario=')) return;
    try {
      state = M.decode(location.hash.slice(10)); startupMessage = ''; sharedLoaded = true;
      // Consume an incoming snapshot so subsequent reloads restore local edits.
      try { history.replaceState(null, '', location.pathname + location.search); } catch { /* file browsers may restrict history */ }
    }
    catch { startupMessage = 'linkError'; }
  }
  readHash();
  const t = k => window.TradeText[lang][k] || k;
  const nf = (v, digits = 2) => v === null || !Number.isFinite(v) ? '—' : new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v);
  const money = v => v === null || !Number.isFinite(v) ? '—' : (v < 0 ? '−' : '') + '$' + nf(Math.abs(v));
  const number = (v, digits = 2) => nf(v, digits);
  const exactNumber = v => esc(String(v).replace('.', lang === 'ru' ? ',' : '.'));
  const pct = v => v === null ? '—' : nf(v) + '%';
  const signed = v => v === null ? '' : v < 0 ? 'negative' : 'positive';
  const uid = () => 'e-' + (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const parseNum = el => el.value.trim() === '' || !el.validity.valid ? null : Number(el.value);
  const inputValue = v => v === null ? '' : esc(v);
  function notify(key) { $('toast').textContent = t(key); $('toast').hidden = false; clearTimeout(notify.timer); notify.timer = setTimeout(() => { $('toast').hidden = true; }, 6000); }
  function persist() {
    try {
      M.save(localStorage, KEYS.current, state); M.save(localStorage, KEYS.library, library); localStorage.setItem(KEYS.lang, lang);
      storageFailed = false; $('storage-warning').hidden = true;
    } catch { storageFailed = true; $('storage-warning').textContent = t('storageError'); $('storage-warning').hidden = false; }
  }
  function options(values, current, translate = false) { return values.map(v => `<option value="${esc(v)}" ${v === current ? 'selected' : ''}>${esc(translate ? t(v) : v)}</option>`).join(''); }
  function field(key, label, unit = '', text = false, integer = false, value = state[key], extra = '') {
    return `<label class="field"><span>${esc(t(label))}</span><div class="input-wrap"><input ${text ? 'type="text" maxlength="200"' : `type="number" min="0" max="1000000000000" step="${integer ? '1' : 'any'}" inputmode="decimal"`} data-field="${key}" value="${inputValue(value)}" ${extra}>${unit ? `<span class="input-unit">${esc(unit)}</span>` : ''}</div></label>`;
  }
  function renderFields() {
    const purchase = state.expenses.find(r => r.id === 'purchase');
    const editablePurchase = purchase && purchase.basis === 'mt' && purchase.currency === 'USD';
    $('scenario-name').value = state.name;
    $('scenario-name').setAttribute('aria-label', t('name'));
    $('deal-fields').innerHTML = field('product', 'product', '', true) + field('origin', 'origin', '', true) + field('destination', 'destination', '', true) +
      `<label class="field"><span>${esc(t('type'))}</span><select data-field="containerType">${options(M.TYPES, state.containerType)}</select></label>` +
      field('containers', 'containers', '', false, true) + field('cargoWeight', 'cargoWeight', 'MT') + field('sellingPrice', 'sellingPrice', 'USD') +
      field('purchaseRate', 'purchase', 'USD', false, false, editablePurchase ? purchase.amount : null, editablePurchase ? '' : `disabled title="${esc(t('missingPurchase'))}"`) + field('usdRub', 'usdRub') + field('usdVnd', 'usdVnd');
    $('heading-route').textContent = `${state.origin} → ${state.destination}`;
    document.querySelector('.eyebrow:has(#heading-route)').childNodes[0].textContent = '';
    $('loading-fields').innerHTML = [['bagWeight', 'kg'], ['bagVolume', 'm³'], ['bags', ''], ['target', 'MT']].map(([key, unit]) =>
      `<label class="field"><span>${esc(t(key))}</span><div class="input-wrap"><input type="number" data-loading="${key}" min="0" max="1000000000000" step="any" value="${inputValue(state.loading[key])}" inputmode="decimal">${unit ? `<span class="input-unit">${unit}</span>` : ''}</div></label>`).join('');
  }
  function renderExpenses() {
    $('expense-rows').innerHTML = state.expenses.map(r => `<tr data-row="${esc(r.id)}" class="${r.enabled ? '' : 'disabled-row'}">
      <td><input type="checkbox" data-expense="enabled" aria-label="${esc(t('enabled') + ': ' + t(r.name))}" ${r.enabled ? 'checked' : ''}></td>
      <td><input type="text" data-expense="name" maxlength="200" value="${esc(t(r.name))}" aria-label="${esc(t('expense'))}"></td>
      <td data-label="${esc(t('amount'))}"><input type="number" data-expense="amount" min="0" max="1000000000000" step="any" inputmode="decimal" value="${inputValue(r.amount)}" aria-label="${esc(t('amount') + ': ' + t(r.name))}"></td>
      <td data-label="${esc(t('currency'))}"><select data-expense="currency" aria-label="${esc(t('currency'))}" ${M.isPercent(r) ? 'disabled' : ''}>${M.isPercent(r) ? '<option>%</option>' : options(M.CURRENCIES, r.currency)}</select></td>
      <td data-label="${esc(t('basis'))}"><select data-expense="basis" aria-label="${esc(t('basis'))}">${options(M.BASES, r.basis, true)}</select></td>
      <td data-label="${esc(t('category'))}"><select data-expense="category" aria-label="${esc(t('category'))}">${options(M.CATEGORIES, r.category, true)}</select></td>
      <td class="number row-total" data-label="${esc(t('total'))}" data-total="${esc(r.id)}"></td>
      <td class="row-actions no-print"><button class="icon-button" data-action="copy-row" title="${esc(t('copy'))}" aria-label="${esc(t('copy'))}">⧉</button><button class="icon-button danger-hover" data-action="delete-row" title="${esc(t('remove'))}" aria-label="${esc(t('remove'))}">×</button></td></tr>`).join('') || `<tr><td colspan="8" class="empty">${esc(t('noRows'))}</td></tr>`;
  }
  function lines(items) { return items.map(([label, value, cls]) => `<div class="metric-line ${cls || ''}"><span>${esc(t(label))}</span><strong>${esc(value)}</strong></div>`).join(''); }
  function details(r) {
    return [
      ['perMT', [['sellingPrice', money(r.valid ? state.sellingPrice : null)], ['transportationMT', money(r.transportationPerMT)], ['costMT', money(r.costPerMT)], ['profitMT', money(r.profitPerMT), signed(r.profitPerMT)], ['margin', pct(r.margin)]]],
      ['perContainer', [['weight', r.valid ? number(state.cargoWeight) + ' MT' : '—'], ['containerRevenue', money(r.revenuePerContainer)], ['transportationCosts', money(r.transportationPerContainer)], ['totalExpenses', money(r.costPerContainer)], ['profit', money(r.profitPerContainer), signed(r.profitPerContainer)]]],
      ['entire', [['containers', r.valid ? number(state.containers, 0) : '—'], ['totalCargo', r.valid ? number(r.cargo) + ' MT' : '—'], ['grossRevenue', money(r.revenue)], ['goodsCosts', money(r.goodsCosts)], ['transportationCosts', money(r.transportationCosts)], ['financialFees', money(r.financialFees)], ['otherExpenses', money(r.otherExpenses)], ['totalCosts', money(r.totalCosts)], ['netProfit', money(r.profit), signed(r.profit)], ['margin', pct(r.margin)]]]
    ].map(([title, values]) => `<section><h3>${esc(t(title))}</h3>${lines(values)}</section>`).join('');
  }
  function renderResults() {
    const r = M.calculate(state);
    $('validation').hidden = r.valid;
    $('validation').textContent = t('invalid');
    document.querySelectorAll('[data-field]').forEach(el => {
      const bad = r.errors.includes(el.dataset.field); el.setAttribute('aria-invalid', bad ? 'true' : 'false');
      if (bad) el.title = t('invalidField');
    });
    for (const row of r.rows) {
      const el = document.querySelector(`[data-total="${row.id}"]`); if (el) el.textContent = money(row.total);
      const input = document.querySelector(`[data-row="${row.id}"] [data-expense="amount"]`);
      if (input) { input.setAttribute('aria-invalid', r.errors.includes(row.id) ? 'true' : 'false'); input.title = r.errors.includes(row.id) ? t('invalidField') : ''; }
    }
    $('hero-profit').textContent = money(r.profit); $('hero-profit').className = 'hero-profit ' + signed(r.profit);
    $('hero-margin').textContent = pct(r.margin);
    $('hero-profit-mt').textContent = money(r.profitPerMT); $('hero-cost-mt').textContent = money(r.costPerMT);
    $('commission-base').textContent = money(r.transportationBase);
    $('summary-lines').innerHTML = lines([['grossRevenue', money(r.revenue)], ['totalCosts', money(r.totalCosts)], ['totalCargo', r.valid ? number(r.cargo, 0) + ' MT' : '—']]);
    $('breakdown').innerHTML = details(r);
    $('cost-bar').innerHTML = r.valid && r.totalCosts > 0 ? M.CATEGORIES.map((c, i) => `<span class="cat-${i}" style="width:${r.byCategory[c] / r.totalCosts * 100}%"></span>`).join('') : '';
    $('cost-bar').setAttribute('aria-label', r.valid ? M.CATEGORIES.map(c => `${t(c)}: ${money(r.byCategory[c])}`).join(', ') : t('invalid'));
    $('cost-legend').innerHTML = r.valid ? M.CATEGORIES.map((c, i) => `<div><span><i class="cat-${i}"></i>${esc(t(c))}</span><strong>${money(r.byCategory[c])}</strong></div>`).join('') : '';
    renderLoading();
    if (tab === 'comparison') renderComparison();
  }
  function renderLoading() {
    const r = M.loading(state);
    const partial = r.fractional || r.enteredFractional;
    $('loading-results').innerHTML = r.valid ? `<div class="bag-equation"><strong>${exactNumber(r.required)}</strong><span>${esc(t('requiredBags'))}<br><small>${exactNumber(state.loading.target)} MT × 1000 ÷ ${exactNumber(state.loading.bagWeight)} kg</small></span></div><p class="${partial ? 'warning small' : 'small-note'}">${esc(t(partial ? 'partialBag' : 'fullBagNote'))}</p><p class="small-note">${esc(t('enteredBags'))}: ${exactNumber(state.loading.bags)} → ${number(r.weight)} MT · ${number(r.volume)} m³<br>${esc(t('theoreticalVolume'))}: ${number(r.requiredVolume)} m³</p>` : `<p class="warning">${esc(t('invalidLoading'))}</p>`;
  }
  function allScenarios() { return [...M.presets().map(scenario => ({ id: scenario.name, scenario, preset: true })), ...library, { id: 'current', scenario: { ...M.clone(state), name: t('current') }, current: true }]; }
  function comparisonScenarios() { return allScenarios().filter(e => selected.has(e.id)); }
  function renderComparison() {
    const all = allScenarios(), chosen = comparisonScenarios();
    $('scenario-choices').innerHTML = all.map(e => `<label class="scenario-chip"><input type="checkbox" data-compare="${esc(e.id)}" ${selected.has(e.id) ? 'checked' : ''}><span>${esc(e.current ? t('includeCurrent') : e.scenario.name)}</span></label>`).join('');
    if (!chosen.length) { $('comparison-table').innerHTML = `<p class="empty">${esc(t('noSelection'))}</p>`; $('profit-chart').innerHTML = ''; return; }
    const metrics = [['totalCargo', 'cargo', 'cargo'], ['grossRevenue', 'revenue'], ['transportationCosts', 'transportationCosts'], ['totalCosts', 'totalCosts'], ['costMT', 'costPerMT'], ['profitMT', 'profitPerMT'], ['netProfit', 'profit'], ['margin', 'margin', 'percent']];
    $('comparison-table').innerHTML = `<table class="comparison-table"><thead><tr><th>${esc(t('comparison'))}</th>${chosen.map(e => {
      const s = e.scenario, inland = s.expenses.find(r => r.id === 'inland'), antin = s.expenses.find(r => r.id === 'antin');
      return `<th><span class="case-label">${esc(s.name)}</span><small>${esc(t(e.preset ? 'reference' : e.current ? 'current' : 'custom'))}</small><span class="case-assumptions">${money(s.sellingPrice)} / MT · ${number(s.cargoWeight)} MT<br>${esc(t('inland'))}: ${inland && inland.enabled ? money(inland.amount) : esc(t('off'))}<br>${esc(t('antin'))}: ${antin && antin.enabled ? number(antin.amount) + '%' : esc(t('off'))}</span>${e.current ? '' : `<button class="text-button" data-use="${esc(e.id)}">${esc(t('use'))} ↗</button>`}</th>`;
    }).join('')}</tr></thead><tbody>${metrics.map(([label, key, format]) => `<tr class="${key === 'profit' ? 'profit-row' : ''}"><th>${esc(t(label))}</th>${chosen.map(e => { const r = M.calculate(e.scenario); return `<td class="${['profit', 'profitPerMT', 'margin'].includes(key) ? signed(r[key]) : ''}">${esc(format === 'cargo' ? r.valid ? number(r[key], 0) + ' MT' : '—' : format === 'percent' ? pct(r[key]) : money(r[key]))}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
    const max = Math.max(1, ...chosen.map(e => Math.abs(M.calculate(e.scenario).profit || 0)));
    $('profit-chart').innerHTML = chosen.map(e => { const r = M.calculate(e.scenario); return `<div class="profit-bar-row"><span>${esc(e.scenario.name)}</span><div class="profit-track"><div class="${signed(r.profit)}" style="width:${Math.abs(r.profit || 0) / max * 100}%"></div></div><strong class="${signed(r.profit)}">${money(r.profit)}</strong></div>`; }).join('');
  }
  function renderLibrary() {
    $('saved-list').innerHTML = library.map(e => `<div class="saved-item"><div><strong>${esc(e.scenario.name)}</strong><span>${esc(e.scenario.containerType)} · ${number(e.scenario.cargoWeight)} MT · ${money(M.calculate(e.scenario).profit)}</span></div><div><button class="button small-button" data-use="${esc(e.id)}" data-t="load">${esc(t('load'))}</button><button class="icon-button danger-hover" data-delete="${esc(e.id)}" aria-label="${esc(t('remove'))}">×</button></div></div>`).join('') || `<p class="empty">${esc(t('savedEmpty'))}</p>`;
  }
  function render() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
    document.querySelectorAll('[data-lang]').forEach(el => { el.classList.toggle('active', el.dataset.lang === lang); el.setAttribute('aria-pressed', el.dataset.lang === lang ? 'true' : 'false'); });
    document.querySelectorAll('[data-action="close-dialog"]').forEach(el => el.setAttribute('aria-label', t('close')));
    renderFields(); renderExpenses(); renderResults(); renderLibrary(); renderComparison();
    if (storageFailed) $('storage-warning').textContent = t('storageError');
  }
  function setTab(next) {
    tab = next;
    ['calculator', 'comparison'].forEach(k => { $('tab-' + k).setAttribute('aria-selected', k === tab ? 'true' : 'false'); $(k + '-panel').hidden = k !== tab; });
    if (tab === 'comparison') renderComparison();
  }
  function commit(full = false) { persist(); if (full) render(); else renderResults(); }
  function loadScenario(s) { state = M.clone(s); document.querySelectorAll('dialog[open]').forEach(d => d.close()); setTab('calculator'); commit(true); notify('loaded'); }
  function download(content, type, suffix) {
    const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = (state.name.replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 70) || 'scenario') + suffix;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function printReport() {
    const r = M.calculate(state);
    const params = [['name', state.name], ['product', state.product], ['origin', state.origin], ['destination', state.destination], ['type', state.containerType], ['containers', state.containers], ['cargoWeight', number(state.cargoWeight) + ' MT'], ['sellingPrice', money(state.sellingPrice)], ['usdRub', state.usdRub], ['usdVnd', state.usdVnd]];
    $('print-report').innerHTML = `<h1>PITCH · ${esc(t('printTitle'))}</h1><p>${esc(state.name)} · ${esc(t('allUSD'))}</p><div class="print-params">${params.map(([k,v]) => `<div><span>${esc(t(k))}</span><strong>${esc(v)}</strong></div>`).join('')}</div><h2>${esc(t('netProfit'))}: ${money(r.profit)}</h2><div class="breakdown-grid">${details(r)}</div><h2>${esc(t('expenses'))}</h2><table><thead><tr>${['enabled','expense','amount','currency','basis','category','total'].map(k=>`<th>${esc(t(k))}</th>`).join('')}</tr></thead><tbody>${r.rows.map(e=>`<tr><td>${e.enabled?'✓':'—'}</td><td>${esc(t(e.name))}</td><td>${number(e.amount)}</td><td>${M.isPercent(e)?'%':e.currency}</td><td>${esc(t(e.basis))}</td><td>${esc(t(e.category))}</td><td>${money(e.total)}</td></tr>`).join('')}</tbody></table><p>${esc(t('baseNote'))} ${money(r.transportationBase)}</p><p>${esc(t('printNote'))}</p>`;
  }
  document.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.field && el.tagName === 'INPUT') {
      const k = el.dataset.field;
      if (k === 'purchaseRate') { const row = state.expenses.find(r => r.id === 'purchase'); if (row) { row.amount = parseNum(el); const linked = document.querySelector('[data-row="purchase"] [data-expense="amount"]'); if (linked) linked.value = el.value; } }
      else state[k] = el.type === 'number' ? parseNum(el) : el.value;
      if (k === 'origin' || k === 'destination') $('heading-route').textContent = `${state.origin} → ${state.destination}`;
      commit();
    } else if (el.dataset.expense && el.tagName === 'INPUT' && el.type !== 'checkbox') {
      const row = state.expenses.find(r => r.id === el.closest('[data-row]').dataset.row);
      row[el.dataset.expense] = el.type === 'number' ? parseNum(el) : el.value;
      if (row.id === 'purchase' && row.basis === 'mt' && row.currency === 'USD') { const linked = document.querySelector('[data-field="purchaseRate"]'); linked.value = row.amount === null ? '' : row.amount; }
      commit();
    } else if (el.dataset.loading) { state.loading[el.dataset.loading] = parseNum(el); persist(); renderLoading(); }
  });
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.field === 'containerType') { state = M.changeContainerType(state, el.value); commit(true); if (!M.calculate(state).valid) notify('quoteRequired'); }
    else if (el.dataset.expense && (el.tagName === 'SELECT' || el.type === 'checkbox')) {
      const row = state.expenses.find(r => r.id === el.closest('[data-row]').dataset.row); row[el.dataset.expense] = el.type === 'checkbox' ? el.checked : el.value; commit(true);
    } else if (el.dataset.compare) { el.checked ? selected.add(el.dataset.compare) : selected.delete(el.dataset.compare); renderComparison(); }
  });
  document.addEventListener('click', async e => {
    const el = e.target.closest('button, [data-action]'); if (!el) return;
    if (el.dataset.lang) { lang = el.dataset.lang; persist(); render(); return; }
    if (el.dataset.tab) { setTab(el.dataset.tab); return; }
    if (el.dataset.use) { const item = allScenarios().find(s => s.id === el.dataset.use); if (item) loadScenario(item.scenario); return; }
    if (el.dataset.delete) { if (!confirm(t('deleteConfirm'))) return; library = library.filter(s => s.id !== el.dataset.delete); selected.delete(el.dataset.delete); persist(); renderLibrary(); renderComparison(); notify('deleted'); return; }
    const action = el.dataset.action; if (!action) return;
    if (['add', 'copy-row'].includes(action) && state.expenses.length >= 250) return notify('expenseLimit');
    document.querySelectorAll('.export-menu[open]').forEach(d => d.open = false);
    if (action === 'close-dialog') { el.closest('dialog').close(); return; }
    if (action === 'add') { state.expenses.push({ id: uid(), name: t('newExpense'), amount: 0, currency: 'USD', basis: 'container', category: 'Other', enabled: true }); commit(true); const inputs = document.querySelectorAll('[data-expense="name"]'); inputs[inputs.length - 1].focus(); inputs[inputs.length - 1].select(); }
    if (action === 'copy-row' || action === 'delete-row') {
      const id = el.closest('[data-row]').dataset.row, i = state.expenses.findIndex(r => r.id === id);
      if (action === 'delete-row') state.expenses.splice(i, 1);
      else { const row = M.clone(state.expenses[i]); row.id = uid(); row.name = t(row.name) + ' (' + t('copySuffix') + ')'; state.expenses.splice(i + 1, 0, row); }
      commit(true);
    }
    if (action === 'library' || action === 'save-dialog') { $('save-name').value = state.name; renderLibrary(); $('library-dialog').showModal(); if (action === 'save-dialog') { $('save-name').focus(); $('save-name').select(); } }
    if (action === 'duplicate') { state = M.clone(state); state.name += ' (' + t('copySuffix') + ')'; commit(true); $('save-name').value = state.name; $('library-dialog').showModal(); notify('duplicated'); }
    if (action === 'reset' && confirm(t('resetConfirm'))) { state = M.defaults(); commit(true); notify('restored'); }
    if (action === 'json') { try { download(M.serialize(state), 'application/json;charset=utf-8', '.json'); } catch { notify('importError'); } }
    if (action === 'import') $('import-file').click();
    if (action === 'csv') { if (!M.calculate(state).valid) return notify('exportInvalid'); download(X.csv(state, comparisonScenarios().map(e => e.scenario)), 'text/csv;charset=utf-8', '.csv'); notify('csvDone'); }
    if (action === 'print') { if (!M.calculate(state).valid) return notify('exportInvalid'); printReport(); window.print(); }
    if (action === 'share') {
      try {
        const url = new URL(location.href); url.search = ''; url.hash = 'scenario=' + M.encode(state); $('share-link').value = url.href;
        $('local-link-note').hidden = !['file:', ''].includes(location.protocol) && !['localhost', '127.0.0.1', '::1'].includes(location.hostname);
        $('long-link-note').hidden = url.href.length < 8000; $('share-dialog').showModal();
      } catch { notify('importError'); }
    }
    if (action === 'copy-link') { try { await navigator.clipboard.writeText($('share-link').value); notify('copied'); } catch { $('share-link').focus(); $('share-link').select(); notify('copyManual'); } }
  });
  $('save-form').addEventListener('submit', e => {
    e.preventDefault(); const name = $('save-name').value.trim(); if (!name) return;
    try {
      const copy = M.normalize({ ...state, name }), id = uid();
      if (library.length >= 100) return notify('libraryLimit');
      library.push({ id, scenario: copy }); selected.add(id); state.name = name; commit(true); renderLibrary(); notify(storageFailed ? 'storageError' : 'saved');
    } catch { notify('importError'); }
  });
  $('import-file').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    try { if (file.size > 300000) throw new Error('File too large'); const imported = M.deserialize(await file.text()); loadScenario(imported); notify('imported'); }
    catch { notify('importError'); } finally { e.target.value = ''; }
  });
  window.addEventListener('hashchange', () => { readHash(); if (startupMessage) notify(startupMessage); commit(true); });
  window.addEventListener('beforeprint', printReport);
  document.querySelector('.brand').addEventListener('click', e => { e.preventDefault(); setTab('calculator'); });
  document.querySelector('[role="tablist"]').addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const next = tab === 'calculator' ? 'comparison' : 'calculator'; setTab(next); $('tab-' + next).focus(); } });
  render(); if (sharedLoaded) persist(); if (startupMessage) notify(startupMessage);
})();
