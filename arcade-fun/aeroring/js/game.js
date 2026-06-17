/* ============ AeroRing — Game Engine (Original Mechanics) ============
   EXACT mechanics from the original prototype:
   - Horizontal lanes (rings come from RIGHT → move LEFT)
   - ↑ ↓ arrow keys  = switch lanes (up/down between lanes)
   - ← → arrow keys  = fine horizontal movement within lane
   - 1..N number keys = instant warp to that lane
   - Rings spawn at RANDOM Y within their lane (not just center)
   - 3 ring types: Hazard ✕ (red), Standard +1 (blue), Bonus +5 (green)
   - Power-ups: Shield SH, Slow SL, Magnet MG
   - 3 lives (hull points)
   - Combo ×2 after 3 consecutive positive rings
   - Wave system with increasing speed
   - EXP bar → Ghost (free movement) or Blast (clear hazards) ability
   - Ship stats from pilot: speed, defense (HP), exp (EXP rate)
================================================================= */
(() => {
'use strict';

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------- star background ---------- */
const bg = $('#bgStars'), bctx = bg.getContext('2d');
let bgStars = [];
function resizeBg() {
  bg.width = innerWidth; bg.height = innerHeight;
  bgStars = Array.from({ length: 150 }, () => ({
    x: Math.random() * bg.width, y: Math.random() * bg.height,
    r: rand(.3, 1.8), s: rand(10, 40), tw: Math.random() * Math.PI * 2
  }));
}
resizeBg(); addEventListener('resize', resizeBg);
(function bgLoop(t) {
  bctx.clearRect(0, 0, bg.width, bg.height);
  for (const st of bgStars) {
    st.x -= st.s * 0.016;
    if (st.x < 0) { st.x = bg.width; st.y = Math.random() * bg.height; }
    const a = 0.25 + 0.55 * Math.abs(Math.sin(t / 1000 + st.tw));
    bctx.fillStyle = `rgba(160,210,255,${a})`;
    bctx.beginPath(); bctx.arc(st.x, st.y, st.r, 0, 7); bctx.fill();
  }
  requestAnimationFrame(bgLoop);
})(0);

/* ---------- navigation ---------- */
let currentScreen = 'loading';
function show(name) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  $('#screen-' + name).classList.add('active');
  currentScreen = name;
  if (name === 'scores') renderScores();
  if (name === 'home') { $('#homeBest').textContent = bestScore(); AudioFX.startMusic(); }
  if (name === 'game') AudioFX.stopMusic();
}
$$('[data-nav]').forEach(b => b.addEventListener('click', () => {
  AudioFX.unlock(); AudioFX.button(); show(b.dataset.nav);
}));

/* ---------- loading ---------- */
const LOAD_STEPS = ['INITIALIZING SYSTEMS…','CALIBRATING LANES…','CHARGING RINGS…','WAKING PILOTS…','READY'];
let lp = 0;
const loadIv = setInterval(() => {
  lp += rand(14, 22);
  $('#loadFill').style.width = Math.min(100, lp) + '%';
  $('#loadText').textContent = LOAD_STEPS[Math.min(LOAD_STEPS.length - 1, Math.floor(lp / 25))];
  if (lp >= 100) { clearInterval(loadIv); setTimeout(() => show('home'), 500); }
}, 220);

/* ---------- audio controls ---------- */
$('#muteBtn').addEventListener('click', () => {
  AudioFX.setMuted(!AudioFX.muted);
  $('#muteBtn').textContent = AudioFX.muted ? '🔇' : '🔊';
});
$('#volSlider').addEventListener('input', e => AudioFX.setVolume(e.target.value / 100));

/* ---------- selection state ---------- */
const sel = { pilot: null, mode: null, lanes: 4, fps: 60, fx: 'high' };

/* ---------- pilot cards ---------- */
function statBars(p) {
  const row = (l, v) =>
    `<div class="stat"><span>${l}</span><span class="bar"><i style="width:${v * 20}%"></i></span></div>`;
  return row('SPEED', p.speed) + row('EXP', p.exp) + row('DEFENSE', p.defense);
}
$('#pilotGrid').innerHTML = PILOTS.map(p => `
  <div class="card" data-pilot="${p.id}" style="color:${p.color}">
    <span class="ship-icon">${p.icon}</span>
    <h3 style="color:${p.color}">${p.name}</h3>
    <div class="role">${p.role}</div>
    <p>${p.desc}</p>
    <div class="stats">${statBars(p)}</div>
    <span class="ability-pill">⚡ ${p.ability}${p.startShield ? ' +🛡' : ''}</span>
  </div>`).join('');
$$('#pilotGrid .card').forEach(c => c.addEventListener('click', () => {
  $$('#pilotGrid .card').forEach(x => x.classList.remove('selected'));
  c.classList.add('selected');
  sel.pilot = PILOTS.find(p => p.id === c.dataset.pilot);
  $('#pilotNext').disabled = false;
  AudioFX.select();
}));

/* ---------- mode cards ---------- */
$('#modeGrid').innerHTML = MODES.map(m => `
  <div class="card" data-mode="${m.id}">
    <span class="ship-icon">${m.icon}</span>
    <h3>${m.name}</h3>
    <p>${m.desc}</p>
  </div>`).join('');
$$('#modeGrid .card').forEach(c => c.addEventListener('click', () => {
  $$('#modeGrid .card').forEach(x => x.classList.remove('selected'));
  c.classList.add('selected');
  sel.mode = MODES.find(m => m.id === c.dataset.mode);
  $('#modeNext').disabled = false;
  AudioFX.select(); updateSummary();
}));

/* ---------- config ---------- */
function segWire(id, key, attr) {
  $$('#' + id + ' button').forEach(b => b.addEventListener('click', () => {
    $$('#' + id + ' button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    sel[key] = key === 'fx' ? b.dataset[attr] : +b.dataset[attr];
    AudioFX.button(); updateSummary();
  }));
}
/* Set default lane button to 4 */
$$('#laneSeg button').forEach(b => b.classList.remove('on'));
const def4 = $('#laneSeg button[data-lanes="4"]');
if (def4) def4.classList.add('on');
segWire('laneSeg', 'lanes', 'lanes');
segWire('fpsSeg',  'fps',   'fps');
segWire('fxSeg',   'fx',    'fx');
function updateSummary() {
  const ab = sel.pilot ? ` • ⚡ ${sel.pilot.ability}` : '';
  $('#configSummary').textContent =
    `${sel.pilot ? sel.pilot.name : '—'} • ${sel.mode ? sel.mode.name : '—'} • ${sel.lanes} LANES • ${sel.fps === 0 ? 'UNCAPPED' : sel.fps + ' FPS'}${ab}`;
}

/* ---------- high scores ---------- */
const LS_KEY = 'aeroring.scores.v3';
function getScores() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; } }
function bestScore() { const s = getScores(); return s.length ? s[0].score : 0; }
function saveScore(entry) {
  const s = getScores(); s.push(entry);
  s.sort((a, b) => b.score - a.score);
  localStorage.setItem(LS_KEY, JSON.stringify(s.slice(0, 10)));
}
function renderScores() {
  const s = getScores();
  $('#scoreList').innerHTML = s.length
    ? s.map((e, i) => `<li><span class="rank">#${i+1}</span><span class="meta">${e.pilot} • ${e.mode} • W${e.wave}</span><span class="pts">${e.score.toLocaleString()}</span></li>`).join('')
    : '<li class="empty">NO FLIGHTS RECORDED YET</li>';
}
$('#clearScores').addEventListener('click', () => { localStorage.removeItem(LS_KEY); renderScores(); AudioFX.button(); });

