/**
 * WalletWise — js/app.js
 * Vanilla JavaScript only (no frameworks) ✓
 * LocalStorage for persistence ✓
 *
 * MVP:  Input form + validation, transaction list + delete,
 *       auto-updating total balance, pie chart (Chart.js)
 * OPT1: Custom categories
 * OPT2: Monthly summary view
 * OPT4: Highlight spending over set limit
 */
'use strict';

/* ── STORAGE KEYS ── */
const SK = {
  tx:    'ww_tx',
  cats:  'ww_cats',
  limit: 'ww_limit',
  theme: 'ww_theme',
};

/* ── DEFAULT CATEGORIES ── */
const DEF_CATS = [
  { id:'food',       name:'Makanan',   color:'#ff3fa0', emoji:'🍔' },
  { id:'transport',  name:'Transport', color:'#9060ff', emoji:'🚗' },
  { id:'fun',        name:'Hiburan',   color:'#00d4a0', emoji:'🎉' },
  { id:'shop',       name:'Belanja',   color:'#f5c340', emoji:'🛍️' },
  { id:'health',     name:'Kesehatan', color:'#3b8bff', emoji:'💊' },
  { id:'income_def', name:'Pemasukan', color:'#00d4a0', emoji:'💵' },
];

/* ── COLOR PALETTE for custom cats ── */
const PALETTE = [
  '#ff3fa0','#9060ff','#00d4a0','#f5c340','#3b8bff',
  '#ff4a5e','#10c49e','#f97316','#a855f7','#06b6d4',
];

/* ── STATE ── */
const S = {
  txs:       [],
  cats:      [],
  limit:     0,
  txType:    'expense',
  selColor:  PALETTE[0],
  curMonth:  new Date(),
};

let pieChart = null;
let barChart = null;

/* ══════════════════════════════════════════════
   PERSIST — LocalStorage
══════════════════════════════════════════════ */
function loadStorage() {
  try {
    const t = localStorage.getItem(SK.tx);
    const c = localStorage.getItem(SK.cats);
    const l = localStorage.getItem(SK.limit);
    const theme = localStorage.getItem(SK.theme) || 'dark';

    S.txs   = t ? JSON.parse(t) : [];
    S.cats  = c ? JSON.parse(c) : [...DEF_CATS];
    S.limit = l ? parseFloat(l) : 0;

    document.documentElement.setAttribute('data-theme', theme);
    document.getElementById('themeBtn').textContent = theme === 'dark' ? '🌙' : '☀️';
    if (S.limit > 0) document.getElementById('fLimit').value = S.limit;
  } catch (e) {
    S.cats = [...DEF_CATS];
  }
}

const saveTx    = () => localStorage.setItem(SK.tx,    JSON.stringify(S.txs));
const saveCats  = () => localStorage.setItem(SK.cats,  JSON.stringify(S.cats));
const saveLimit = () => localStorage.setItem(SK.limit, String(S.limit));

