const STORAGE_KEY = 'shrimp-live:data';

let truckInfo = '';
let recordDate = '';
let recordNote = '';
let tareWeight = 0;
let deductPercent = 0;
let basketMode = 'perbasket'; // 'perbasket' or 'bulk'
let baskets = []; // current truck in progress (perbasket mode): [{no, weight}] — weight is gross
let bulkWeight = 0; // current truck in progress (bulk mode): total gross weight for the whole load
let bulkBasketCount = 0; // current truck in progress (bulk mode): basket count, to deduct tare from bulkWeight
let completedTrucks = []; // [{id, truckInfo, note, basketCount, grossTotal, savedAt}] — net/final weight is recomputed from the current tare weight and deduct %, so changing either updates every truck

const truckInfoInput = document.getElementById('truckInfo');
const recordDateInput = document.getElementById('recordDate');
const recordNoteInput = document.getElementById('recordNote');
const tareInput = document.getElementById('tareWeight');
const deductInput = document.getElementById('deductPercent');
const basketModeToggle = document.getElementById('basketModeToggle');
const perBasketModeEl = document.getElementById('perBasketMode');
const bulkModeEl = document.getElementById('bulkMode');
const basketWeightInput = document.getElementById('basketWeight');
const addBasketBtn = document.getElementById('addBasketBtn');
const bulkWeightInput = document.getElementById('bulkWeight');
const bulkBasketCountInput = document.getElementById('bulkBasketCount');
const finishTruckBtn = document.getElementById('finishTruckBtn');
const resetBtn = document.getElementById('resetBtn');
const basketGrid = document.getElementById('basketGrid');
const truckList = document.getElementById('truckList');

function setBasketMode(mode){
  basketMode = mode;
  basketModeToggle.querySelectorAll('.mode-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  perBasketModeEl.style.display = mode === 'perbasket' ? '' : 'none';
  bulkModeEl.style.display = mode === 'bulk' ? '' : 'none';
}

basketModeToggle.addEventListener('click', (e) => {
  const btn = e.target.closest('.mode-btn');
  if (!btn) return;
  setBasketMode(btn.dataset.mode);
  render();
  save();
});

function fmt(n){
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayISO(){
  const now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
}

function num(el){
  const v = parseFloat(el.value);
  return isNaN(v) ? 0 : v;
}

function netOf(gross){
  return gross - tareWeight;
}

function applyDeduct(net){
  return net - net * (deductPercent / 100);
}

function render(){
  document.getElementById('basketNextNo').textContent = basketMode === 'perbasket' ? '(ตะกร้าที่ #' + (baskets.length + 1) + ')' : '';

  basketGrid.innerHTML = '';
  if (basketMode === 'perbasket') {
    baskets.forEach((b, idx) => {
      const tile = document.createElement('div');
      tile.className = 'basket-tile';
      tile.title = 'แตะเพื่อลบ';
      tile.innerHTML = `<div class="no">#${b.no}</div><div class="kg">${fmt(netOf(b.weight))}</div>`;
      tile.addEventListener('click', () => {
        baskets.splice(idx, 1);
        save();
        render();
      });
      basketGrid.appendChild(tile);
    });
  }

  const basketCount = basketMode === 'bulk' ? bulkBasketCount : baskets.length;
  const grossSum = basketMode === 'bulk' ? bulkWeight : baskets.reduce((s, b) => s + b.weight, 0);
  const netSum = grossSum - tareWeight * basketCount;
  const deductAmount = netSum * (deductPercent / 100);
  const finalSum = netSum - deductAmount;
  document.getElementById('basketCount').textContent = basketCount + ' ใบ';
  document.getElementById('truckGross').textContent = fmt(grossSum) + ' กก.';
  document.getElementById('truckNet').textContent = fmt(netSum) + ' กก.';
  document.getElementById('truckDeductPct').textContent = deductPercent;
  document.getElementById('truckDeduct').textContent = '-' + fmt(deductAmount) + ' กก.';
  document.getElementById('truckFinal').textContent = fmt(finalSum) + ' กก.';

  truckList.innerHTML = '';
  if (completedTrucks.length === 0) {
    truckList.innerHTML = '<div class="empty-note">ยังไม่มีคันที่บันทึกไว้</div>';
  } else {
    completedTrucks.forEach((t, idx) => {
      const row = document.createElement('div');
      row.className = 'truck-row';
      const label = t.truckInfo && t.truckInfo.trim() ? t.truckInfo : '(ไม่ระบุข้อมูลรถ)';
      const finalTotal = applyDeduct(t.grossTotal - tareWeight * t.basketCount);
      row.innerHTML = `
        <div>
          <div class="truck-label">${label}</div>
          <div class="truck-meta">${t.basketCount} ตะกร้า</div>
        </div>
        <div class="truck-weight">${fmt(finalTotal)} กก.</div>
        <button type="button" class="truck-rm" aria-label="ลบรายการ">×</button>
      `;
      row.querySelector('.truck-rm').addEventListener('click', () => {
        completedTrucks.splice(idx, 1);
        save();
        render();
      });
      truckList.appendChild(row);
    });
  }

  const grand = completedTrucks.reduce((s, t) => s + applyDeduct(t.grossTotal - tareWeight * t.basketCount), 0) + finalSum;
  document.getElementById('grandTotal').textContent = fmt(grand) + ' กก.';
}

function addBasket(){
  const v = num(basketWeightInput);
  if (v <= 0) return;
  baskets.push({ no: baskets.length + 1, weight: v });
  basketWeightInput.value = '';
  save();
  render();
  basketWeightInput.focus();
}

addBasketBtn.addEventListener('click', addBasket);
basketWeightInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); addBasket(); }
});

