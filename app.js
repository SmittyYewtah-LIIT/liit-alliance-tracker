const canvas = document.getElementById('reportCanvas');
const ctx = canvas.getContext('2d');
let templateBitmap = null;
let templateReadyResolve;
let templateReadyReject;
const templateReady = new Promise((resolve, reject) => {
  templateReadyResolve = resolve;
  templateReadyReject = reject;
});

async function setTemplateFromBlob(blob, sourceLabel = 'template image') {
  if (!blob || !blob.type.startsWith('image/')) throw new Error('Selected template is not an image file.');
  if (templateBitmap && typeof templateBitmap.close === 'function') templateBitmap.close();
  templateBitmap = await createImageBitmap(blob);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(templateBitmap, 0, 0, canvas.width, canvas.height);
  if (document.getElementById('templateStatus')) {
    document.getElementById('templateStatus').innerHTML = `<span class="ok">Template loaded from ${sourceLabel}.</span>`;
  }
  templateReadyResolve(templateBitmap);
  return templateBitmap;
}

async function loadDefaultTemplate() {
  const status = document.getElementById('templateStatus');
  try {
    const url = new URL('template-clean.png', window.location.href);
    const response = await fetch(url.href, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await setTemplateFromBlob(await response.blob(), 'template-clean.png');
  } catch (fetchError) {
    console.warn('Automatic template fetch failed:', fetchError);
    // A same-origin Image fallback handles some Live Server/browser combinations.
    try {
      const url = new URL('template-clean.png', window.location.href);
      const blob = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = async () => {
          try {
            const c = document.createElement('canvas');
            c.width = image.naturalWidth;
            c.height = image.naturalHeight;
            c.getContext('2d').drawImage(image, 0, 0);
            c.toBlob(b => b ? resolve(b) : reject(new Error('Could not convert template image.')), 'image/png');
          } catch (error) { reject(error); }
        };
        image.onerror = () => reject(new Error('Browser could not open template.png.'));
        image.src = url.href + `?v=${Date.now()}`;
      });
      await setTemplateFromBlob(blob, 'template.png fallback');
    } catch (fallbackError) {
      console.error('Template fallback failed:', fallbackError);
      if (status) status.innerHTML = '<span class="warn">Automatic template loading failed. Click “Choose File” above and select template.png from this project folder.</span>';
    }
  }
}


const $ = id => document.getElementById(id);
const fmt = n => Number(n || 0).toLocaleString('en-US');
const compact = n => `${(Number(n || 0) / 1_000_000).toFixed(2)}M`;
const pct = (a,b) => b ? `${(a / b * 100).toFixed(1)}%` : '0.0%';
let extractedRows = [];

function parseRankings(text) {
  const rows = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const match = line.match(/^(.*?)[,\t]\s*([\d,]+)\s*$/);
    if (!match) continue;
    rows.push({ rank: rows.length + 1, name: match[1].trim(), points: Number(match[2].replace(/,/g,'')) || 0 });
  }
  return rows.sort((a,b) => b.points - a.points).map((r,i)=>({...r,rank:i+1}));
}

