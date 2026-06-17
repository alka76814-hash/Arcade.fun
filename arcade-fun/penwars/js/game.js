/* ============ PEN FIGHT 3D — Engine ============ */
(() => {
'use strict';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ── mode helpers ────────────────────────────────────────── */
const isCPU = () => sel.mode === 'cpu';
const is2P  = () => sel.mode === 'friend' && sel.playerCount === 2;
const isKoH = () => sel.mode === 'friend' && sel.playerCount > 2;

/* ── navigation ──────────────────────────────────────────── */
let currentScreen = 'loading';
function show(name) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  $('#screen-' + name).classList.add('active');
  currentScreen = name;
  if (name === 'records') renderRecords();
}
$$('[data-nav]').forEach(b => b.addEventListener('click', () => {
  AudioFX.unlock(); AudioFX.button(); show(b.dataset.nav);
}));

/* ── loading ─────────────────────────────────────────────── */
const STEPS = ['SHARPENING PENS…','POLISHING THE BENCH…','WARMING UP THE WRIST…','READY TO FLICK!'];
let lp = 0;
const li = setInterval(() => {
  lp += rand(14, 26);
  $('#loadFill').style.width = Math.min(100, lp) + '%';
  $('#loadText').textContent = STEPS[Math.min(STEPS.length - 1, Math.floor(lp / 26))];
  if (lp >= 100) { clearInterval(li); setTimeout(() => show('home'), 420); }
}, 230);

/* ── audio UI ────────────────────────────────────────────── */
$('#muteBtn').addEventListener('click', () => {
  AudioFX.setMuted(!AudioFX.muted);
  $('#muteBtn').textContent = AudioFX.muted ? '🔇' : '🔊';
});
$('#volSlider').addEventListener('input', e => AudioFX.setVolume(e.target.value / 100));

/* ── selection state ─────────────────────────────────────── */
const sel = {
  mode: null,
  playerCount: 2,
  players: [],          // [{name, pen}] for every human player
  p1Pen: null, p2Pen: null,   // compat refs (CPU & 2P)
  rounds: 3, bench: 'medium', ai: 'medium',
  targetWins: 3         // multiplayer win target
};
let setupIdx = 0;
let pendingPen = null;

/* ── mode selection ──────────────────────────────────────── */
$$('[data-pick-mode]').forEach(c => c.addEventListener('click', () => {
  sel.mode = c.dataset.pickMode;
  AudioFX.select();
  if (sel.mode === 'friend') {
    /* re-highlight previously chosen count */
    $$('.pc-btn').forEach(b => b.classList.toggle('selected', +b.dataset.count === sel.playerCount));
    show('playercount');
  } else {
    /* CPU: single player setup */
    sel.playerCount = 2;
    sel.players = [];
    setupIdx = 0;
    showPlayerSetup(0);
  }
}));

/* ── player count screen ─────────────────────────────────── */
$$('.pc-btn').forEach(b => b.addEventListener('click', () => {
  sel.playerCount = +b.dataset.count;
  sel.players = [];
  setupIdx = 0;
  $$('.pc-btn').forEach(x => x.classList.remove('selected'));
  b.classList.add('selected');
  AudioFX.select();
  setTimeout(() => showPlayerSetup(0), 160);
}));

/* ── player setup (name + pen) ───────────────────────────── */
function showPlayerSetup(idx) {
  setupIdx = idx;
  const total = isCPU() ? 1 : sel.playerCount;
  const num   = idx + 1;

  /* title */
  $('#penTitle').textContent = total === 1
    ? 'CHOOSE YOUR PEN'
    : `PLAYER ${num} OF ${total} — CHOOSE YOUR PEN`;

  /* name input */
  const ni = $('#playerNameInput');
  ni.value = sel.players[idx]?.name || (isCPU() ? 'PLAYER 1' : `PLAYER ${num}`);
  ni.placeholder = isCPU() ? 'YOUR NAME' : `PLAYER ${num}'S NAME`;

  /* pips: only friend mode 3+ players */
  const pipsEl = $('#setupPips');
  if (sel.mode === 'friend' && total > 2) {
    pipsEl.innerHTML = Array.from({length: total}, (_, i) =>
      `<span class="pip ${i < idx ? 'done' : i === idx ? 'active' : ''}"></span>`
    ).join('');
    pipsEl.style.display = 'flex';
  } else {
    pipsEl.style.display = 'none';
  }

  /* restore previous pen selection for this player */
  pendingPen = sel.players[idx]?.pen || null;
  $$('#penGrid .card').forEach(c =>
    c.classList.toggle('selected', !!pendingPen && pendingPen.id === c.dataset.pen)
  );

  /* next button */
  const isLast = isCPU() || idx === sel.playerCount - 1;
  $('#penNext').textContent = (sel.mode === 'friend' && !isLast) ? 'NEXT PLAYER ▶' : 'NEXT ▶';
  $('#penNext').disabled = !pendingPen;

  show('pens');
}

/* pen grid — built once */
function statBars(p) {
  const row = (l, v) =>
    `<div class="stat"><span>${l}</span><span class="bar"><i style="width:${clamp(v/2*100,10,100)}%"></i></span></div>`;
  return row('WEIGHT', p.mass) + row('POWER', p.power) + row('GRIP', p.grip);
}
$('#penGrid').innerHTML = PENS.map(p => `
  <div class="card" data-pen="${p.id}">
    <span class="pen-icon">${p.icon}</span>
    <h3>${p.name}</h3>
    <div class="role">${p.role}</div>
    <p>${p.desc}</p>
    <div class="stats">${statBars(p)}</div>
  </div>`).join('');

$$('#penGrid .card').forEach(c => c.addEventListener('click', () => {
  $$('#penGrid .card').forEach(x => x.classList.remove('selected'));
  c.classList.add('selected');
  pendingPen = PENS.find(p => p.id === c.dataset.pen);
  $('#penNext').disabled = false;
  AudioFX.select();
}));

/* Enter key on name input → click NEXT */
$('#playerNameInput').addEventListener('keypress', e => {
  if (e.key === 'Enter' && !$('#penNext').disabled) $('#penNext').click();
});

$('#penNext').addEventListener('click', () => {
  if (!pendingPen) return;
  AudioFX.button();

  const nameVal = ($('#playerNameInput').value.trim() || `PLAYER ${setupIdx + 1}`)
    .toUpperCase().substring(0, 14);

  /* save/update this player's entry */
  if (setupIdx < sel.players.length) sel.players[setupIdx] = { name: nameVal, pen: pendingPen };
  else                                sel.players.push({ name: nameVal, pen: pendingPen });

  if (isCPU()) {
    sel.p1Pen = pendingPen;
    sel.p2Pen = PENS[Math.floor(Math.random() * PENS.length)];
    enterConfig();
    return;
  }

  if (setupIdx + 1 < sel.playerCount) {
    /* more players to set up */
    setupIdx++;
    pendingPen = null;
    showPlayerSetup(setupIdx);
  } else {
    enterConfig();
  }
});

$('#penBack').addEventListener('click', () => {
  AudioFX.button();
  if (isCPU()) { show('mode'); return; }
  if (setupIdx === 0) {
    $$('.pc-btn').forEach(b => b.classList.toggle('selected', +b.dataset.count === sel.playerCount));
    show('playercount');
    return;
  }
  setupIdx--;
  showPlayerSetup(setupIdx);
});

/* ── config ──────────────────────────────────────────────── */
function enterConfig() {
  /* sync compat refs */
  if (sel.mode === 'friend') {
    sel.p1Pen = sel.players[0]?.pen || sel.p1Pen;
    sel.p2Pen = sel.players[1]?.pen || sel.p2Pen;
  }
  const multi = isKoH();
  $('#roundRow').style.display     = multi ? 'none' : 'flex';
  $('#targetWinRow').style.display = multi ? 'flex' : 'none';
  $('#aiRow').style.display        = isCPU() ? 'flex' : 'none';
  updateSummary();
  show('config');
}

$('#configBack').addEventListener('click', () => {
  AudioFX.button();
  setupIdx = isCPU() ? 0 : sel.playerCount - 1;
  showPlayerSetup(setupIdx);
});

function segWire(id, key, attr) {
  $$('#' + id + ' button').forEach(b => b.addEventListener('click', () => {
    $$('#' + id + ' button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    const numKeys = ['rounds', 'targetWins'];
    sel[key] = numKeys.includes(key) ? +b.dataset[attr] : b.dataset[attr];
    AudioFX.button(); updateSummary();
  }));
}
segWire('roundSeg',     'rounds',     'rounds');
segWire('benchSeg',     'bench',      'bench');
segWire('aiSeg',        'ai',         'ai');
segWire('targetWinSeg', 'targetWins', 'tw');

function updateSummary() {
  let txt;
  if (isCPU()) {
    txt = `${sel.players[0]?.name || 'YOU'} (${sel.p1Pen?.name || '?'}) VS COMPUTER (${sel.p2Pen?.name || '?'}) • ${BENCHES[sel.bench].label} • BEST OF ${sel.rounds}`;
  } else if (is2P()) {
    const n0 = sel.players[0]?.name || 'P1', n1 = sel.players[1]?.name || 'P2';
    const p0 = sel.players[0]?.pen?.name || '?', p1 = sel.players[1]?.pen?.name || '?';
    txt = `${n0} (${p0}) VS ${n1} (${p1}) • ${BENCHES[sel.bench].label} • BEST OF ${sel.rounds}`;
  } else {
    const names = sel.players.map(p => p.name).join(', ');
    txt = `${sel.playerCount}-PLAYER BATTLE ROYALE • ${names} • ${BENCHES[sel.bench].label} • FIRST TO ${sel.targetWins}`;
  }
  $('#configSummary').textContent = txt;
}

/* ── records ─────────────────────────────────────────────── */
const LS_KEY = 'penfight.records.v1';
function getRecords() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; } }
function addRecord(r) {
  const a = getRecords(); a.unshift(r);
  localStorage.setItem(LS_KEY, JSON.stringify(a.slice(0, 15)));
}
function renderRecords() {
  const a = getRecords();
  $('#recordList').innerHTML = a.length
    ? a.map(r => `<li><span class="who">${r.winner} 🏆</span><span class="meta">${r.score} • ${r.mode} • ${r.pens}</span></li>`).join('')
    : '<li class="empty">NO FIGHTS RECORDED YET</li>';
}
$('#clearRecords').addEventListener('click', () => { localStorage.removeItem(LS_KEY); renderRecords(); AudioFX.button(); });

