const $ = id => document.getElementById(id);
const canvas = $('reportCanvas');
const ctx = canvas.getContext('2d');
const template = new Image();
template.src = 'template.png';
let extractedRows = [];

const EVENT_BY_DAY = {1:'RADAR TRAINING',2:'BASE EXPANSION',3:'AGE OF SCIENCE',4:'TRAIN HEROES',5:'TOTAL MOBILIZATION',6:'ENEMY BUSTER'};
const STORAGE_KEY='liit-generator-v3';
function n(v){return Number(String(v??'').replace(/[^0-9-]/g,''))||0}
function fmt(v){return n(v).toLocaleString('en-US')}
function pct(v,total){return total?100*v/total:0}
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

function setTodayDefaults(){const d=new Date();$('reportDate').value=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);syncEventFromDate()}
function syncEventFromDate(){const v=$('reportDate').value;if(!v)return;const jsDay=new Date(v+'T12:00:00').getDay();$('eventTitle').value=EVENT_BY_DAY[jsDay]||'NO VS'}
$('reportDate').addEventListener('change',syncEventFromDate);

function cleanName(value){return String(value||'').replace(/\[.*?\]/g,'').replace(/\bLast\s+Light\b/ig,'').replace(/^\W+|\W+$/g,'').replace(/\s{2,}/g,' ').trim()}

function preprocessImage(file){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{const sx=Math.round(img.width*.02),sy=Math.round(img.height*.18),sw=Math.round(img.width*.96),sh=Math.round(img.height*.67),scale=1.7;const c=document.createElement('canvas');c.width=Math.round(sw*scale);c.height=Math.round(sh*scale);const cctx=c.getContext('2d',{willReadFrequently:true});cctx.drawImage(img,sx,sy,sw,sh,0,0,c.width,c.height);const data=cctx.getImageData(0,0,c.width,c.height);for(let i=0;i<data.data.length;i+=4){const r=data.data[i],g=data.data[i+1],b=data.data[i+2];let gray=.299*r+.587*g+.114*b;gray=gray>158?255:Math.max(0,gray-40);data.data[i]=data.data[i+1]=data.data[i+2]=gray}cctx.putImageData(data,0,0);URL.revokeObjectURL(img.src);resolve(c)};img.onerror=reject;img.src=URL.createObjectURL(file)})}

function groupWordsIntoRows(words,width){
  const usable=(words||[]).filter(w=>w.text&&Number(w.confidence??w.conf??0)>20&&w.bbox);
  const lineGroups=[]; const lineTol=34;
  for(const w of usable.sort((a,b)=>a.bbox.y0-b.bbox.y0||a.bbox.x0-b.bbox.x0)){
    const cy=(w.bbox.y0+w.bbox.y1)/2; let g=lineGroups.find(x=>Math.abs(x.cy-cy)<lineTol);
    if(!g){g={cy,words:[]};lineGroups.push(g)} g.words.push(w);g.cy=g.words.reduce((s,q)=>s+(q.bbox.y0+q.bbox.y1)/2,0)/g.words.length;
  }
  const cards=[];
  for(const g of lineGroups.sort((a,b)=>a.cy-b.cy)){
    let c=cards.find(x=>Math.abs(x.cy-g.cy)<92);if(!c){c={cy:g.cy,words:[]};cards.push(c)}c.words.push(...g.words);c.cy=c.words.reduce((s,q)=>s+(q.bbox.y0+q.bbox.y1)/2,0)/c.words.length;
  }
  const found=[];
  for(const card of cards){
    const ws=card.words.sort((a,b)=>a.bbox.x0-b.bbox.x0);
    const rankNums=ws.filter(w=>w.bbox.x0<width*.20).map(w=>Number(w.text.replace(/\D/g,''))).filter(v=>v>=1&&v<=100);
    const rank=rankNums[0];
    const pointText=ws.filter(w=>w.bbox.x0>width*.67).map(w=>w.text).join(' ');
    const points=(pointText.match(/[\d,.]+/g)||[]).map(v=>Number(v.replace(/\D/g,''))).filter(v=>Number.isFinite(v)).sort((a,b)=>b-a)[0];
    const name=cleanName(ws.filter(w=>w.bbox.x0>width*.22&&w.bbox.x0<width*.69&&!/\[?LIIT\]?|Last|Light/i.test(w.text)).map(w=>w.text).join(' '));
    if(rank&&name&&Number.isFinite(points))found.push({rank,name,points});
  }
  return found;
}