/* ================================================================
   RING TYPES  (same as original prototype)
   Hazard ✕ red   — damages  weight 2
   Standard +1 blue — scores  weight 3
   Bonus +5 green   — bonus   weight 1
   Power-ups: SH / SL / MG (rare)
================================================================ */
const RING_TYPES = [
  { id:'hazard', col:'#ff2244', label:'\u2715', score:0, w:2, isHazard:true },
  { id:'std',    col:'#00aaff', label:'+1',     score:1, w:3 },
  { id:'bonus',  col:'#00ffaa', label:'+5',     score:5, w:1 },
];
const PU_TYPES = [
  { id:'shield', col:'#66ccff', label:'SH', isPU:true, pu:'shield', w:0.5 },
  { id:'slow',   col:'#bb44ff', label:'SL', isPU:true, pu:'slow',   w:0.5 },
  { id:'magnet', col:'#ffaa00', label:'MG', isPU:true, pu:'magnet', w:0.4 },
];
const ALL_TYPES  = [...RING_TYPES, ...PU_TYPES];
const TOTAL_W    = ALL_TYPES.reduce((a, r) => a + r.w, 0);
function pickRing() {
  let r = Math.random() * TOTAL_W;
  for (const t of ALL_TYPES) { r -= t.w; if (r <= 0) return t; }
  return RING_TYPES[1];
}

/* ================================================================
   GAME CONSTANTS
================================================================ */
const SHIP_R = 14, RING_R = 10;
const MAX_LIVES = 3, INVINCE_F = 1.5, MAX_PU = 8;
const WARP_CD_S = 0.45;    // frames of warp cooldown
const EXP_MAX = 100;   // EXP needed for ability
const CV_W = innerWidth, CV_H = innerHeight;

/* Lane geometry */
function laneH(n) { return cv.height / (n || (G && G.lanes) || sel.lanes); }
function laneY(i, n) { const h = laneH(n); return h * i + h / 2; }

/* ================================================================
   GAME STATE
================================================================ */
const cv = $('#gameCanvas'), ctx = cv.getContext('2d');
let G = null, rafId = null, lastT = 0, acc = 0;

function resizeGame() { cv.width = innerWidth; cv.height = innerHeight; }
addEventListener('resize', resizeGame);

function newGame() {
  resizeGame();
  const p = sel.pilot, m = sel.mode;

  /* Derive ship stats from pilot data */
  const maxHp    = 40 + p.defense * 12;   // 52 (BOLT) → 100 (TITAN)
  const damage   = 32 - p.defense * 4;    // 12 (TITAN) → 28 (BOLT)
  const moveSpd  = 2  + p.speed   * 1.0;  // px per frame
  const expRate  = p.expRate || 1.0;

  const startLane = Math.floor(sel.lanes / 2);
  G = {
    pilot: p, mode: m, lanes: sel.lanes,
    /* ship */
    lane: startLane,              // current lane (0-based)
    shipX: 130,                   // horizontal pos (moves ← →)
    shipY: 0,                     // set below after G is created
    maxHp, hp: maxHp, damage,
    moveSpd, expRate,
    invince: 0,                   // invincibility frames
    shake: 0,
    /* status */
    shield: p.startShield, slowT: 0, magnetT: 0,
    ghostT: 0, bulletTimer: 0, bullets: [],
    /* scoring */
    score: 0, rings: 0,
    combo: 0, comboMult: false,   // ×2 after 3 consecutive
    /* EXP / ability */
    exp: 0, expMax: EXP_MAX, abilityActive: null, abilityTimer: 0,
    /* input */
    keys: {}, warpCd: 0,
    /* wave */
    wave: 1, waveT: 0, waveLen: 20,
    speed: 3.2,                   // ring travel speed (px/frame)
    baseSpeed: 3.2,
    /* RANDOM mode speed shock */
    speedTarget: 3.2, shockT: 0,
    /* spawning */
    spawnTimer: 0,
    /* lane flash [0..lanes-1] */
    laneFlash: Array(sel.lanes).fill(0),
    /* particles + floats */
    parts: [], floats: [],
    /* stars */
    stars: Array.from({ length: sel.fx === 'high' ? 80 : 28 }, () => ({
      x: Math.random() * cv.width, y: Math.random() * cv.height,
      r: rand(.4, 1.8), s: rand(40, 130)
    })),
    /* misc */
    elapsed: 0, over: false, time: 0,
    hitThisWave: false, waveFlawless: 0, _laneCd: 0,
    rings_arr: [],
  };
  G.shipY = laneY(startLane, sel.lanes);  // safe: G now exists
  updateHUD(); renderBuffs();
}