/* ============================================================
   3D WORLD
============================================================ */
const PEN_LEN = 1.7, PEN_R = 0.085;
let renderer, scene, camera, benchMesh, aimArrow, dirLight;
let threeReady = false;

const TRAJ_COUNT = 9;
let trajDots = [];
const chalkPool = [];
let edgeRings = [];
let camFocus = { x: 0, z: 0 };
let edgeWarnFired = [false, false];
const EDGE_COLORS = [0x7ec8ff, 0xff6b6b, 0xffd95e, 0xa0e87a, 0xdd88ff, 0xffbb66, 0xf3efe2, 0x88ffaa];

function addEdgeRing(color) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.046, 8, 28),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);
  edgeRings.push(ring);
  edgeWarnFired.push(false);
  return ring;
}

function ensureEdgeRing(i) {
  while (edgeRings.length <= i) {
    addEdgeRing(EDGE_COLORS[edgeRings.length % EDGE_COLORS.length]);
  }
  return edgeRings[i];
}

function init3D() {
  if (threeReady) return;
  threeReady = true;

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  $('#three-wrap').appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x16241c);
  scene.fog = new THREE.Fog(0x16241c, 14, 30);

  camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  dirLight = new THREE.DirectionalLight(0xfff2d0, 0.9);
  dirLight.position.set(4, 9, 5);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.left = -8; dirLight.shadow.camera.right = 8;
  dirLight.shadow.camera.top  =  8; dirLight.shadow.camera.bottom = -8;
  scene.add(dirLight);
  const rim = new THREE.DirectionalLight(0x88ccff, 0.32);
  rim.position.set(-5, 4, -4);
  scene.add(rim);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x223328, roughness: 1 })
  );
  floor.rotation.x = -Math.PI / 2; floor.position.y = -3.2;
  floor.receiveShadow = true;
  scene.add(floor);

  aimArrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(), 1, 0xffd95e, 0.3, 0.18);
  aimArrow.visible = false;
  scene.add(aimArrow);

  for (let i = 0; i < TRAJ_COUNT; i++) {
    const r = Math.max(0.02, 0.056 - i * 0.0045);
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(r, 7, 7),
      new THREE.MeshBasicMaterial({ color: 0xffd95e, transparent: true, opacity: 0.85 - i * 0.08 })
    );
    dot.visible = false;
    scene.add(dot);
    trajDots.push(dot);
  }

  EDGE_COLORS.slice(0, 2).forEach(col => addEdgeRing(col));

  resize3D();
  addEventListener('resize', resize3D);
}