function cleanName(value) {
  return value
    .replace(/\[.*?\]/g, '')
    .replace(/\bLast\s+Light\b/ig, '')
    .replace(/^\W+|\W+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function preprocessImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Ranking cards occupy the center of the standard 941x2048 screenshot.
      const sx = Math.round(img.width * 0.03);
      const sy = Math.round(img.height * 0.205);
      const sw = Math.round(img.width * 0.94);
      const sh = Math.round(img.height * 0.60);
      const scale = 1.5;
      const c = document.createElement('canvas');
      c.width = Math.round(sw * scale);
      c.height = Math.round(sh * scale);
      const cctx = c.getContext('2d', { willReadFrequently: true });
      cctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
      const data = cctx.getImageData(0,0,c.width,c.height);
      for (let i=0; i<data.data.length; i+=4) {
        const r=data.data[i], g=data.data[i+1], b=data.data[i+2];
        let gray = 0.299*r + 0.587*g + 0.114*b;
        gray = gray > 150 ? 255 : Math.max(0, gray - 35);
        data.data[i]=data.data[i+1]=data.data[i+2]=gray;
      }
      cctx.putImageData(data,0,0);
      URL.revokeObjectURL(img.src);
      resolve(c);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function groupWordsIntoRows(words, width) {
  const usable = words.filter(w => w.text && Number(w.confidence ?? w.conf ?? 0) > 25);
  const groups = [];
  const tolerance = 42;
  for (const word of usable.sort((a,b)=>a.bbox.y0-b.bbox.y0 || a.bbox.x0-b.bbox.x0)) {
    const cy = (word.bbox.y0 + word.bbox.y1) / 2;
    let group = groups.find(g => Math.abs(g.cy - cy) < tolerance);
    if (!group) { group = {cy, words:[]}; groups.push(group); }
    group.words.push(word);
    group.cy = group.words.reduce((s,w)=>s+(w.bbox.y0+w.bbox.y1)/2,0)/group.words.length;
  }

  // Merge text lines that belong to the same player card.
  const cardGroups = [];
  for (const g of groups.sort((a,b)=>a.cy-b.cy)) {
    let card = cardGroups.find(c => Math.abs(c.cy-g.cy) < 100);
    if (!card) { card={cy:g.cy, words:[]}; cardGroups.push(card); }
    card.words.push(...g.words);
    card.cy = card.words.reduce((s,w)=>s+(w.bbox.y0+w.bbox.y1)/2,0)/card.words.length;
  }

  const found = [];
  for (const card of cardGroups) {
    const ws = card.words.sort((a,b)=>a.bbox.x0-b.bbox.x0);
    const rankCandidates = ws.filter(w => w.bbox.x0 < width*0.18).map(w=>w.text.replace(/\D/g,''));
    const rank = rankCandidates.map(Number).find(n=>n>=1 && n<=100);
    const pointText = ws.filter(w => w.bbox.x0 > width*0.68).map(w=>w.text).join(' ');
    const pointMatches = pointText.match(/[\d,.]+/g) || [];
    const points = pointMatches.map(v=>Number(v.replace(/\D/g,''))).filter(n=>Number.isFinite(n)).sort((a,b)=>b-a)[0];
    const nameWords = ws.filter(w => w.bbox.x0 > width*0.25 && w.bbox.x0 < width*0.68 && !/\[?Liit\]?|Last|Light/i.test(w.text));
    const name = cleanName(nameWords.map(w=>w.text).join(' '));
    if (rank && name && Number.isFinite(points)) found.push({rank,name,points});
  }
  return found;
}

async function extractScreenshots() {
  const files = [...$('screenshots').files];
  if (!files.length) {
    $('ocrStatus').textContent = 'Choose ranking screenshots first.';
    return;
  }
  if (!window.Tesseract) {
    $('ocrStatus').textContent = 'OCR library did not load. Confirm internet access and run with Live Server.';
    return;
  }
  $('extractBtn').disabled = true;
  $('ocrProgress').value = 0;
  const all = [];
  try {
    for (let i=0; i<files.length; i++) {
      $('ocrStatus').textContent = `Reading screenshot ${i+1} of ${files.length}: ${files[i].name}`;
      const processed = await preprocessImage(files[i]);
      const result = await Tesseract.recognize(processed, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            $('ocrProgress').value = Math.round(((i + m.progress) / files.length) * 100);
          }
        }
      });
      const rows = groupWordsIntoRows(result.data.words || [], processed.width);
      all.push(...rows);
    }
    const byRank = new Map();
    for (const row of all) {
      const current = byRank.get(row.rank);
      if (!current || row.name.length > current.name.length) byRank.set(row.rank,row);
    }
    extractedRows = [...byRank.values()].sort((a,b)=>a.rank-b.rank);
    renderReviewTable();
    $('ocrProgress').value = 100;
    const missing = [];
    const total = Number($('totalMembers').value) || 100;
    for (let i=1;i<=total;i++) if (!byRank.has(i)) missing.push(i);
    $('ocrStatus').textContent = `Extracted ${extractedRows.length} members. ${missing.length ? `Missing ranks: ${missing.join(', ')}.` : 'All ranks found.'} Review before generating.`;
  } catch (error) {
    console.error(error);
    $('ocrStatus').textContent = `OCR stopped: ${error.message || error}`;
  } finally {
    $('extractBtn').disabled = false;
  }
}

