const $ = (id) => document.getElementById(id);
const canvas = $('reportCanvas');
const ctx = canvas.getContext('2d');
const template = new Image();
template.src = 'template.png';

const EVENT_BY_DAY = {
  1: 'RADAR TRAINING',
  2: 'BASE EXPANSION',
  3: 'AGE OF SCIENCE',
  4: 'TRAIN HEROES',
  5: 'TOTAL MOBILIZATION',
  6: 'ENEMY BUSTER'
};

const dayIndexToVsDay = {1:1,2:2,3:3,4:4,5:5,6:6}; // JS Mon=1 ... Sat=6

function n(v){return Number(String(v ?? '').replace(/[^0-9-]/g,'')) || 0}
function fmt(v){return n(v).toLocaleString('en-US')}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function pct(v,total){return total ? (100*v/total) : 0}

function setTodayDefaults(){
  const d = new Date();
  const local = new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
  $('reportDate').value = local;
  syncDayFromDate();
}

function syncDayFromDate(){
  const val = $('reportDate').value;
  if(!val) return;
  const date = new Date(val+'T12:00:00');
  const jsDay = date.getDay();
  const vsDay = dayIndexToVsDay[jsDay] || '';
  if(vsDay) $('dayNumber').value = vsDay;
  syncEvent();
}
function syncEvent(){
  const day = Number($('dayNumber').value);
  $('eventTitle').value = EVENT_BY_DAY[day] || 'NO VS / REST DAY';
}
$('reportDate').addEventListener('change', syncDayFromDate);
$('dayNumber').addEventListener('input', syncEvent);

function parseRoster(){
  const lines = $('rosterCsv').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const rows = [];
  for(const line of lines){
    let parts;
    if(line.includes('\t')) parts=line.split('\t');
    else parts=line.split(',');
    if(parts.length<3) continue;
    const rank=n(parts.shift());
    const points=n(parts.pop());
    const name=parts.join(',').trim();
    if(rank && name) rows.push({rank,name,points});
  }
  rows.sort((a,b)=>a.rank-b.rank);
  return rows;
}
function getExcused(){
  return new Set($('excusedMembers').value.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean));
}
function derive(rows){
  const total = Math.max(n($('allianceMembers').value), rows.length || 0);
  const excused=getExcused();
  const stretch=rows.filter(r=>r.points>=7200000).length;
  const met=rows.filter(r=>r.points>=3600000 && r.points<7200000).length;
  const below=rows.filter(r=>r.points>0 && r.points<3600000);
  const zeros=rows.filter(r=>r.points===0);
  const active=rows.filter(r=>r.points>=3600000).length;
  const excusedZero=zeros.filter(r=>excused.has(r.name.toLowerCase()));
  const unexcusedZero=zeros.filter(r=>!excused.has(r.name.toLowerCase()));
  // Participation follows the alliance rule: >=3.6M divided by alliance members.
  return {total,stretch,met,below,zeros,active,excusedZero,unexcusedZero,rate:pct(active,total)};
}

function font(size, weight='700', family='Arial Narrow, Arial, sans-serif'){ctx.font=`${weight} ${size}px ${family}`}
function text(t,x,y,size=24,color='#fff',align='left',weight='700'){
  ctx.save();font(size,weight);ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(String(t),x,y);ctx.restore();
}
function fitText(t,x,y,maxWidth,size=28,color='#fff',align='center',weight='800'){
  ctx.save(); let s=size; font(s,weight); while(s>12 && ctx.measureText(String(t)).width>maxWidth){s--;font(s,weight)} ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(String(t),x,y);ctx.restore();
}
function mask(x,y,w,h,color='#080c10'){ctx.save();ctx.fillStyle=color;ctx.fillRect(x,y,w,h);ctx.restore()}
function line(x1,y1,x2,y2,color='rgba(255,255,255,.25)',width=1){ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.restore()}

function drawTemplate(){ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(template,0,0,1024,1536)}