function resize3D() {
  if (!renderer) return;
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}

function woodTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#9a6633'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = `rgba(${80+Math.random()*40},${45+Math.random()*25},10,${rand(.15,.4)})`;
    g.lineWidth = rand(1, 4);
    g.beginPath();
    const y = Math.random() * 256;
    g.moveTo(0, y);
    for (let x = 0; x <= 256; x += 32) g.lineTo(x, y + Math.sin(x * 0.05 + i) * 5);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function buildBench(b) {
  if (benchMesh) scene.remove(benchMesh);
  const grp = new THREE.Group();
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(b.x * 2, 0.25, b.z * 2),
    new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.8 })
  );
  top.position.y = -0.125;
  top.receiveShadow = true; top.castShadow = true;
  grp.add(top);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x5b3a1a, roughness: 0.9 });
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx, sz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3, 0.22), legMat);
    leg.position.set(sx * (b.x - 0.3), -1.7, sz * (b.z - 0.3));
    leg.castShadow = true;
    grp.add(leg);
  });
  const edge = new THREE.Mesh(
    new THREE.BoxGeometry(b.x * 2 + 0.04, 0.012, b.z * 2 + 0.04),
    new THREE.MeshBasicMaterial({ color: 0xf3efe2, transparent: true, opacity: 0.18 })
  );
  edge.position.y = 0.006;
  grp.add(edge);
  const mid = new THREE.Mesh(
    new THREE.BoxGeometry(0.034, 0.013, b.z * 2),
    new THREE.MeshBasicMaterial({ color: 0xffd95e, transparent: true, opacity: 0.10 })
  );
  mid.position.y = 0.007;
  grp.add(mid);
  benchMesh = grp;
  scene.add(grp);
}

function buildPenMesh(type) {
  const grp = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: type.body, roughness: 0.35, metalness: 0.25 });
  const capMat  = new THREE.MeshStandardMaterial({ color: type.cap,  roughness: 0.3,  metalness: 0.4  });
  const tipMat  = new THREE.MeshStandardMaterial({ color: type.tip,  roughness: 0.25, metalness: 0.7  });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(PEN_R, PEN_R, PEN_LEN * 0.62, 16), bodyMat);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(PEN_R*1.05, PEN_R*0.95, PEN_LEN*0.20, 16), capMat);
  grip.position.y = -PEN_LEN * 0.41;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(PEN_R * 0.95, PEN_LEN * 0.14, 16), tipMat);
  tip.position.y = -PEN_LEN * 0.55; tip.rotation.x = Math.PI;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(PEN_R*1.1, PEN_R*1.1, PEN_LEN*0.24, 16), capMat);
  cap.position.y = PEN_LEN * 0.38;
  const clip = new THREE.Mesh(new THREE.BoxGeometry(PEN_R*0.5, PEN_LEN*0.2, PEN_R*0.4), tipMat);
  clip.position.set(PEN_R * 1.2, PEN_LEN * 0.36, 0);
  [body, grip, tip, cap, clip].forEach(m => { m.castShadow = true; grp.add(m); });
  grp.rotation.z = -Math.PI / 2;
  const holder = new THREE.Group();
  holder.add(grp);
  return holder;
}

/* ── chalk dust particles ────────────────────────────────── */
function spawnChalk(x, z, strength) {
  const count = Math.floor(4 + strength * 12);
  for (let i = 0; i < count; i++) {
    const s = rand(0.02, 0.052);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(s, s, s),
      new THREE.MeshBasicMaterial({ color: 0xf0ece0, transparent: true, opacity: rand(0.65, 0.9) })
    );
    const a = rand(0, Math.PI * 2);
    const spd = rand(0.7, 2.7) * Math.max(0.25, strength);
    mesh.position.set(x, 0.1, z);
    scene.add(mesh);
    chalkPool.push({ mesh, vx: Math.cos(a)*spd, vy: rand(0.6,2.3), vz: Math.sin(a)*spd, life: rand(0.75,1.35) });
  }
}
function updateChalk(dt) {
  for (let i = chalkPool.length - 1; i >= 0; i--) {
    const p = chalkPool[i];
    p.vx *= 0.9; p.vz *= 0.9;
    p.vy -= 9.5 * dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.mesh.rotation.x += p.vx * dt * 4;
    p.mesh.rotation.z += p.vz * dt * 4;
    p.life -= dt * 1.15;
    p.mesh.material.opacity = Math.max(0, p.life * 0.75);
    if (p.life <= 0 || p.mesh.position.y < -1.0) { scene.remove(p.mesh); chalkPool.splice(i, 1); }
  }
}

/* ── edge-warning rings ──────────────────────────────────── */
function updateEdgeWarnings() {
  if (!M) { edgeRings.forEach(r => r.visible = false); return; }
  const now = performance.now();
  M.pens.forEach((p, i) => {
    const ring = ensureEdgeRing(i);
    if (p.fallen || p.falling) { ring.visible = false; edgeWarnFired[i] = false; return; }
    const b = M.bench;
    const minDist = Math.min(b.x - Math.abs(p.x), b.z - Math.abs(p.z));
    const threshold = 0.88;
    if (minDist < threshold) {
      if (!edgeWarnFired[i]) { edgeWarnFired[i] = true; AudioFX.nearEdge(); }
      const t = 1 - minDist / threshold;
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.009);
      ring.material.opacity = clamp(t * (0.55 + pulse * 0.35), 0, 0.88);
      const sc = 1 + t * 0.34 + pulse * t * 0.12;
      ring.scale.set(sc, sc, sc);
      ring.position.set(p.x, 0.07, p.z);
      ring.visible = true;
    } else {
      ring.visible = false;
      edgeWarnFired[i] = false;
    }
  });
}

