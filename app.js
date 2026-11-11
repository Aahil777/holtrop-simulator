/* Holtrop–Mennen simulator: controls, Python bridge, ship canvas and charts.
   All resistance numbers come from holtrop.py running in the runner iframe. */

const G = 9.81;

// ---------------------------------------------------------------- presets
const BASE = {
  hold: 'volume', bulb: true, transom: true, thruster: false, d_thruster: 2.0, CBTO: 0.006,
  iEOverride: false, iE: 12, SOverride: false, S: 7000, rough: false, ks_um: 150,
  water: 'sea', rho: 1025, nu_e6: 1.1883, Cstern: 0,
};
const PRESETS = {
  example: { name: 'Worked example · 205 m container ship', L: 205, B: 32, TF: 10, TA: 10, volume: 37500,
    lcb: -0.75, CM: 0.98, CWP: 0.75, ABT: 20, hB: 4, AT: 16, SAPP: 50, k2: 1.5, Cstern: 10,
    knots: 25, vmin: 12, vmax: 32 },
  tanker: { name: 'Tanker · 250 m (illustrative)', L: 250, B: 43, TF: 15, TA: 15, volume: 132225,
    lcb: 3.0, CM: 0.995, CWP: 0.90, ABT: 35, hB: 6, AT: 0, transom: false, SAPP: 120, k2: 1.5, Cstern: 0,
    knots: 15, vmin: 8, vmax: 18 },
  liner: { name: 'Cargo liner · 140 m (illustrative)', L: 140, B: 21, TF: 8, TA: 8, volume: 15994,
    lcb: -0.5, CM: 0.98, CWP: 0.80, ABT: 8, hB: 3, AT: 4, SAPP: 30, k2: 1.5, Cstern: 0,
    knots: 16, vmin: 8, vmax: 22 },
  ferry: { name: 'Ro-ro ferry · 180 m (illustrative)', L: 180, B: 28, TF: 7, TA: 7, volume: 20462,
    lcb: -2.0, CM: 0.97, CWP: 0.78, ABT: 12, hB: 2.8, AT: 25, SAPP: 90, k2: 2.8, Cstern: -10,
    knots: 22, vmin: 10, vmax: 28 },
  coaster: { name: 'Coaster · 50 m (illustrative)', L: 50, B: 10, TF: 4, TA: 4, volume: 1100,
    lcb: -2.5, CM: 0.85, CWP: 0.80, ABT: 0, bulb: false, hB: 1.5, AT: 2, SAPP: 6, k2: 1.5, Cstern: 0,
    knots: 11, vmin: 5, vmax: 15 },
};

const K2_TABLE = [
  ['Rudder behind skeg', 1.75], ['Rudder behind stern', 1.4], ['Twin-screw balance rudders', 2.8],
  ['Shaft brackets', 3.0], ['Skeg', 1.75], ['Strut bossings', 3.0], ['Hull bossings', 2.0],
  ['Shafts', 3.0], ['Stabiliser fins', 2.8], ['Dome', 2.7], ['Bilge keels', 1.4],
];
const STERNS = [[-25, 'Pram + gondola'], [-10, 'V-sections'], [0, 'Normal'], [10, 'U-sections']];
const WATERS = { sea: ['Sea water 15 °C', 1025, 1.1883], fresh: ['Fresh water 15 °C', 999.1, 1.1386] };

// ---------------------------------------------------------------- fields
const LBT = s => s.L * s.B * (s.TF + s.TA) / 2;
const FIELDS = {
  knots: { sym: 'V', label: 'Design speed', unit: 'kn', min: 1, max: 40, step: 0.1 },
  vmin: { sym: 'V<sub>min</sub>', label: 'Curve from', unit: 'kn', min: 1, max: 39, step: 0.5 },
  vmax: { sym: 'V<sub>max</sub>', label: 'Curve to', unit: 'kn', min: 2, max: 40, step: 0.5 },
  L: { sym: 'L', label: 'Waterline length', unit: 'm', min: 20, max: 450, step: 0.5 },
  B: { sym: 'B', label: 'Moulded breadth', unit: 'm', min: 3, max: 70, step: 0.1 },
  TF: { sym: 'T<sub>F</sub>', label: 'Draught forward', unit: 'm', min: 0.5, max: 25, step: 0.05 },
  TA: { sym: 'T<sub>A</sub>', label: 'Draught aft', unit: 'm', min: 0.5, max: 25, step: 0.05 },
  volume: { sym: '∇', label: 'Displaced volume', unit: 'm³', step: 1,
    range: s => [Math.round(0.35 * LBT(s)), Math.round(0.92 * LBT(s))], free: true },
  CB: { sym: 'C<sub>B</sub>', label: 'Block coefficient', unit: '', min: 0.35, max: 0.92, step: 0.001 },
  lcb: { sym: 'lcb', label: 'Centre of buoyancy', unit: '% L', min: -6, max: 6, step: 0.05 },
  CM: { sym: 'C<sub>M</sub>', label: 'Midship coefficient', unit: '', min: 0.7, max: 1, step: 0.005 },
  CWP: { sym: 'C<sub>WP</sub>', label: 'Waterplane coefficient', unit: '', min: 0.55, max: 0.98, step: 0.005 },
  ABT: { sym: 'A<sub>BT</sub>', label: 'Bulb area at FP', unit: 'm²', min: 0.5, max: 80, step: 0.5 },
  hB: { sym: 'h<sub>B</sub>', label: 'Bulb centre above keel', unit: 'm', min: 0.1, step: 0.05,
    range: s => [0.1, +(0.6 * s.TF).toFixed(2)] },
  AT: { sym: 'A<sub>T</sub>', label: 'Immersed transom area', unit: 'm²', min: 0.5, max: 80, step: 0.5 },
  SAPP: { sym: 'S<sub>APP</sub>', label: 'Appendage wetted area', unit: 'm²', min: 0, max: 400, step: 1 },
  k2: { sym: '1+k<sub>2</sub>', label: 'Appendage form factor', unit: '', min: 1, max: 4, step: 0.05 },
  d_thruster: { sym: 'd', label: 'Tunnel diameter', unit: 'm', min: 0.5, max: 4, step: 0.1 },
  CBTO: { sym: 'C<sub>BTO</sub>', label: 'Tunnel opening coeff.', unit: '', min: 0.003, max: 0.012, step: 0.0005 },
  iE: { sym: 'i<sub>E</sub>', label: 'Half angle of entrance', unit: '°', min: 1, max: 89, step: 0.1 },
  S: { sym: 'S', label: 'Wetted surface', unit: 'm²', min: 50, max: 60000, step: 1, free: true,
    range: s => [Math.round(0.5 * s.L * (2 * (s.TF + s.TA) / 2 + s.B)), Math.round(1.2 * s.L * (2 * (s.TF + s.TA) / 2 + s.B))] },
  ks_um: { sym: 'k<sub>s</sub>', label: 'Hull roughness', unit: 'µm', min: 50, max: 1000, step: 5 },
  rho: { sym: 'ρ', label: 'Water density', unit: 'kg/m³', min: 990, max: 1035, step: 0.1 },
  nu_e6: { sym: 'ν', label: 'Viscosity ×10⁻⁶', unit: 'm²/s', min: 0.8, max: 1.8, step: 0.0001 },
};