function render(){
  const rows=parseRoster();
  if(!rows.length){$('message').textContent='Paste roster data first (rank,name,points).';return}
  const stats=derive(rows);
  const dateVal=$('reportDate').value;
  const date=dateVal?new Date(dateVal+'T12:00:00'):new Date();
  const weekday=date.toLocaleDateString('en-US',{weekday:'long'}).toUpperCase();
  const dateLong=date.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}).toUpperCase();
  const event=$('eventTitle').value || EVENT_BY_DAY[Number($('dayNumber').value)] || '';
  const opponent=($('opponent').value||'OPPONENT').toUpperCase();
  const liit=n($('liitScore').value);
  const enemy=n($('enemyScore').value);
  const result=liit>=enemy?'VICTORY':'DEFEAT';
  const margin=Math.abs(liit-enemy);

  drawTemplate();

  // Header date: mask only the old sample text while preserving calendar icon.
  mask(836,42,165,78,'#070a0d');
  fitText(weekday,916,59,160,21,'#fff','center','800');
  fitText(dateLong,916,85,165,18,'#fff','center','800');

  // Event title: mask old title, preserve the bar and icon.
  mask(403,108,315,48,'#173047');
  fitText(event,560,133,300,31,'#fff','center','900');

  // LIIT score blank zone.
  mask(192,284,235,42,'#06101a');
  fitText(fmt(liit),310,307,220,34,'#fff','center','900');

  // Opponent zone: remove baked REAR name, score and emblem.
  mask(650,180,355,146,'#32100f');
  fitText(opponent,760,222,190,36,'#fff','center','900');
  fitText(fmt(enemy),760,290,245,34,'#fff','center','900');
  // simple opponent badge placeholder
  ctx.save();ctx.strokeStyle='#c7c7c7';ctx.lineWidth=3;ctx.beginPath();ctx.arc(935,254,42,0,Math.PI*2);ctx.stroke();ctx.restore();
  fitText(opponent.slice(0,6),935,254,72,17,'#ddd','center','900');

  // Result and margin
  mask(187,341,220,46,'#070b0e');
  text(result,295,362,35,result==='VICTORY'?'#55d30f':'#ff3333','center','900');
  mask(642,343,230,43,'#070b0e');
  fitText(fmt(margin),755,363,220,31,result==='VICTORY'?'#55d30f':'#ffcc29','center','900');

  // Metrics
  const metricY=575;
  mask(48,552,87,55,'#071019'); text(stats.total,91,581,37,'#fff','center','900');
  mask(209,552,102,55,'#071019'); text(stats.stretch,260,581,37,'#fff','center','900');
  mask(375,552,102,55,'#071019'); text(stats.met,426,581,37,'#fff','center','900');
  mask(535,552,102,55,'#071019'); text(stats.below.length,586,581,37,'#fff','center','900');
  mask(699,552,102,55,'#071019'); text(stats.zeros.length,750,581,37,'#fff','center','900');
  mask(864,495,110,112,'#071019');
  text(`${stats.rate.toFixed(0)}%`,919,530,32,'#fff','center','900');
  text(`${stats.active} / ${stats.total}`,919,581,20,'#fff','center','800');

  // Top 10
  const top10=rows.slice(0,10);
  for(let i=0;i<10;i++){
    const y=712+i*46.0;
    mask(128,y-16,335,33,'#061018');
    if(top10[i]){
      fitText(top10[i].name,138,y,245,22,'#fff','left','700');
      fitText(fmt(top10[i].points),465,y,120,20,'#f4b719','right','800');
    }
  }

  // Leadership follow-up: use up to 10 below-min rows with compact spacing.
  mask(516,777,468,196,'#071018');
  const follow=stats.below.slice().sort((a,b)=>b.points-a.points).slice(0,10);
  follow.forEach((r,i)=>{
    const y=792+i*18;
    fitText(r.name,526,y,190,16,'#f2f2f2','left','700');
    fitText(fmt(r.points),820,y,102,16,'#ff3838','right','700');
    fitText(fmt(3600000-r.points),966,y,125,16,'#ffc400','right','700');
  });

  // No participation area. Show unexcused first, then excused.
  mask(520,1014,300,122,'#071018');
  const allZero=[...stats.unexcusedZero.map(r=>({...r,exc:false})),...stats.excusedZero.map(r=>({...r,exc:true}))];
  allZero.slice(0,6).forEach((r,i)=>{
    const y=1043+i*22;
    fitText('• '+r.name,530,y,205,17,r.exc?'#ffd046':'#fff','left','700');
    if(r.exc) text('EXCUSED',792,y,14,'#ffd046','right','900');
  });

  // Leadership notes area
  mask(173,1190,480,136,'#071018');
  let notes=$('leadershipNotes').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  if(!notes.length){
    notes=[
      `${result==='VICTORY'?'LIIT won':'LIIT finished'} by ${fmt(margin)} VS points.`,
      `${stats.rate.toFixed(0)}% of the alliance met the 3.6M participation minimum.`,
      `${stats.below.length} members finished below the 3.6M minimum.`,
      `${stats.unexcusedZero.length} unexcused members recorded zero points.`,
      stats.excusedZero.length?`${stats.excusedZero.length} zero-point member(s) were excused.`:'No zero-point members were marked excused.'
    ];
  }
  notes.slice(0,5).forEach((note,i)=>{
    const y=1210+i*25;
    const color=i===0?'#65d81c':i===1?'#65d81c':i===2?'#ffc52a':i===3?'#ff3a3a':'#2caaf5';
    text(i<2?'✓':i===2?'▲':i===3?'!':'i',157,y,18,color,'center','900');
    fitText(note,180,y,455,18,'#fff','left','600');
  });

  // Bottom quote area, deliberately separate from dynamic data.
  mask(23,1355,665,150,'#071018');
  fitText('A SINGLE WARRIOR MAY LOSE A BATTLE,',355,1402,620,25,'#f2f2f2','center','900');
  fitText('BUT A CLAN OF WARRIORS WINS THE WAR.',355,1438,620,26,'#f4b719','center','900');
  fitText('HONOR  •  LOYALTY  •  VICTORY',355,1481,500,19,'#d7d7d7','center','800');

  $('downloadBtn').disabled=false;
  $('message').textContent=`Rendered ${rows.length} roster rows • ${stats.active}/${stats.total} active • ${stats.rate.toFixed(1)}% participation.`;
}

