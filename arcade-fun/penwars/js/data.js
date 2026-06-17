/* ============ Pen Fight Data ============ */

/* mass: heavier = harder to push, hits harder.
   power: flick impulse multiplier.
   grip: friction — high grip stops sooner (more control). */
const PENS = [
  {
    id: 'lexi', name: 'LEXI CLASSIC', role: 'BALANCED', icon: '🖊️',
    desc: 'The legendary blue ballpoint. Fair in every fight.',
    mass: 1.0, power: 1.0, grip: 1.0,
    body: 0x2277ee, cap: 0x113a88, tip: 0xcccccc
  },
  {
    id: 'hero', name: 'HERO FOUNTAIN', role: 'HEAVY', icon: '✒️',
    desc: 'Grandpa\'s ink tank. Slow, but a single hit sends pens flying.',
    mass: 1.6, power: 0.9, grip: 1.2,
    body: 0x1b5e20, cap: 0xd4af37, tip: 0xd4af37
  },
  {
    id: 'gel', name: 'GEL STRIKER', role: 'ATTACKER', icon: '🖋️',
    desc: 'Smooth gel grip, vicious flick power. Glass cannon.',
    mass: 0.9, power: 1.25, grip: 0.9,
    body: 0xd32f2f, cap: 0x7b1010, tip: 0x999999
  },
  {
    id: 'needle', name: 'NEEDLE POINT', role: 'SPEEDSTER', icon: '✏️',
    desc: 'Featherweight slim-tip. Flies far… in both directions.',
    mass: 0.7, power: 1.1, grip: 0.75,
    body: 0xfbc02d, cap: 0x333333, tip: 0x333333
  },
  {
    id: 'boss', name: 'DESK DESTROYER', role: 'TANK', icon: '🔫',
    desc: 'The back-bencher\'s metal-body monster. Almost immovable.',
    mass: 1.9, power: 0.85, grip: 1.35,
    body: 0x37474f, cap: 0x90a4ae, tip: 0x90a4ae
  },
  {
    id: 'marker', name: 'MARKER KING', role: 'BRUISER', icon: '🖍️',
    desc: 'Fat permanent marker. Wider body means harder to dodge — but it\'s slow.',
    mass: 1.45, power: 1.08, grip: 1.05,
    body: 0x7b1fa2, cap: 0x4a0072, tip: 0x1a1a1a
  }
];

const BENCHES = {
  small:  { x: 3.4, z: 2.2, label: 'SMALL'  },
  medium: { x: 4.4, z: 2.8, label: 'MEDIUM' },
  large:  { x: 5.6, z: 3.6, label: 'LARGE'  }
};

const AI_LEVELS = {
  easy:   { err: 0.50, powErr: 0.45, smart: 0.20 },
  medium: { err: 0.22, powErr: 0.25, smart: 0.60 },
  hard:   { err: 0.07, powErr: 0.08, smart: 0.95 }  // tighter power control than before
};