/* ================================================================
   SPAWN
================================================================ */
function spawnInterval() {
  /* scales down as wave increases; random mode adds variation */
  const base = Math.max(28, 90 - G.wave * 5);
  return G.mode.random ? base * rand(0.7, 1.3) : base;
}

function spawnRing() {
  const lane = Math.floor(Math.random() * G.lanes);
  const type = pickRing();
  /* Random Y within the lane (with ring-radius padding) */
  const top = lane * laneH() + RING_R + 4;
  const bot = (lane + 1) * laneH() - RING_R - 4;
  const y   = top + Math.random() * (bot - top);
  /* Flash the lane */
  G.laneFlash[lane] = 1.0;
  G.rings_arr.push({
    ...type,
    x: cv.width + RING_R + 20,
    y,
    lane,
    rot: Math.random() * Math.PI * 2,
    dead: false,
  });
}

/* ================================================================
   PARTICLES / FLOAT TEXT
================================================================ */
function burst(x, y, col, n = 12) {
  if (sel.fx === 'low') n = Math.ceil(n / 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = rand(60, 220);
    G.parts.push({ x, y, vx: Math.cos(a)*v, vy: Math.sin(a)*v - 80,
      life: rand(0.3, 0.7), t: 0, col, r: rand(1.5, 4) });
  }
}
function floatText(x, y, txt, col) {
  G.floats.push({ x, y, txt, col, t: 0, life: 0.85 });
}

/* ================================================================
   COLLECT / HIT
================================================================ */
function collectRing(e) {
  G.rings++;
  let pts = e.score;
  if (G.comboMult && pts > 0) pts *= 2;
  G.score += pts;
  G.combo++;
  if (G.combo >= 3 && !G.comboMult) { G.comboMult = true; floatText(G.shipX, G.shipY - 55, '\u00d72 COMBO!', '#ffcc44'); }
  G.exp = Math.min(G.expMax, G.exp + (e.score >= 5 ? 25 : 8) * G.expRate);
  if (G.exp >= G.expMax && !G.abilityActive) {
    floatText(G.shipX, G.shipY - 70, '\u26a1 ' + G.pilot.ability + ' READY!', '#3dff9e');
  }
  burst(e.x, e.y, e.col, e.score >= 5 ? 16 : 8);
  floatText(e.x, e.y - 14, (G.comboMult && pts > e.score ? '+' + pts + ' \u2726' : '+' + pts), e.col);
  AudioFX.ring(G.combo);
}

function collectPU(e) {
  if (e.pu === 'shield') G.shield = true;
  if (e.pu === 'slow')   G.slowT  = 5.5;
  if (e.pu === 'magnet') G.magnetT = 6.5;
  burst(e.x, e.y, e.col, 16);
  floatText(e.x, e.y - 14, e.label + ' ACTIVATED', e.col);
  AudioFX.powerup(); renderBuffs();
}

function hitHazard(e) {
  /* ghost mode = invulnerable */
  if (G.ghostT > 0) return;
  /* shield blocks one hit */
  if (G.shield) {
    G.shield = false; e.dead = true;
    burst(e.x, e.y, '#66ccff', 20); G.shake = 0.4;
    floatText(G.shipX, G.shipY - 50, '\ud83d\udee1 SHIELD BLOCKED', '#66ccff');
    AudioFX.shieldHit(); renderBuffs();
    G.hitThisWave = true; G.waveFlawless = 0;
    G.combo = 0; G.comboMult = false;
    return;
  }
  if (G.invince > 0) return;
  /* take damage */
  G.hp = Math.max(0, G.hp - G.damage);
  G.invince = INVINCE_F; G.shake = 14;
  G.combo = 0; G.comboMult = false;
  G.exp   = Math.max(0, G.exp - 15);
  G.hitThisWave = true; G.waveFlawless = 0;
  burst(G.shipX, G.shipY, '#ff2244', 22);
  floatText(G.shipX, G.shipY - 50, 'HULL -' + Math.round(G.damage), '#ff2244');
  AudioFX.shieldHit();
  renderBuffs();
  if (G.hp <= 0) endGame();
}

/* ================================================================
   ABILITY
================================================================ */
function useAbility() {
  if (!G || G.over || G.exp < G.expMax || G.abilityActive) return;
  G.exp = 0; G.abilityActive = G.pilot.ability; G.abilityTimer = 600;
  AudioFX.ability();
  if (G.pilot.ability === 'GHOST') {
    floatText(G.shipX, G.shipY - 60, '\ud83d\udc7b GHOST ACTIVE', '#00e5ff');
    burst(G.shipX, G.shipY, '#00e5ff', 22);
  } else {
    /* BLAST: clear all hazards immediately */
    let n = 0;
    for (const r of G.rings_arr) if (r.isHazard && !r.dead) { r.dead = true; burst(r.x, r.y, '#ff4d6d', 14); n++; }
    G.score += n * 15; G.shake = 0.5;
    floatText(G.shipX, G.shipY - 60, '\ud83d\udca5 BLAST! +' + (n * 15), '#ff4d6d');
  }
  updateHUD();
}