const GROUPS = [
  { title: 'Speed', fields: ['knots', 'vmin', 'vmax'] },
  { title: 'Main dimensions', fields: ['L', 'B', 'TF', 'TA'] },
  { title: 'Displacement', fields: ['volume', 'CB'], seg: 'hold' },
  { title: 'Hull form', fields: ['lcb', 'CM', 'CWP'], seg: 'stern' },
  { title: 'Bulbous bow', toggle: 'bulb', fields: ['ABT', 'hB'] },
  { title: 'Immersed transom', toggle: 'transom', fields: ['AT'] },
  { title: 'Appendages', fields: ['SAPP', 'k2'], seg: 'k2' },
  { title: 'Bow-thruster tunnel', toggle: 'thruster', fields: ['d_thruster', 'CBTO'] },
  { title: 'Entrance angle override', toggle: 'iEOverride', fields: ['iE'] },
  { title: 'Wetted surface override', toggle: 'SOverride', fields: ['S'] },
  { title: 'Rough hull', toggle: 'rough', fields: ['ks_um'] },
  { title: 'Water', fields: ['rho', 'nu_e6'], seg: 'water' },
];

// ---------------------------------------------------------------- state
let state = {};
let result = null;          // last good Python result
let runId = 0, lastShown = 0, pyReady = false, timer = null;
let chartMode = 'R';
const $ = id => document.getElementById(id);
const inputs = {};

function loadPreset(key) {
  const p = PRESETS[key];
  state = { ...BASE, ...p, preset: key };
  state.CB = state.volume / LBT(state);
  syncAll();
  schedule(0);
}

function decimals(step) { const s = String(step); return s.includes('.') ? s.split('.')[1].length : 0; }
function rangeOf(key) {
  const f = FIELDS[key];
  return f.range ? f.range(state) : [f.min, f.max];
}

function setValue(key, raw, fromRange) {
  let v = parseFloat(raw);
  if (!isFinite(v)) return;
  const [lo, hi] = rangeOf(key);
  if (!FIELDS[key].free || fromRange) v = Math.min(hi, Math.max(lo, v));
  state[key] = v;

  if (['L', 'B', 'TF', 'TA'].includes(key)) {
    if (state.hold === 'CB') state.volume = state.CB * LBT(state);
    else state.CB = state.volume / LBT(state);
    if (key === 'TF') state.hB = Math.min(state.hB, 0.6 * state.TF);
  }
  if (key === 'volume') state.CB = state.volume / LBT(state);
  if (key === 'CB') state.volume = state.CB * LBT(state);
  if (key === 'vmin' && state.vmax - state.vmin < 1) state.vmax = Math.min(40, state.vmin + 1);
  if (key === 'vmax' && state.vmax - state.vmin < 1) state.vmin = Math.max(1, state.vmax - 1);
  if (key === 'rho' || key === 'nu_e6') state.water = 'custom';
  syncAll(key);
  schedule();
}

// ---------------------------------------------------------------- build controls
function buildControls() {
  const sel = $('preset');
  sel.innerHTML = Object.entries(PRESETS).map(([k, p]) => `<option value="${k}">${p.name}</option>`).join('');
  sel.onchange = () => loadPreset(sel.value);
  $('resetBtn').onclick = () => loadPreset(sel.value);

  const host = $('groups');
  for (const g of GROUPS) {
    const el = document.createElement('section');
    el.className = 'group';
    if (g.toggle) el.dataset.toggle = g.toggle;
    const id = 'tg-' + (g.toggle || '');
    el.innerHTML = `<div class="group-head"><h3>${g.title}</h3>${g.toggle ?
      `<label class="switch" title="Include ${g.title.toLowerCase()}"><input type="checkbox" id="${id}" aria-label="${g.title}"><span></span></label>` : ''}</div>`;
    if (g.seg) el.appendChild(buildSeg(g.seg));
    for (const key of g.fields) el.appendChild(buildRow(key));
    host.appendChild(el);
    if (g.toggle) {
      $(id).onchange = e => {
        state[g.toggle] = e.target.checked;
        if (e.target.checked && g.toggle === 'iEOverride' && result) state.iE = +result.point.iE_est.toFixed(1);
        if (e.target.checked && g.toggle === 'SOverride' && result) state.S = Math.round(result.point.S_est);
        syncAll();
        schedule();
      };
    }
  }
}

function buildRow(key) {
  const f = FIELDS[key];
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `<label for="n-${key}"><span class="sym">${f.sym}</span>${f.label}</label>
    <div class="num"><input type="number" id="n-${key}" step="${f.step}" inputmode="decimal"><span class="unit">${f.unit}</span></div>
    <input type="range" id="r-${key}" step="${f.step}" aria-label="${f.label}">`;
  const num = row.querySelector('input[type=number]');
  const rng = row.querySelector('input[type=range]');
  rng.addEventListener('input', () => setValue(key, rng.value, true));
  num.addEventListener('change', () => setValue(key, num.value, false));
  num.addEventListener('keydown', e => { if (e.key === 'Enter') setValue(key, num.value, false); });
  inputs[key] = { num, rng, row };
  return row;
}