/* ── trajectory dots ─────────────────────────────────────── */
const MAX_POW = 7.5;
function showTrajectory(pen, dirX, dirZ, power) {
  if (!M) { hideTraj(); return; }
  const v  = power * MAX_POW * pen.type.power / pen.type.mass;
  const fr = Math.exp(-1.6 * pen.type.grip * 0.09);
  let sx = pen.x, sz = pen.z, vx = dirX * v, vz = dirZ * v;
  for (let i = 0; i < TRAJ_COUNT; i++) {
    sx += vx * 0.09; sz += vz * 0.09;
    vx *= fr; vz *= fr;
    if (Math.abs(sx) > M.bench.x + 0.35 || Math.abs(sz) > M.bench.z + 0.35) {
      for (let j = i; j < TRAJ_COUNT; j++) trajDots[j].visible = false;
      return;
    }
    trajDots[i].position.set(sx, 0.14, sz);
    trajDots[i].visible = true;
  }
}
function hideTraj() { trajDots.forEach(d => d.visible = false); }

/* ── impact flash ────────────────────────────────────────── */
function flashImpact(strength) {
  const el = $('#impact-flash');
  if (!el || strength < 0.4) return;
  el.style.transition = 'none';
  el.style.opacity = Math.min(0.38, strength * 0.12);
  requestAnimationFrame(() => { el.style.transition = 'opacity 0.28s ease'; el.style.opacity = '0'; });
}

/* ── confetti ────────────────────────────────────────────── */
function launchConfetti() {
  const container = $('#confetti');
  if (!container) return;
  container.innerHTML = '';
  const colors = ['#ffd95e','#ff6b6b','#7ec8ff','#a0e87a','#ffbb66','#dd88ff'];
  for (let i = 0; i < 72; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    const w = rand(6,13), h = rand(9,17);
    el.style.cssText =
      `left:${rand(3,97)}%;width:${w}px;height:${h}px;` +
      `background:${colors[Math.floor(rand(0,colors.length))]};` +
      `animation-delay:${rand(0,1.3)}s;animation-duration:${rand(1.8,3.1)}s;` +
      `transform:rotate(${rand(0,360)}deg);` +
      `border-radius:${Math.random()<0.4?'50%':'2px'}`;
    container.appendChild(el);
  }
  container.classList.add('active');
  setTimeout(() => container.classList.remove('active'), 4200);
  AudioFX.confetti();
}

/* ============================================================
   MATCH STATE & PHYSICS
============================================================ */
let M = null;
let rafId = null, lastT = 0;

function playerName(seatIdx) {
  if (isCPU())  return seatIdx === 0 ? (sel.players[0]?.name || 'PLAYER 1') : 'COMPUTER';
  return sel.players[seatIdx]?.name || `PLAYER ${seatIdx + 1}`;
}

function newMatch() {
  init3D();
  const b = BENCHES[sel.bench];
  buildBench(b);
  if (M) M.pens.forEach(p => scene.remove(p.mesh));
  chalkPool.forEach(p => scene.remove(p.mesh));
  chalkPool.length = 0;
  edgeWarnFired[0] = edgeWarnFired[1] = false;

  M = {
    bench: b,
    scores: isKoH() ? Array(sel.playerCount).fill(0) : [0, 0],
    round: 1,
    needed: Math.ceil(sel.rounds / 2),
    turn: isKoH() ? Math.floor(Math.random() * sel.playerCount) : (Math.random() < 0.5 ? 0 : 1),
    state: 'aim',
    pens: [],
    time: 0,
    camShake: 0,
    camZoom: 0,
    tourney: null
  };

  /* Multiplayer: all selected players share the same bench. */
  if (isKoH()) {
    M.tourney = {
      players:    sel.players.map(p => ({ ...p, wins: 0 })),
      targetWins: sel.targetWins,
      matchCount: 1,
      onBench:    sel.players.map((_, i) => i)   // all players start on bench
    };
  }

  const penTypes = isKoH() ? sel.players.map(p => p.pen) : [sel.p1Pen, sel.p2Pen];
  penTypes.forEach((type, i) => {
    const mesh = buildPenMesh(type);
    scene.add(mesh);
    M.pens.push({ type, mesh, owner: i, x:0, z:0, ang:0, vx:0, vz:0, w:0, y:0, vy:0, falling:false, fallen:false, tumble:0, hopY:0 });
  });
  edgeWarnFired = Array(M.pens.length).fill(false);

  camFocus.x = 0; camFocus.z = 0;
  updateHUDNames();
  layoutRound();
}

function resetPen(p, x, z, ang) {
  Object.assign(p, { x, z, ang, vx:0, vz:0, w:0, y:0, vy:0, falling:false, fallen:false, tumble:0, hopY:0 });
  p.mesh.visible = true;
  p.mesh.rotation.x = 0;
  syncMesh(p);
}

function layoutRound() {
  const b = M.bench;
  if (isKoH()) {
    const n = M.pens.length;
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const xMin = -b.x * 0.64, xMax = b.x * 0.64;
    const zMin = -b.z * 0.58, zMax = b.z * 0.58;
    M.pens.forEach((p, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = cols === 1 ? 0 : xMin + (xMax - xMin) * (col / (cols - 1));
      const z = rows === 1 ? 0 : zMin + (zMax - zMin) * (row / (rows - 1));
      const ang = Math.PI / 2 + rand(-0.18, 0.18);
      resetPen(p, x + rand(-0.08, 0.08), z + rand(-0.08, 0.08), ang);
    });
  } else {
    const p1 = M.pens[0], p2 = M.pens[1];
    resetPen(p1, -b.x * 0.55, rand(-0.4, 0.4), Math.PI / 2 + rand(-0.15, 0.15));
    resetPen(p2,  b.x * 0.55, rand(-0.4, 0.4), Math.PI / 2 + rand(-0.15, 0.15));
  }
  M.state = 'aim';
  M.camShake = 0; M.camZoom = 0;
  edgeWarnFired = Array(M.pens.length).fill(false);
  hideTraj();
  updateHUD();
  maybeAITurn();
}

function syncMesh(p) {
  p.mesh.position.set(p.x, p.y + PEN_R + (p.hopY || 0), p.z);
  p.mesh.rotation.y = -p.ang;
  if (p.falling || p.fallen) p.mesh.rotation.x = p.tumble;
}

function ends(p) {
  const hx = Math.cos(p.ang) * PEN_LEN / 2, hz = Math.sin(p.ang) * PEN_LEN / 2;
  return [{ x: p.x-hx, z: p.z-hz }, { x: p.x+hx, z: p.z+hz }];
}