bulkWeightInput.addEventListener('input', () => {
  bulkWeight = num(bulkWeightInput);
  render();
  save();
});
bulkBasketCountInput.addEventListener('input', () => {
  bulkBasketCount = Math.max(0, Math.round(num(bulkBasketCountInput)));
  render();
  save();
});

finishTruckBtn.addEventListener('click', () => {
  const basketCount = basketMode === 'bulk' ? bulkBasketCount : baskets.length;
  if (basketCount === 0) return;
  const grossTotal = basketMode === 'bulk' ? bulkWeight : baskets.reduce((s, b) => s + b.weight, 0);
  completedTrucks.push({
    id: 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    truckInfo,
    note: recordNote,
    basketCount,
    grossTotal,
    savedAt: new Date().toISOString()
  });
  baskets = [];
  bulkWeight = 0;
  bulkBasketCount = 0;
  bulkWeightInput.value = '';
  bulkBasketCountInput.value = '';
  truckInfo = '';
  recordNote = '';
  truckInfoInput.value = '';
  recordNoteInput.value = '';
  save();
  render();
});

resetBtn.addEventListener('click', () => {
  baskets = [];
  bulkWeight = 0;
  bulkBasketCount = 0;
  completedTrucks = [];
  truckInfo = '';
  recordNote = '';
  recordDate = todayISO();
  tareWeight = 0;
  deductPercent = 0;
  truckInfoInput.value = '';
  recordNoteInput.value = '';
  recordDateInput.value = recordDate;
  tareInput.value = '';
  deductInput.value = '';
  basketWeightInput.value = '';
  bulkWeightInput.value = '';
  bulkBasketCountInput.value = '';
  setBasketMode('perbasket');
  save();
  render();
});

truckInfoInput.addEventListener('input', () => {
  truckInfo = truckInfoInput.value;
  save();
});

recordNoteInput.addEventListener('input', () => {
  recordNote = recordNoteInput.value;
  save();
});

recordDateInput.addEventListener('input', () => {
  recordDate = recordDateInput.value;
  save();
});

tareInput.addEventListener('input', () => {
  tareWeight = num(tareInput);
  render();
  save();
});

deductInput.addEventListener('input', () => {
  deductPercent = num(deductInput);
  render();
  save();
});

let storageOk = true;

function save(){
  if (!storageOk) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ truckInfo, recordDate, recordNote, tareWeight, deductPercent, basketMode, baskets, bulkWeight, bulkBasketCount, completedTrucks }));
  } catch (e) {
    storageOk = false; // storage unavailable here; app continues to work in-memory silently
  }
}

function load(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      truckInfo = parsed.truckInfo || '';
      recordDate = parsed.recordDate || '';
      recordNote = parsed.recordNote || '';
      tareWeight = parsed.tareWeight || 0;
      deductPercent = parsed.deductPercent || 0;
      basketMode = parsed.basketMode === 'bulk' ? 'bulk' : 'perbasket';
      baskets = Array.isArray(parsed.baskets) ? parsed.baskets : [];
      bulkWeight = parsed.bulkWeight || 0;
      bulkBasketCount = parsed.bulkBasketCount || 0;
      // migrate records saved before trucks stored a recomputable grossTotal
      // (older format froze a net totalWeight + the tareWeight used at the time)
      completedTrucks = (Array.isArray(parsed.completedTrucks) ? parsed.completedTrucks : []).map(t =>
        typeof t.grossTotal === 'number'
          ? t
          : { ...t, grossTotal: (t.totalWeight || 0) + (t.tareWeight || 0) * (t.basketCount || 0) }
      );
    }
  } catch (e) {
    // no existing data yet, or storage unavailable — start fresh in-memory
  }
  if (!recordDate) recordDate = todayISO();
  truckInfoInput.value = truckInfo;
  recordNoteInput.value = recordNote;
  recordDateInput.value = recordDate;
  tareInput.value = tareWeight ? Number(tareWeight).toFixed(2) : '';
  deductInput.value = deductPercent ? Number(deductPercent).toFixed(1) : '';
  bulkWeightInput.value = bulkWeight ? Number(bulkWeight).toFixed(2) : '';
  bulkBasketCountInput.value = bulkBasketCount ? String(bulkBasketCount) : '';
  setBasketMode(basketMode);
  render();
}

load();

