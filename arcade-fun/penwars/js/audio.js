/* ============ Pen Fight Audio (WebAudio, asset-free) ============ */
const AudioFX = (() => {
  let ctx = null, master = null, muted = false, volume = 0.6;

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
    if (muted) return; ensure();
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur);
  }
  function noise(dur, vol = 0.4, lp = 3000) {
    if (muted) return; ensure();
    const t = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t);
  }
  return {
    unlock: ensure,

    button()  { tone(300, 0.07, 'square', 0.16, 60); },
    select()  { tone(480, 0.1, 'triangle', 0.3, 120); },

    /* subtle whoosh when the player starts dragging */
    chargeStart() { tone(160, 0.1, 'sine', 0.08, 55); },

    flick() { noise(0.18, 0.35, 1800); tone(220, 0.15, 'sine', 0.2, 300); },

    /* pen-on-pen hit — pitch and body vary with average pen mass */
    clack(strength = 1, massA = 1, massB = 1) {
      const avg  = (massA + massB) / 2;
      const freq = Math.max(480, 1150 - avg * 270 + Math.random() * 240);
      const v    = Math.min(0.58, 0.18 + strength * 0.28);
      noise(0.07, v, 3200 + avg * 900);
      tone(freq, 0.065, 'square', v * 0.42, -170 - avg * 85);
    },

    edge()   { tone(180, 0.22, 'sine', 0.32, -90); },
    fall()   { tone(500, 0.5, 'sawtooth', 0.3, -380); setTimeout(() => noise(0.2, 0.4, 1200), 420); },

    /* brief round-win sting */
    win() {
      [392, 494, 587, 784].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.35), i * 140));
    },

    /* two-phrase fanfare for match victory + confetti */
    confetti() {
      [523, 659, 784, 1047, 1175].forEach((f, i) =>
        setTimeout(() => tone(f, 0.20, 'triangle', 0.30), i * 95));
      setTimeout(() => {
        [784, 988, 1175, 1568].forEach((f, i) =>
          setTimeout(() => tone(f, 0.18, 'triangle', 0.24), i * 90));
      }, 520);
    },

    /* "next challenger coming up" — punchy descending–ascending motif */
    nextChallenger() {
      [660, 550, 440].forEach((f, i) => setTimeout(() => tone(f, 0.12, 'triangle', 0.22, -40), i * 85));
      setTimeout(() => tone(550, 0.18, 'square', 0.14, 120), 280);
    },

    /* pulsing tick when a pen is near the bench edge */
    nearEdge() { tone(520, 0.05, 'square', 0.12, -80); },

    lose() {
      [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.30, 'sawtooth', 0.25), i * 180));
    },

    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : volume; },
    setVolume(v) { volume = v; if (master && !muted) master.gain.value = v; },
    get muted() { return muted; }
  };
})();