function closestSegSeg(p1, q1, p2, q2) {
  const d1={x:q1.x-p1.x,z:q1.z-p1.z}, d2={x:q2.x-p2.x,z:q2.z-p2.z};
  const r={x:p1.x-p2.x,z:p1.z-p2.z};
  const a=d1.x*d1.x+d1.z*d1.z, e=d2.x*d2.x+d2.z*d2.z;
  const f=d2.x*r.x+d2.z*r.z, c=d1.x*r.x+d1.z*r.z;
  const b=d1.x*d2.x+d1.z*d2.z, den=a*e-b*b;
  let s=den>1e-9?clamp((b*f-c*e)/den,0,1):0;
  let t=e>1e-9?clamp((b*s+f)/e,0,1):0;
  s=a>1e-9?clamp((b*t-c)/a,0,1):s;
  const c1={x:p1.x+d1.x*s,z:p1.z+d1.z*s}, c2={x:p2.x+d2.x*t,z:p2.z+d2.z*t};
  const dx=c2.x-c1.x, dz=c2.z-c1.z;
  return {c1, c2, dist:Math.hypot(dx,dz)};
}

function physics(dt) {
  const b = M.bench;
  for (const p of M.pens) {
    if (p.fallen) continue;
    if (p.falling) {
      p.vy -= 14 * dt;
      p.y  += p.vy * dt;
      p.x  += p.vx * dt; p.z += p.vz * dt;
      p.tumble += 6 * dt;
      if (p.y <= -3.0) { p.y = -3.0; p.fallen = true; p.vx = p.vz = p.w = 0; AudioFX.fall(); }
      syncMesh(p); continue;
    }
    if (p.hopY > 0) p.hopY = Math.max(0, p.hopY - dt * 4.5);
    p.x += p.vx * dt; p.z += p.vz * dt; p.ang += p.w * dt;
    const fr = Math.exp(-1.6 * p.type.grip * dt);
    p.vx *= fr; p.vz *= fr;
    p.w  *= Math.exp(-2.2 * p.type.grip * dt);
    if (Math.hypot(p.vx, p.vz) < 0.04) { p.vx = p.vz = 0; }
    if (Math.abs(p.w) < 0.06) p.w = 0;
    if (Math.abs(p.x) > b.x || Math.abs(p.z) > b.z) {
      p.falling = true; p.vy = 0.5;
      M.camShake = 0.55;
      AudioFX.edge();
      spawnChalk(clamp(p.x,-b.x,b.x), clamp(p.z,-b.z,b.z), 0.9);
    }
    syncMesh(p);
  }
  for (let i = 0; i < M.pens.length; i++) {
    for (let j = i + 1; j < M.pens.length; j++) {
      const A = M.pens[i], B = M.pens[j];
      if (A.falling || B.falling || A.fallen || B.fallen) continue;
      const [a1,a2]=ends(A), [b1,b2]=ends(B);
      const r = closestSegSeg(a1,a2,b1,b2);
      const minD = PEN_R * 2.2;
      if (r.dist < minD && r.dist > 1e-6) {
        const n={x:(r.c2.x-r.c1.x)/r.dist, z:(r.c2.z-r.c1.z)/r.dist};
        const cx=(r.c1.x+r.c2.x)/2, cz=(r.c1.z+r.c2.z)/2;
        const ra={x:cx-A.x,z:cz-A.z}, rb={x:cx-B.x,z:cz-B.z};
        const mA=A.type.mass, mB=B.type.mass;
        const IA=mA*PEN_LEN*PEN_LEN/12, IB=mB*PEN_LEN*PEN_LEN/12;
        const vA={x:A.vx-A.w*ra.z,z:A.vz+A.w*ra.x}, vB={x:B.vx-B.w*rb.z,z:B.vz+B.w*rb.x};
        const rel=(vB.x-vA.x)*n.x+(vB.z-vA.z)*n.z;
        if (rel < 0) {
          const e=0.55;
          const raXn=ra.x*n.z-ra.z*n.x, rbXn=rb.x*n.z-rb.z*n.x;
          const jj=-(1+e)*rel/(1/mA+1/mB+raXn*raXn/IA+rbXn*rbXn/IB);
          A.vx-=jj*n.x/mA; A.vz-=jj*n.z/mA;
          B.vx+=jj*n.x/mB; B.vz+=jj*n.z/mB;
          A.w-=jj*raXn/IA; B.w+=jj*rbXn/IB;
          const strength=Math.abs(jj);
          if (strength>0.45) { A.hopY=Math.min(0.13,strength*0.04); B.hopY=Math.min(0.13,strength*0.04); }
          AudioFX.clack(strength, mA, mB);
          M.camShake=Math.min(0.62,strength*0.26);
          M.camZoom =Math.min(0.88,strength*0.14);
          spawnChalk(cx, cz, clamp(strength*0.48,0.18,1.1));
          flashImpact(strength);
        }
        const pen=(minD-r.dist)/2;
        A.x-=n.x*pen; A.z-=n.z*pen;
        B.x+=n.x*pen; B.z+=n.z*pen;
        syncMesh(A); syncMesh(B);
      }
    }
  }
}

function allSettled() {
  return M.pens.every(p => p.fallen || (!p.falling && p.vx===0 && p.vz===0 && p.w===0));
}

/* ── turn resolution ─────────────────────────────────────── */
function aliveSeats() {
  return M.pens.map((p, i) => ({ p, i })).filter(x => !x.p.fallen && !x.p.falling).map(x => x.i);
}

function nextAliveTurn(fromIdx) {
  const n = M.pens.length;
  for (let step = 1; step <= n; step++) {
    const idx = (fromIdx + step + n) % n;
    if (!M.pens[idx].fallen && !M.pens[idx].falling) return idx;
  }
  return -1;
}

function resolveTurn() {
  if (isKoH()) {
    const alive = aliveSeats();
    if (alive.length <= 1) {
      M.state = 'done';
      setTimeout(() => resolveKoHWin(alive[0] ?? -1), 700);
      return;
    }
    M.turn = nextAliveTurn(M.turn);
    M.state = 'aim';
    updateHUD();
    return;
  }

  const shooter=M.turn, other=1-M.turn;
  const sFell=M.pens[shooter].fallen||M.pens[shooter].falling;
  const oFell=M.pens[other  ].fallen||M.pens[other  ].falling;
  if (sFell || oFell) {
    const winSeat = sFell ? other : shooter;
    M.state = 'done';
    setTimeout(() => {
      if (isKoH()) resolveKoHWin(winSeat);
      else          resolve2PWin(winSeat, shooter, other);
    }, 700);
  } else {
    M.turn = other;
    M.state = 'aim';
    updateHUD();
    maybeAITurn();
  }
}

