const STORAGE_KEY = 'shrimp-weigh:data';
let baskets = []; // [{no, weight}] — weight is gross (as weighed, including basket)
let tareWeight = 0; // empty basket weight, subtracted from every basket
let percentDeduct = 0; // % deducted from the grand total, applied after tare
let sampleWeight = 0; // extra sample shrimp weight, added directly to the net final total
let truckNo = '';
let recordDate = '';
let editingIdx = null;
let collapsedRows = new Set(); // row indices (0-based) currently collapsed
let prevBasketCount = 0;
let records = []; // saved past truck sessions: {id, truckNo, recordDate, baskets, tare, percent, sample, basketCount, grossTotal, netTotal, finalTotal, savedAt}

const input = document.getElementById('weightInput');
const tareInput = document.getElementById('tareInput');
const percentInput = document.getElementById('percentInput');
const sampleInput = document.getElementById('sampleInput');
const truckInput = document.getElementById('truckInput');
const dateInput = document.getElementById('dateInput');
const addBtn = document.getElementById('addBtn');
const undoBtn = document.getElementById('undoBtn');
const clearBtn = document.getElementById('clearBtn');
const basketsSection = document.getElementById('basketsSection');
const basketCount = document.getElementById('basketCount');
const grandTotalEl = document.getElementById('grandTotal');
const grandGrossEl = document.getElementById('grandGross');

function fmt(n){
  return n.toLocaleString('en-US',{minimumFractionDigits:2, maximumFractionDigits:2});
}

function netWeight(gross){
  return Math.max(0, gross - (tareWeight || 0));
}

function computeTotals(basketList, tare, percent, sample){
  let grossTotal = 0, netTotal = 0;
  basketList.forEach(b => {
    grossTotal += b.weight;
    netTotal += Math.max(0, b.weight - (tare || 0));
  });
  const pct = percent || 0;
  const percentDeductKg = netTotal * (pct / 100);
  const finalTotal = netTotal - percentDeductKg + (sample || 0);
  return { grossTotal, netTotal, finalTotal };
}

// Auto-decimal "cents entry": user types digits only (e.g. 6 2 3) and the
// value auto-formats with 2 decimal places from the right (→ 6.23), like a
// calculator/POS keypad — no manual decimal point needed for speed.
function formatCentsValue(raw){
  const digits = raw.replace(/\D/g, '').slice(0, 6); // cap at 9999.99
  const num = digits === '' ? 0 : parseInt(digits, 10);
  return (num / 100).toFixed(2);
}