function escapeHtml(s){
  return s.replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function buildSummaryHtml(){
  const items = [];

  const currentBasketCount = basketMode === 'bulk' ? bulkBasketCount : baskets.length;
  const currentGross = basketMode === 'bulk' ? bulkWeight : baskets.reduce((s, b) => s + b.weight, 0);
  if (currentBasketCount > 0) {
    const currentFinal = applyDeduct(currentGross - tareWeight * currentBasketCount);
    items.push({
      label: (truckInfo && truckInfo.trim() ? truckInfo : '(ไม่ระบุข้อมูลรถ)') + ' (คันปัจจุบัน)',
      note: recordNote,
      basketCount: currentBasketCount,
      finalTotal: currentFinal,
    });
  }
  completedTrucks.forEach((t) => {
    items.push({
      label: t.truckInfo && t.truckInfo.trim() ? t.truckInfo : '(ไม่ระบุข้อมูลรถ)',
      note: t.note,
      basketCount: t.basketCount,
      finalTotal: applyDeduct(t.grossTotal - tareWeight * t.basketCount),
    });
  });

  const itemsHtml = items.length === 0
    ? '<div class="empty-note">ยังไม่มีข้อมูลรถ</div>'
    : items.map((it) => `
      <div class="truck-row">
        <div>
          <div class="truck-label">${escapeHtml(it.label)}</div>
          <div class="truck-meta">${it.basketCount} ตะกร้า${it.note && it.note.trim() ? ' · ' + escapeHtml(it.note.trim()) : ''}</div>
        </div>
        <div class="truck-weight">${fmt(it.finalTotal)} กก.</div>
      </div>
    `).join('');

  const grandTotal = items.reduce((s, it) => s + it.finalTotal, 0);

  const now = new Date();
  const dateStr = recordDate
    ? new Date(recordDate + 'T00:00:00').toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
    : now.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>สรุปรายการชั่งกุ้งเป็น</title>
<style>
  :root{
    --bg: #0a1830;
    --panel: #11233f;
    --line: #27466b;
    --ink: #eef2f9;
    --ink-dim: #9db2cc;
    --teal-accent: #4da3ff;
  }
  *{box-sizing:border-box;}
  body{
    margin:0;
    background: var(--bg);
    font-family: 'Noto Sans Thai', 'Sarabun', system-ui, sans-serif;
    color: var(--ink);
    padding: 18px 16px 28px;
  }
  .wrap{ max-width: 520px; margin: 0 auto; }
  .eyebrow{
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 11px;
    letter-spacing: 0.18em;
    color: var(--teal-accent);
    text-transform: uppercase;
  }
  h1{ font-size: 21px; margin: 4px 0 3px; }
  .meta{ font-size: 13px; color: var(--ink-dim); margin-bottom: 14px; }
  .section-label{
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-dim);
    font-weight: 600;
    margin: 14px 0 6px;
  }
  .truck-row{
    display:flex;
    justify-content: space-between;
    align-items:center;
    gap: 10px;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 10px 14px;
    margin-bottom: 8px;
  }
  .truck-label{ font-size: 14.5px; color: var(--ink); font-weight: 600; }
  .truck-meta{ font-size: 12px; color: var(--ink-dim); font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; }
  .truck-weight{
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 15px;
    font-weight: 700;
    color: var(--teal-accent);
    white-space: nowrap;
  }
  .empty-note{ text-align:center; color: var(--ink-dim); font-size: 13.5px; padding: 16px 10px; }
  .grand-card{
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 16px 20px;
    margin-top: 14px;
  }
  .grand-label{ font-size: 13px; color: var(--ink-dim); margin-bottom: 4px; }
  .grand-value{ font-size: 28px; font-weight: 800; color: var(--teal-accent); }
  .back-btn{
    display:inline-flex;
    align-items:center;
    gap: 6px;
    background: var(--panel);
    border: 1px solid var(--line);
    color: var(--ink);
    padding: 9px 14px;
    border-radius: 10px;
    font-family: 'Noto Sans Thai', 'Sarabun', system-ui, sans-serif;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    margin-bottom: 14px;
  }
  .back-btn:active{ background: var(--line); }
</style>
</head>
<body>
  <div class="wrap">
    <button type="button" class="back-btn" onclick="window.close()">← ย้อนกลับ</button>
    <div class="eyebrow">Shrimp Scale · แพกุ้ง</div>
    <h1>สรุปรายการชั่งกุ้งเป็น</h1>
    <div class="meta">${dateStr} · ${timeStr} น.</div>

    <div class="section-label">รายการรถแต่ละคัน</div>
    ${itemsHtml}

    <div class="grand-card">
      <div class="grand-label">น้ำหนักรวมทั้งหมด</div>
      <div class="grand-value">${fmt(grandTotal)} กก.</div>
    </div>
  </div>
</body>
</html>`;
}

document.getElementById('summaryBtn').addEventListener('click', () => {
  const html = buildSummaryHtml();
  const win = window.open('', '_blank');
  if (!win) {
    alert('เบราว์เซอร์บล็อกการเปิดหน้าต่างใหม่ กรุณาอนุญาต pop-up แล้วลองอีกครั้ง');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {
      // ignore registration errors (e.g. running from file://)
    });
  });
}