function buildSeg(kind) {
  const wrap = document.createElement('div');
  wrap.className = 'seg-row';
  let label, options, get, set;
  if (kind === 'hold') {
    label = 'Hold constant when L, B or T change';
    options = [['volume', '∇ volume'], ['CB', 'C_B']];
    get = () => state.hold; set = v => { state.hold = v; };
  } else if (kind === 'stern') {
    label = 'Stern shape C<sub>stern</sub>';
    options = STERNS.map(([v, n]) => [v, `${n} ${v > 0 ? '+' : ''}${v}`]);
    get = () => state.Cstern; set = v => { state.Cstern = +v; schedule(); };
  } else if (kind === 'k2') {
    const sel = document.createElement('select');
    sel.id = 'k2Preset';
    sel.innerHTML = '<option value="">1+k₂ from the appendage table…</option>' +
      K2_TABLE.map(([n, v]) => `<option value="${v}">${n} · ${v}</option>`).join('');
    sel.onchange = () => { if (sel.value) setValue('k2', sel.value); sel.value = ''; };
    wrap.appendChild(sel);
    return wrap;
  } else if (kind === 'water') {
    const sel = document.createElement('select');
    sel.id = 'waterSel';
    sel.innerHTML = Object.entries(WATERS).map(([k, [n]]) => `<option value="${k}">${n}</option>`).join('') +
      '<option value="custom">Custom</option>';
    sel.onchange = () => {
      state.water = sel.value;
      if (WATERS[sel.value]) { state.rho = WATERS[sel.value][1]; state.nu_e6 = WATERS[sel.value][2]; }
      syncAll(); schedule();
    };
    wrap.appendChild(sel);
    return wrap;
  }
  wrap.innerHTML = `<span>${label}</span><div class="seg" role="group"></div>`;
  const seg = wrap.querySelector('.seg');
  for (const [v, text] of options) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.v = v;
    b.innerHTML = text.replace('C_B', 'C<sub>B</sub>');
    b.onclick = () => { set(kind === 'stern' ? +v : v); syncSegs(); };
    seg.appendChild(b);
  }
  wrap.dataset.kind = kind;
  wrap._get = get;
  return wrap;
}

function syncSegs() {
  for (const w of document.querySelectorAll('.seg-row[data-kind]')) {
    const cur = String(w._get());
    for (const b of w.querySelectorAll('button')) b.setAttribute('aria-pressed', b.dataset.v === cur);
  }
}

function syncAll(skip) {
  for (const [key, { num, rng }] of Object.entries(inputs)) {
    const f = FIELDS[key];
    const [lo, hi] = rangeOf(key);
    rng.min = lo; rng.max = hi;
    let v = state[key];
    // Disabled overrides show the live estimate instead of a stale value.
    if (key === 'iE' && !state.iEOverride && result) v = result.point.iE_est;
    if (key === 'S' && !state.SOverride && result) v = result.point.S_est;
    rng.value = v;
    if (document.activeElement !== num || skip !== key) num.value = (+v).toFixed(decimals(f.step));
  }
  for (const g of document.querySelectorAll('.group[data-toggle]')) {
    const on = !!state[g.dataset.toggle];
    g.classList.toggle('off', !on);
    $('tg-' + g.dataset.toggle).checked = on;
    for (const inp of g.querySelectorAll('.row input')) inp.disabled = !on;
  }
  $('waterSel').value = state.water;
  $('preset').value = state.preset;
  syncSegs();
}

// ---------------------------------------------------------------- python bridge
function shipPayload() {
  const s = state;
  return {
    L: s.L, B: s.B, TF: s.TF, TA: s.TA, volume: s.volume, lcb: s.lcb, CM: s.CM, CWP: s.CWP,
    ABT: s.bulb ? s.ABT : 0, hB: s.bulb ? s.hB : 0, AT: s.transom ? s.AT : 0,
    SAPP: s.SAPP, k2: s.k2, Cstern: s.Cstern,
    iE: s.iEOverride ? s.iE : null, S: s.SOverride ? s.S : null,
    rho: s.rho, nu: s.nu_e6 * 1e-6, ks: s.rough ? s.ks_um * 1e-6 : null,
    d_thruster: s.thruster ? s.d_thruster : 0, CBTO: s.CBTO,
  };
}

function schedule(delay = 80) {
  clearTimeout(timer);
  timer = setTimeout(send, delay);
}
function send() {
  if (!pyReady) return;
  const frame = $('pyFrame').contentWindow;
  frame.postMessage({ type: 'run', id: ++runId, ship: shipPayload(),
    knots: state.knots, vmin: state.vmin, vmax: state.vmax }, '*');
}

window.addEventListener('message', e => {
  const m = e.data || {};
  if (m.type === 'py-ready') {
    pyReady = true;
    $('pyBadge').className = 'py-badge ready';
    $('pyBadgeText').textContent = `Python ${m.version} · ${m.engine}`;
    $('pyHint').textContent = m.engine === 'native' ? 'holtrop.py running in desktop Python' : 'holtrop.py running under Pyodide';
    send();
  } else if (m.type === 'py-result') {
    if (m.id < lastShown) return;
    lastShown = m.id;
    result = m.data;
    showError(null);
    render();
    syncAll();
  } else if (m.type === 'py-error') {
    if (!m.id) { $('pyBadge').className = 'py-badge err'; $('pyBadgeText').textContent = 'Python failed'; }
    showError(m.error);
  }
});

function showError(msg) {
  const b = $('banner');
  document.querySelectorAll('.kpis, .card:not(.py-card)').forEach(el => el.classList.toggle('stale', !!msg && !!result));
  if (!msg) { b.hidden = true; return; }
  b.hidden = false;
  b.innerHTML = `<b>Python raised an error</b><span><code>${msg.replace(/</g, '&lt;')}</code><br>
    The board shows the last valid result. Adjust the inputs to bring the hull back inside the formulas' domain.</span>`;
}