/* ================================================================
   WAVE ADVANCE
================================================================ */
function nextWave() {
  if (!G.hitThisWave) {
    G.waveFlawless++;
    const bonus = G.wave * 50 * Math.min(G.waveFlawless, 3);
    G.score += bonus;
    floatText(cv.width / 2, cv.height * 0.42,
      G.waveFlawless >= 3 ? '\ud83c\udf1f FLAWLESS x' + G.waveFlawless + '! +' + bonus : '\u2728 FLAWLESS! +' + bonus,
      '#3dff9e');
  }
  G.hitThisWave = false;
  G.wave++; G.waveT = 0;
  G.speed *= 1 + G.mode.rampSpeed;
  G.baseSpeed = G.speed; G.speedTarget = G.speed;
  floatText(cv.width / 2, cv.height * 0.30, '\ud83c\udf0a WAVE ' + G.wave, '#ff2bd6');
  AudioFX.wave();
}

/* ================================================================
   UPDATE LOOP
================================================================ */
function shipY() { return G.shipY; }

function update(dt) {
  G.time += dt;
  const slow  = G.slowT   > 0 ? 0.55 : 1;
  const p     = G;

  /* cooldowns */
  if (G.warpCd  > 0) G.warpCd  -= dt;
  if (G.invince > 0) G.invince -= dt;
  if (G.shake   > 0) G.shake    = Math.max(0, G.shake - dt * 2.2);
  if (G.slowT   > 0) { G.slowT   -= dt; if (G.slowT   <= 0) renderBuffs(); }
  if (G.magnetT > 0) { G.magnetT -= dt; if (G.magnetT <= 0) renderBuffs(); }
  if (G.ghostT  > 0) G.ghostT  -= dt;
  G.laneFlash   = G.laneFlash.map(f => Math.max(0, f - dt * 1.8));

  /* ability countdown */
  if (G.abilityActive) {
    G.abilityTimer -= dt * 60;
    if (G.abilityTimer <= 0) {
      G.abilityActive = null; G.ghostT = 0;
      floatText(cv.width / 2, cv.height / 2 - 20, 'ABILITY ENDED', '#aaccff');
      AudioFX.wave();
    }
  }

  /* RANDOM mode speed shock */
  if (G.mode.random && G.shockT > 0) {
    G.shockT = Math.max(0, G.shockT - dt);
    if (G.shockT <= 0) G.speedTarget = G.baseSpeed;
    const lr = G.speedTarget > G.speed ? 6 : 4;
    G.speed += (G.speedTarget - G.speed) * Math.min(1, dt * lr);
  }

  /* ──────── CONTROLS ────────
     ↑ ↓  = switch lanes (up/down one lane)
     ← →  = fine horizontal movement within lane
     1..N  = instant warp to lane N (handled in keydown)
  ──────────────────────────── */

  /* Lane switching: NUMBER KEYS ONLY (↑↓ arrows disabled) */
  /* ← → fine horizontal movement within lane */
  const hSpd = (3 + G.moveSpd) * 60 * dt;
  if (G.keys['ArrowLeft']  && G.shipX > SHIP_R + 10)    G.shipX -= hSpd;
  if (G.keys['ArrowRight'] && G.shipX < cv.width * 0.5) G.shipX += hSpd;
  G.shipX = clamp(G.shipX, SHIP_R + 10, cv.width * 0.5);

  /* ↑ ↓ vertical movement WITHIN current lane (not switching lanes) */
  const vSpd = (3 + G.moveSpd) * 60 * dt;
  const laneTop = G.lane * laneH() + SHIP_R + 4;
  const laneBot = (G.lane + 1) * laneH() - SHIP_R - 4;
  if (G.keys['ArrowUp']   && G.shipY > laneTop) G.shipY -= vSpd;
  if (G.keys['ArrowDown'] && G.shipY < laneBot) G.shipY += vSpd;
  G.shipY = clamp(G.shipY, laneTop, laneBot);

  /* ship trail */
  if (sel.fx === 'high' && G.time % 0.04 < dt) {
    G.parts.push({
      x: G.shipX + rand(-4, 4), y: G.shipY + rand(-4, 4),
      vx: rand(-20, -60), vy: rand(-12, 12),
      life: rand(0.1, 0.22), t: 0, col: G.pilot.color, r: rand(1, 2.5)
    });
  }

  /* blast ability: auto-fire bullets */
  if (G.abilityActive === 'BLAST') {
    G.bulletTimer = (G.bulletTimer || 0) + dt;
    if (G.bulletTimer >= 0.18) {
      G.bulletTimer = 0;
      G.bullets.push({ x: G.shipX + 28, y: G.shipY, vy: (Math.random() - 0.5) * 60 });
    }
    const hbSet = new Set();
    G.bullets.forEach((b, bi) => {
      b.x += 600 * dt; b.y += b.vy * dt;
      G.rings_arr.forEach(r => {
        if (r.isHazard && !r.dead && Math.hypot(b.x - r.x, b.y - r.y) < RING_R + 8) {
          r.dead = true; burst(r.x, r.y, '#00ffaa', 10);
          floatText(r.x, r.y - 14, 'CONVERTED +5', '#00ffaa');
          G.score += 5; hbSet.add(bi);
        }
      });
    });
    G.bullets = G.bullets.filter((_, i) => !hbSet.has(i) && G.bullets[i] && G.bullets[i].x < cv.width + 40);
  } else { G.bullets = []; }

  /* waves */
  G.waveT += dt;
  if (G.waveT >= G.waveLen && (G.mode.endless || G.wave < G.mode.maxWave)) nextWave();

  /* spawn */
  G.spawnTimer += dt * 60;
  if (G.spawnTimer >= spawnInterval()) { G.spawnTimer = 0; spawnRing(); }

  /* move rings */
  const rSpd = G.speed * slow * 60 * dt;
  const sx = G.shipX, sy = G.shipY;
  for (const r of G.rings_arr) {
    r.x -= rSpd;
    r.rot += dt * (r.isHazard ? 2.2 : 0.8);
    /* magnet pulls positive rings */
    if (G.magnetT > 0 && !r.isHazard && !r.isPU) {
      const dy = sy - r.y, dist = Math.abs(dy);
      if (dist < 200) r.y += dy * Math.min(1, dt * 7);
    }
    /* collision */
    if (!r.dead && Math.hypot(sx - r.x, sy - r.y) < SHIP_R + RING_R) {
      r.dead = true;
      if (r.isHazard)  { hitHazard(r); if (G.over) return; }
      else if (r.isPU) collectPU(r);
      else             collectRing(r);
      /* RANDOM mode speed shock on every ring touch */
      if (G.mode.random && !G.shockT) {
        const fast = Math.random() < 0.5;
        G.speedTarget = fast ? G.baseSpeed * rand(3.8, 5.6) : G.baseSpeed * rand(0.06, 0.22);
        G.shockT = rand(1.4, 2.8); G.shake = fast ? 0.55 : 0.3;
        floatText(cv.width / 2, cv.height * 0.44, fast ? '\u26a1\u26a1 SPEED SURGE!' : '\u274c DEAD SLOW!', fast ? '#ff4d6d' : '#00e5ff');
        AudioFX.speedShock && AudioFX.speedShock(fast);
      }
    }
    /* ring exits left = break combo */
    if (r.x < -RING_R - 20) {
      r.dead = true;
      if (!r.isHazard && !r.isPU && G.combo > 0) {
        G.combo = 0; G.comboMult = false;
        floatText(sx, sy - 38, 'COMBO LOST', '#8aa0c0');
      }
    }
  }
  G.rings_arr = G.rings_arr.filter(r => !r.dead);

  /* particles / floats */
  G.parts  = G.parts.filter(pt  => { pt.t  += dt; pt.x  += pt.vx  * dt; pt.y  += pt.vy  * dt; pt.vy  += 150 * dt; return pt.t  < pt.life; });
  G.floats = G.floats.filter(f  => { f.t   += dt; f.y   -= 48     * dt;                                             return f.t   < f.life;  });

  /* stars scroll */
  for (const st of G.stars) {
    st.x -= st.s * slow * dt;
    if (st.x < 0) { st.x = cv.width; st.y = Math.random() * cv.height; }
  }

  G.elapsed += dt;
  updateHUD();
}

