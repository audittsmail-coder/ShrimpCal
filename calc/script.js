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

function txt(id){
  const el = document.getElementById(id);
  return el ? el.textContent.trim() : '';
}

function buildSummaryHtml(){
  const statRows = [
    ['ตะกร้าสุทธิ', 'out_basket_net'],
    ['เศษสุทธิ', 'out_rest'],
    ['ตัวอย่างกุ้งสุ่ม', 'out_sample'],
    ['ดิบก่อนหัก', 'out_gross'],
  ];
  if (foyMode === 'percent') statRows.push(['หักน้ำหนักกุ้งฝอย', 'out_foy_split']);
  statRows.push(['หักเปอร์เซ็นต์', 'out_deduct']);

  const statsHtml = statRows.map(([label, id]) =>
    `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value">${txt(id)}</div></div>`
  ).join('');

  const categories = [
    { cls: 'cat-normal', title: 'กุ้งปกติ', weight: txt('out_net'), rate: txt('out_price_rate'), total: txt('out_price') + ' บาท' },
    { cls: 'cat-foy',    title: 'กุ้งฝอย',  weight: txt('out_foy_net'), rate: txt('out_foy_rate'), total: txt('out_foy_price') },
    { cls: 'cat-nim',    title: 'กุ้งนิ่ม',  weight: txt('out_nim_net'), rate: txt('out_nim_rate'), total: txt('out_nim_price') },
  ];
  const catsHtml = categories.map(c => `
    <div class="cat-card ${c.cls}">
      <div class="cat-title">${c.title}</div>
      <div class="cat-weight">${c.weight}</div>
      <div class="cat-rate">${c.rate}</div>
      <div class="cat-total">${c.total}</div>
    </div>
  `).join('');

  const totalWeightText = txt('out_total_weight');
  const grandTotalText = txt('out_grand_total');

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
    --bg: #0a1830;
    --panel: #11233f;
    --line: #27466b;
    --ink: #eef2f9;
    --ink-dim: #9db2cc;
    --shrimp: #e6733a;
    --teal-accent: #4da3ff;
    --nim-accent: #d9a441;
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
  .section-label:first-of-type{ margin-top: 0; }

  .stat-grid{
    display:grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .stat{
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 8px 10px;
  }
  .stat-label{ font-size: 10.5px; color: var(--ink-dim); margin-bottom: 2px; }
  .stat-value{ font-size: 13.5px; font-weight: 700; }

  .cat-grid{
    display:grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .cat-card{
    background: var(--panel);
    border: 1px solid var(--line);
    border-top: 3px solid var(--line);
    border-radius: 12px;
    padding: 10px 10px 12px;
    text-align: center;
  }
  .cat-normal{ border-top-color: var(--shrimp); }
  .cat-foy{ border-top-color: var(--teal-accent); }
  .cat-nim{ border-top-color: var(--nim-accent); }
  .cat-title{ font-size: 12px; color: var(--ink-dim); margin-bottom: 6px; font-weight: 600; }
  .cat-weight{ font-size: 17px; font-weight: 800; }
  .cat-normal .cat-weight{ color: var(--shrimp); }
  .cat-foy .cat-weight{ color: var(--teal-accent); }
  .cat-nim .cat-weight{ color: var(--nim-accent); }
  .cat-rate{ font-size: 10.5px; color: var(--ink-dim); margin-top: 6px; }
  .cat-total{ font-size: 13px; font-weight: 700; margin-top: 2px; }

  .grand-bar{
    display:grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .grand-card{
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 12px 14px;
  }
  .grand-label{ font-size: 12.5px; color: var(--ink-dim); margin-bottom: 3px; }
  .grand-value{ font-size: 22px; font-weight: 800; color: var(--shrimp); }
  .grand-card.price .grand-value{ color: var(--teal-accent); }

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
  .back-btn:active{ background: var(--panel-2); }
</style>
</head>
<body>
  <div class="wrap">
    <button type="button" class="back-btn" onclick="window.close()">← ย้อนกลับ</button>
    <div class="eyebrow">Shrimp Scale · แพกุ้ง</div>
    <h1>สรุปรายการชั่งกุ้ง</h1>
    <div class="meta">${dateStr} · ${timeStr} น.</div>

    <div class="section-label">น้ำหนักตะกร้า / เศษ / หัก</div>
    <div class="stat-grid">${statsHtml}</div>

    <div class="section-label">แยกตามประเภทกุ้ง</div>
    <div class="cat-grid">${catsHtml}</div>

    <div class="section-label">รวมทั้งหมด</div>
    <div class="grand-bar">
      <div class="grand-card weight"><div class="grand-label">น้ำหนักรวม</div><div class="grand-value">${totalWeightText}</div></div>
      <div class="grand-card price"><div class="grand-label">ราคารวม</div><div class="grand-value">${grandTotalText}</div></div>
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