// ---------------------------------------------------------------- formatting
const nf = (v, d = 0) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const kN = v => nf(v / 1000, 1);
function sig(v, n = 4) {
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e6 || a < 1e-3) return v.toExponential(n - 1).replace('e', '×10^').replace(/\^\+?(-?)(\d+)/, (m, s, d) => `<sup>${s}${d}</sup>`);
  const d = Math.max(0, n - 1 - Math.floor(Math.log10(a)));
  return nf(v, Math.min(d, 6));
}
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const GROUPS_R = [
  { key: 'RF_k1', name: 'Friction with form', sym: 'RF(1+k1)', color: '--s1' },
  { key: 'RW', name: 'Waves', sym: 'RW', color: '--s2' },
  { key: 'RA', name: 'Correlation', sym: 'RA', color: '--s3' },
  { key: 'other', name: 'Appendages, bulb, transom', sym: 'RAPP+RB+RTR', color: '--s4' },
];
const other = p => p.RAPP + p.RB + p.RTR;

// ---------------------------------------------------------------- render
function render() {
  if (!result) return;
  const p = result.point;
  renderKpis(p);
  renderBreakdown(p);
  renderSteps(p);
  renderValidity(result.validity);
  renderChart();
  const lw = 2 * Math.PI * p.V ** 2 / G;
  $('shipHint').textContent = `wave length 2πV²/g = ${nf(lw, 1)} m · λ/L = ${nf(lw / state.L, 2)}`;
}

function renderKpis(p) {
  const lw = 2 * Math.PI * p.V ** 2 / G;
  const tiles = [
    ['hero', 'Total resistance R<sub>T</sub>', nf(p.RT / 1000, 1), 'kN', `at ${nf(p.knots, 1)} kn · ${nf(p.V, 2)} m/s`],
    ['', 'Effective power P<sub>E</sub>', nf(p.PE / 1000, 0), 'kW', `${nf(p.PE / 1e6, 2)} MW = R<sub>T</sub>·V`],
    ['', 'Froude number F<sub>n</sub>', nf(p.Fn, 3), '', `R<sub>n</sub> = ${sig(p.Rn, 3)}`],
    ['', 'Form factor 1+k<sub>1</sub>', nf(p.k1, 3), '', `C<sub>stern</sub> ${state.Cstern > 0 ? '+' : ''}${state.Cstern}`],
    ['', 'C<sub>B</sub> · C<sub>P</sub>', `${nf(p.CB, 3)}<small>·</small>${nf(p.CP, 3)}`, '', `L<sub>R</sub> = ${nf(p.LR, 1)} m`],
    ['', 'Wetted surface S', nf(p.S, 0), 'm²', state.SOverride ? 'user override' : 'Holtrop estimate'],
    ['', 'Wave length / L', nf(lw / state.L, 2), '', `i<sub>E</sub> = ${nf(p.iE, 1)}°`],
  ];
  $('kpis').innerHTML = tiles.map(([cls, k, v, u, s]) =>
    `<div class="kpi ${cls}"><div class="k">${k}</div><div class="v">${v}${u ? `<small>${u}</small>` : ''}</div><div class="s">${s}</div></div>`).join('');
}

function renderBreakdown(p) {
  $('bdSpeed').textContent = `${nf(p.knots, 1)} kn`;
  const parts = [
    ['RF_k1', 'Friction with form', 'RF(1+k1)', '--s1'], ['RAPP', 'Appendages', 'RAPP', '--s4'],
    ['RW', 'Waves', 'RW', '--s2'], ['RB', 'Bulbous bow', 'RB', '--s4'], ['RTR', 'Transom', 'RTR', '--s4'],
    ['RA', 'Correlation', 'RA', '--s3'],
  ];
  $('stackBar').innerHTML = GROUPS_R.map(g => {
    const v = g.key === 'other' ? other(p) : p[g.key];
    return v > 0 ? `<div title="${g.name}: ${kN(v)} kN" style="flex-grow:${v};background:var(${g.color})"></div>` : '';
  }).join('');
  $('bdTable').innerHTML = parts.map(([k, name, sym, c]) =>
    `<tr><td><span class="sw" style="background:var(${c})"></span>${name} <span class="sub">${sym}</span></td>
      <td>${kN(p[k])} kN</td><td>${nf(100 * p[k] / p.RT, 1)} %</td></tr>`).join('') +
    (p.RBT > 0 ? `<tr><td class="sub" style="padding-left:22px">incl. bow-thruster tunnel</td><td>${kN(p.RBT)} kN</td><td></td></tr>` : '') +
    `<tr class="total"><td>Total R<sub>T</sub></td><td>${kN(p.RT)} kN</td><td>100 %</td></tr>
     <tr><td>Effective power P<sub>E</sub></td><td>${nf(p.PE / 1000, 0)} kW</td><td></td></tr>`;
}