function renderPreviews(files){const grid=$('previewGrid');grid.innerHTML='';files.forEach(file=>{const img=document.createElement('img');img.src=URL.createObjectURL(file);img.onload=()=>URL.revokeObjectURL(img.src);grid.appendChild(img)})}
$('rankingScreenshots').addEventListener('change',()=>{const files=[...$('rankingScreenshots').files];renderPreviews(files);$('rankingStatus').textContent=`${files.length} screenshot(s) selected.`});

async function extractRankings(){
  const files=[...$('rankingScreenshots').files]; if(!files.length){$('rankingStatus').textContent='Choose ranking screenshots first.';return}
  if(!window.Tesseract){$('rankingStatus').textContent='Tesseract did not load. Run with Live Server and confirm internet access.';return}
  $('extractRankingsBtn').disabled=true;$('ocrProgress').value=0;const all=[];
  try{
    for(let i=0;i<files.length;i++){
      $('rankingStatus').textContent=`Reading ${i+1}/${files.length}: ${files[i].name}`;
      const processed=await preprocessImage(files[i]);
      const result=await Tesseract.recognize(processed,'eng',{logger:m=>{if(m.status==='recognizing text')$('ocrProgress').value=Math.round(((i+(m.progress||0))/files.length)*100)}});
      all.push(...groupWordsIntoRows(result.data.words||[],processed.width));
    }
    const byRank=new Map();
    for(const row of all){const cur=byRank.get(row.rank);if(!cur||row.name.length>cur.name.length||row.points>cur.points)byRank.set(row.rank,row)}
    extractedRows=[...byRank.values()].sort((a,b)=>a.rank-b.rank);renderReviewTable();$('ocrProgress').value=100;
    const total=n($('allianceMembers').value)||100,missing=[];for(let i=1;i<=total;i++)if(!byRank.has(i))missing.push(i);
    $('rankingStatus').innerHTML=`<span class="${missing.length?'warn':'ok'}">Extracted ${extractedRows.length}/${total} members.</span> ${missing.length?'Missing ranks: '+missing.join(', '):'All ranks found.'}`;
    saveState();
  }catch(err){console.error(err);$('rankingStatus').textContent=`OCR stopped: ${err.message||err}`}
  finally{$('extractRankingsBtn').disabled=false}
}

function renderReviewTable(){const tbody=$('reviewTable').querySelector('tbody');tbody.innerHTML='';extractedRows.sort((a,b)=>a.rank-b.rank).forEach((row,index)=>{const tr=document.createElement('tr');tr.innerHTML=`<td><input class="rank-input" type="number" min="1" max="100" value="${row.rank}"></td><td><input class="name-input" value="${escapeHtml(row.name)}"></td><td><input class="points-input" inputmode="numeric" value="${fmt(row.points)}"></td><td><button class="remove-row" type="button">×</button></td>`;tr.querySelector('.rank-input').oninput=e=>row.rank=n(e.target.value);tr.querySelector('.name-input').oninput=e=>row.name=e.target.value.trim();tr.querySelector('.points-input').oninput=e=>row.points=n(e.target.value);tr.querySelector('.remove-row').onclick=()=>{extractedRows.splice(index,1);renderReviewTable();saveState()};tbody.appendChild(tr)})}
function syncRowsFromTable(){const rows=[];$('reviewTable').querySelectorAll('tbody tr').forEach(tr=>{const rank=n(tr.querySelector('.rank-input').value),name=tr.querySelector('.name-input').value.trim(),points=n(tr.querySelector('.points-input').value);if(rank&&name)rows.push({rank,name,points})});extractedRows=rows.sort((a,b)=>a.rank-b.rank)}