/* ══════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════ */
const rp      = n => 'Rp ' + Math.abs(n).toLocaleString('id-ID');
const getCat  = id => S.cats.find(c => c.id === id) || { name: id, color: '#888', emoji: '❓' };
const monKey  = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}`; };
const curKey  = () => monKey(S.curMonth);
const totExp  = () => S.txs.filter(t => t.type === 'expense').reduce((a,t) => a+t.amount, 0);

/* ══════════════════════════════════════════════
   RENDER — BALANCE HERO
══════════════════════════════════════════════ */
function renderBalance() {
  const inc  = S.txs.filter(t => t.type === 'income').reduce((a,t) => a+t.amount, 0);
  const exp  = S.txs.filter(t => t.type === 'expense').reduce((a,t) => a+t.amount, 0);
  const bal  = inc - exp;

  document.getElementById('balAmt').textContent  = rp(bal);
  document.getElementById('totalInc').textContent = rp(inc);
  document.getElementById('totalExp').textContent = rp(exp);

  document.getElementById('balDate').textContent = 'Per ' + new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  // OPT4: Limit highlight
  const banner = document.getElementById('limitBanner');
  const lpWrap = document.getElementById('lpWrap');
  const fill   = document.getElementById('lpFill');

  if (S.limit > 0) {
    lpWrap.classList.add('visible');
    const rawPct = (exp / S.limit) * 100;
    const pct    = Math.min(rawPct, 100);
    fill.style.width = pct + '%';
    fill.className   = 'lp-fill' + (exp > S.limit ? ' over' : '');
    document.getElementById('lpPct').textContent  = Math.round(rawPct) + '%';
    document.getElementById('lpText').textContent = exp > S.limit
      ? '⚠ Melewati batas!'
      : rp(exp) + ' / ' + rp(S.limit);
    banner.classList.toggle('show', exp > S.limit);
  } else {
    lpWrap.classList.remove('visible');
    banner.classList.remove('show');
  }
}

/* ══════════════════════════════════════════════
   RENDER — CATEGORY SELECT
══════════════════════════════════════════════ */
function renderCatSelect() {
  const sel  = document.getElementById('fCat');
  const prev = sel.value;
  sel.innerHTML = '';

  let list = S.txType === 'income'
    ? S.cats.filter(c => c.id.includes('income') || c.name.toLowerCase().includes('masuk'))
    : S.cats.filter(c => !c.id.includes('income') && !c.name.toLowerCase().includes('masuk'));

  if (!list.length) list = S.cats;

  list.forEach(cat => {
    const o = document.createElement('option');
    o.value = cat.id;
    o.textContent = `${cat.emoji} ${cat.name}`;
    sel.appendChild(o);
  });

  if (prev && sel.querySelector(`[value="${prev}"]`)) sel.value = prev;
}

/* ══════════════════════════════════════════════
   RENDER — TRANSACTION LIST
══════════════════════════════════════════════ */
function sorted() {
  const v = document.getElementById('sortSel').value;
  const list = [...S.txs];
  if (v === 'amount-desc') return list.sort((a,b) => b.amount - a.amount);
  if (v === 'amount-asc')  return list.sort((a,b) => a.amount - b.amount);
  if (v === 'cat')         return list.sort((a,b) => a.category.localeCompare(b.category));
  return list.sort((a,b) => new Date(b.date) - new Date(a.date));
}

function renderTx() {
  const wrap  = document.getElementById('txList');
  const empty = document.getElementById('emptyState');
  const list  = sorted();
  const expTotal = totExp();

  wrap.querySelectorAll('.tx-item').forEach(el => el.remove());

  if (!list.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  list.forEach(tx => {
    const cat  = getCat(tx.category);
    const over = S.limit > 0 && tx.type === 'expense' && expTotal > S.limit;
    const d    = new Date(tx.date).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });

    const el = document.createElement('div');
    el.className  = 'tx-item';
    el.dataset.id = tx.id;

    el.innerHTML = `
      <div class="tx-ico" style="background:${cat.color}18">${cat.emoji}</div>
      <div class="tx-info">
        <div class="tx-name">${tx.name}</div>
        <div class="tx-meta">${cat.name} · ${d}</div>
      </div>
      <div class="tx-right">
        <div class="tx-amt ${tx.type === 'income' ? 'inc' : 'exp'}">
          ${tx.type === 'income' ? '+' : '−'}${rp(tx.amount)}
        </div>
        ${over && tx.type === 'expense' ? '<div class="tx-over">⚠ Over limit</div>' : ''}
      </div>
      <button class="del-btn" data-id="${tx.id}" title="Hapus">✕</button>
    `;
    wrap.appendChild(el);
  });
}

/* ══════════════════════════════════════════════
   RENDER — PIE CHART (spending by category)
══════════════════════════════════════════════ */
function renderPie() {
  const exps = S.txs.filter(t => t.type === 'expense');
  const by   = {};
  exps.forEach(t => { by[t.category] = (by[t.category] || 0) + t.amount; });

  const keys   = Object.keys(by);
  const vals   = keys.map(k => by[k]);
  const colors = keys.map(k => getCat(k).color);
  const labels = keys.map(k => { const c = getCat(k); return `${c.emoji} ${c.name}`; });
  const total  = vals.reduce((a,b) => a+b, 0);
  const legEl  = document.getElementById('pieLegend');
  legEl.innerHTML = '';

  if (!keys.length) {
    legEl.innerHTML = '<p class="chart-empty">Belum ada data pengeluaran</p>';
    if (pieChart) { pieChart.destroy(); pieChart = null; }
    return;
  }

  // Draw doughnut
  const ctx = document.getElementById('pieChart').getContext('2d');
  if (pieChart) pieChart.destroy();

  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: vals,
        backgroundColor: colors,
        borderColor: 'transparent',
        borderWidth: 0,
        hoverOffset: 16,
      }],
    },
    options: {
      cutout: '74%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => rp(c.parsed) } },
      },
      animation: { animateRotate: true, duration: 700 },
    },
  });

  // Legend
  keys.forEach((k, i) => {
    const pct = Math.round((vals[i] / total) * 100);
    const row = document.createElement('div');
    row.className = 'leg-row';
    row.innerHTML = `
      <div class="leg-left">
        <span class="leg-dot" style="background:${colors[i]}"></span>
        <div>
          <div class="leg-name">${labels[i]}</div>
          <div class="leg-pct">${pct}% dari total</div>
        </div>
      </div>
      <div class="leg-amt">${rp(vals[i])}</div>
    `;
    legEl.appendChild(row);
  });
}

/* ══════════════════════════════════════════════
   RENDER — MONTHLY SUMMARY (OPT2)
══════════════════════════════════════════════ */
function renderMonthly() {
  const key = curKey();
  document.getElementById('monLabel').textContent =
    S.curMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  const mTxs = S.txs.filter(t => monKey(t.date) === key);
  const inc  = mTxs.filter(t => t.type === 'income').reduce((a,t) => a+t.amount, 0);
  const exp  = mTxs.filter(t => t.type === 'expense').reduce((a,t) => a+t.amount, 0);
  const bal  = inc - exp;

  document.getElementById('mInc').textContent = rp(inc);
  document.getElementById('mExp').textContent = rp(exp);
  const balEl = document.getElementById('mBal');
  balEl.textContent  = rp(bal);
  balEl.style.color  = bal >= 0 ? 'var(--teal)' : 'var(--pink)';

  // Bar chart
  const by   = {};
  mTxs.filter(t => t.type === 'expense').forEach(t => { by[t.category] = (by[t.category]||0)+t.amount; });
  const keys   = Object.keys(by);
  const vals   = keys.map(k => by[k]);
  const colors = keys.map(k => getCat(k).color);
  const labels = keys.map(k => { const c = getCat(k); return `${c.emoji} ${c.name}`; });

  const ctx = document.getElementById('barChart').getContext('2d');
  if (barChart) barChart.destroy();
  if (!keys.length) return;

  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: vals,
        backgroundColor: colors.map(c => c + '99'),
        borderColor: colors,
        borderWidth: 2,
        borderRadius: 12,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend:  { display: false },
        tooltip: { callbacks: { label: c => rp(c.parsed.y) } },
      },
      scales: {
        y: {
          ticks: { callback: v => 'Rp ' + v.toLocaleString('id-ID'), color: '#7878a8', font: { size: 11 } },
          grid:  { color: 'rgba(255,255,255,0.04)' },
          border: { color: 'transparent' },
        },
        x: {
          ticks: { color: '#7878a8', font: { size: 12 } },
          grid:  { display: false },
          border: { color: 'transparent' },
        },
      },
    },
  });
}

/* ══════════════════════════════════════════════
   RENDER ALL
══════════════════════════════════════════════ */
function renderAll() {
  renderBalance();
  renderCatSelect();
  renderTx();
  if (document.getElementById('pane-chart').classList.contains('on'))   renderPie();
  if (document.getElementById('pane-monthly').classList.contains('on')) renderMonthly();
}

/* ══════════════════════════════════════════════
   EVENTS — ADD TRANSACTION
══════════════════════════════════════════════ */
document.getElementById('btnAdd').addEventListener('click', () => {
  const name     = document.getElementById('fName').value.trim();
  const amtRaw   = document.getElementById('fAmt').value;
  const category = document.getElementById('fCat').value;
  const date     = document.getElementById('fDate').value;
  const errEl    = document.getElementById('formErr');

  // Validate all fields ✓
  if (!name || !amtRaw || !category || !date) {
    errEl.textContent = '⚠ Semua field wajib diisi!';
    errEl.classList.add('show');
    setTimeout(() => errEl.classList.remove('show'), 3000);
    return;
  }
  const amount = parseFloat(amtRaw);
  if (isNaN(amount) || amount <= 0) {
    errEl.textContent = '⚠ Jumlah harus berupa angka positif!';
    errEl.classList.add('show');
    setTimeout(() => errEl.classList.remove('show'), 3000);
    return;
  }

  errEl.classList.remove('show');
  S.txs.push({ id: Date.now().toString(), name, amount, category, type: S.txType, date });
  saveTx();

  // Reset fields
  document.getElementById('fName').value = '';
  document.getElementById('fAmt').value  = '';
  document.getElementById('fDate').value = new Date().toISOString().split('T')[0];

  renderAll();
});

/* ══════════════════════════════════════════════
   EVENTS — DELETE TRANSACTION
══════════════════════════════════════════════ */
document.getElementById('txList').addEventListener('click', e => {
  const btn = e.target.closest('.del-btn');
  if (!btn) return;
  S.txs = S.txs.filter(t => t.id !== btn.dataset.id);
  saveTx();
  renderAll();
});

/* ══════════════════════════════════════════════
   EVENTS — TYPE TOGGLE
══════════════════════════════════════════════ */
function setType(type) {
  S.txType = type;
  document.getElementById('btnExp').className = 'type-btn' + (type === 'expense' ? ' active-exp' : '');
  document.getElementById('btnInc').className = 'type-btn' + (type === 'income'  ? ' active-inc' : '');
  renderCatSelect();
}
document.getElementById('btnExp').addEventListener('click', () => setType('expense'));
document.getElementById('btnInc').addEventListener('click', () => setType('income'));

/* ══════════════════════════════════════════════
   EVENTS — SORT
══════════════════════════════════════════════ */
document.getElementById('sortSel').addEventListener('change', renderTx);

/* ══════════════════════════════════════════════
   EVENTS — SPENDING LIMIT (OPT4)
══════════════════════════════════════════════ */
document.getElementById('btnSaveLimit').addEventListener('click', () => {
  S.limit = Math.max(parseFloat(document.getElementById('fLimit').value) || 0, 0);
  saveLimit();
  renderBalance();
});

/* ══════════════════════════════════════════════
   EVENTS — TABS
══════════════════════════════════════════════ */
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('on'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('on'));
    tab.classList.add('on');
    document.getElementById('pane-' + target).classList.add('on');
    if (target === 'chart')   renderPie();
    if (target === 'monthly') renderMonthly();
  });
});

/* ══════════════════════════════════════════════
   EVENTS — MONTHLY NAV (OPT2)
══════════════════════════════════════════════ */
document.getElementById('prevMon').addEventListener('click', () => {
  const d = S.curMonth;
  S.curMonth = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  renderMonthly();
});
document.getElementById('nextMon').addEventListener('click', () => {
  const d = S.curMonth;
  S.curMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  renderMonthly();
});

/* ══════════════════════════════════════════════
   EVENTS — DARK/LIGHT MODE
══════════════════════════════════════════════ */
document.getElementById('themeBtn').addEventListener('click', () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const next   = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  document.getElementById('themeBtn').textContent = next === 'dark' ? '🌙' : '☀️';
  localStorage.setItem(SK.theme, next);
  setTimeout(() => {
    if (document.getElementById('pane-chart').classList.contains('on'))   renderPie();
    if (document.getElementById('pane-monthly').classList.contains('on')) renderMonthly();
  }, 200);
});

/* ══════════════════════════════════════════════
   EVENTS — CUSTOM CATEGORY MODAL (OPT1)
══════════════════════════════════════════════ */
function buildSwatches() {
  const wrap = document.getElementById('colorSwatches');
  wrap.innerHTML = '';
  PALETTE.forEach(col => {
    const sw = document.createElement('div');
    sw.className = 'swatch' + (col === S.selColor ? ' sel' : '');
    sw.style.background = col;
    sw.addEventListener('click', () => {
      S.selColor = col;
      document.querySelectorAll('.swatch').forEach(s => s.classList.remove('sel'));
      sw.classList.add('sel');
    });
    wrap.appendChild(sw);
  });
}

document.getElementById('openCatModal').addEventListener('click', () => {
  buildSwatches();
  document.getElementById('mCatName').value  = '';
  document.getElementById('mCatEmoji').value = '';
  document.getElementById('catModal').classList.add('open');
});
document.getElementById('cancelCat').addEventListener('click', () => {
  document.getElementById('catModal').classList.remove('open');
});
document.getElementById('catModal').addEventListener('click', e => {
  if (e.target === document.getElementById('catModal'))
    document.getElementById('catModal').classList.remove('open');
});
document.getElementById('confirmCat').addEventListener('click', () => {
  const name  = document.getElementById('mCatName').value.trim();
  const emoji = document.getElementById('mCatEmoji').value.trim() || '📦';
  if (!name) return;
  S.cats.push({ id: 'c_' + Date.now(), name, color: S.selColor, emoji });
  saveCats();
  renderCatSelect();
  document.getElementById('catModal').classList.remove('open');
});

/* ══════════════════════════════════════════════
   INIT
══════════════════════════════════════════════ */
function init() {
  loadStorage();
  document.getElementById('fDate').value = new Date().toISOString().split('T')[0];
  S.curMonth = new Date();
  renderAll();
}

init();