function render(){
  basketCount.textContent = baskets.length + ' ตะกร้า';
  document.getElementById('historyCount').textContent = records.length;
  document.getElementById('totalBasketCount').textContent = baskets.length;
  document.getElementById('nextBasketNo').textContent = 'ตะกร้าที่ #' + (baskets.length + 1);

  let grossTotal = 0, netTotal = 0;
  baskets.forEach(b => { grossTotal += b.weight; netTotal += netWeight(b.weight); });
  const pct = percentDeduct || 0;
  const percentDeductKg = netTotal * (pct / 100);
  const finalTotal = netTotal - percentDeductKg + (sampleWeight || 0);
  grandGrossEl.textContent = fmt(grossTotal);
  document.getElementById('grandNet').textContent = fmt(netTotal);
  document.getElementById('percentLabel2').textContent = pct.toString();
  document.getElementById('percentDeductKg').textContent = fmt(percentDeductKg);
  document.getElementById('sampleWeightLabel').textContent = fmt(sampleWeight || 0);
  grandTotalEl.textContent = fmt(finalTotal);

  renderTruckSummary();

  basketsSection.innerHTML = '';

  if(baskets.length === 0){
    basketsSection.innerHTML = '<div class="empty">ยังไม่มีตะกร้าที่ชั่ง — เริ่มกรอกน้ำหนักด้านบนได้เลย<br><span style="font-size:12px;">แตะที่ตะกร้าใดก็ได้ภายหลังเพื่อแก้ไขน้ำหนัก</span></div>';
    return;
  }

  const rowsCount = Math.ceil(baskets.length / 10);

  // whenever the basket count changes (add/remove/edit doesn't count), auto-collapse
  // every row except the current (last) one, to keep long lists scannable
  if(baskets.length !== prevBasketCount){
    collapsedRows = new Set();
    for(let i=0;i<rowsCount-1;i++) collapsedRows.add(i);
    prevBasketCount = baskets.length;
  }

  for(let r = 0; r < rowsCount; r++){
    const rowBaskets = baskets.slice(r*10, r*10+10);
    const rowBlock = document.createElement('div');
    rowBlock.className = 'row-block';
    const isCollapsed = collapsedRows.has(r);

    // subtotal acts as a clickable header — shown first, toggles the row's grid
    const rowGross = rowBaskets.reduce((s,b)=>s+b.weight,0);
    const subtotal = document.createElement('div');
    subtotal.className = 'row-subtotal' + (isCollapsed ? ' collapsed' : '');
    const rangeLabel = `แถวที่ ${r+1} (#${r*10+1}–#${r*10+rowBaskets.length})`;
    subtotal.innerHTML = `<span class="lbl-group"><span class="chevron">▾</span><span class="lbl">${rangeLabel}</span></span><span class="val">${fmt(rowGross)} กก.</span>`;
    subtotal.addEventListener('click', () => {
      if(collapsedRows.has(r)) collapsedRows.delete(r); else collapsedRows.add(r);
      render();
    });
    rowBlock.appendChild(subtotal);

    if(!isCollapsed){
      const grid = document.createElement('div');
      grid.className = 'row-grid';
      rowBaskets.forEach((b, i) => {
        const idx = r*10 + i;
        const el = document.createElement('div');
        el.className = 'basket' + (idx === baskets.length - 1 ? ' last' : '');
        if(editingIdx === idx){
          el.innerHTML = `
            <div class="no">#${b.no}</div>
            <input class="kg-edit cents-input" data-idx="${idx}" type="text" inputmode="numeric" pattern="[0-9]*" value="${Number(b.weight).toFixed(2)}">
            <div class="edit-actions">
              <button type="button" class="edit-confirm" data-idx="${idx}">✓</button>
              <button type="button" class="edit-cancel" data-idx="${idx}">✕</button>
            </div>`;
          grid.appendChild(el);
        }else{
          el.innerHTML = `<div class="no">#${b.no}</div><div class="kg" data-idx="${idx}">${fmt(b.weight)}</div>`;
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            editingIdx = idx;
            render();
            const inp = basketsSection.querySelector(`.kg-edit[data-idx="${idx}"]`);
            if(inp){ inp.focus(); inp.select(); }
          });
          grid.appendChild(el);
        }
      });
      rowBlock.appendChild(grid);
    }

    basketsSection.appendChild(rowBlock);
  }
}

// Per-truck net-weight breakdown: current in-progress session (if it has any
// baskets) plus every archived session in history, summed into one grand total.
function renderTruckSummary(){
  const section = document.getElementById('truckSummarySection');
  const listEl = document.getElementById('truckSummaryList');
  const items = [];

  if(baskets.length > 0){
    const t = computeTotals(baskets, tareWeight, percentDeduct, sampleWeight);
    items.push({ truckNo, finalTotal: t.finalTotal, current: true });
  }
  records.forEach(rec => {
    items.push({ truckNo: rec.truckNo, finalTotal: rec.finalTotal, current: false });
  });

  if(items.length === 0){
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';

  listEl.innerHTML = items.map(it => {
    const label = it.truckNo && it.truckNo.trim() ? it.truckNo : '(ไม่ระบุรถ)';
    const tag = it.current ? '<span style="color:var(--aqua); font-size:11px; margin-left:6px;">● คันปัจจุบัน</span>' : '';
    return `<div style="display:flex; align-items:center; justify-content:space-between; font-family:'JetBrains Mono',monospace; font-size:13.5px;">
      <span style="color:var(--text);">${label}${tag}</span>
      <span style="color:var(--aqua); font-weight:700;">${fmt(it.finalTotal)} กก.</span>
    </div>`;
  }).join('');

  const grand = items.reduce((sum, it) => sum + it.finalTotal, 0);
  document.getElementById('truckSummaryGrand').textContent = fmt(grand);
}

let storageOk = true;

function save(){
  if(!storageOk) return; // storage unavailable in this environment, keep working in-memory
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ baskets, tare: tareWeight, percent: percentDeduct, sample: sampleWeight, truckNo, recordDate, records }));
  }catch(e){
    storageOk = false; // auto-save unavailable here; app continues to work in-memory silently
    const note = document.getElementById('storageNote');
    if(note) note.style.display = 'block';
  }
}