/* 2-player (or CPU) round resolution */
function resolve2PWin(winSeat, shooter, other) {
  M.scores[winSeat]++;
  updateHUD();
  if (M.scores[winSeat] >= M.needed) { endMatch(winSeat); return; }
  const shooterFell = M.pens[shooter].fallen || M.pens[shooter].falling;
  $('#roundMsg').textContent = playerName(winSeat) + ' WINS THE ROUND!';
  $('#roundSub').textContent = shooterFell
    ? playerName(shooter) + "'s pen slid off the bench 😬"
    : playerName(other)   + "'s pen was knocked off! 💥";
  $('#overlay-round').classList.add('active');
  AudioFX.win();
}

$('#nextRoundBtn').addEventListener('click', () => {
  AudioFX.button();
  $('#overlay-round').classList.remove('active');
  M.round++;
  M.turn = Math.random() < 0.5 ? 0 : 1;
  layoutRound();
});

/* ── KoH match resolution ────────────────────────────────── */
function resolveKoHWin(winSeat) {
  const { tourney } = M;
  if (winSeat < 0 || !tourney.players[winSeat]) {
    AudioFX.edge();
    showKoHStandings(-1);
    return;
  }

  tourney.players[winSeat].wins++;
  AudioFX.win();

  if (tourney.players[winSeat].wins >= tourney.targetWins) {
    endTournament(winSeat);
    return;
  }

  M.turn = winSeat;
  updateHUDQueue();
  showKoHStandings(winSeat);
}

function showKoHStandings(winPlayerIdx) {
  const { tourney } = M;
  const wp = tourney.players[winPlayerIdx];

  const sorted = tourney.players.map((p,i)=>({...p,idx:i})).sort((a,b)=>b.wins-a.wins);

  let html = `<div class="koh-result">`;
  if (wp) {
    html += `<p class="koh-winner">🏅 ${wp.name} WINS THE ROUND!</p>`;
    html += `<p class="koh-loser chalk-dim">Last pen standing on the desk</p>`;
  } else {
    html += `<p class="koh-winner">NO PEN SURVIVED!</p>`;
    html += `<p class="koh-loser chalk-dim">No score this round</p>`;
  }
  html += `</div><div class="standings-table">`;

  sorted.forEach((p, rank) => {
    const isW = p.idx === winPlayerIdx, isL = M.pens[p.idx]?.fallen;
    const filled = '●'.repeat(p.wins) + '○'.repeat(Math.max(0, tourney.targetWins - p.wins));
    html += `<div class="standings-row${isW?' win-row':''}${isL?' lose-row':''}">`;
    html += `<span class="s-rank">${rank===0?'👑':rank+1}</span>`;
    html += `<span class="s-icon">${p.pen.icon}</span>`;
    html += `<span class="s-name">${p.name}</span>`;
    html += `<span class="s-wins">${filled}</span>`;
    html += `<span class="s-num">${p.wins}</span>`;
    html += `</div>`;
  });
  html += `</div>`;

  $('#standingsList').innerHTML = html;
  $('#nextMatchInfo').textContent = `NEXT: all ${sel.playerCount} pens back on the desk`;
  $('#overlay-standings').classList.add('active');
}

$('#continueKohBtn').addEventListener('click', () => {
  AudioFX.button();
  $('#overlay-standings').classList.remove('active');
  startKoHRound();
});

function startKoHRound() {
  M.tourney.matchCount++;
  M.pens.forEach(p => scene.remove(p.mesh));
  chalkPool.forEach(p => scene.remove(p.mesh));
  chalkPool.length = 0;

  /* rebuild pens for the new matchup */
  M.pens = M.tourney.onBench.map((playerIdx, seatIdx) => {
    const type = sel.players[playerIdx].pen;
    const mesh = buildPenMesh(type);
    scene.add(mesh);
    return { type, mesh, owner: seatIdx, x:0, z:0, ang:0, vx:0, vz:0, w:0, y:0, vy:0, falling:false, fallen:false, tumble:0, hopY:0 };
  });

  // M.turn was already set to the winner's seat in resolveKoHWin — champion goes first
  edgeWarnFired = Array(M.pens.length).fill(false);
  updateHUDNames();
  layoutRound();
  AudioFX.nextChallenger();
}

function endTournament(winPlayerIdx) {
  const { tourney } = M;
  const winner = tourney.players[winPlayerIdx];
  const sorted = tourney.players.map((p,i)=>({...p,idx:i})).sort((a,b)=>b.wins-a.wins);

  const medals = ['🥇','🥈','🥉','🏅','🏅','🏅','🏅','🏅'];
  let sHTML = '';
  sorted.forEach((p, rank) => {
    sHTML += `<div class="f-row">`;
    sHTML += `<span>${medals[rank] || (rank+1+'.')} ${p.pen.icon} ${p.name}</span>`;
    sHTML += `<span>${p.wins}W</span>`;
    sHTML += `</div>`;
  });

  $('#winnerTitle').textContent = '🏆 ' + winner.name + ' IS THE CHAMPION!';
  $('#finalScore').textContent  = winner.pen.icon + ' ' + winner.wins + ' MATCH WIN' + (winner.wins!==1?'S':'');
  const sub = $('#matchSub');
  if (sub) sub.textContent = `${sel.playerCount}-PLAYER KING OF THE HILL · ${BENCHES[sel.bench].label} BENCH`;
  const ts = $('#tourneyFinalStandings');
  if (ts) { ts.innerHTML = sHTML; ts.style.display = 'block'; }

  addRecord({
    winner: winner.name,
    score:  winner.wins + ' wins',
    mode:   sel.playerCount + 'P KING OF THE HILL',
    pens:   sorted.map(p => p.name).join(', ')
  });

  launchConfetti();
  cancelAnimationFrame(rafId); rafId = null;
  setTimeout(() => show('matchover'), 1500);
}

