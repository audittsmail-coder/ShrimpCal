const STORAGE_KEY = 'shrimp-live:data';

let truckInfo = '';
let tareWeight = 0;
let deductPercent = 0;
let basketMode = 'perbasket'; // 'perbasket' or 'bulk'
let baskets = []; // current truck in progress (perbasket mode): [{no, weight}] — weight is gross
let bulkWeight = 0; // current truck in progress (bulk mode): total gross weight for the whole load
let bulkBasketCount = 0; // current truck in progress (bulk mode): basket count, to deduct tare from bulkWeight
let completedTrucks = []; // [{id, truckInfo, basketCount, grossTotal, savedAt}] — net/final weight is recomputed from the current tare weight and deduct %, so changing either updates every truck

const truckInfoInput = document.getElementById('truckInfo');
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
  truckInfoInput.value = '';
  save();
  render();
});

resetBtn.addEventListener('click', () => {
  baskets = [];
  bulkWeight = 0;
  bulkBasketCount = 0;
  completedTrucks = [];
  truckInfo = '';
  tareWeight = 0;
  deductPercent = 0;
  truckInfoInput.value = '';
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ truckInfo, tareWeight, deductPercent, basketMode, baskets, bulkWeight, bulkBasketCount, completedTrucks }));
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
  truckInfoInput.value = truckInfo;
  tareInput.value = tareWeight ? Number(tareWeight).toFixed(2) : '';
  deductInput.value = deductPercent ? Number(deductPercent).toFixed(1) : '';
  bulkWeightInput.value = bulkWeight ? Number(bulkWeight).toFixed(2) : '';
  bulkBasketCountInput.value = bulkBasketCount ? String(bulkBasketCount) : '';
  setBasketMode(basketMode);
  render();
}

load();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {
      // ignore registration errors (e.g. running from file://)
    });
  });
}
