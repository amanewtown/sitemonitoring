const SITE_PIN = "1234"; // Change this PIN before sharing
const STORAGE_KEY = "siteMonitoringEntries";

const $ = (id) => document.getElementById(id);
const today = () => new Date().toISOString().slice(0,10);

function show(screenId){
  document.querySelectorAll('main .screen').forEach(s => s.classList.add('hidden'));
  $(screenId).classList.remove('hidden');
  if(screenId === 'reports') renderReports();
}
function toast(msg){ $('toast').textContent=msg; $('toast').classList.remove('hidden'); setTimeout(()=>$('toast').classList.add('hidden'),1800); }
function getEntries(){ return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
function setEntries(entries){ localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); }
function fileToDataUrl(file){
  return new Promise((resolve)=>{ if(!file) return resolve(''); const r=new FileReader(); r.onload=()=>resolve(r.result); r.readAsDataURL(file); });
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
  const image = imageFile && imageFile.size ? await fileToDataUrl(imageFile) : '';
  const entry = {
    id: crypto.randomUUID(), type, createdAt: new Date().toISOString(),
    description: fd.get('incident') || fd.get('item'), subcontractor: fd.get('subcontractor'),
    notice: fd.get('notice'), date: fd.get('date'), entryBy: fd.get('entryBy'), image
  };
  const entries = getEntries(); entries.unshift(entry); setEntries(entries);
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
  const rows = [['Type','Description','Subcontractor','Notice Issued','Date','Entry By','Created At']].concat(getEntries().map(e => [e.type,e.description,e.subcontractor,e.notice,e.date,e.entryBy,e.createdAt]));
  const csv = rows.map(r => r.map(v => `"${String(v||'').replaceAll('"','""')}"`).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'})); a.download='site-monitoring-report.csv'; a.click();
};
$('clearData').onclick = () => { if(confirm('Clear all saved entries on this device?')){ setEntries([]); renderReports(); } };

if('serviceWorker' in navigator){ navigator.serviceWorker.register('service-worker.js'); }