function load(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      if(Array.isArray(parsed)){
        baskets = parsed; // legacy format (no tare/truck/date)
      }else{
        baskets = parsed.baskets || [];
        tareWeight = parsed.tare || 0;
        percentDeduct = parsed.percent || 0;
        sampleWeight = parsed.sample || 0;
        truckNo = parsed.truckNo || '';
        recordDate = parsed.recordDate || '';
        records = Array.isArray(parsed.records) ? parsed.records : [];
      }
    }
  }catch(e){
    // no existing data yet, or storage unavailable — start fresh in-memory
  }
  tareInput.value = Number(tareWeight).toFixed(2);
  percentInput.value = Number(percentDeduct).toFixed(2);
  sampleInput.value = Number(sampleWeight).toFixed(2);
  truckInput.value = truckNo;
  // default to today if no date has been saved yet
  if(!recordDate){
    const now = new Date();
    recordDate = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
  }
  dateInput.value = recordDate;
  render();
}

function addBasket(){
  const v = parseFloat(input.value);
  if(isNaN(v) || v <= 0) return;
  baskets.push({ no: baskets.length + 1, weight: v });
  input.value = '';
  addBtn.disabled = true;
  render();
  save();
  input.focus();
}

function undoLast(){
  if(baskets.length === 0) return;
  baskets.pop();
  render();
  save();
}

function todayISO(){
  const now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
}

function clearAll(){
  document.getElementById('clearModal').classList.remove('hidden');
}

document.getElementById('modalCancel').addEventListener('click', () => {
  document.getElementById('clearModal').classList.add('hidden');
});
document.getElementById('modalConfirm').addEventListener('click', () => {
  baskets = [];
  tareWeight = 0;
  percentDeduct = 0;
  sampleWeight = 0;
  truckNo = '';
  editingIdx = null;

  tareInput.value = '0.00';
  percentInput.value = '0.00';
  sampleInput.value = '0.00';
  truckInput.value = '';

  recordDate = todayISO();
  dateInput.value = recordDate;

  render();
  save();
  document.getElementById('clearModal').classList.add('hidden');
});

// ---- Truck sessions: "start new truck" archives the current session into
// history, then resets the active fields for the next truck. ----

function resetActiveSession(){
  baskets = [];
  tareWeight = 0;
  percentDeduct = 0;
  sampleWeight = 0;
  truckNo = '';
  editingIdx = null;
  collapsedRows = new Set();
  prevBasketCount = 0;

  tareInput.value = '0.00';
  percentInput.value = '0.00';
  sampleInput.value = '0.00';
  truckInput.value = '';

  recordDate = todayISO();
  dateInput.value = recordDate;
}

function archiveCurrentSession(){
  if(baskets.length === 0) return; // nothing to archive
  const totals = computeTotals(baskets, tareWeight, percentDeduct, sampleWeight);
  records.unshift({
    id: 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
    truckNo, recordDate,
    baskets, tare: tareWeight, percent: percentDeduct, sample: sampleWeight,
    basketCount: baskets.length,
    grossTotal: totals.grossTotal, netTotal: totals.netTotal, finalTotal: totals.finalTotal,
    savedAt: new Date().toISOString()
  });
}