/* ================================================================
   DRAW
================================================================ */
function draw() {
  ctx.save();
  if (G.shake > 0) ctx.translate(rand(-8, 8) * G.shake * 0.08, rand(-8, 8) * G.shake * 0.08);

  /* bg */
  const grd = ctx.createLinearGradient(0, 0, cv.width, 0);
  grd.addColorStop(0, '#060a1e'); grd.addColorStop(1, '#0a0f2a');
  ctx.fillStyle = grd; ctx.fillRect(-20, -20, cv.width + 40, cv.height + 40);

  /* stars */
  for (const st of G.stars) {
    ctx.fillStyle = 'rgba(140,200,255,.6)'; ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, 7); ctx.fill();
  }

  const lH = laneH();

  /* lane flash */
  G.laneFlash.forEach((f, i) => {
    if (f <= 0) return;
    const match = G.rings_arr.find(r => r.lane === i && !r.dead);
    ctx.fillStyle = (match ? match.col : '#ffffff') + Math.round(f * 22).toString(16).padStart(2, '0');
    ctx.fillRect(0, i * lH, cv.width, lH);
  });

  /* lane dividers — HORIZONTAL lines */
  for (let i = 0; i <= G.lanes; i++) {
    const y = i * lH;
    const isEdge = i === 0 || i === G.lanes;
    if (isEdge) {
      ctx.strokeStyle = 'rgba(0,180,255,.3)'; ctx.lineWidth = 1.5; ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = 'rgba(0,180,255,.1)'; ctx.lineWidth = 1; ctx.setLineDash([10, 16]);
    }
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cv.width, y); ctx.stroke();
  }
  ctx.setLineDash([]);

  /* lane numbers (right edge) */
  ctx.font = '600 11px Orbitron, sans-serif';
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (let i = 0; i < G.lanes; i++) {
    const isCur = i === G.lane;
    ctx.fillStyle = isCur ? 'rgba(0,229,255,.75)' : 'rgba(0,180,255,.2)';
    ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = isCur ? 10 : 0;
    ctx.fillText('LANE ' + (i + 1), cv.width - 10, i * lH + lH / 2);
  }
  ctx.shadowBlur = 0;

  /* active lane highlight */
  ctx.fillStyle = 'rgba(0,180,255,0.04)';
  ctx.fillRect(0, G.lane * lH, cv.width, lH);

  /* entities */
  for (const r of G.rings_arr) {
    ctx.save(); ctx.translate(r.x, r.y);
    if (r.isHazard) {
      /* Red triangle hazard */
      ctx.rotate(r.rot);
      ctx.fillStyle = r.col; ctx.shadowColor = r.col; ctx.shadowBlur = 18;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) { const a = i * 2.094 - Math.PI / 2; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * RING_R, Math.sin(a) * RING_R); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(0, 0, RING_R * 0.3, 0, 7); ctx.fill();
      /* label */
      ctx.font = 'bold 9px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff'; ctx.fillText(r.label, 0, 0);
    } else {
      /* Ring: blue / green / power-up */
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, RING_R * 2.8);
      glow.addColorStop(0, r.col + '44'); glow.addColorStop(1, r.col + '00');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, RING_R * 2.8, 0, 7); ctx.fill();

      ctx.save(); ctx.rotate(r.rot * 0.4);
      ctx.strokeStyle = r.col; ctx.lineWidth = r.isPU ? 2.5 : 3.5;
      ctx.shadowColor = r.col; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(0, 0, RING_R, 0, 7); ctx.stroke();
      /* inner ring */
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.2; ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(0, 0, RING_R - 5, 0, 7); ctx.stroke();
      ctx.restore();

      /* label */
      ctx.font = 'bold 9px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = r.col; ctx.shadowColor = r.col; ctx.shadowBlur = 6;
      ctx.fillText(r.label, 0, 0);
    }
    ctx.restore();
  }

  /* blast bullets */
  if (G.bullets && G.bullets.length) {
    G.bullets.forEach(b => {
      const bg2 = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 8);
      bg2.addColorStop(0, 'rgba(255,220,0,.9)'); bg2.addColorStop(1, 'rgba(255,100,0,0)');
      ctx.fillStyle = bg2; ctx.beginPath(); ctx.arc(b.x, b.y, 8, 0, 7); ctx.fill();
      ctx.strokeStyle = '#ffdd44'; ctx.lineWidth = 2; ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(b.x - 14, b.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.shadowBlur = 0;
    });
  }

  /* SHIP */
  const sx = G.shipX, sy = G.shipY;
  const ghost = G.ghostT > 0;
  ctx.save(); ctx.translate(sx, sy);
  ctx.globalAlpha = ghost ? 0.45 + Math.sin(G.time * 12) * 0.18 : (G.invince > 0 && Math.floor(G.invince * 8) % 2 === 0 ? 0.3 : 1);

  if (ghost) {
    ctx.strokeStyle = `rgba(0,229,255,${0.25 + Math.sin(G.time * 8) * 0.15})`;
    ctx.lineWidth = 2; ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(0, 0, 44 + Math.sin(G.time * 10) * 5, 0, 7); ctx.stroke(); ctx.shadowBlur = 0;
  }
  if (G.shield) {
    ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 2.5; ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 14;
    ctx.globalAlpha = (ctx.globalAlpha * (0.8 + Math.sin(G.time * 8) * 0.2));
    ctx.beginPath(); ctx.arc(0, 0, 36, 0, 7); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.globalAlpha = ghost ? 0.45 + Math.sin(G.time * 12) * 0.18 : 1;
  }

  /* engine flame — colour changes per pilot */
  const flameCol = ghost ? '#00e5ff' : G.pilot.id === 'bolt' ? '#fff44f' : G.pilot.id === 'titan' ? '#3dff9e' : G.pilot.id === 'flux' ? '#ff2bd6' : '#ff9b3d';
  ctx.fillStyle = flameCol; ctx.shadowColor = flameCol; ctx.shadowBlur = 18;
  const fl = 14 + Math.sin(G.time * 30) * 5;
  ctx.beginPath(); ctx.moveTo(-22, -5); ctx.lineTo(-22 - fl, 0); ctx.lineTo(-22, 5); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;

  /* hull — unique shape per pilot */
  const hullCol = G.comboMult ? '#ffcc44' : G.pilot.color;
  ctx.fillStyle = hullCol; ctx.shadowColor = hullCol; ctx.shadowBlur = 22;

  if (G.pilot.id === 'nova') {
    /* NOVA — sleek diamond interceptor */
    ctx.beginPath();
    ctx.moveTo(28, 0);          // sharp nose
    ctx.lineTo(0, -13);         // top edge
    ctx.lineTo(-18, -18);       // top wing tip
    ctx.lineTo(-10, 0);         // back centre
    ctx.lineTo(-18, 18);        // bottom wing tip
    ctx.lineTo(0, 13);          // bottom edge
    ctx.closePath(); ctx.fill();
    /* wing accent */
    ctx.fillStyle = 'rgba(0,229,255,0.35)'; ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.moveTo(-4,-8); ctx.lineTo(-16,-16); ctx.lineTo(-10,0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-4,8);  ctx.lineTo(-16,16);  ctx.lineTo(-10,0); ctx.closePath(); ctx.fill();

  } else if (G.pilot.id === 'bolt') {
    /* BOLT — ultra-thin razor speedster */
    ctx.beginPath();
    ctx.moveTo(34, 0);          // very sharp nose
    ctx.lineTo(4, -7);
    ctx.lineTo(-20, -10);       // thin swept wings
    ctx.lineTo(-14, 0);
    ctx.lineTo(-20, 10);
    ctx.lineTo(4, 7);
    ctx.closePath(); ctx.fill();
    /* speed stripes */
    ctx.strokeStyle = 'rgba(255,244,79,0.5)'; ctx.lineWidth = 1.5; ctx.shadowBlur = 0;
    for (let s = 0; s < 3; s++) {
      const ox = -4 - s * 6;
      ctx.beginPath(); ctx.moveTo(ox, -4 + s); ctx.lineTo(ox - 8, 0); ctx.lineTo(ox, 4 - s); ctx.stroke();
    }

  } else if (G.pilot.id === 'titan') {
    /* TITAN — wide heavy fortress */
    ctx.beginPath();
    ctx.moveTo(22, 0);          // blunt nose
    ctx.lineTo(10, -10);
    ctx.lineTo(-8, -22);        // wide wings
    ctx.lineTo(-18, -18);
    ctx.lineTo(-14, 0);
    ctx.lineTo(-18, 18);
    ctx.lineTo(-8, 22);
    ctx.lineTo(10, 10);
    ctx.closePath(); ctx.fill();
    /* armour plates */
    ctx.fillStyle = 'rgba(61,255,158,0.28)'; ctx.shadowBlur = 0;
    ctx.fillRect(-14, -6, 24, 12);
    ctx.strokeStyle = hullCol; ctx.lineWidth = 1.5;
    ctx.strokeRect(-14, -6, 24, 12);

  } else if (G.pilot.id === 'flux') {
    /* FLUX — twin-boom exotic shape */
    ctx.beginPath();
    ctx.moveTo(26, 0);
    ctx.lineTo(8, -6);
    ctx.lineTo(-6, -14);        // top boom
    ctx.lineTo(-20, -14);
    ctx.lineTo(-16, 0);
    ctx.lineTo(-20, 14);
    ctx.lineTo(-6, 14);         // bottom boom
    ctx.lineTo(8, 6);
    ctx.closePath(); ctx.fill();
    /* EXP glow pulse between booms */
    const pulse = 0.2 + Math.sin(G.time * 6) * 0.15;
    ctx.fillStyle = `rgba(255,43,214,${pulse})`; ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2); ctx.fill();

  } else {
    /* fallback */
    ctx.beginPath();
    ctx.moveTo(28, 0); ctx.lineTo(-14, -16); ctx.lineTo(-6, 0); ctx.lineTo(-14, 16);
    ctx.closePath(); ctx.fill();
  }

  /* cockpit window — position varies by pilot */
  const cpX = G.pilot.id === 'titan' ? 6 : G.pilot.id === 'bolt' ? 12 : 10;
  ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.arc(cpX, 0, G.pilot.id === 'titan' ? 6 : 4.5, 0, 7); ctx.fill();
  /* cockpit tint */
  ctx.fillStyle = G.pilot.color + '66';
  ctx.beginPath(); ctx.arc(cpX, 0, G.pilot.id === 'titan' ? 4 : 3, 0, 7); ctx.fill();

  /* warp cooldown arc */
  if (G.warpCd > 0) {
    const pct = G.warpCd / WARP_CD_S;
    ctx.strokeStyle = '#ff4466'; ctx.lineWidth = 2.5; ctx.shadowColor = '#ff4466'; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(0, 0, SHIP_R + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - pct)); ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.restore();

  /* magnet field */
  if (G.magnetT > 0) {
    ctx.strokeStyle = `rgba(255,43,214,${0.18 + Math.sin(G.time * 5) * 0.07})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sx, sy, 90 + Math.sin(G.time * 5) * 8, 0, 7); ctx.stroke();
  }

  /* particles */
  for (const pt of G.parts) {
    ctx.globalAlpha = Math.max(0, 1 - pt.t / pt.life);
    ctx.fillStyle = pt.col; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;

  /* float texts */
  ctx.textAlign = 'center'; ctx.font = '700 14px Orbitron, sans-serif';
  for (const f of G.floats) {
    ctx.globalAlpha = Math.max(0, 1 - f.t / f.life);
    ctx.fillStyle = f.col; ctx.shadowColor = f.col; ctx.shadowBlur = 10;
    ctx.fillText(f.txt, f.x, f.y);
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;

  /* combo banner */
  if (G.comboMult) {
    ctx.font = 'bold 12px Orbitron, sans-serif'; ctx.textAlign = 'left';
    ctx.fillStyle = '#ffcc44'; ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 10;
    ctx.fillText('\u00d72 COMBO ACTIVE', 16, 32); ctx.shadowBlur = 0;
  }

  /* ghost timer */
  if (G.ghostT > 0) {
    ctx.font = 'bold 11px Orbitron, sans-serif'; ctx.textAlign = 'left';
    ctx.fillStyle = '#00e5ff'; ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 8;
    ctx.fillText('\ud83d\udc7b GHOST ' + G.ghostT.toFixed(1) + 's', 16, 52); ctx.shadowBlur = 0;
  }

  /* RANDOM mode speed bar */
  if (G.mode.random) {
    const ratio = clamp(G.speed / (G.baseSpeed * 5.6), 0, 1);
    const bW = cv.width * 0.3, bX = (cv.width - bW) / 2, bY = cv.height - 12;
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(bX - 2, bY - 5, bW + 4, 10);
    const hue = 220 - ratio * 220;
    ctx.fillStyle = `hsl(${hue},100%,55%)`; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
    ctx.fillRect(bX, bY - 3, bW * ratio, 6); ctx.shadowBlur = 0;
    ctx.font = '600 8px Orbitron,sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillText('SPEED', cv.width / 2, bY + 10);
  }

  ctx.restore();
}

/* ================================================================
   HUD
================================================================ */
function updateHUD() {
  $('#hudScore').textContent  = Math.floor(G.score).toLocaleString();
  $('#hudCombo').textContent  = G.comboMult ? '\u00d72 (' + G.combo + ')' : 'x1 (' + G.combo + ')';
  $('#hudWave').textContent   = G.wave;
  /* HP bar via EXP bar area — repurposed: show HP% */
  const hpPct = (G.hp / G.maxHp) * 100;
  const expPct = (G.exp / G.expMax) * 100;
  const hpEl = document.getElementById('expFill');
  if (hpEl) {
    hpEl.style.width = expPct + '%';
    if (G.exp >= G.expMax || G.abilityActive) {
      /* Full — pulsing gold glow */
      const pulse = 0.5 + 0.5 * Math.abs(Math.sin(G.time * 5));
      hpEl.style.background = `linear-gradient(90deg, #ffcc00, #fff44f)`;
      hpEl.style.boxShadow  = `0 0 ${8 + pulse * 14}px #ffcc00, 0 0 ${4 + pulse * 8}px #fff`;
      hpEl.style.filter     = `brightness(${1.1 + pulse * 0.4})`;
    } else {
      hpEl.style.background = 'linear-gradient(90deg, #3dff9e, #00e5ff)';
      hpEl.style.boxShadow  = '';
      hpEl.style.filter     = '';
    }
  }
  const tag = document.getElementById('abilityTag');
  if (tag) {
    if (G.abilityActive) {
      tag.textContent = '\u26a1 ' + G.abilityActive + ' ' + Math.ceil(G.abilityTimer / 60) + 's';
      tag.classList.add('ready');
    } else if (G.exp >= G.expMax) {
      tag.textContent = '\u26a1 ' + G.pilot.ability + ' READY!';
      tag.classList.add('ready');
      tag.style.animation = 'pulse 0.5s infinite';
    } else {
      tag.textContent = 'EXP ' + Math.floor(G.exp) + '/100';
      tag.classList.remove('ready');
      tag.style.animation = '';
    }
  }
}
function renderBuffs() {
  let h = '';
  if (G.shield)    h += '<span class="buff">\ud83d\udee1</span>';
  if (G.slowT > 0) h += `<span class="buff">\ud83d\udc0c ${G.slowT.toFixed(1)}s</span>`;
  if (G.magnetT>0) h += `<span class="buff">\ud83e\uddf2 ${G.magnetT.toFixed(1)}s</span>`;
  /* HP dots */
  const dots = Math.ceil((G.hp / G.maxHp) * 3);
  h += '<span class="buff" title="Hull">' + ['\u25c8','\u25c8','\u25c8'].map((d,i)=>`<span style="opacity:${i<dots?1:.15}">${d}</span>`).join('') + '</span>';
  $('#buffRow').innerHTML = h;
}

