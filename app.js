const SITE_PIN = "1234"; // Change this PIN before sharing
const STORAGE_KEY = "siteMonitoringEntries";

const $ = (id) => document.getElementById(id);
const today = () => new Date().toISOString().slice(0,10);

function show(screenId){
  document.querySelectorAll('main .screen').forEach(s => s.classList.add('hidden'));
  $(screenId).classList.remove('hidden');
  if(screenId === 'reports') renderReports();
}
function toast(msg){ $('toast').textContent=msg; $('toast').classList.remove('hidden'); setTimeout(()=>$('toast').classList.add('hidden'),3000); }
function getEntries(){ return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
function setEntries(entries){
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); return true; }
  catch (err) { console.error('Could not save entry:', err); return false; }
}
function fileToDataUrl(file){
  return new Promise((resolve)=>{ if(!file) return resolve(''); const r=new FileReader(); r.onload=()=>resolve(r.result); r.readAsDataURL(file); });
}

// Heavy photo compression for browser storage: 420px wide JPEG, low quality.
// This is intended for roughly 20 photos/day short-term use, but old entries still need exporting/clearing.
function compressImage(file, maxWidth = 420, quality = 0.32){
  return new Promise((resolve, reject) => {
    if(!file) return resolve('');
    if(!file.type || !file.type.startsWith('image/')) return fileToDataUrl(file).then(resolve).catch(reject);

    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

$('pinBtn').onclick = () => {
  if($('pinInput').value === SITE_PIN){
    sessionStorage.setItem('unlocked','yes'); $('pinScreen').classList.add('hidden'); $('app').classList.remove('hidden'); show('home');
  } else $('pinError').textContent = 'Incorrect PIN';
};
$('logoutBtn').onclick = () => { sessionStorage.removeItem('unlocked'); location.reload(); };
if(sessionStorage.getItem('unlocked') === 'yes'){ $('pinScreen').classList.add('hidden'); $('app').classList.remove('hidden'); }

document.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { show(b.dataset.open); setDefaultDates(); });
document.querySelectorAll('.back').forEach(b => b.onclick = () => show('home'));
function setDefaultDates(){ document.querySelectorAll('input[type="date"]').forEach(i => { if(!i.value) i.value = today(); }); }
setDefaultDates();

async function handleSubmit(form, type){
  const fd = new FormData(form);
  const imageFile = fd.get('image');
  let image = '';
  try { image = imageFile && imageFile.size ? await compressImage(imageFile) : ''; }
  catch(err){ console.error(err); toast('Could not process image. Try another photo.'); return; }
  const entry = {
    id: crypto.randomUUID(), type, createdAt: new Date().toISOString(),
    description: fd.get('incident') || fd.get('item'), subcontractor: fd.get('subcontractor'),
    notice: fd.get('notice'), date: fd.get('date'), entryBy: fd.get('entryBy'), image
  };
  const entries = getEntries(); entries.unshift(entry);
  if(!setEntries(entries)){
    toast('Storage full. Export CSV, then Clear Local Data.');
    return;
  }
  form.reset(); setDefaultDates(); toast('Entry saved'); show('home');
}
$('healthForm').onsubmit = (e) => { e.preventDefault(); handleSubmit(e.target,'Health & Safety'); };
$('cleanForm').onsubmit = (e) => { e.preventDefault(); handleSubmit(e.target,'Site Cleanliness'); };

function renderReports(){
  const entries = getEntries();
  $('reportList').innerHTML = entries.length ? entries.map(e => `
    <div class="entry">
      <span class="pill">${e.type}</span>
      <h3>${escapeHtml(e.description)}</h3>
      <p><b>Subcontractor:</b> ${escapeHtml(e.subcontractor)}<br><b>Notice:</b> ${e.notice}<br><b>Date:</b> ${e.date}<br><b>Entry by:</b> ${escapeHtml(e.entryBy)}</p>
      ${e.image ? `<img src="${e.image}" alt="Uploaded image">` : ''}
    </div>`).join('') : '<p>No entries yet.</p>';
}
function escapeHtml(s=''){ return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

$('exportCsv').onclick = () => {
  const rows = [['Type','Description','Subcontractor','Notice Issued','Date','Entry By','Created At','Image In PDF']].concat(getEntries().map(e => [e.type,e.description,e.subcontractor,e.notice,e.date,e.entryBy,e.createdAt,e.image ? 'Yes - see PDF report' : 'No image']));
  const csv = rows.map(r => r.map(v => `"${String(v||'').replaceAll('"','""')}"`).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'})); a.download='site-monitoring-report.csv'; a.click();
};

$('generatePdf').onclick = () => {
  const entries = getEntries();
  if(!entries.length){ toast('No entries to report yet.'); return; }

  const reportRows = entries.map(e => `
    <section class="pdf-entry">
      <h2>${escapeHtml(e.type)}</h2>
      <p><b>Description:</b> ${escapeHtml(e.description)}</p>
      <p><b>Subcontractor:</b> ${escapeHtml(e.subcontractor)}</p>
      <p><b>Notice issued:</b> ${escapeHtml(e.notice)}</p>
      <p><b>Date:</b> ${escapeHtml(e.date)}</p>
      <p><b>Entry by:</b> ${escapeHtml(e.entryBy)}</p>
      ${e.image ? `<img src="${e.image}" alt="Entry photo">` : '<p><i>No image attached.</i></p>'}
    </section>
  `).join('');

  const w = window.open('', '_blank');
  w.document.write(`<!doctype html>
<html>
<head>
  <title>Site Monitoring PDF Report</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body{font-family:Arial,Helvetica,sans-serif;margin:24px;color:#111}
    h1{margin:0 0 6px}.meta{color:#555;margin-bottom:20px}
    .pdf-entry{break-inside:avoid;page-break-inside:avoid;border:1px solid #ddd;border-radius:12px;padding:16px;margin:0 0 18px}
    .pdf-entry h2{margin-top:0}.pdf-entry img{max-width:100%;max-height:420px;border-radius:10px;border:1px solid #ddd;margin-top:10px}
    .print-btn{position:fixed;right:16px;top:16px;padding:12px 18px;border:0;border-radius:10px;background:#101828;color:white;font-weight:bold}
    @media print{.print-btn{display:none} body{margin:12mm}.pdf-entry{page-break-inside:avoid}}
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Save / Print PDF</button>
  <h1>Site Monitoring Report</h1>
  <div class="meta">Generated: ${new Date().toLocaleString()} &nbsp; | &nbsp; Entries: ${entries.length}</div>
  ${reportRows}
</body>
</html>`);
  w.document.close();
  setTimeout(() => w.print(), 500);
};

$('clearData').onclick = () => { if(confirm('Clear all saved entries on this device?')){ setEntries([]); renderReports(); } };

if('serviceWorker' in navigator){ navigator.serviceWorker.register('service-worker.js'); }
