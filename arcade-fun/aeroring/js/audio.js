/* ============ AeroRing Audio Engine (Enhanced) ============ */
const AudioFX = (() => {
  let ctx = null, master = null, muted = false, volume = 0.6, musicTimer = null;

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : volume;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function tone(freq, dur, type = 'sine', vol = 0.5, slide = 0) {
    if (muted) return;
    ensure();
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur);
  }

  function noise(dur, vol = 0.4) {
    if (muted) return;
    ensure();
    const t = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(g); g.connect(master);
    src.start(t);
  }

  /* --- ambient music loop --- */
  const SCALE = [220, 261.6, 329.6, 392, 440, 523.2];
  function startMusic() {
    stopMusic();
    let step = 0;
    musicTimer = setInterval(() => {
      if (muted) return;
      const n = SCALE[(step * 2 + (step % 3)) % SCALE.length];
      tone(n / 2, 0.5, 'triangle', 0.055);
      if (step % 4 === 0) tone(n / 4, 0.9, 'sine', 0.04);
      if (step % 8 === 0) tone(n * 1.5, 0.3, 'sine', 0.03);
      step++;
    }, 280);
  }
  function stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }

  return {
    unlock: ensure,

    /* collect ring — pitch rises with combo */
    ring(combo = 1) {
      tone(620 + Math.min(combo, 24) * 26, 0.11, 'sine', 0.38, 180);
    },

    /* bonus ring — brighter, double chime */
    bonusRing() {
      tone(880, 0.1, 'triangle', 0.35, 220);
      setTimeout(() => tone(1320, 0.14, 'triangle', 0.28, 200), 75);
    },

    button()  { tone(340, 0.07, 'square', 0.18, 60); },
    select()  { tone(520, 0.1, 'triangle', 0.28, 140); },
    launch()  { tone(160, 0.6, 'sawtooth', 0.35, 420); noise(0.4, 0.2); },
    powerup() { tone(440, 0.1, 'triangle', 0.32, 220); setTimeout(() => tone(660, 0.14, 'triangle', 0.28, 220), 90); },
    ability() { tone(200, 0.4, 'sawtooth', 0.38, 600); noise(0.15, 0.12); },
    shieldHit() { tone(300, 0.2, 'square', 0.38, -120); noise(0.15, 0.22); },

    /* near miss — quick whoosh */
    nearMiss() {
      tone(800, 0.08, 'sawtooth', 0.18, -400);
    },

    /* flawless wave clear */
    flawless() {
      [523, 659, 784, 1046, 1318].forEach((f, i) =>
        setTimeout(() => tone(f, 0.18, 'triangle', 0.28), i * 90)
      );
    },

    /* wave announcement */
    wave() {
      tone(523, 0.12, 'triangle', 0.28);
      setTimeout(() => tone(784, 0.18, 'triangle', 0.28), 120);
      setTimeout(() => tone(1046, 0.22, 'triangle', 0.22), 240);
    },

    /* combo milestone — fanfare */
    comboMilestone(n) {
      const freqs = n >= 35 ? [659,784,1046,1318] : n >= 20 ? [523,659,784] : n >= 10 ? [440,523,659] : [440,523];
      freqs.forEach((f, i) => setTimeout(() => tone(f, 0.14, 'triangle', 0.3), i * 80));
    },

    gameOver() {
      tone(330, 0.3, 'sawtooth', 0.38, -200);
      setTimeout(() => tone(220, 0.5, 'sawtooth', 0.32, -150), 200);
      setTimeout(() => tone(150, 0.7, 'sawtooth', 0.28, -80), 450);
      noise(0.6, 0.28);
    },
    speedShock(fast) {
      if (fast) {
        // Fast surge: rising screech
        tone(200, 0.08, 'sawtooth', 0.35, 800);
        noise(0.12, 0.22);
        setTimeout(() => tone(600, 0.15, 'square', 0.25, 400), 80);
      } else {
        // Slow drop: descending thud
        tone(400, 0.12, 'sawtooth', 0.32, -350);
        noise(0.18, 0.18);
        setTimeout(() => tone(80, 0.3, 'sine', 0.22, -40), 100);
      }
    },
    record() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'triangle', 0.32), i * 120)); },

    startMusic, stopMusic,
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : volume; },
    setVolume(v) { volume = v; if (master && !muted) master.gain.value = v; },
    get muted() { return muted }
  };
})();