/* ================================================================
   GAME LOOP
================================================================ */
function loop(t) {
  rafId = requestAnimationFrame(loop);
  const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
  if (sel.fps > 0) {
    acc += dt; const step = 1 / sel.fps;
    if (acc < step) return;
    while (acc >= step) { update(step); acc -= step; if (G.over) break; }
  } else update(dt);
  if (!G.over) draw();
}

function startGame() {
  newGame(); show('game'); AudioFX.launch();
  lastT = performance.now(); acc = 0;
  cancelAnimationFrame(rafId); rafId = requestAnimationFrame(loop);
}
function pauseGame() {
  if (!G || G.over) return;
  cancelAnimationFrame(rafId);
  $('#overlay-pause').classList.add('active');
}
function resumeGame() {
  $('#overlay-pause').classList.remove('active');
  lastT = performance.now(); rafId = requestAnimationFrame(loop);
}
function endGame() {
  G.over = true; cancelAnimationFrame(rafId);
  AudioFX.stopMusic(); AudioFX.gameOver();
  burst(G.shipX, G.shipY, G.pilot.color, 50);
  burst(G.shipX, G.shipY, '#ff4d6d', 30);
  draw();
  const score = Math.floor(G.score), isRecord = score > bestScore() && score > 0;
  saveScore({ score, pilot: G.pilot.name, mode: G.mode.name, wave: G.wave, date: Date.now() });
  setTimeout(() => {
    $('#goScore').textContent = score.toLocaleString();
    $('#goCombo').textContent = 'x' + (G.comboMult ? '2' : '1') + ' (' + G.combo + ')';
    $('#goWave').textContent  = G.wave;
    $('#goRings').textContent = G.rings;
    $('#newRecord').classList.toggle('hidden', !isRecord);
    if (isRecord) AudioFX.record();
    show('gameover');
  }, 900);
}

