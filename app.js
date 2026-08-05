
const canvas = document.getElementById('reportCanvas');
const ctx = canvas.getContext('2d');
const template = new Image();
template.src = 'template.png';

const $ = id => document.getElementById(id);
const fmt = n => Number(n || 0).toLocaleString('en-US');
const compact = n => `${(Number(n || 0) / 1_000_000).toFixed(2)}M`;
const pct = (a,b) => b ? `${(a / b * 100).toFixed(1)}%` : '0.0%';

function parseRankings(text) {
  const rows = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const match = line.match(/^(.*?)[,\t]\s*([\d,]+)\s*$/);
    if (!match) continue;
    rows.push({
      name: match[1].trim(),
      points: Number(match[2].replace(/,/g,'')) || 0
    });
  }
  return rows.sort((a,b) => b.points - a.points);
}

function drawText(text, x, y, size, color='#eee', align='left', weight='600') {
  ctx.save();
  ctx.font = `${weight} ${size}px Arial`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(String(text), x, y);
  ctx.restore();
}

function cover(x,y,w,h,alpha=0.96) {
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.fillRect(x,y,w,h);
  ctx.restore();
}

function calculate() {
  const rows = parseRankings($('rankings').value);
  const totalMembers = Number($('totalMembers').value) || rows.length;
  const excused = new Set($('excused').value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean));

  const stretch = rows.filter(r => r.points >= 7_200_000);
  const met = rows.filter(r => r.points >= 3_600_000 && r.points < 7_200_000);
  const below = rows.filter(r => r.points > 0 && r.points < 3_600_000);
  const zero = rows.filter(r => r.points === 0);
  const participating = stretch.length + met.length;

  return { rows, totalMembers, excused, stretch, met, below, zero, participating };
}

function drawReport() {
  const d = calculate();
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(template,0,0,1024,1536);

  // Dynamic header data
  cover(345,363,170,62); // event
  cover(548,363,160,62); // week/day
  cover(755,363,210,62); // date
  drawText($('event').value.toUpperCase(), 430, 402, 20, '#eeeeee', 'center', '700');
  drawText(`WEEK ${$('week').value} • DAY ${$('day').value}`, 628, 397, 18, '#eeeeee', 'center', '600');
  drawText($('date').value.toUpperCase(), 860, 397, 18, '#eeeeee', 'center', '600');

  // Match totals
  cover(305,469,420,145);
  drawText('VICTORY', 377, 485, 25, '#4fae19', 'center', '800');
  drawText('[LIIT]', 377, 523, 21, '#c9c9c9', 'center', '700');
  drawText(compact($('allianceTotal').value), 377, 560, 41, '#4fae19', 'center', '800');
  drawText('VS POINTS TODAY', 377, 598, 16, '#d8d8d8', 'center', '500');
  drawText('VS', 512, 535, 46, '#e4b537', 'center', '900');
  drawText('DEFEAT', 647, 485, 25, '#ce1f1f', 'center', '800');
  drawText(`[${$('opponentTag').value}]`, 647, 523, 21, '#c9c9c9', 'center', '700');
  drawText(compact($('opponentTotal').value), 647, 560, 41, '#ce1f1f', 'center', '800');
  drawText('VS POINTS TODAY', 647, 598, 16, '#d8d8d8', 'center', '500');

  cover(740,468,250,145);
  drawText('ALLIANCE TOTAL VS', 865, 490, 18, '#bdbdbd', 'center', '600');
  drawText(compact($('allianceTotal').value), 865, 550, 44, '#d89f16', 'center', '800');

  // Metric values
  const metrics = [
    {x:161, count:`${d.participating} / ${d.totalMembers}`, percentage:pct(d.participating,d.totalMembers)},
    {x:344, count:d.stretch.length, percentage:pct(d.stretch.length,d.totalMembers)},
    {x:529, count:d.met.length, percentage:pct(d.met.length,d.totalMembers)},
    {x:712, count:d.below.length, percentage:pct(d.below.length,d.totalMembers)},
    {x:908, count:d.zero.length, percentage:pct(d.zero.length,d.totalMembers)}
  ];
  for (const m of metrics) {
    cover(m.x-76,748,m.x===161?155:150,112);
    drawText(m.count,m.x,780,38,'#eeeeee','center','800');
    drawText(m.x===161?'PARTICIPATION':'MEMBERS',m.x,819,15,'#dddddd','center','500');
    drawText(m.percentage,m.x,849,19,'#eeeeee','center','600');
  }

  cover(600,884,270,45);
  drawText(`${d.stretch.length} / ${d.totalMembers} (${pct(d.stretch.length,d.totalMembers)})`,735,907,29,'#a9a9a9','center','700');

  // Top 10
  cover(74,983,377,352);
  const top10 = d.rows.slice(0,10);
  top10.forEach((r,i) => {
    const y = 1002 + i*35;
    drawText(i+1,49,y,15,'#111','center','800');
    drawText(r.name,82,y,18,'#eeeeee','left','500');
    drawText(fmt(r.points),447,y,17,'#eeeeee','right','500');
  });

  // Leadership follow-up
  cover(535,1050,440,290);
  const follow = [...d.below, ...d.zero].sort((a,b)=>b.points-a.points);
  const maxRows = 8;
  follow.slice(0,maxRows).forEach((r,i) => {
    const y = 1070 + i*35;
    const needed = Math.max(0,3_600_000-r.points);
    const isExcused = d.excused.has(r.name.toLowerCase());
    drawText(isExcused?'🏖':'⚠',519,y,15,isExcused?'#1aa3ff':'#e32020','center','700');
    drawText(r.name,552,y,17,'#eeeeee','left','500');
    drawText(fmt(r.points),790,y,16,'#eeeeee','center','500');
    drawText(isExcused?'EXCUSED':fmt(needed),940,y,16,isExcused?'#1aa3ff':'#e8b000','right','500');
  });

  cover(548,1334,290,34);
  const excusedBelow = follow.filter(r => d.excused.has(r.name.toLowerCase()));
  drawText(excusedBelow.length ? excusedBelow.map(r=>r.name).join(', ') : 'None',552,1352,15,'#eeeeee','left','500');

  const found = d.rows.length;
  const notes = [];
  notes.push(`<span class="${found === d.totalMembers ? 'ok':'warn'}">Parsed ${found} ranking rows; roster set to ${d.totalMembers}.</span>`);
  notes.push(`Participation: ${d.participating}/${d.totalMembers} (${pct(d.participating,d.totalMembers)}).`);
  notes.push(`Stretch ${d.stretch.length} • Met minimum ${d.met.length} • Below ${d.below.length} • Zero ${d.zero.length}.`);
  $('validation').innerHTML = notes.join('<br>');
}

template.onload = drawReport;
$('generateBtn').addEventListener('click', drawReport);
$('downloadBtn').addEventListener('click', () => {
  drawReport();
  const link = document.createElement('a');
  link.download = `LIIT-${$('date').value.replace(/\s+/g,'-')}-Daily-VS-Report.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
});

$('screenshots').addEventListener('change', e => {
  const grid = $('previewGrid');
  grid.innerHTML = '';
  [...e.target.files].forEach(file => {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    grid.appendChild(img);
  });
});

$('loadWednesdayBtn').addEventListener('click', () => {
  $('date').value='July 22, 2026';
  $('week').value='30';
  $('day').value='3';
  $('event').value='Age of Science';
  $('opponentTag').value='MARv';
  $('opponentTotal').value='310168257';
  $('allianceTotal').value='821832368';
  $('totalMembers').value='99';
  drawReport();
});
