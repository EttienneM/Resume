/* ── data ────────────────────────────────────────────────── */
let entries = [];

/* ── timeline layout ─────────────────────────────────────── */
const YEAR_START = 1998;
const YEAR_END = 2024;
const YEAR_PX = 150;
const LEFT_PAD = 48;
const CARD_W = () => parseInt(getComputedStyle(document.documentElement).getPropertyValue('--card-w')) || 230;

function monthToX(ym) {
  const [y, m] = ym.split("-").map(Number);
  const frac = y + (m - 1) / 12;
  return LEFT_PAD + (frac - YEAR_START) * YEAR_PX;
}

function fmtRange(start, end) {
  const [ys, ms] = start.split("-").map(Number);
  const [ye, me] = end.split("-").map(Number);
  const MO = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${MO[ms-1]} ${ys} — ${MO[me-1]} ${ye}`;
}

function duration(start, end) {
  const [ys, ms] = start.split("-").map(Number);
  const [ye, me] = end.split("-").map(Number);
  const months = (ye - ys) * 12 + (me - ms);
  const yrs = Math.floor(months / 12);
  const rem = months % 12;
  const parts = [];
  if (yrs) parts.push(`${yrs}y`);
  if (rem) parts.push(`${rem}m`);
  if (!parts.length) parts.push(`${months}m`);
  return parts.join(" ");
}

/* ── render ─────────────────────────────────────────────── */
function renderYears() {
  const grid = document.getElementById('yearGrid');
  grid.innerHTML = '';
  for (let y = YEAR_START; y <= YEAR_END; y++) {
    const x = (y - YEAR_START) * YEAR_PX;
    const el = document.createElement('div');
    el.className = 'year-tick' + (y % 5 === 0 ? ' major' : '');
    el.style.left = x + 'px';
    el.innerHTML = `<span></span><b>${y % 5 === 0 || y === YEAR_END ? y : "'" + String(y).slice(2)}</b>`;
    grid.appendChild(el);
  }
  document.getElementById('track').style.width = (YEAR_END - YEAR_START) * YEAR_PX + LEFT_PAD * 2 + 'px';
}

function renderEntries() {
  const host = document.getElementById('entries');
  const bars = document.getElementById('spineBars');
  host.innerHTML = '';
  bars.innerHTML = '';
  const lanes = { top: [], bot: [] };
  entries.forEach((e, i) => {
    const xStart = monthToX(e.start);
    const xEnd = monthToX(e.end);

    const bar = document.createElement('div');
    bar.className = 'spine-bar';
    bar.dataset.index = i;
    bar.style.left = (xStart - LEFT_PAD) + 'px';
    bar.style.width = (xEnd - xStart) + 'px';
    bars.appendChild(bar);
    const cardW = CARD_W();
    const left = xStart;
    const right = left + cardW;

    let side = i % 2 === 0 ? 'top' : 'bot';
    const overlapsOn = (s) => lanes[s].some(r => !(right < r.left - 8 || left > r.right + 8));
    if (overlapsOn(side)) side = side === 'top' ? 'bot' : 'top';
    if (overlapsOn(side)) side = side === 'top' ? 'bot' : 'top';
    lanes[side].push({ left, right });

    const el = document.createElement('div');
    el.className = 'entry ' + (side === 'top' ? 'entry-top' : 'entry-bot');
    el.style.left = left + 'px';
    el.style.width = cardW + 'px';
    el.dataset.index = i;
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', `${e.title} at ${e.employer}, ${fmtRange(e.start, e.end)}. Press Enter for details.`);
    el.innerHTML = `
      <div class="card">
        <div class="year-chip">${e.start.slice(0,4)} – ${e.end.slice(0,4)} · ${duration(e.start, e.end)}</div>
        <div class="title">${e.title}</div>
        <div class="emp">${e.employer}</div>
        <div class="desc">${e.blurb}</div>
      </div>
      <div class="leader" style="left:0"></div>
      <div class="dot" style="left:0"></div>
    `;
    el.addEventListener('click', () => select(i));
    el.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        select(i);
      }
    });
    host.appendChild(el);
  });
}

/* ── spring-driven scroll (Path 2 overdrive) ───────────── */
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let scrollAnim = null;
function cancelSpring() {
  if (scrollAnim) { cancelAnimationFrame(scrollAnim); scrollAnim = null; }
}
function springScroll(tl, target) {
  cancelSpring();
  const max = Math.max(0, tl.scrollWidth - tl.clientWidth);
  const to = Math.max(0, Math.min(max, target));
  if (reducedMotion) { tl.scrollLeft = to; return; }

  let pos = tl.scrollLeft;
  let vel = 0;
  const stiffness = 170, damping = 22, mass = 1;
  let last = performance.now();

  function step(now) {
    const dt = Math.min(0.032, (now - last) / 1000);
    last = now;
    const spring = -stiffness * (pos - to);
    const damp = -damping * vel;
    vel += ((spring + damp) / mass) * dt;
    pos += vel * dt;
    tl.scrollLeft = pos;
    if (Math.abs(vel) < 0.5 && Math.abs(pos - to) < 0.5) {
      tl.scrollLeft = to;
      scrollAnim = null;
      return;
    }
    scrollAnim = requestAnimationFrame(step);
  }
  scrollAnim = requestAnimationFrame(step);
}

/* ── detail panel ─────────────────────────────────────── */
let currentIdx = -1;
function select(i, { instant = false } = {}) {
  currentIdx = i;
  document.querySelectorAll('.entry').forEach(el =>
    el.classList.toggle('active', Number(el.dataset.index) === i)
  );
  document.querySelectorAll('.spine-bar').forEach(el => {
    const on = Number(el.dataset.index) === i;
    el.classList.toggle('active', on);
    if (on) el.parentElement.appendChild(el);
  });
  const e = entries[i];
  const detail = document.getElementById('detail');
  detail.innerHTML = `
    <div class="detail-side">
      <div class="period">${fmtRange(e.start, e.end)}</div>
      <h2>${e.title}</h2>
      <div class="employer">${e.employer}</div>
      <div class="duration">duration · ${duration(e.start, e.end)}</div>
    </div>
    <div class="detail-body">
      <p class="lead">${e.blurb}</p>
      <ul>${e.bullets.map(b => `<li>${b}</li>`).join('')}</ul>
    </div>
  `;
  detail.classList.remove('appear');
  void detail.offsetWidth;
  detail.classList.add('appear');
  const el = document.querySelector(`.entry[data-index="${i}"]`);
  if (el) {
    const tl = document.getElementById('timeline');
    const elLeft = parseFloat(el.style.left);
    const cardCenter = elLeft + el.offsetWidth / 2;
    const viewCenter = tl.scrollLeft + tl.clientWidth / 2;
    const tolerance = tl.clientWidth * 0.15;
    const target = cardCenter - tl.clientWidth / 2;

    if (instant) {
      tl.scrollLeft = Math.max(0, Math.min(tl.scrollWidth - tl.clientWidth, target));
    } else if (Math.abs(cardCenter - viewCenter) > tolerance) {
      springScroll(tl, target);
    }
  }
}

/* ── drag to scroll ─────────────────────────────────── */
function wireDrag() {
  const tl = document.getElementById('timeline');
  let down = false, sx = 0, sl = 0;
  tl.addEventListener('mousedown', e => {
    if (e.target.closest('.entry')) return;
    cancelSpring();
    down = true; sx = e.pageX; sl = tl.scrollLeft;
    tl.classList.add('dragging');
  });
  window.addEventListener('mouseup', () => { down = false; tl.classList.remove('dragging'); });
  window.addEventListener('mousemove', e => {
    if (!down) return;
    tl.scrollLeft = sl - (e.pageX - sx);
  });
  tl.addEventListener('wheel', e => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { cancelSpring(); return; }
    if (e.shiftKey || Math.abs(e.deltaY) > 0) {
      cancelSpring();
      tl.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }, { passive: false });
  window.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowRight') select(Math.min(entries.length - 1, currentIdx + 1));
    if (e.key === 'ArrowLeft')  select(Math.max(0, currentIdx - 1));
  });
}

/* ── boot ─────────────────────────── */
(async () => {
  try {
    const res = await fetch('entries.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    entries = await res.json();
  } catch (err) {
    console.error('Failed to load entries.json:', err);
    return;
  }
  renderYears();
  renderEntries();
  wireDrag();
  requestAnimationFrame(() => {
    const tl = document.getElementById('timeline');
    tl.scrollLeft = tl.scrollWidth;
  });
})();

/* ── quiet hello for anyone reading the source ─── */
console.log(
  '%c Thanks for reading the source. ',
  'background: #0a0a0a; color: #ffffff; font: 600 13px/1.5 ui-sans-serif, system-ui, sans-serif; padding: 4px 8px;'
);
console.log(
  '%cThe timeline uses a continuous-month axis — every card is placed by its actual start/end dates. Contact details live in the footer.',
  'color: #666; font: 400 12px/1.5 ui-sans-serif, system-ui, sans-serif;'
);