document.getElementById('newTruckBtn').addEventListener('click', () => {
  archiveCurrentSession();
  resetActiveSession();
  render();
  save();
});

function renderHistoryList(){
  const listEl = document.getElementById('historyList');
  const clearBtn = document.getElementById('historyClearBtn');
  clearBtn.style.display = records.length === 0 ? 'none' : '';
  clearBtn.dataset.confirming = '0';
  clearBtn.textContent = 'ล้างประวัติทั้งหมด';

  listEl.innerHTML = '';
  if(records.length === 0){
    listEl.innerHTML = '<div class="history-empty">ยังไม่มีประวัติรถที่บันทึกไว้</div>';
    return;
  }
  records.forEach(rec => {
    const item = document.createElement('div');
    item.className = 'history-item';
    const truckLabel = rec.truckNo && rec.truckNo.trim() ? rec.truckNo : '(ไม่ระบุรถ)';
    item.innerHTML = `
      <div class="hi-info">
        <div class="hi-truck">${truckLabel}</div>
        <div class="hi-meta">${rec.recordDate || '-'} • ${rec.basketCount} ตะกร้า • ${fmt(rec.finalTotal)} กก.</div>
      </div>
      <div class="hi-actions">
        <button type="button" class="hi-open" data-id="${rec.id}">เปิดดู</button>
        <button type="button" class="hi-delete" data-id="${rec.id}">ลบ</button>
      </div>`;
    listEl.appendChild(item);
  });
}

function loadRecord(id){
  const idx = records.findIndex(r => r.id === id);
  if(idx === -1) return;
  const rec = records[idx];

  // put the current active session back into history first (so it isn't lost),
  // then remove the chosen record from history and make it active
  archiveCurrentSession();
  records.splice(records.findIndex(r => r.id === id), 1);

  baskets = rec.baskets || [];
  tareWeight = rec.tare || 0;
  percentDeduct = rec.percent || 0;
  sampleWeight = rec.sample || 0;
  truckNo = rec.truckNo || '';
  recordDate = rec.recordDate || todayISO();
  editingIdx = null;
  collapsedRows = new Set();
  prevBasketCount = 0;

  tareInput.value = Number(tareWeight).toFixed(2);
  percentInput.value = Number(percentDeduct).toFixed(2);
  sampleInput.value = Number(sampleWeight).toFixed(2);
  truckInput.value = truckNo;
  dateInput.value = recordDate;

  render();
  save();
  document.getElementById('historyModal').classList.add('hidden');
}

document.getElementById('historyBtn').addEventListener('click', () => {
  renderHistoryList();
  document.getElementById('historyModal').classList.remove('hidden');
});
document.getElementById('historyCloseBtn').addEventListener('click', () => {
  document.getElementById('historyModal').classList.add('hidden');
});
document.getElementById('historyClearBtn').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  if(btn.dataset.confirming === '1'){
    records = [];
    renderHistoryList();
    render();
    save();
  }else{
    btn.dataset.confirming = '1';
    btn.textContent = 'ยืนยันล้างทั้งหมด?';
    setTimeout(() => {
      if(btn.dataset.confirming === '1'){
        btn.dataset.confirming = '0';
        btn.textContent = 'ล้างประวัติทั้งหมด';
      }
    }, 3000);
  }
});
document.getElementById('historyList').addEventListener('click', (e) => {
  const openBtn = e.target.closest('.hi-open');
  const delBtn = e.target.closest('.hi-delete');
  if(openBtn){
    loadRecord(openBtn.dataset.id);
  }else if(delBtn){
    if(delBtn.dataset.confirming === '1'){
      records = records.filter(r => r.id !== delBtn.dataset.id);
      renderHistoryList();
      render();
      save();
    }else{
      delBtn.dataset.confirming = '1';
      const original = delBtn.textContent;
      delBtn.textContent = 'ยืนยันลบ?';
      setTimeout(() => { delBtn.dataset.confirming = '0'; delBtn.textContent = original; }, 3000);
    }
  }
});