function renderSteps(p) {
  const steps = [
    ['1', 'Hull form', [['V', nf(p.V, 3) + ' m/s'], ['T', nf(p.T, 2) + ' m'], ['CB', nf(p.CB, 4)], ['CP', nf(p.CP, 4)], ['Fn', nf(p.Fn, 4)], ['LR', nf(p.LR, 2) + ' m']]],
    ['2', 'Friction', [['S', nf(p.S, 1) + ' m²'], ['Rn', sig(p.Rn)], ['CF', sig(p.CF)], ['½ρV²', nf(p.q / 1000, 2) + ' kPa'], ['RF', kN(p.RF) + ' kN', 1]]],
    ['3', 'Form factor', [['c12', nf(p.c12, 4)], ['c13', nf(p.c13, 3)], ['1+k1', nf(p.k1, 4)], ['RF(1+k1)', kN(p.RF_k1) + ' kN', 1]]],
    ['4', 'Appendages', [['SAPP', nf(state.SAPP, 0) + ' m²'], ['1+k2', nf(state.k2, 2)], ['RBT', kN(p.RBT) + ' kN'], ['RAPP', kN(p.RAPP) + ' kN', 1]]],
    ['5', 'Waves', [['c7', nf(p.c7, 4)], ['iE', nf(p.iE, 2) + '°'], ['c1', nf(p.c1, 4)], ['c3', nf(p.c3, 5)], ['c2', nf(p.c2, 4)], ['c5', nf(p.c5, 4)],
      ['c16', nf(p.c16, 4)], ['m1', nf(p.m1, 4)], ['c15', nf(p.c15, 4)], ['m2', nf(p.m2, 4)], ['λ', nf(p.lam, 4)], ['RW', kN(p.RW) + ' kN', 1]]],
    ['6', 'Bulb, transom', [['PB', nf(p.PB, 4)], ['Fni', nf(p.Fni, 3)], ['RB', nf(p.RB / 1000, 3) + ' kN', 1], ['FnT', nf(p.FnT, 3)], ['c6', nf(p.c6, 4)], ['RTR', kN(p.RTR) + ' kN', 1]]],
    ['7', 'Correlation', [['c4', nf(p.c4, 4)], ['CA', sig(p.CA)], ['RA', kN(p.RA) + ' kN', 1]]],
    ['8', 'Total, power', [['RT', kN(p.RT) + ' kN', 1], ['PE', nf(p.PE / 1000, 0) + ' kW', 1], ['CT', sig(p.CT)]]],
  ];
  $('steps').innerHTML = steps.map(([n, t, rows]) =>
    `<div class="step"><h4>Step ${n}<b>${t}</b></h4><dl>${rows.map(([k, v, key]) =>
      `<dt>${k}</dt><dd class="${key ? 'key' : ''}">${v}</dd>`).join('')}</dl></div>`).join('');
}

const ICON_OK = '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="var(--good)"/><path d="M4.5 8.2l2.3 2.3 4.7-4.8" stroke="#fff" stroke-width="1.8" fill="none"/></svg>';
const ICON_WARN = '<svg viewBox="0 0 16 16"><path d="M8 1.5l7 12.5H1z" fill="var(--warning)"/><path d="M8 6v4M8 11.6v.4" stroke="#0b0b0b" stroke-width="1.7"/></svg>';

function renderValidity(v) {
  const matches = v.rows.filter(r => r.ok).map(r => r.type);
  const status = matches.length
    ? `<div class="val-status ok">${ICON_OK}<span><b>In range</b> for ${matches.join(', ')}.</span></div>`
    : `<div class="val-status warn">${ICON_WARN}<span><b>Outside every fitted range.</b> Treat the answer as a rough guide only.</span></div>`;
  const range = (r, d) => `${nf(r[0], d)}–${nf(r[1], d)}`;
  $('validity').innerHTML = status + `<table class="val"><thead><tr><th>Ship type</th><th>Max Fn</th><th>CP</th><th>L/B</th><th>B/T</th></tr></thead><tbody>
    <tr class="cur"><td>This ship</td><td>${nf(v.Fn, 3)}</td><td>${nf(v.CP, 3)}</td><td>${nf(v.LB, 2)}</td><td>${nf(v.BT, 2)}</td></tr>
    ${v.rows.map(r => `<tr class="${r.ok ? 'match' : ''}"><td>${r.type}</td>
      <td class="${r.checks.Fn ? '' : 'bad'}">${nf(r.fn_max, 2)}</td><td class="${r.checks.CP ? '' : 'bad'}">${range(r.cp, 2)}</td>
      <td class="${r.checks['L/B'] ? '' : 'bad'}">${range(r.lb, 1)}</td><td class="${r.checks['B/T'] ? '' : 'bad'}">${range(r.bt, 1)}</td></tr>`).join('')}
    </tbody></table>`;
}

// ---------------------------------------------------------------- chart
let chart = null;
const MODES = {
  // One blue ramp, so each line also carries its own dash pattern.
  R: { title: 'Resistance curve', unit: 'kN', series: [
    { label: 'Total RT', ink: true, f: p => p.RT / 1000 },
    { label: 'Friction with form', color: '--s1', dash: [], f: p => p.RF_k1 / 1000 },
    { label: 'Waves RW', color: '--s2', dash: [7, 4], f: p => p.RW / 1000 },
    { label: 'Correlation RA', color: '--s3', dash: [2, 3], f: p => p.RA / 1000 },
    { label: 'Appendages, bulb, transom', color: '--s4', dash: [9, 3, 2, 3], f: p => other(p) / 1000 }] },
  P: { title: 'Effective power', unit: 'kW', series: [
    { label: 'Effective power PE', ink: true, f: p => p.PE / 1000 }] },
  C: { title: 'Resistance coefficients', unit: '×10³', series: [
    { label: 'CT', ink: true, f: p => p.CT * 1e3 },
    { label: 'CF(1+k1)', color: '--s1', dash: [], f: p => p.RF_k1 / (p.q * p.S) * 1e3 },
    { label: 'CW', color: '--s2', dash: [7, 4], f: p => p.CW * 1e3 },
    { label: 'CA', color: '--s3', dash: [2, 3], f: p => p.CA * 1e3 }] },
  S: { title: 'Share of total resistance', unit: '%', stacked: true, series: [
    { label: 'Friction with form', color: '--s1', f: p => 100 * p.RF_k1 / p.RT },
    { label: 'Waves RW', color: '--s2', f: p => 100 * p.RW / p.RT },
    { label: 'Correlation RA', color: '--s3', f: p => 100 * p.RA / p.RT },
    { label: 'Appendages, bulb, transom', color: '--s4', f: p => 100 * other(p) / p.RT }] },
};