function getExcused(){return new Set($('excusedMembers').value.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean))}
function derive(rows){const total=Math.max(n($('allianceMembers').value),rows.length),excused=getExcused();const stretch=rows.filter(r=>r.points>=7200000),met=rows.filter(r=>r.points>=3600000&&r.points<7200000),below=rows.filter(r=>r.points>0&&r.points<3600000),zeros=rows.filter(r=>r.points===0),active=stretch.length+met.length;const excusedZero=zeros.filter(r=>excused.has(r.name.toLowerCase())),unexcusedZero=zeros.filter(r=>!excused.has(r.name.toLowerCase()));return{total,stretch,met,below,zeros,active,excusedZero,unexcusedZero,rate:pct(active,total)}}

function font(size,weight='700',family='Arial Narrow, Arial, sans-serif'){ctx.font=`${weight} ${size}px ${family}`}
function text(t,x,y,size=24,color='#fff',align='left',weight='700'){ctx.save();font(size,weight);ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(String(t),x,y);ctx.restore()}
function fitText(t,x,y,maxWidth,size=28,color='#fff',align='center',weight='800'){ctx.save();let s=size;font(s,weight);while(s>11&&ctx.measureText(String(t)).width>maxWidth){s--;font(s,weight)}ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(String(t),x,y);ctx.restore()}
function mask(x,y,w,h,color='#080c10'){ctx.save();ctx.fillStyle=color;ctx.fillRect(x,y,w,h);ctx.restore()}
function drawTemplate(){ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(template,0,0,1024,1536)}