/* endMatch: used only for CPU / 2P friend modes */
function endMatch(winSeat) {
  const wName = playerName(winSeat);
  const humanWins = !(isCPU() && winSeat === 1);

  const ts = $('#tourneyFinalStandings');
  if (ts) ts.style.display = 'none';

  $('#winnerTitle').textContent = '🏆 ' + wName + ' WINS!';
  $('#finalScore').textContent  = M.scores[0] + ' — ' + M.scores[1];
  const sub = $('#matchSub');
  if (sub) sub.textContent =
    playerName(0) + ' (' + (sel.p1Pen?.name||'') + ') vs ' + playerName(1) + ' (' + (sel.p2Pen?.name||'') + ')' +
    ' • ' + (isCPU() ? 'VS COMPUTER (' + sel.ai.toUpperCase() + ')' : 'VS FRIEND');

  addRecord({
    winner: wName,
    score:  M.scores[0] + '-' + M.scores[1],
    mode:   isCPU() ? 'VS COMPUTER (' + sel.ai.toUpperCase() + ')' : 'VS FRIEND',
    pens:   (sel.p1Pen?.name||'?') + ' vs ' + (sel.p2Pen?.name||'?')
  });

  if (humanWins) { AudioFX.win(); launchConfetti(); } else AudioFX.lose();
  cancelAnimationFrame(rafId); rafId = null;
  setTimeout(() => show('matchover'), humanWins ? 1300 : 650);
}

/* ── HUD ─────────────────────────────────────────────────── */
function updateHUDNames() {
  /* toggle HUDs: 2-player panel vs battle-royale panel */
  $('#hud-2p').style.display = isKoH() ? 'none' : '';
  $('#hud-br').style.display = isKoH() ? 'flex' : 'none';

  if (isKoH()) {
    /* queue score-bar shows every player */
    $('#hud-queue').style.display = 'flex';
    updateHUDQueue();
    return;
  }

  let n0, n1;
  if (isCPU()) {
    n0 = (sel.players[0]?.name||'YOU').substring(0,8) + ' ' + (sel.p1Pen?.icon||'');
    n1 = 'BOT ' + (sel.p2Pen?.icon||'');
  } else {
    n0 = (sel.players[0]?.name||'P1').substring(0,7) + ' ' + (sel.players[0]?.pen?.icon||'');
    n1 = (sel.players[1]?.name||'P2').substring(0,7) + ' ' + (sel.players[1]?.pen?.icon||'');
  }
  $('#hudP1Name').textContent = n0;
  $('#hudP2Name').textContent = n1;
  $('#hud-queue').style.display = 'none';
}

function updateHUDQueue() {
  const qDiv = $('#hud-queue');
  if (!M?.tourney) return;
  const { tourney } = M;
  const sorted = tourney.players.map((p,i)=>({...p,idx:i})).sort((a,b)=>b.wins-a.wins);
  let html = '<span class="queue-label">SCORES</span>';
  sorted.forEach(p => {
    const onBench = tourney.onBench.includes(p.idx);
    html += `<span class="queue-chip${onBench?' on-bench':''}">${p.pen.icon} ${p.name.substring(0,5)} <b>${p.wins}</b></span>`;
  });
  qDiv.innerHTML = html;
}

function updateHUD() {
  if (isKoH() && M?.tourney) {
    const { tourney } = M;
    $('#hudRoundBR').textContent = 'ROUND ' + tourney.matchCount + ' • FIRST TO ' + tourney.targetWins;
    const tbBR = $('#turnBannerBR');
    tbBR.textContent = M.state === 'sim' ? '…' : playerName(M.turn) + "'S TURN";
    tbBR.className   = 'turn-banner';   // neutral gold colour for any seat
    updateHUDQueue();
  } else {
    $('#hudP1Score').textContent = M.scores[0];
    $('#hudP2Score').textContent = M.scores[1];
    $('#hudRound').textContent   = 'ROUND ' + M.round + ' • FIRST TO ' + M.needed;

    const tb = $('#turnBanner');
    tb.textContent = M.state === 'sim' ? '…' : playerName(M.turn) + "'S TURN";
    tb.className   = 'turn-banner ' + (M.turn === 0 ? 'p1' : 'p2');

    $$('.hud-player').forEach(el => el.classList.remove('active'));
    const ah = document.querySelector('.hud-player.' + (M.turn===0?'p1':'p2'));
    if (ah) ah.classList.add('active');
  }

  $('#hint').style.display = (M.state==='aim' && !(isCPU() && M.turn===1)) ? 'block' : 'none';
}

/* ── shooting ────────────────────────────────────────────── */
function shoot(idx, dirX, dirZ, power) {
  const p = M.pens[idx];
  const v = power * MAX_POW * p.type.power / p.type.mass;
  p.vx = dirX * v; p.vz = dirZ * v;
  p.w  = rand(-1.5, 1.5) * power;
  M.state = 'sim';
  AudioFX.flick();
  updateHUD();
}

/* ── AI ──────────────────────────────────────────────────── */
function maybeAITurn() {
  if (!isCPU() || M.turn !== 1 || M.state !== 'aim') return;
  const L = AI_LEVELS[sel.ai];
  const delay = sel.ai==='hard' ? rand(600,980) : sel.ai==='medium' ? rand(900,1400) : rand(1200,1900);
  setTimeout(() => {
    if (!M || M.state!=='aim' || M.turn!==1) return;
    const me=M.pens[1], target=M.pens[0], b=M.bench;
    /* self-preservation */
    const myEdge = Math.min(b.x-Math.abs(me.x), b.z-Math.abs(me.z));
    if (myEdge < 0.62 && Math.random() < L.smart*0.65) {
      let dx=-me.x, dz=-me.z;
      const d=Math.hypot(dx,dz)||1; dx/=d; dz/=d;
      const ea=rand(-L.err*0.5,L.err*0.5), cos=Math.cos(ea), sin=Math.sin(ea);
      shoot(1, dx*cos-dz*sin, dx*sin+dz*cos, rand(0.25,0.45));
      return;
    }
    /* targeting */
    let aimX, aimZ;
    if (Math.random() < L.smart*0.42) {
      const [t1,t2]=ends(target), f=rand(0.72,0.94);
      aimX=t1.x+(t2.x-t1.x)*f; aimZ=t1.z+(t2.z-t1.z)*f;
    } else {
      aimX=target.x+rand(-0.12,0.12); aimZ=target.z+rand(-0.12,0.12);
    }
    let dx=aimX-me.x, dz=aimZ-me.z;
    const dist=Math.hypot(dx,dz)||1; dx/=dist; dz/=dist;
    const ea=rand(-L.err,L.err), cos=Math.cos(ea), sin=Math.sin(ea);
    const adx=dx*cos-dz*sin, adz=dx*sin+dz*cos;
    /* power */
    const targetEdge=Math.min(b.x-Math.abs(target.x),b.z-Math.abs(target.z));
    let pow;
    if (targetEdge<0.52 && Math.random()<L.smart*0.78) {
      pow=rand(0.16,0.36);
    } else {
      pow=clamp(dist/(b.x*2)*0.85+0.25,0.28,1.0);
      pow*=1+rand(-L.powErr,L.powErr);
    }
    shoot(1, adx, adz, clamp(pow,0.18,1));
  }, delay);
}

