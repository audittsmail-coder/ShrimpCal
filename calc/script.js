const baseIds = ['w_basket','w_tare','n_basket','deductPercent','price','priceFoy','priceNim','foyPercent'];
const inputs = Object.fromEntries(baseIds.map(id => [id, document.getElementById(id)]));

let foyMode = 'weigh';
const foyModeToggle = document.getElementById('foyModeToggle');
const foyWeighMode = document.getElementById('foyWeighMode');
const foyPercentMode = document.getElementById('foyPercentMode');
const foyGrossRow = document.getElementById('foyGrossRow');
const foyBaseRow = document.getElementById('foyBaseRow');

function setFoyMode(mode){
  foyMode = mode;
  foyModeToggle.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  foyWeighMode.style.display = mode === 'weigh' ? '' : 'none';
  foyPercentMode.style.display = mode === 'percent' ? '' : 'none';
  foyGrossRow.style.display = mode === 'weigh' ? '' : 'none';
  foyBaseRow.style.display = mode === 'percent' ? '' : 'none';
}

foyModeToggle.addEventListener('click', (e) => {
  const btn = e.target.closest('.mode-btn');
  if (!btn) return;
  setFoyMode(btn.dataset.mode);
  calculate();
});

function num(el){
  const v = parseFloat(el.value);
  return isNaN(v) ? 0 : v;
}