function render(){
  syncRowsFromTable();const rows=[...extractedRows].sort((a,b)=>a.rank-b.rank);if(!rows.length){$('message').textContent='Extract or enter roster data first.';return}
  const stats=derive(rows),dateVal=$('reportDate').value,date=dateVal?new Date(dateVal+'T12:00:00'):new Date(),weekday=date.toLocaleDateString('en-US',{weekday:'long'}).toUpperCase(),dateLong=date.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}).toUpperCase(),event=$('eventTitle').value,opponent=($('opponent').value||'OPPONENT').toUpperCase(),liit=n($('liitScore').value),enemy=n($('enemyScore').value),victory=liit>=enemy,result=victory?'VICTORY':'DEFEAT',margin=Math.abs(liit-enemy);
  drawTemplate();
  mask(836,42,165,78,'#070a0d');fitText(weekday,916,59,160,21,'#fff','center','800');fitText(dateLong,916,85,165,18,'#fff','center','800');
  mask(403,108,315,48,'#173047');fitText(event,560,133,300,31,'#fff','center','900');
  mask(192,284,235,42,'#06101a');fitText(fmt(liit),310,307,220,34,'#fff','center','900');
  mask(650,180,355,146,'#32100f');fitText(opponent,760,222,190,36,'#fff','center','900');fitText(fmt(enemy),760,290,245,34,'#fff','center','900');ctx.save();ctx.strokeStyle='#c7c7c7';ctx.lineWidth=3;ctx.beginPath();ctx.arc(935,254,42,0,Math.PI*2);ctx.stroke();ctx.restore();fitText(opponent.slice(0,6),935,254,72,17,'#ddd','center','900');
  mask(187,341,220,46,'#070b0e');text(result,295,362,35,victory?'#55d30f':'#ff3333','center','900');mask(642,343,230,43,'#070b0e');fitText(fmt(margin),755,363,220,31,victory?'#55d30f':'#ffcc29','center','900');
  mask(48,552,87,55,'#071019');text(stats.total,91,581,37,'#fff','center','900');mask(209,552,102,55,'#071019');text(stats.stretch.length,260,581,37,'#fff','center','900');mask(375,552,102,55,'#071019');text(stats.met.length,426,581,37,'#fff','center','900');mask(535,552,102,55,'#071019');text(stats.below.length,586,581,37,'#fff','center','900');mask(699,552,102,55,'#071019');text(stats.zeros.length,750,581,37,'#fff','center','900');mask(864,495,110,112,'#071019');text(`${stats.rate.toFixed(0)}%`,919,530,32,'#fff','center','900');text(`${stats.active} / ${stats.total}`,919,581,20,'#fff','center','800');
  const top10=[...rows].sort((a,b)=>b.points-a.points).slice(0,10);for(let i=0;i<10;i++){const y=712+i*46;mask(128,y-16,335,33,'#061018');if(top10[i]){fitText(top10[i].name,138,y,245,22,'#fff','left','700');fitText(fmt(top10[i].points),465,y,120,20,'#f4b719','right','800')}}
  mask(516,777,468,196,'#071018');const follow=[...stats.below,...stats.unexcusedZero].sort((a,b)=>b.points-a.points).slice(0,10);follow.forEach((r,i)=>{const y=792+i*18;fitText(r.name,526,y,190,16,'#f2f2f2','left','700');fitText(fmt(r.points),820,y,102,16,'#ff3838','right','700');fitText(fmt(Math.max(0,3600000-r.points)),966,y,125,16,'#ffc400','right','700')});
  mask(520,1014,300,122,'#071018');const zeros=[...stats.unexcusedZero.map(r=>({...r,exc:false})),...stats.excusedZero.map(r=>({...r,exc:true}))];zeros.slice(0,6).forEach((r,i)=>{const y=1043+i*22;fitText('• '+r.name,530,y,205,17,r.exc?'#ffd046':'#fff','left','700');if(r.exc)text('EXCUSED',792,y,14,'#ffd046','right','900')});
  mask(173,1190,480,136,'#071018');let notes=$('leadershipNotes').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);if(!notes.length)notes=[`${result==='VICTORY'?'LIIT won':'LIIT finished'} by ${fmt(margin)} VS points.`,`${stats.rate.toFixed(0)}% of the alliance met the 3.6M minimum.`,`${stats.below.length} members finished below 3.6M.`,`${stats.unexcusedZero.length} unexcused members recorded zero points.`,stats.excusedZero.length?`${stats.excusedZero.length} zero-point member(s) were excused.`:'No zero-point members were marked excused.'];notes.slice(0,5).forEach((note,i)=>{const y=1210+i*25,color=i<2?'#65d81c':i===2?'#ffc52a':i===3?'#ff3a3a':'#2caaf5';fitText(note,180,y,455,18,'#fff','left','600')});
  mask(23,1355,665,150,'#071018');fitText('A SINGLE WARRIOR MAY LOSE A BATTLE,',355,1402,620,25,'#f2f2f2','center','900');fitText('BUT A CLAN OF WARRIORS WINS THE WAR.',355,1438,620,26,'#f4b719','center','900');fitText('HONOR  •  LOYALTY  •  VICTORY',355,1481,500,19,'#d7d7d7','center','800');
  $('downloadBtn').disabled=false;$('message').innerHTML=`<span class="ok">Rendered ${rows.length} roster rows.</span> Participation ${stats.active}/${stats.total} (${stats.rate.toFixed(1)}%). Stretch ${stats.stretch.length} • Met ${stats.met.length} • Below ${stats.below.length} • Zero ${stats.zeros.length}.`;saveState();
}

function download(){const date=$('reportDate').value||'date';canvas.toBlob(blob=>{if(!blob){$('message').textContent='PNG export failed.';return}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`LIIT_${date}_Daily_VS_Report.png`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)},'image/png')}

async function readDuel(){const file=$('duelScreenshot').files[0];if(!file){$('duelStatus').textContent='Choose the Duel screenshot first.';return}if(!window.Tesseract){$('duelStatus').textContent='OCR library did not load.';return}$('duelStatus').textContent='Reading…';try{const {data:{text:raw}}=await Tesseract.recognize(file,'eng',{logger:m=>{if(m.status==='recognizing text')$('duelStatus').textContent=`OCR ${Math.round((m.progress||0)*100)}%`}});const textRaw=raw.replace(/\s+/g,' '),tags=[...textRaw.matchAll(/\[\s*([A-Za-z0-9]{2,8})\s*\]/g)].map(m=>m[1]),nums=[...textRaw.matchAll(/\b\d{1,3}(?:,\d{3}){2,}\b/g)].map(m=>n(m[0])).filter(v=>v>1000000),opp=tags.find(t=>t.toLowerCase()!=='liit');if(opp)$('opponent').value=opp.toUpperCase();if(nums.length>=2){$('liitScore').value=fmt(nums[0]);$('enemyScore').value=fmt(nums[1])}$('duelStatus').textContent='OCR complete — verify opponent and scores.';saveState()}catch(err){console.error(err);$('duelStatus').textContent='Duel OCR failed; enter fields manually.'}}