/* ── input (drag-to-flick) ───────────────────────────────── */
let dragging=false, dragStart=null;
let ray=null, ndc=null, tablePlane=null;

function toWorld(ev) {
  if (!ray) {
    ray=new THREE.Raycaster(); ndc=new THREE.Vector2();
    tablePlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  }
  const cx=ev.clientX??ev.touches?.[0]?.clientX;
  const cy=ev.clientY??ev.touches?.[0]?.clientY;
  if (cx==null) return null;
  ndc.set((cx/innerWidth)*2-1, -(cy/innerHeight)*2+1);
  ray.setFromCamera(ndc, camera);
  const out=new THREE.Vector3();
  return ray.ray.intersectPlane(tablePlane,out) ? out : null;
}

function humanCanAim() {
  return M && M.state==='aim' && currentScreen==='game' && !(isCPU() && M.turn===1);
}

function onDown(ev) {
  if (!humanCanAim()) return;
  const w=toWorld(ev); if (!w) return;
  const p=M.pens[M.turn];
  if (Math.hypot(w.x-p.x, w.z-p.z) < 1.6) {
    dragging=true; dragStart={x:w.x,z:w.z};
    AudioFX.chargeStart();
  }
}
function onMove(ev) {
  if (!dragging) return;
  const w=toWorld(ev); if (!w) return;
  const p=M.pens[M.turn];
  const dx=dragStart.x-w.x, dz=dragStart.z-w.z;
  const len=Math.hypot(dx,dz), power=clamp(len/3.2,0,1);
  const pf=$('#powerFill');
  pf.style.width=power*100+'%';
  pf.classList.toggle('danger', power>0.78);
  pf.classList.toggle('warn',   power>0.46 && power<=0.78);
  if (len>0.05) {
    aimArrow.position.set(p.x,0.15,p.z);
    aimArrow.setDirection(new THREE.Vector3(dx/len,0,dz/len));
    aimArrow.setLength(0.6+power*2.6, 0.32, 0.2);
    aimArrow.visible=true;
    showTrajectory(p, dx/len, dz/len, power);
  }
}
function onUp(ev) {
  if (!dragging) return;
  dragging=false; aimArrow.visible=false; hideTraj();
  const pf=$('#powerFill');
  pf.style.width='0%'; pf.classList.remove('danger','warn');
  const w=toWorld(ev); if (!w) return;
  const dx=dragStart.x-w.x, dz=dragStart.z-w.z;
  const len=Math.hypot(dx,dz);
  if (len<0.15) return;
  shoot(M.turn, dx/len, dz/len, clamp(len/3.2,0.08,1));
}

/* ── render loop ─────────────────────────────────────────── */
function loop(t) {
  rafId = requestAnimationFrame(loop);
  const dt = Math.min(0.04, (t-lastT)/1000); lastT = t;
  if (!M) return;

  M.time += dt;
  if (M.state === 'sim') {
    for (let i = 0; i < 4; i++) physics(dt / 4);
    if (allSettled()) resolveTurn();
  }

  updateChalk(dt);
  updateEdgeWarnings();

  M.camShake = Math.max(0, M.camShake - dt*1.55);
  M.camZoom  = Math.max(0, M.camZoom  - dt*1.9);

  const active = M.pens[M.turn];
  camFocus.x += (active.x*0.17 - camFocus.x)*0.038;
  camFocus.z += (active.z*0.06 - camFocus.z)*0.038;

  const sway=Math.sin(M.time*0.4)*0.38;
  const shx=rand(-1,1)*M.camShake*0.14, shy=rand(-1,1)*M.camShake*0.11;

  camera.position.set(sway+shx+camFocus.x*0.26, 6.4+shy, 7.4+M.camZoom*1.5);
  camera.lookAt(camFocus.x*0.20, -0.4, camFocus.z*0.14);
  renderer.render(scene, camera);
}

/* ── start / pause / quit ────────────────────────────────── */
let inputWired = false;

function startMatch() {
  newMatch();
  show('game');
  if (!inputWired) {
    inputWired = true;
    renderer.domElement.addEventListener('pointerdown', onDown);
    addEventListener('pointermove', onMove);
    addEventListener('pointerup',   onUp);
  }
  lastT = performance.now();
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

$('#startBtn'  ).addEventListener('click', () => { AudioFX.unlock(); AudioFX.button(); startMatch(); });
$('#rematchBtn').addEventListener('click', () => { AudioFX.button(); startMatch(); });

$('#pauseBtn').addEventListener('click', () => {
  if (!M) return;
  cancelAnimationFrame(rafId); rafId = null;
  hideTraj();
  $('#overlay-pause').classList.add('active');
  AudioFX.button();
});
$('#resumeBtn').addEventListener('click', () => {
  $('#overlay-pause').classList.remove('active');
  lastT = performance.now();
  rafId = requestAnimationFrame(loop);
  AudioFX.button();
});
$('#restartBtn').addEventListener('click', () => { $('#overlay-pause').classList.remove('active'); startMatch(); });
$('#quitBtn').addEventListener('click', () => {
  $('#overlay-pause').classList.remove('active');
  cancelAnimationFrame(rafId); rafId = null;
  hideTraj();
  show('home');
});
addEventListener('keydown', e => {
  if (currentScreen !== 'game') return;
  if (e.code === 'KeyP' || e.code === 'Escape') {
    $('#overlay-pause').classList.contains('active') ? $('#resumeBtn').click() : $('#pauseBtn').click();
  }
});

})();