function commitEdit(idx, rawValue){
  const v = parseFloat(rawValue);
  if(!isNaN(v) && v > 0){
    baskets[idx].weight = v;
    save();
  }
  editingIdx = null;
  render();
}

basketsSection.addEventListener('input', (e) => {
  if(!e.target.classList.contains('kg-edit')) return;
  e.target.value = formatCentsValue(e.target.value);
});

basketsSection.addEventListener('click', (e) => {
  const confirmBtn = e.target.closest('.edit-confirm');
  const cancelBtn = e.target.closest('.edit-cancel');
  if(confirmBtn){
    const idx = parseInt(confirmBtn.dataset.idx, 10);
    const inp = basketsSection.querySelector(`.kg-edit[data-idx="${idx}"]`);
    commitEdit(idx, inp ? inp.value : '');
  }else if(cancelBtn){
    editingIdx = null;
    render();
  }
});

basketsSection.addEventListener('keydown', (e) => {
  if(!e.target.classList.contains('kg-edit')) return;
  const idx = parseInt(e.target.dataset.idx, 10);
  if(e.key === 'Enter'){
    e.preventDefault();
    commitEdit(idx, e.target.value);
  }else if(e.key === 'Escape'){
    e.preventDefault();
    editingIdx = null;
    render();
  }
});
// Note: no auto-commit on blur/focusout — committing is done via the
// explicit ✓/✕ buttons or Enter/Escape keys, to avoid mobile keyboards
// firing blur before a button tap is registered.

truckInput.addEventListener('input', () => {
  truckNo = truckInput.value;
  save();
});
dateInput.addEventListener('input', () => {
  recordDate = dateInput.value;
  save();
});

percentInput.addEventListener('input', () => {
  percentInput.value = formatCentsValue(percentInput.value);
  const v = parseFloat(percentInput.value);
  percentDeduct = (!isNaN(v) && v >= 0) ? Math.min(v, 100) : 0;
  render();
  save();
});

sampleInput.addEventListener('input', () => {
  sampleInput.value = formatCentsValue(sampleInput.value);
  const v = parseFloat(sampleInput.value);
  sampleWeight = (!isNaN(v) && v >= 0) ? v : 0;
  render();
  save();
});

tareInput.addEventListener('input', () => {
  tareInput.value = formatCentsValue(tareInput.value);
  const v = parseFloat(tareInput.value);
  tareWeight = (!isNaN(v) && v >= 0) ? v : 0;
  render();
  save();
});

input.addEventListener('input', () => {
  input.value = formatCentsValue(input.value);
  const v = parseFloat(input.value);
  addBtn.disabled = !(!isNaN(v) && v > 0);
});
input.addEventListener('keydown', (e) => {
  if(e.key === 'Enter'){ e.preventDefault(); addBasket(); }
});
addBtn.addEventListener('click', addBasket);
undoBtn.addEventListener('click', undoLast);
clearBtn.addEventListener('click', clearAll);

function showBackupStatus(msg, isError){
  const el = document.getElementById('backupStatus');
  el.textContent = msg;
  el.style.color = isError ? '#ff8a65' : 'var(--aqua)';
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3500);
}

function exportBackup(){
  const data = { baskets, tare: tareWeight, percent: percentDeduct, sample: sampleWeight, truckNo, recordDate, records, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateForName = (recordDate || 'data').replace(/-/g,'');
  const truckForName = (truckNo || '').trim().replace(/[^a-zA-Z0-9-]/g,'') || 'shrimp';
  a.href = url;
  a.download = `shrimp-weigh_${truckForName}_${dateForName}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showBackupStatus('✓ บันทึกลงในอุปกรณ์แล้ว', false);
}

document.getElementById('exportBtn').addEventListener('click', exportBackup);

load();

if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