function fmt(n){
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Factory for a dynamic "add rows of weight, subtract tare" group
function createRowGroup(containerId, addBtnId, rowLabel){
  const containerEl = document.getElementById(containerId);
  let count = 0;

  function addRow(){
    count++;
    const row = document.createElement('div');
    row.className = 'rest-row';
    row.innerHTML = `
      <div class="field">
        ${count === 1 ? `<div class="rest-row-label">${rowLabel} (กก.)</div>` : ''}
        <input type="number" class="rest-w" inputmode="decimal" step="0.01" placeholder="0.00">
      </div>
      <button type="button" class="rm-row" aria-label="ลบรายการ">×</button>
    `;
    containerEl.appendChild(row);
    row.querySelector('.rest-w').addEventListener('input', calculate);
    row.querySelector('.rm-row').addEventListener('click', () => {
      row.remove();
      updateRemoveButtons();
      calculate();
    });
    updateRemoveButtons();
  }

  function updateRemoveButtons(){
    const rows = containerEl.querySelectorAll('.rest-row');
    rows.forEach(r => { r.querySelector('.rm-row').disabled = rows.length === 1; });
  }

  function sumNet(wTare){
    let total = 0;
    containerEl.querySelectorAll('.rest-row').forEach(row => {
      const w = parseFloat(row.querySelector('.rest-w').value);
      if (!isNaN(w)) total += (w - wTare);
    });
    return total;
  }

  function sumRaw(){
    let total = 0;
    containerEl.querySelectorAll('.rest-row').forEach(row => {
      const w = parseFloat(row.querySelector('.rest-w').value);
      if (!isNaN(w)) total += w;
    });
    return total;
  }

  function reset(){
    containerEl.innerHTML = '';
    count = 0;
    addRow();
  }

  document.getElementById(addBtnId).addEventListener('click', () => {
    addRow();
    calculate();
  });

  addRow();
  return { sumNet, sumRaw, reset };
}

const sampleGroup = createRowGroup('sampleRows', 'addSample', 'ตัวอย่างกุ้งสุ่ม');
const restGroup = createRowGroup('restRows', 'addRow', 'เศษที่ชั่ง');
const foyGroup = createRowGroup('shrimpFoyRows', 'addShrimpFoy', 'น้ำหนักกุ้งฝอย');
const nimGroup = createRowGroup('shrimpNimRows', 'addShrimpNim', 'น้ำหนักกุ้งนิ่ม');

function calculate(){
  const wBasket = num(inputs.w_basket);
  const wTare   = num(inputs.w_tare);
  const nBasket = num(inputs.n_basket);
  const deductPercent = num(inputs.deductPercent);
  const price   = num(inputs.price);
  const priceFoy= num(inputs.priceFoy);
  const priceNim= num(inputs.priceNim);
  const foyPercent = num(inputs.foyPercent);

  const restNet = restGroup.sumNet(wTare);
  const sampleNet = sampleGroup.sumRaw();
  const nimNet  = nimGroup.sumNet(wTare);

  const basketNet = (wBasket - wTare) * nBasket;
  const grossNet = basketNet + restNet + sampleNet;
  const foyNet = foyMode === 'percent' ? grossNet * (foyPercent / 100) : foyGroup.sumNet(wTare);
  const normalBase = foyMode === 'percent' ? grossNet - foyNet : grossNet;
  const deductAmount = normalBase * (deductPercent / 100);
  const net = normalBase - deductAmount;
  const total = price * net;
  const foyTotal = priceFoy * foyNet;
  const nimTotal = priceNim * nimNet;
  const grandTotal = total + foyTotal + nimTotal;
  const totalWeight = net + foyNet + nimNet;

  document.getElementById('restGross').textContent = fmt(restGroup.sumRaw()) + ' กก.';
  document.getElementById('restSubtotal').textContent = fmt(restNet) + ' กก.';
  document.getElementById('sampleSubtotal').textContent = fmt(sampleNet) + ' กก.';
  document.getElementById('shrimpFoyGross').textContent = fmt(foyGroup.sumRaw()) + ' กก.';
  document.getElementById('shrimpFoyBase').textContent = fmt(grossNet) + ' กก.';
  document.getElementById('shrimpFoySubtotal').textContent = fmt(foyNet) + ' กก.';
  document.getElementById('shrimpNimGross').textContent = fmt(nimGroup.sumRaw()) + ' กก.';
  document.getElementById('shrimpNimSubtotal').textContent = fmt(nimNet) + ' กก.';

  document.getElementById('out_basket_net').textContent = fmt(basketNet) + ' กก.';
  document.getElementById('out_rest').textContent = fmt(restNet) + ' กก.';
  document.getElementById('out_sample').textContent = fmt(sampleNet) + ' กก.';
  document.getElementById('out_gross').textContent = fmt(grossNet) + ' กก.';
  const foySplitRow = document.getElementById('out_foy_split_row');
  if (foyMode === 'percent') {
    foySplitRow.style.display = '';
    document.getElementById('out_foy_split').textContent = fmt(foyNet) + ' กก.';
  } else {
    foySplitRow.style.display = 'none';
  }
  document.getElementById('out_deduct').textContent = deductPercent + '% (' + fmt(deductAmount) + ' กก.)';
  document.getElementById('out_net').innerHTML = fmt(net) + '<span style="font-size:16px; color:var(--ink-dim)"> กก.</span>';
  document.getElementById('out_price_rate').textContent = fmt(price) + ' บาท/กก.';
  document.getElementById('out_price').textContent = fmt(total);

  document.getElementById('out_foy_net').textContent = fmt(foyNet) + ' กก.';
  document.getElementById('out_foy_rate').textContent = fmt(priceFoy) + ' บาท/กก.';
  document.getElementById('out_foy_price').textContent = fmt(foyTotal) + ' บาท';

  document.getElementById('out_nim_net').textContent = fmt(nimNet) + ' กก.';
  document.getElementById('out_nim_rate').textContent = fmt(priceNim) + ' บาท/กก.';
  document.getElementById('out_nim_price').textContent = fmt(nimTotal) + ' บาท';

  document.getElementById('out_total_weight').innerHTML = fmt(totalWeight) + '<span style="font-size:16px; color:var(--ink-dim)"> กก.</span>';
  document.getElementById('out_grand_total').innerHTML = fmt(grandTotal) + '<span style="font-size:16px; color:var(--ink-dim)"> บาท</span>';
}

baseIds.forEach(id => inputs[id].addEventListener('input', calculate));

document.getElementById('resetBtn').addEventListener('click', () => {
  baseIds.forEach(id => inputs[id].value = '');
  restGroup.reset();
  sampleGroup.reset();
  foyGroup.reset();
  nimGroup.reset();
  setFoyMode('weigh');
  calculate();
});

calculate();

function buildSummaryHtml(){
  const rows = [
    ['น้ำหนักตะกร้าสุทธิ', 'out_basket_net'],
    ['เศษสุทธิ', 'out_rest'],
    ['น้ำหนักตัวอย่างกุ้งสุ่ม', 'out_sample'],
    ['น้ำหนักดิบก่อนหัก', 'out_gross'],
  ];
  if (foyMode === 'percent') rows.push(['หักน้ำหนักกุ้งฝอย (%)', 'out_foy_split']);
  rows.push(
    ['หักเปอร์เซ็นต์', 'out_deduct'],
    ['น้ำหนักสุทธิกุ้งปกติ', 'out_net'],
    ['ราคาต่อกก. (กุ้งปกติ)', 'out_price_rate'],
    ['ราคารวมกุ้งปกติ', 'out_price'],
    ['น้ำหนักสุทธิกุ้งฝอย', 'out_foy_net'],
    ['ราคาต่อกก. (กุ้งฝอย)', 'out_foy_rate'],
    ['ราคารวมกุ้งฝอย', 'out_foy_price'],
    ['น้ำหนักสุทธิกุ้งนิ่ม', 'out_nim_net'],
    ['ราคาต่อกก. (กุ้งนิ่ม)', 'out_nim_rate'],
    ['ราคารวมกุ้งนิ่ม', 'out_nim_price']
  );

  const rowsHtml = rows.map(([label, id]) => {
    const el = document.getElementById(id);
    const text = el ? el.textContent.trim() : '';
    return `<div class="row"><span class="label">${label}</span><span class="value">${text}</span></div>`;
  }).join('');

  const totalWeightText = document.getElementById('out_total_weight').textContent.trim();
  const grandTotalText = document.getElementById('out_grand_total').textContent.trim();

  const now = new Date();
  const dateStr = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>สรุปรายการชั่งกุ้ง</title>
<style>
  :root{
    --bg: #0d2b2e;
    --panel: #123539;
    --line: #2c565b;
    --ink: #eef2ea;
    --ink-dim: #9fb8b6;
    --shrimp: #e6733a;
    --teal-accent: #3fb6a8;
  }
  *{box-sizing:border-box;}
  body{
    margin:0;
    background: var(--bg);
    font-family: 'Noto Sans Thai', 'Sarabun', system-ui, sans-serif;
    color: var(--ink);
    padding: 24px 18px 40px;
  }
  .wrap{ max-width: 480px; margin: 0 auto; }
  .eyebrow{
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 12px;
    letter-spacing: 0.18em;
    color: var(--teal-accent);
    text-transform: uppercase;
  }
  h1{ font-size: 24px; margin: 6px 0 4px; }
  .meta{ font-size: 14px; color: var(--ink-dim); margin-bottom: 24px; }
  .rows{
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 8px 18px;
  }
  .row{
    display:flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px dashed var(--line);
    font-size: 16px;
  }
  .row:last-child{ border-bottom: none; }
  .row .label{ color: var(--ink-dim); }
  .row .value{ font-weight: 700; text-align: right; }
  .totals{ margin-top: 20px; }
  .total-row{
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 16px 20px;
    margin-bottom: 14px;
  }
  .total-row .label{ display:block; font-size: 15px; color: var(--ink-dim); margin-bottom: 4px; }
  .total-row .big{ display:block; font-size: 30px; font-weight: 800; color: var(--shrimp); }
  .total-row.grand .big{ color: var(--teal-accent); }
</style>
</head>
<body>
  <div class="wrap">
    <div class="eyebrow">Shrimp Scale · แพกุ้ง</div>
    <h1>สรุปรายการชั่งกุ้ง</h1>
    <div class="meta">${dateStr} · ${timeStr} น.</div>
    <div class="rows">${rowsHtml}</div>
    <div class="totals">
      <div class="total-row"><span class="label">น้ำหนักกุ้งทั้งหมด</span><span class="big">${totalWeightText}</span></div>
      <div class="total-row grand"><span class="label">รวมราคาทั้งหมด</span><span class="big">${grandTotalText}</span></div>
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