const markerPlugin = {
  id: 'designSpeed',
  afterDatasetsDraw(c) {
    if (!result) return;
    const { ctx, chartArea: a, scales: { x } } = c;
    const px = x.getPixelForValue(state.knots);
    if (px < a.left || px > a.right) return;
    ctx.save();
    ctx.strokeStyle = css('--ink-2'); ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = css('--ink'); ctx.font = '600 11px ' + css('--font');
    ctx.textAlign = px > a.right - 70 ? 'right' : 'left';
    ctx.fillText(`${nf(state.knots, 1)} kn`, px + (ctx.textAlign === 'right' ? -5 : 5), a.top + 11);
    const mode = MODES[chartMode];
    if (!mode.stacked) {
      const y = c.scales.y.getPixelForValue(mode.series[0].f(result.point));
      ctx.fillStyle = css('--surface'); ctx.strokeStyle = css('--ink'); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, y, 5, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  },
};

function renderChart() {
  const mode = MODES[chartMode];
  $('chartTitle').textContent = mode.title;
  const curve = result.curve;
  const ink = css('--ink'), grid = css('--grid'), muted = css('--muted'), surface = css('--surface');
  const datasets = mode.series.map(s => {
    const color = s.ink ? ink : css(s.color);
    return {
      label: s.label, data: curve.map(p => ({ x: p.knots, y: s.f(p) })),
      borderColor: color, backgroundColor: mode.stacked ? color : color,
      borderWidth: s.ink ? 3.25 : 1.75, borderDash: mode.stacked ? [] : (s.dash || []), pointRadius: 0, pointHoverRadius: 4, pointHoverBorderWidth: 2,
      pointHoverBackgroundColor: color, pointHoverBorderColor: surface, tension: 0.25,
      fill: mode.stacked ? (s === mode.series[0] ? 'origin' : '-1') : false,
    };
  });
  $('chartLegend').innerHTML = mode.series.length > 1 ? mode.series.map(s => {
    const c = s.ink ? 'var(--ink)' : `var(${s.color})`;
    const key = mode.stacked
      ? `<rect x="6" y="0" width="10" height="10" rx="2" fill="${c}"/>`
      : `<line x1="0" y1="5" x2="22" y2="5" stroke="${c}" stroke-width="${s.ink ? 3.25 : 1.75}" stroke-dasharray="${(s.dash || []).join(' ')}"/>`;
    return `<span><svg viewBox="0 0 22 10" aria-hidden="true">${key}</svg>${s.label}</span>`;
  }).join('') : '';

  const options = {
    responsive: true, maintainAspectRatio: false, animation: false, parsing: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: surface, titleColor: ink, bodyColor: ink, borderColor: css('--axis'), borderWidth: 1,
        padding: 10, boxPadding: 4, usePointStyle: true,
        callbacks: {
          title: items => `${nf(items[0].parsed.x, 1)} kn · Fn ${nf(curve[items[0].dataIndex].Fn, 3)}`,
          label: it => ` ${it.dataset.label}: ${nf(it.parsed.y, mode.unit === 'kN' || mode.unit === '%' ? 1 : mode.unit === 'kW' ? 0 : 3)} ${mode.unit}`,
        },
      },
    },
    scales: {
      x: { type: 'linear', min: state.vmin, max: state.vmax, title: { display: true, text: 'Speed, knots', color: muted },
        grid: { color: grid, drawTicks: false }, border: { color: css('--axis') }, ticks: { color: muted, padding: 6 } },
      y: { beginAtZero: true, stacked: !!mode.stacked, max: mode.stacked ? 100 : undefined,
        title: { display: true, text: `${mode.title.split(' ')[0]}, ${mode.unit}`, color: muted },
        grid: { color: grid, drawTicks: false }, border: { display: false },
        ticks: { color: muted, padding: 6, callback: v => nf(v, 0) } },
    },
    onClick: (e, els, c) => {
      const v = c.scales.x.getValueForPixel(e.x);
      if (v >= state.vmin && v <= state.vmax) setValue('knots', Math.round(v * 10) / 10);
    },
  };
  if (!chart) {
    Chart.defaults.font.family = css('--font');
    chart = new Chart($('curve'), { type: 'line', data: { datasets }, options, plugins: [markerPlugin] });
  } else {
    chart.data.datasets = datasets;
    chart.options = options;
    chart.update('none');
  }
}

for (const b of document.querySelectorAll('#chartMode button')) {
  b.onclick = () => {
    chartMode = b.dataset.mode;
    for (const o of document.querySelectorAll('#chartMode button')) o.setAttribute('aria-pressed', o === b);
    if (result) renderChart();
  };
}

// ---------------------------------------------------------------- ship canvas
const canvas = $('shipCanvas');
const ctx = canvas.getContext('2d');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const foam = Array.from({ length: 70 }, () => ({ u: Math.random(), d: Math.random(), s: 0.6 + Math.random() * 0.8 }));
let lastT = performance.now(), flow = 0;

