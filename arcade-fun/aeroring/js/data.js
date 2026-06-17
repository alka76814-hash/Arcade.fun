/* ============ AeroRing Game Data (Enhanced) ============ */

const PILOTS = [
  {
    id: 'nova', name: 'NOVA', role: 'BALANCED', icon: '🛸', color: '#00e5ff',
    desc: 'The all-rounder. Reliable in every lane, every wave.',
    speed: 3, exp: 3, defense: 3,
    ability: 'GHOST', abilityDur: 3.2, expRate: 1.0, moveCooldown: 0.11, startShield: false
  },
  {
    id: 'bolt', name: 'BOLT', role: 'SPEEDSTER', icon: '🚀', color: '#ffd54a',
    desc: 'Blink-fast lane switching. Lives in the gaps between hazards.',
    speed: 5, exp: 2, defense: 1,
    ability: 'BLAST', abilityDur: 0, expRate: 0.9, moveCooldown: 0.055, startShield: false
  },
  {
    id: 'titan', name: 'TITAN', role: 'TANK', icon: '🛰️', color: '#3dff9e',
    desc: 'Launches with a shield online. Absorbs punishment, never flinches.',
    speed: 2, exp: 2, defense: 5,
    ability: 'BLAST', abilityDur: 0, expRate: 0.85, moveCooldown: 0.16, startShield: true
  },
  {
    id: 'flux', name: 'FLUX', role: 'SPECIALIST', icon: '👾', color: '#ff2bd6',
    desc: 'Charges ability at incredible speed. Ghost early, ghost often.',
    speed: 3, exp: 5, defense: 2,
    ability: 'GHOST', abilityDur: 3.8, expRate: 1.65, moveCooldown: 0.10, startShield: false
  }
];

const MODES = [
  {
    id: 'constant', name: 'CONSTANT', icon: '🎯',
    desc: 'Stable, predictable difficulty ramp. Master the fundamentals here.',
    rampSpeed: 0.10, rampSpawn: 0.06, random: false, endless: false, maxWave: 10
  },
  {
    id: 'random', name: 'RANDOM', icon: '🎲',
    desc: 'Chaotic speeds, surprise power-ups, unpredictable spawns.',
    rampSpeed: 0.14, rampSpawn: 0.08, random: true, endless: false, maxWave: 12
  },
  {
    id: 'endless', name: 'ENDLESS', icon: '♾️',
    desc: 'Difficulty never stops climbing. Built for record chasers only.',
    rampSpeed: 0.15, rampSpawn: 0.09, random: false, endless: true, maxWave: Infinity
  }
];

const POWERUPS = [
  { id: 'shield', icon: '🛡', color: '#00e5ff', dur: 0 },
  { id: 'slow',   icon: '🐌', color: '#3dff9e', dur: 5.5 },
  { id: 'magnet', icon: '🧲', color: '#ff2bd6', dur: 6.5 }
];

const COMBO_TIERS = [
  { at: 0,  mult: 1 },
  { at: 5,  mult: 2 },
  { at: 10, mult: 3 },
  { at: 20, mult: 4 },
  { at: 35, mult: 5 }
];

function comboMult(count) {
  let m = 1;
  for (const t of COMBO_TIERS) if (count >= t.at) m = t.mult;
  return m;
}