function renderReviewTable() {
  const tbody = $('reviewTable').querySelector('tbody');
  tbody.innerHTML = '';
  extractedRows.sort((a,b)=>a.rank-b.rank).forEach((row,index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input class="rank-input" type="number" min="1" max="100" value="${row.rank}"></td>
      <td><input class="name-input" value="${escapeHtml(row.name)}"></td>
      <td><input class="points-input" inputmode="numeric" value="${fmt(row.points)}"></td>
      <td><button class="remove-row" aria-label="Remove row">×</button></td>`;
    tr.querySelector('.rank-input').addEventListener('change', e=>row.rank=Number(e.target.value));
    tr.querySelector('.name-input').addEventListener('input', e=>row.name=e.target.value.trim());
    tr.querySelector('.points-input').addEventListener('input', e=>row.points=Number(e.target.value.replace(/\D/g,''))||0);
    tr.querySelector('.remove-row').addEventListener('click', ()=>{extractedRows.splice(index,1);renderReviewTable();});
    tbody.appendChild(tr);
  });
}
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function syncFromTable(){
  const rows=[];
  $('reviewTable').querySelectorAll('tbody tr').forEach(tr=>{
    const rank=Number(tr.querySelector('.rank-input').value);
    const name=tr.querySelector('.name-input').value.trim();
    const points=Number(tr.querySelector('.points-input').value.replace(/\D/g,''))||0;
    if(name) rows.push({rank,name,points});
  });
  extractedRows=rows;
}

function getRows() {
  syncFromTable();
  if (extractedRows.length) return [...extractedRows].sort((a,b)=>b.points-a.points);
  return parseRankings($('rankings').value);
}

function drawText(text, x, y, size, color='#eee', align='left', weight='600') {
  ctx.save(); ctx.font = `${weight} ${size}px Arial`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(String(text), x, y); ctx.restore();
}
function cover(x,y,w,h,alpha=1) { ctx.save(); ctx.fillStyle = `rgba(0,0,0,${alpha})`; ctx.fillRect(x,y,w,h); ctx.restore(); }

function calculate() {
  const rows = getRows();
  const totalMembers = Number($('totalMembers').value) || rows.length;
  const excused = new Set($('excused').value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
  const stretch = rows.filter(r => r.points >= 7_200_000);
  const met = rows.filter(r => r.points >= 3_600_000 && r.points < 7_200_000);
  const below = rows.filter(r => r.points > 0 && r.points < 3_600_000);
  const zero = rows.filter(r => r.points === 0);
  return { rows, totalMembers, excused, stretch, met, below, zero, participating: stretch.length + met.length };
}

async function drawReport() {
  const d = calculate();
  await templateReady;
  if (!d.rows.length) { $('validation').innerHTML='<span class="warn">No ranking data is available. Extract screenshots or load pasted data first.</span>'; return; }
  ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(templateBitmap,0,0,1024,1536);
  cover(345,363,170,62); cover(548,363,160,62); cover(755,363,210,62);
  drawText($('event').value.toUpperCase(),430,402,20,'#eeeeee','center','700');
  drawText(`WEEK ${$('week').value} • DAY ${$('day').value}`,628,397,18,'#eeeeee','center','600');
  drawText($('date').value.toUpperCase(),860,397,18,'#eeeeee','center','600');
  cover(305,469,420,145);
  drawText('VICTORY',377,485,25,'#4fae19','center','800'); drawText('[LIIT]',377,523,21,'#c9c9c9','center','700');
  drawText(compact($('allianceTotal').value),377,560,41,'#4fae19','center','800'); drawText('VS POINTS TODAY',377,598,16,'#d8d8d8','center','500');
  drawText('VS',512,535,46,'#e4b537','center','900'); drawText('DEFEAT',647,485,25,'#ce1f1f','center','800');
  drawText(`[${$('opponentTag').value}]`,647,523,21,'#c9c9c9','center','700'); drawText(compact($('opponentTotal').value),647,560,41,'#ce1f1f','center','800');
  drawText('VS POINTS TODAY',647,598,16,'#d8d8d8','center','500'); cover(740,468,250,145);
  drawText('ALLIANCE TOTAL VS',865,490,18,'#bdbdbd','center','600'); drawText(compact($('allianceTotal').value),865,550,44,'#d89f16','center','800');
  const metrics=[{x:161,count:`${d.participating} / ${d.totalMembers}`,percentage:pct(d.participating,d.totalMembers)},{x:344,count:d.stretch.length,percentage:pct(d.stretch.length,d.totalMembers)},{x:529,count:d.met.length,percentage:pct(d.met.length,d.totalMembers)},{x:712,count:d.below.length,percentage:pct(d.below.length,d.totalMembers)},{x:908,count:d.zero.length,percentage:pct(d.zero.length,d.totalMembers)}];
  for(const m of metrics){cover(m.x-76,748,m.x===161?155:150,112);drawText(m.count,m.x,780,38,'#eeeeee','center','800');drawText(m.x===161?'PARTICIPATION':'MEMBERS',m.x,819,15,'#dddddd','center','500');drawText(m.percentage,m.x,849,19,'#eeeeee','center','600');}
  cover(600,884,270,45); drawText(`${d.stretch.length} / ${d.totalMembers} (${pct(d.stretch.length,d.totalMembers)})`,735,907,29,'#a9a9a9','center','700');
  cover(74,983,377,352); d.rows.slice(0,10).forEach((r,i)=>{const y=1002+i*35;drawText(i+1,49,y,15,'#111','center','800');drawText(r.name,82,y,18,'#eeeeee','left','500');drawText(fmt(r.points),447,y,17,'#eeeeee','right','500');});
  cover(535,1050,440,290); const follow=[...d.below,...d.zero.filter(r=>!d.excused.has(r.name.toLowerCase()))].sort((a,b)=>b.points-a.points);
  follow.slice(0,8).forEach((r,i)=>{const y=1070+i*35,needed=Math.max(0,3600000-r.points),isExcused=d.excused.has(r.name.toLowerCase());drawText(isExcused?'E':'!',519,y,15,isExcused?'#1aa3ff':'#e32020','center','700');drawText(r.name,552,y,17,'#eeeeee','left','500');drawText(fmt(r.points),790,y,16,'#eeeeee','center','500');drawText(isExcused?'EXCUSED':fmt(needed),940,y,16,isExcused?'#1aa3ff':'#e8b000','right','500');});
  cover(548,1334,290,34); const excusedBelow=follow.filter(r=>d.excused.has(r.name.toLowerCase())); drawText(excusedBelow.length?excusedBelow.map(r=>r.name).join(', '):'None',552,1352,15,'#eeeeee','left','500');
  const found=d.rows.length; $('validation').innerHTML=`<span class="${found===d.totalMembers?'ok':'warn'}">Using ${found} ranking rows; roster set to ${d.totalMembers}.</span><br>Participation: ${d.participating}/${d.totalMembers} (${pct(d.participating,d.totalMembers)}).<br>Stretch ${d.stretch.length} • Met minimum ${d.met.length} • Below ${d.below.length} • Zero ${d.zero.length}.`;
}


const STORAGE_KEY = 'liit-report-generator-v04';
const LEGACY_BACKUP_KEY = 'liitBackup';

function saveCurrentData() {
  syncFromTable();
  const fields = ['date','week','day','event','opponentTag','opponentTotal','allianceTotal','totalMembers','excused','rankings'];
  const payload = { rows: extractedRows, fields: {} };
  for (const id of fields) payload.fields[id] = $(id)?.value ?? '';
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function restoreSavedData() {
  try {
    let payload = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!payload) {
      const legacy = JSON.parse(localStorage.getItem(LEGACY_BACKUP_KEY) || 'null');
      if (Array.isArray(legacy)) payload = { rows: legacy, fields: {} };
    }
    if (!payload) return;
    extractedRows = Array.isArray(payload.rows) ? payload.rows : [];
    for (const [id,value] of Object.entries(payload.fields || {})) if ($(id)) $(id).value = value;
    renderReviewTable();
    $('ocrStatus').textContent = extractedRows.length ? `Restored ${extractedRows.length} saved members.` : $('ocrStatus').textContent;
  } catch (error) {
    console.warn('Could not restore saved data:', error);
  }
}

window.addEventListener('beforeunload', saveCurrentData);
document.addEventListener('input', event => {
  if (event.target.closest('.controls')) saveCurrentData();
});

restoreSavedData();
loadDefaultTemplate();
$('generateBtn').addEventListener('click', async () => { await drawReport(); saveCurrentData(); });
$('extractBtn').addEventListener('click', extractScreenshots);
$('clearBtn').addEventListener('click',()=>{$('screenshots').value='';$('previewGrid').innerHTML='';extractedRows=[];renderReviewTable();$('ocrStatus').textContent='Cleared.';$('ocrProgress').value=0;});
$('addRowBtn').addEventListener('click',()=>{extractedRows.push({rank:extractedRows.length+1,name:'',points:0});renderReviewTable();});
$('loadManualBtn').addEventListener('click',()=>{extractedRows=parseRankings($('rankings').value);renderReviewTable();$('ocrStatus').textContent=`Loaded ${extractedRows.length} pasted rows.`;});
async function downloadReport() {
  const button = $('downloadBtn');
  const originalText = button.textContent;
  try {
    button.disabled = true;
    button.textContent = 'Preparing PNG...';

    const rows = getRows();
    if (!rows.length) {
      $('validation').innerHTML = '<span class="warn">No ranking data is available. Add or extract member data first.</span>';
      return;
    }

    await templateReady;

    await drawReport();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const filename = `LIIT-${$('date').value.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'')}-Daily-VS-Report.png`;
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(result => result ? resolve(result) : reject(new Error('The browser could not create the PNG file.')), 'image/png');
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);

    $('validation').innerHTML += `<br><span class="ok">PNG prepared: ${filename}. Check your Downloads folder.</span>`;
  } catch (error) {
    console.error('PNG download failed:', error);
    $('validation').innerHTML = `<span class="warn">PNG download failed: ${error.message || error}. Try the fallback button below.</span>`;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const opened = window.open(dataUrl, '_blank');
      if (!opened) throw new Error('Your browser blocked the download and the fallback tab. Allow pop-ups/downloads for this local site.');
    } catch (fallbackError) {
      console.error('PNG fallback failed:', fallbackError);
      $('validation').innerHTML += `<br><span class="warn">Fallback failed: ${fallbackError.message || fallbackError}</span>`;
    }
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

$('templateFile').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    await setTemplateFromBlob(file, file.name);
    $('validation').innerHTML = '<span class="ok">Template is ready. Your saved roster remains available.</span>';
  } catch (error) {
    console.error(error);
    $('templateStatus').innerHTML = `<span class="warn">Template could not be loaded: ${error.message || error}</span>`;
  }
});

$('downloadBtn').addEventListener('click', downloadReport);
$('screenshots').addEventListener('change',e=>{const grid=$('previewGrid');grid.innerHTML='';[...e.target.files].forEach(file=>{const img=document.createElement('img');img.src=URL.createObjectURL(file);grid.appendChild(img);});$('ocrStatus').textContent=`${e.target.files.length} screenshot(s) selected. Click Extract Members.`;});