function drawShip(now) {
  requestAnimationFrame(drawShip);
  const dpr = devicePixelRatio || 1;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  if (!W) return;
  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  if (!result) {
    ctx.fillStyle = css('--muted'); ctx.font = '13px ' + css('--font'); ctx.textAlign = 'center';
    ctx.fillText('Waiting for the Python runtime…', W / 2, H / 2);
    return;
  }

  const p = result.point, s = state;
  const L = s.L, B = s.B, TF = s.TF, TA = s.TA, Tm = (TF + TA) / 2;
  const D = Math.max(TF, TA) * 1.55 + 2;                      // schematic depth to deck
  const V = p.V, Hv = V * V / (2 * G), k = G / (V * V);
  const sideH = H * 0.6, planTop = sideH + 8, planH = H - planTop - 6;

  // Shared horizontal scale; vertical exaggeration on the side view only.
  const xMinM = -0.42 * L, xMaxM = 1.14 * L;
  const sx = (W - 24) / (xMaxM - xMinM);
  const X = xm => 12 + (xm - xMinM) * sx;
  const ve = Math.min(6, Math.max(1, (sideH - 80) / ((D + 3 * Hv * 0.25 + 6) * sx)));
  const wlY = 46 +(D - Tm) * sx * ve + Hv * 0.25 * sx * ve;  // screen y of the mean waterline
  const Z = zm => wlY - (zm - Tm) * sx * ve;                   // z measured up from keel

  // Kelvin transverse waves from the bow and stern shoulders (stationary relative to the hull).
  const Ab = 0.22 * Hv * Math.sqrt(p.c2), As = 0.13 * Hv * (0.5 + 0.5 * p.c5);
  const xb = L * 0.985, xs = Math.max(p.LR, 0.1 * L);
  const t = now / 1000;
  const eta = x => {
    let e = x <= xb ? Ab * Math.cos(k * (xb - x)) * Math.exp(-(xb - x) / (2.2 * L)) : Ab * Math.exp(-(((x - xb) / (0.035 * L)) ** 2));
    e += x <= xs ? -As * Math.cos(k * (xs - x)) * Math.exp(-(xs - x) / (2.2 * L)) : -As * Math.exp(-(((x - xs) / (0.06 * L)) ** 2));
    return e + 0.04 * Hv * Math.sin(x * 0.35 + t * 2.1) * (reduceMotion.matches ? 0 : 1);
  };
  const wlZ = x => TA + (TF - TA) * x / L;                      // still waterline (with trim)

  // Water body
  const waterCol = css('--water'), waterLine = css('--water-line'), hull = css('--hull'), hullLine = css('--hull-line');
  ctx.beginPath();
  ctx.moveTo(X(xMinM), sideH);
  for (let xm = xMinM; xm <= xMaxM; xm += (xMaxM - xMinM) / 260) ctx.lineTo(X(xm), Z(wlZ(Math.min(L, Math.max(0, xm))) + eta(xm)));
  ctx.lineTo(X(xMaxM), sideH);
  ctx.closePath();
  ctx.fillStyle = waterCol; ctx.fill();

  // Hull geometry (schematic): transom, run, flat keel, entrance, bulb, raked stem.
  const tT = s.transom ? Math.min(0.8 * TA, s.AT / (0.56 * B)) : 0;
  const aftZ = s.transom ? TA - tT : TA + 0.4;
  const runEnd = Math.min(0.48 * L, Math.max(0.15 * L, p.LR));
  const foreStart = L * (1 - Math.max(0.08, 0.35 * (1 - p.CP)));
  let bulbR = 0;
  if (s.bulb && s.ABT > 0) bulbR = Math.sqrt(s.ABT / (Math.PI * 0.6));
  const deckZ = D;
  ctx.beginPath();
  ctx.moveTo(X(0), Z(deckZ));
  ctx.lineTo(X(0), Z(aftZ));
  ctx.bezierCurveTo(X(runEnd * 0.35), Z(aftZ), X(runEnd * 0.6), Z(0), X(runEnd), Z(0));
  ctx.lineTo(X(foreStart), Z(0));
  if (bulbR) {
    const bz = s.hB, bx = L + bulbR * 0.9;
    ctx.bezierCurveTo(X(L - 0.02 * L), Z(0), X(bx), Z(bz - bulbR * 1.05), X(bx + bulbR * 0.9), Z(bz));
    ctx.bezierCurveTo(X(bx + bulbR * 0.9), Z(bz + bulbR), X(L + 0.3 * bulbR), Z(bz + bulbR * 1.1), X(L), Z(Math.min(TF * 0.8, bz + bulbR * 1.6)));
    ctx.lineTo(X(L), Z(TF));
  } else {
    ctx.bezierCurveTo(X(L - 0.015 * L), Z(0), X(L), Z(0.2 * TF), X(L), Z(TF));
  }
  ctx.lineTo(X(L + 0.035 * L), Z(deckZ));
  ctx.closePath();
  ctx.fillStyle = hull; ctx.globalAlpha = 0.96; ctx.fill(); ctx.globalAlpha = 1;
  ctx.lineWidth = 1.6; ctx.strokeStyle = hullLine; ctx.stroke();

  // Superstructure and rudder
  ctx.fillStyle = css('--deck');
  const shX0 = 0.03 * L, shX1 = 0.13 * L, shH = Math.max(4, 0.06 * L);
  ctx.fillRect(X(shX0), Z(deckZ + shH / ve * 1.2), X(shX1) - X(shX0), Z(deckZ) - Z(deckZ + shH / ve * 1.2));
  ctx.strokeRect(X(shX0), Z(deckZ + shH / ve * 1.2), X(shX1) - X(shX0), Z(deckZ) - Z(deckZ + shH / ve * 1.2));
  let rud = null;
  if (s.SAPP > 0) {
    const rh = Math.min(0.75 * TA, Math.sqrt(s.SAPP / 2 * 1.6)), rc = Math.min(0.06 * L, s.SAPP / 2 / rh);
    rud = { x0: -0.004 * L - rc, z0: Math.max(0.1 * TA, aftZ - 0.2 - rh), w: rc, h: rh };
    rud.z0 = Math.max(0.05 * TA, Math.min(rud.z0, TA - rh));
    ctx.fillStyle = css('--deck');
    ctx.fillRect(X(rud.x0), Z(rud.z0 + rud.h), X(rud.x0 + rud.w) - X(rud.x0), Z(rud.z0) - Z(rud.z0 + rud.h));
    ctx.strokeRect(X(rud.x0), Z(rud.z0 + rud.h), X(rud.x0 + rud.w) - X(rud.x0), Z(rud.z0) - Z(rud.z0 + rud.h));
  }

  // Still waterline (dashed) and the wave profile drawn over the hull side
  ctx.setLineDash([5, 4]); ctx.strokeStyle = waterLine; ctx.lineWidth = 1; ctx.globalAlpha = 0.7;
  ctx.beginPath(); ctx.moveTo(X(0), Z(TA)); ctx.lineTo(X(L), Z(TF)); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  ctx.beginPath();
  for (let xm = xMinM, i = 0; xm <= xMaxM; xm += (xMaxM - xMinM) / 260, i++) {
    const y = Z(wlZ(Math.min(L, Math.max(0, xm))) + eta(xm));
    i ? ctx.lineTo(X(xm), y) : ctx.moveTo(X(xm), y);
  }
  ctx.strokeStyle = waterLine; ctx.lineWidth = 2; ctx.stroke();

  // Flow tracers drift aft at the true speed on screen scale.
  if (!reduceMotion.matches) flow += V * dt;
  ctx.fillStyle = waterLine;
  const span = xMaxM - xMinM;
  for (const f of foam) {
    const xm = xMaxM - (((f.u * span + flow * f.s) % span) + span) % span;
    const inside = xm > 0 && xm < L;
    const depth = 0.3 + f.d * (inside ? 0.15 : 1.2) * Tm;
    const zm = wlZ(Math.min(L, Math.max(0, xm))) + eta(xm) - depth * (inside ? 0.3 : 1);
    if (inside && zm > 0 && depth > 0.15 * Tm) continue;
    ctx.globalAlpha = 0.25 + 0.35 * (1 - f.d);
    ctx.fillRect(X(xm), Z(zm), 6 * f.s, 1.5);
  }
  ctx.globalAlpha = 1;

  // Resistance arrows: length grows with each component's share of RT.
  const font = css('--font'), ink = css('--ink');
  const arrow = (xm, zm, val, color, label, dy = -6, align = 'left') => {
    if (!(val > 0)) return;
    const len = 14 + 150 * Math.sqrt(val / p.RT) * (val / p.RT > 0.002 ? 1 : 0.4);
    const x0 = X(xm), y0 = Z(zm);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 - len, y0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0 - len - 7, y0); ctx.lineTo(x0 - len + 1, y0 - 4.5); ctx.lineTo(x0 - len + 1, y0 + 4.5); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(x0, y0, 3, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = ink; ctx.font = '600 11px ' + font; ctx.textAlign = align;
    ctx.fillText(label, align === 'left' ? x0 - len : x0, y0 + dy);
  };
  const lab = (sym, v) => `${sym} ${v / 1000 >= 100 ? nf(v / 1000, 0) : nf(v / 1000, 1)} kN`;
  arrow(L * 1.0, TF + eta(xb) + 0.3, p.RW, css('--s2'), lab('RW', p.RW), -8);
  arrow(0.62 * L, -0.02 * Tm, p.RF_k1, css('--s1'), lab('RF(1+k1)', p.RF_k1), 15);
  arrow(shX1, deckZ + shH / ve * 1.2, p.RA, css('--s3'), lab('RA', p.RA), -8);
  if (bulbR) arrow(L + bulbR * 1.4, s.hB, p.RB, css('--s4'), lab('RB', p.RB), 15);
  if (rud) arrow(rud.x0 + rud.w / 2, rud.z0 + rud.h / 2, p.RAPP, css('--s4'), lab('RAPP', p.RAPP), 15);
  if (tT > 0) arrow(0, TA - tT / 2, p.RTR, css('--s4'), lab('RTR', p.RTR), -8);

  // Annotations
  ctx.fillStyle = css('--muted'); ctx.font = '11px ' + font; ctx.textAlign = 'left';
  ctx.fillText(`side view · vertical scale ×${nf(ve, 1)} · flow tracers move at V = ${nf(V, 2)} m/s`, 12, sideH - 8);
  ctx.textAlign = 'right';
  ctx.fillText('bow →', W - 12, 16);

  // Waterplane (plan view, true proportions)
  const pyc = planTop + planH / 2;
  const sy = Math.min(sx, (planH - 8) / B);
  const Y = (ym) => pyc - ym * sy;
  const half = B / 2;
  const bt = s.transom ? half * (0.55 + 0.25 * Math.min(1, s.AT / (0.4 * B * Tm))) : half * 0.18;
  const iE = p.iE * Math.PI / 180;
  const LE = Math.max(0.12 * L, Math.min(0.5 * L, L * (1 - p.CP) * 0.95 * (1.25 - 0.5 * (s.CWP - 0.6))));
  const xE = L - LE;
  const tip = Math.min(LE * 0.45, half / Math.tan(Math.max(iE, 0.05)) * 0.6);
  ctx.beginPath();
  ctx.moveTo(X(L), Y(0));
  ctx.bezierCurveTo(X(L - tip), Y(tip * Math.tan(iE)), X(xE + LE * 0.5), Y(half), X(xE), Y(half));
  ctx.lineTo(X(runEnd), Y(half));
  ctx.bezierCurveTo(X(runEnd * 0.7), Y(half), X(runEnd * 0.5), Y(half * 0.98), X(0), Y(bt));
  ctx.lineTo(X(0), Y(-bt));
  ctx.bezierCurveTo(X(runEnd * 0.5), Y(-half * 0.98), X(runEnd * 0.7), Y(-half), X(runEnd), Y(-half));
  ctx.lineTo(X(xE), Y(-half));
  ctx.bezierCurveTo(X(xE + LE * 0.5), Y(-half), X(L - tip), Y(-tip * Math.tan(iE)), X(L), Y(0));
  ctx.closePath();
  ctx.fillStyle = hull; ctx.fill();
  ctx.strokeStyle = hullLine; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.setLineDash([6, 4]); ctx.strokeStyle = css('--muted'); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(X(-0.05 * L), Y(0)); ctx.lineTo(X(1.08 * L), Y(0)); ctx.stroke(); ctx.setLineDash([]);
  // entrance angle
  const r = Math.min(0.12 * L * sx, 46);
  ctx.strokeStyle = css('--s2'); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(X(L), Y(0)); ctx.lineTo(X(L) - Math.cos(iE) * r * 1.6, Y(0) + Math.sin(iE) * r * 1.6 * (sy / sx)); ctx.stroke();
  ctx.beginPath(); ctx.arc(X(L), Y(0), r, Math.PI, Math.PI - Math.atan(Math.tan(iE) * sy / sx), true); ctx.stroke();
  ctx.fillStyle = ink; ctx.font = '600 11px ' + font; ctx.textAlign = 'right';
  ctx.fillText(`iE ${nf(p.iE, 1)}°`, X(L) - r - 4, Y(0) + 14);
  ctx.textAlign = 'left'; ctx.fillStyle = css('--muted'); ctx.font = '11px ' + font;
  ctx.fillText(`waterplane · L ${nf(L, 1)} m × B ${nf(B, 1)} m · CWP ${nf(s.CWP, 3)}`, 12, planTop + 10);
  ctx.textAlign = 'center';
  ctx.fillText(`LR ${nf(p.LR, 1)} m`, X(runEnd / 2), Y(-half) + 13);
}
requestAnimationFrame(drawShip);

// ---------------------------------------------------------------- theme
$('themeBtn').onclick = () => {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('hm-theme', root.dataset.theme); } catch (e) { /* storage unavailable */ }
  if (result) renderChart();
};
try { const t = localStorage.getItem('hm-theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) { /* ignore */ }
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => result && renderChart());

buildControls();
loadPreset('example');