function saveState(){syncRowsFromTable();const payload={rows:extractedRows,fields:{reportDate:$('reportDate').value,allianceMembers:$('allianceMembers').value,excusedMembers:$('excusedMembers').value,opponent:$('opponent').value,liitScore:$('liitScore').value,enemyScore:$('enemyScore').value,leadershipNotes:$('leadershipNotes').value}};localStorage.setItem(STORAGE_KEY,JSON.stringify(payload))}
function restoreState(){try{const p=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(!p)return;extractedRows=Array.isArray(p.rows)?p.rows:[];Object.entries(p.fields||{}).forEach(([id,v])=>{if($(id))$(id).value=v});renderReviewTable();syncEventFromDate();if(extractedRows.length)$('rankingStatus').textContent=`Restored ${extractedRows.length} saved members.`}catch(e){console.warn(e)}}

function loadDemo(){
 $('reportDate').value='2026-08-05';syncEventFromDate();$('opponent').value='REAR';$('liitScore').value='805,705,900';$('enemyScore').value='28,643,976';$('allianceMembers').value=100;$('excusedMembers').value='Moto a GoGo';
 const demo=`1,Johntilla the Fun,19718400\n2,OG Cobb,19001300\n3,TangoWhiskeyy,18991350\n4,4tt1cus,17168200\n5,Dubbzz7,16702250\n6,Dr LAZR,14798200\n7,Náțe,14731250\n8,Raeghin,14218250\n9,Oblivion,13752250\n10,oAbaporu,13516550\n87,Bannamu,3393000\n88,Bewblover,3162500\n89,Weemzy,2871000\n90,MoccaMaster,2849100\n91,Dre137,2667450\n92,Cykot,2514000\n93,itsmekaityg,2216750\n94,Dove Zone,1530000\n95,Tucker11978,1368800\n96,btss,1170000\n97,Ducky615,0\n98,Dilly0,0\n99,DjcHaRm23,0\n100,Moto a GoGo,0`;
 extractedRows=demo.split(/\n/).map(line=>{const p=line.split(',');return{rank:n(p[0]),name:p[1],points:n(p[2])}});renderReviewTable();render();
}

$('extractRankingsBtn').addEventListener('click',extractRankings);$('clearRankingsBtn').addEventListener('click',()=>{$('rankingScreenshots').value='';$('previewGrid').innerHTML='';extractedRows=[];renderReviewTable();$('rankingStatus').textContent='Cleared.';$('ocrProgress').value=0;saveState()});$('addRowBtn').addEventListener('click',()=>{syncRowsFromTable();extractedRows.push({rank:extractedRows.length+1,name:'',points:0});renderReviewTable()});$('saveRosterBtn').addEventListener('click',()=>{saveState();$('message').textContent='Review table saved in this browser.'});$('readDuelBtn').addEventListener('click',readDuel);$('generateBtn').addEventListener('click',render);$('downloadBtn').addEventListener('click',download);$('loadDemoBtn').addEventListener('click',loadDemo);window.addEventListener('beforeunload',saveState);
document.addEventListener('input',e=>{if(e.target.closest('.controls'))saveState()});

template.onload=()=>{drawTemplate();setTodayDefaults();restoreState();$('message').textContent='Ready. Upload all ranking screenshots at once, then click Extract Members.'};
template.onerror=()=>{$('message').innerHTML='<span class="danger">Template failed to load. Keep template.png beside index.html and run through Live Server.</span>'};