function download(){
  const day=$('dayNumber').value||'X';
  const date=$('reportDate').value||'date';
  canvas.toBlob(blob=>{
    if(!blob){$('message').textContent='PNG export failed.';return}
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`LIIT_Day_${day}_${date}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  },'image/png');
}

async function readDuel(){
  const file=$('duelScreenshot').files[0];
  if(!file){$('ocrStatus').textContent='Choose a Duel screenshot first.';return}
  if(!window.Tesseract){$('ocrStatus').textContent='OCR library did not load. Use Live Server / GitHub Pages and check internet access.';return}
  $('ocrStatus').textContent='Reading screenshot…';
  try{
    const {data:{text:raw}}=await Tesseract.recognize(file,'eng',{logger:m=>{if(m.status==='recognizing text')$('ocrStatus').textContent=`OCR ${Math.round((m.progress||0)*100)}%`;}});
    const text=raw.replace(/\s+/g,' ');
    // Look for bracketed alliance tags and large score numbers.
    const tags=[...text.matchAll(/\[\s*([A-Za-z0-9]{2,8})\s*\]/g)].map(m=>m[1]);
    const nums=[...text.matchAll(/\b\d{1,3}(?:,\d{3}){2,}\b/g)].map(m=>n(m[0])).filter(v=>v>1000000);
    const opponentTag=tags.find(t=>t.toLowerCase()!=='liit');
    if(opponentTag) $('opponent').value=opponentTag.toUpperCase();
    // Duel screenshot normally presents LIIT first, opponent second; choose two largest in first several values carefully.
    if(nums.length>=2){$('liitScore').value=fmt(nums[0]);$('enemyScore').value=fmt(nums[1]);}
    $('ocrStatus').textContent=`OCR complete. Please verify opponent and both scores before generating.`;
  }catch(err){console.error(err);$('ocrStatus').textContent='OCR failed. Enter the opponent and scores manually.';}
}

function loadDemo(){
  $('reportDate').value='2026-08-05'; $('weekNumber').value=32; $('dayNumber').value=3; syncEvent();
  $('opponent').value='REAR'; $('liitScore').value='805,705,900'; $('enemyScore').value='28,643,976'; $('allianceMembers').value=100; $('excusedMembers').value='Moto a GoGo';
  $('rosterCsv').value=`1,Johntilla the Fun,19718400\n2,OG Cobb,19001300\n3,TangoWhiskeyy,18991350\n4,4tt1cus,17168200\n5,Dubbzz7,16702250\n6,Dr LAZR,14798200\n7,Náțe,14731250\n8,Raeghin,14218250\n9,Oblivion,13752250\n10,oAbaporu,13516550\n11,Redkorn,13428600\n12,Tex2885,13396650\n13,kiki 49,12822300\n14,Lileldy,12677350\n15,Kokrocket,12599800\n16,PeterD63,12193200\n17,Ä B B Ÿ,11747450\n18,RAGS,11383500\n19,Deputydawg255725i4,11081400\n20,B R Y L L E,10838300\n21,MRSDucky615,10821200\n22,JustUneBite,10733250\n23,GooberNoPants,10466050\n24,BuddhaBellie,10407750\n25,Blytheville,10357550\n26,Oba Ogun,10304350\n27,Goldfischy,10270250\n28,Limpet65,10086500\n29,Melopatra,10056450\n30,Czarnn,9940400\n31,ArsSenalDen,9818250\n32,TheBogus,9781100\n33,Plumb Mad,9403300\n34,XXXanderXXII,9229900\n35,dadbod1977,9150450\n36,StingKing61,9100500\n37,SpookyTruffL,9046700\n38,ChickenWingLover,8831120\n39,Ainz Overlord,8781350\n40,Rambo2018,8681750\n41,Watchtheworldburn,8668950\n42,Spakoli69,8620100\n43,beanville,8552800\n44,Mua Dib,8406250\n45,Manut26,8371150\n46,MMV25,8309100\n47,Juvi83,8164150\n48,RRRDDDRRR,8155650\n49,LadyCommando69,8089250\n50,SmittyYewtah,8069400\n51,WreckHold,7965000\n52,Sharyun83,7930400\n53,Dräins TÄBBY,7909730\n54,Valiant Fool,7738500\n55,RockySmurfette,7661200\n56,HurricaneCarma,7635400\n57,IINV18II,7508700\n58,Vyrooka,7401900\n59,LegendairyMoo42,7355400\n60,Rudeass91,7328900\n61,Poobearrr,6936900\n62,CookieDoh,6883450\n63,Arya420,6783900\n64,AlphaBravo2010,6576000\n65,Lincoln navigator,6567100\n66,Irish Bully Squad,6467700\n67,Medo mashak,6328600\n68,HarambesReaver,6190050\n69,Michelecruz,6109100\n70,Vampiresquadron,5985400\n71,MNovember,5919500\n72,vrod1003,5881700\n73,Montanagamer,5597500\n74,LtCatgut,5548750\n75,DemonSlayer0522,5494600\n76,E White,5345500\n77,northern Gaul,5203500\n78,FreePlayAllDay,5072750\n79,deathwish1,4908900\n80,Battlebum,4893700\n81,Riveroflight,4635000\n82,J renee,3998750\n83,SouthMost,3792300\n84,CarnageClaus,3690000\n85,Havoksnpa,3659600\n86,Venoms Carnage,3616500\n87,Bannamu,3393000\n88,Bewblover,3162500\n89,Weemzy,2871000\n90,MoccaMaster,2849100\n91,Dre137,2667450\n92,Cykot,2514000\n93,itsmekaityg,2216750\n94,Dove Zone,1530000\n95,Tucker11978,1368800\n96,btss,1170000\n97,Ducky615,0\n98,Dilly0,0\n99,DjcHaRm23,0\n100,Moto a GoGo,0`;
  render();
}

$('generateBtn').addEventListener('click',render);
$('downloadBtn').addEventListener('click',download);
$('readDuelBtn').addEventListener('click',readDuel);
$('loadDemoBtn').addEventListener('click',loadDemo);

template.onload=()=>{drawTemplate();setTodayDefaults();$('message').textContent='Template loaded. Add roster data or click Load Day 3 Demo.'};
template.onerror=()=>{$('message').textContent='Template failed to load. Make sure template.png is in the same folder and run through Live Server or GitHub Pages.'};
