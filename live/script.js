const STORAGE_KEY = 'shrimp-live:data';

let truckInfo = '';
let tareWeight = 0;
let baskets = []; // current truck in progress: [{no, weight}] — weight is gross
let completedTrucks = []; // [{id, truckInfo, basketCount, grossTotal, savedAt}] — net is recomputed from the current tare weight, so changing it updates every truck

const truckInfoInput = document.getElementById('truckInfo');
const tareInput = document.getElementById('tareWeight');
const basketWeightInput = document.getElementById('basketWeight');
const addBasketBtn = document.getElementById('addBasketBtn');
const finishTruckBtn = document.getElementById('finishTruckBtn');
const resetBtn = document.getElementById('resetBtn');
const basketGrid = document.getElementById('basketGrid');
const truckList = document.getElementById('truckList');

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

function render(){
  document.getElementById('basketNextNo').textContent = '(ตะกร้าที่ #' + (baskets.length + 1) + ')';

  basketGrid.innerHTML = '';
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

  const grossSum = baskets.reduce((s, b) => s + b.weight, 0);
  const netSum = baskets.reduce((s, b) => s + netOf(b.weight), 0);
  document.getElementById('basketCount').textContent = baskets.length + ' ใบ';
  document.getElementById('truckGross').textContent = fmt(grossSum) + ' กก.';
  document.getElementById('truckNet').textContent = fmt(netSum) + ' กก.';

  truckList.innerHTML = '';
  if (completedTrucks.length === 0) {
    truckList.innerHTML = '<div class="empty-note">ยังไม่มีคันที่บันทึกไว้</div>';
  } else {
    completedTrucks.forEach((t, idx) => {
      const row = document.createElement('div');
      row.className = 'truck-row';
      const label = t.truckInfo && t.truckInfo.trim() ? t.truckInfo : '(ไม่ระบุข้อมูลรถ)';
      const netTotal = t.grossTotal - tareWeight * t.basketCount;
      row.innerHTML = `
        <div>
          <div class="truck-label">${label}</div>
          <div class="truck-meta">${t.basketCount} ตะกร้า</div>
        </div>
        <div class="truck-weight">${fmt(netTotal)} กก.</div>
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

  const grand = completedTrucks.reduce((s, t) => s + (t.grossTotal - tareWeight * t.basketCount), 0) + netSum;
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

finishTruckBtn.addEventListener('click', () => {
  if (baskets.length === 0) return;
  const grossTotal = baskets.reduce((s, b) => s + b.weight, 0);
  completedTrucks.push({
    id: 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    truckInfo,
    basketCount: baskets.length,
    grossTotal,
    savedAt: new Date().toISOString()
  });
  baskets = [];
  truckInfo = '';
  truckInfoInput.value = '';
  save();
  render();
});

resetBtn.addEventListener('click', () => {
  baskets = [];
  completedTrucks = [];
  truckInfo = '';
  tareWeight = 0;
  truckInfoInput.value = '';
  tareInput.value = '';
  basketWeightInput.value = '';
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

let storageOk = true;

function save(){
  if (!storageOk) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ truckInfo, tareWeight, baskets, completedTrucks }));
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
      baskets = Array.isArray(parsed.baskets) ? parsed.baskets : [];
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