$('#startBtn').addEventListener('click',  () => { if (sel.pilot && sel.mode) startGame(); });
$('#pauseBtn').addEventListener('click',  pauseGame);
$('#resumeBtn').addEventListener('click', () => { AudioFX.button(); resumeGame(); });
$('#restartBtn').addEventListener('click',() => { $('#overlay-pause').classList.remove('active'); startGame(); });
$('#quitBtn').addEventListener('click',   () => { $('#overlay-pause').classList.remove('active'); AudioFX.stopMusic(); show('home'); });
$('#goRetry').addEventListener('click',   startGame);

/* ================================================================
   INPUT
================================================================ */
addEventListener('keydown', e => {
  if (currentScreen !== 'game') return;
  if (G && !G.over) G.keys[e.key] = true;

  /* arrow keys — prevent scroll */
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();

  if (e.code === 'Space') useAbility();
  else if (e.code === 'KeyP' || e.code === 'Escape') {
    $('#overlay-pause').classList.contains('active') ? resumeGame() : pauseGame();
  }
  /* Number keys 1-9 → instant lane warp */
  else if (e.code.startsWith('Digit')) {
    const n = parseInt(e.key);
    if (n >= 1 && n <= 9 && G && !G.over) {
      const idx = clamp(n - 1, 0, G.lanes - 1);
      if (idx !== G.lane && G.warpCd <= 0) {
        G.lane = idx; G.shipY = laneY(idx);
        G.warpCd = WARP_CD_S;
        AudioFX.select && AudioFX.select();
      }
    }
  }
});
addEventListener('keyup', e => { if (G) delete G.keys[e.key]; });

/* touch zones: left/right = change lane, centre = ability */
$('#touchLeft').addEventListener('pointerdown',    () => { if (G && !G.over && G.lane > 0 && G.warpCd <= 0) { G.lane--; G.shipY = laneY(G.lane); G.warpCd = WARP_CD_S; } });
$('#touchRight').addEventListener('pointerdown',   () => { if (G && !G.over && G.lane < G.lanes - 1 && G.warpCd <= 0) { G.lane++; G.shipY = laneY(G.lane); G.warpCd = WARP_CD_S; } });
$('#touchAbility').addEventListener('pointerdown', useAbility);

})();

