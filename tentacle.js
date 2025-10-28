const canvas = document.getElementById('tentacleCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// -----------------------------------------------------------------------------
// COLOR PALETTES & UI STATE
// -----------------------------------------------------------------------------
const paletteState = { index: 0 };
const palettes = [
  {
    name: 'Neon Tide',
    tentacle: { r: 0, g: 200, b: 255 },
    glow: { r: 0, g: 150, b: 255 },
    orb: {
      inner: { r: 0, g: 190, b: 255, a: 1 },
      mid: { r: 0, g: 120, b: 245, a: 0.8 },
      outer: { r: 0, g: 40, b: 110, a: 0 }
    },
    background: {
      top: '#020916',
      mid: '#031c32',
      bottom: '#000a14',
      star: { r: 120, g: 200, b: 255 }
    },
    bridge: {
      inner: { r: 120, g: 225, b: 255 },
      outer: { r: 20, g: 140, b: 255 }
    },
    ripple: { r: 0, g: 190, b: 255 }
  },
  {
    name: 'Solar Bloom',
    tentacle: { r: 255, g: 150, b: 40 },
    glow: { r: 255, g: 80, b: 20 },
    orb: {
      inner: { r: 255, g: 180, b: 70, a: 1 },
      mid: { r: 255, g: 90, b: 50, a: 0.75 },
      outer: { r: 120, g: 30, b: 0, a: 0 }
    },
    background: {
      top: '#1a0524',
      mid: '#32092c',
      bottom: '#140310',
      star: { r: 255, g: 160, b: 90 }
    },
    bridge: {
      inner: { r: 255, g: 200, b: 120 },
      outer: { r: 255, g: 90, b: 40 }
    },
    ripple: { r: 255, g: 140, b: 70 }
  },
  {
    name: 'Abyss Warden',
    tentacle: { r: 120, g: 90, b: 255 },
    glow: { r: 80, g: 60, b: 220 },
    orb: {
      inner: { r: 190, g: 160, b: 255, a: 1 },
      mid: { r: 120, g: 90, b: 255, a: 0.78 },
      outer: { r: 20, g: 0, b: 60, a: 0 }
    },
    background: {
      top: '#06011a',
      mid: '#12082c',
      bottom: '#04010f',
      star: { r: 160, g: 130, b: 255 }
    },
    bridge: {
      inner: { r: 210, g: 190, b: 255 },
      outer: { r: 110, g: 80, b: 250 }
    },
    ripple: { r: 170, g: 140, b: 255 }
  }
];

function getPalette() {
  return palettes[paletteState.index];
}

function toRgba(rgb, alpha = 1) {
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

// -----------------------------------------------------------------------------
// CAMERA / PROJECTION (Software 3D rendered on 2D canvas)
// -----------------------------------------------------------------------------
const camera = { z: 700, f: 600 };
function project3D(x, y, z) {
  const denom = Math.max(1e-3, camera.z - z);
  const s = camera.f / denom;
  return { sx: x * s, sy: y * s, scale: s, denom };
}

// -----------------------------------------------------------------------------
// ANCHOR RING (global, keeps equal spacing while allowing rotation)
// -----------------------------------------------------------------------------
const anchorRing = {
  offset: 0,
  av: 0,
  friction: 0.9,
  coreInfluence: 0.6,
  tensionInfluence: 0.15,
  maxAV: 6.0
};

// -----------------------------------------------------------------------------
// INPUT
// -----------------------------------------------------------------------------
const mouse = { x: canvas.width / 2, y: canvas.height / 2, isDown: false };
window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  initBackground();
});
window.addEventListener('mousedown', e => {
  mouse.isDown = true;
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  addRipple(mouse.x, mouse.y);
});
window.addEventListener('mouseup', () => {
  mouse.isDown = false;
});
window.addEventListener('mousemove', e => {
  if (mouse.isDown) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }
});
window.addEventListener('touchstart', e => {
  const touch = e.touches[0];
  if (!touch) return;
  mouse.isDown = true;
  mouse.x = touch.clientX;
  mouse.y = touch.clientY;
  addRipple(mouse.x, mouse.y);
  e.preventDefault();
}, { passive: false });
window.addEventListener('touchend', () => {
  mouse.isDown = false;
});
window.addEventListener('touchcancel', () => {
  mouse.isDown = false;
});
window.addEventListener('touchmove', e => {
  if (!mouse.isDown) return;
  const touch = e.touches[0];
  if (!touch) return;
  mouse.x = touch.clientX;
  mouse.y = touch.clientY;
  e.preventDefault();
}, { passive: false });
window.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    e.preventDefault();
    requestEnergyBridge();
  } else if (e.key === 'q' || e.key === 'Q') {
    cyclePalette(-1);
  } else if (e.key === 'e' || e.key === 'E') {
    cyclePalette(1);
  } else if (e.key === 'h' || e.key === 'H') {
    toggleHud();
  }
});
window.addEventListener('dblclick', e => {
  requestEnergyBridge();
  addRipple(e.clientX, e.clientY);
});

// -----------------------------------------------------------------------------
// ENERGY BRIDGE SYSTEM
// -----------------------------------------------------------------------------
let energyBridge = {
  isActive: false,
  progress: 0,
  startTime: 0,
  duration: 3000,
  cooldown: 3500,
  lastTrigger: Number.NEGATIVE_INFINITY,
  particles: [],
  pending: false,
  spawnAccumulator: 0
};

// -----------------------------------------------------------------------------
// BACKGROUND, HUD, AND VISUAL FX
// -----------------------------------------------------------------------------
const background = {
  particles: [],
  parallax: 0.12
};

const ripples = [];

const hudEl = document.getElementById('hud');
const paletteNameEl = document.getElementById('paletteName');
const bridgeStatusEl = document.getElementById('bridgeStatus');
let hudVisible = true;

function initBackground() {
  const area = canvas.width * canvas.height;
  const density = Math.min(260, Math.max(90, Math.round(area / 3600)));
  background.particles.length = 0;
  for (let i = 0; i < density; i++) {
    const depth = 0.25 + Math.random() * 0.75;
    background.particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      depth,
      size: 0.6 + depth * 1.4,
      driftX: (Math.random() - 0.5) * 6,
      driftY: (Math.random() - 0.5) * 4,
      twinkle: Math.random()
    });
  }
}

function updateBackground(dt, dxCore, dyCore) {
  const parallaxFactor = background.parallax;
  for (let i = 0; i < background.particles.length; i++) {
    const p = background.particles[i];
    const parallax = (1 - p.depth) * parallaxFactor;
    p.x -= dxCore * parallax;
    p.y -= dyCore * parallax;

    p.x += p.driftX * dt;
    p.y += p.driftY * dt;
    p.twinkle = (p.twinkle + dt * 0.35 + Math.random() * 0.01) % 1;

    if (p.x < -50) p.x += canvas.width + 100;
    else if (p.x > canvas.width + 50) p.x -= canvas.width + 100;
    if (p.y < -50) p.y += canvas.height + 100;
    else if (p.y > canvas.height + 50) p.y -= canvas.height + 100;
  }
}

function drawBackground() {
  const palette = getPalette();
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, palette.background.top);
  gradient.addColorStop(0.6, palette.background.mid);
  gradient.addColorStop(1, palette.background.bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  for (let i = 0; i < background.particles.length; i++) {
    const p = background.particles[i];
    const alpha = 0.2 + p.twinkle * 0.6;
    ctx.fillStyle = toRgba(palette.background.star, alpha);
    const size = p.size * (0.8 + p.twinkle * 0.6);
    ctx.beginPath();
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function addRipple(x, y) {
  ripples.push({
    x,
    y,
    start: performance.now(),
    lifespan: 900
  });
}

function drawRipples(now) {
  const palette = getPalette();
  const nowTime = now > 0 ? now : performance.now();
  for (let i = ripples.length - 1; i >= 0; i--) {
    const ripple = ripples[i];
    const age = nowTime - ripple.start;
    if (age > ripple.lifespan) {
      ripples.splice(i, 1);
      continue;
    }
    const t = age / ripple.lifespan;
    const radius = 30 + t * 180;
    const alpha = Math.max(0, 1 - t);
    ctx.strokeStyle = toRgba(palette.ripple, alpha * 0.35);
    ctx.lineWidth = 2 + t * 4;
    ctx.beginPath();
    ctx.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function setPalette(index) {
  paletteState.index = ((index % palettes.length) + palettes.length) % palettes.length;
  if (paletteNameEl) {
    paletteNameEl.textContent = getPalette().name;
  }
}

function cyclePalette(direction) {
  setPalette(paletteState.index + direction);
}

function updateHud(now) {
  const palette = getPalette();
  if (paletteNameEl) paletteNameEl.textContent = palette.name;

  if (!bridgeStatusEl) return;
  let status = 'Ready';
  const remaining = energyBridge.isActive
    ? 0
    : Math.max(0, (energyBridge.cooldown - (now - energyBridge.lastTrigger)) / 1000);

  if (energyBridge.isActive) {
    status = 'Bridge active';
  } else if (remaining > 0.05) {
    status = `Recharging (${remaining.toFixed(1)}s)`;
  }
  bridgeStatusEl.textContent = status;
}

function toggleHud() {
  hudVisible = !hudVisible;
  if (!hudEl) return;
  if (hudVisible) hudEl.classList.remove('hidden');
  else hudEl.classList.add('hidden');
}

function requestEnergyBridge() {
  energyBridge.pending = true;
}

function maybeActivateEnergyBridge(now) {
  if (!energyBridge.pending) return;
  energyBridge.pending = false;
  if (energyBridge.isActive) return;
  if (now - energyBridge.lastTrigger < energyBridge.cooldown) return;
  energyBridge.isActive = true;
  energyBridge.startTime = now;
  energyBridge.progress = 0;
  energyBridge.lastTrigger = now;
  energyBridge.particles.length = 0;
  energyBridge.spawnAccumulator = 0;
  addRipple(core.x, core.y);
}

function updateEnergyBridge(dt, now, tips) {
  if (!energyBridge.isActive) return;
  const elapsed = now - energyBridge.startTime;
  energyBridge.progress = Math.min(1, elapsed / energyBridge.duration);
  if (elapsed >= energyBridge.duration) {
    energyBridge.isActive = false;
    energyBridge.progress = 1;
    energyBridge.particles.length = 0;
    return;
  }

  const tipCount = Math.max(1, tips.length);
  const targetParticles = Math.min(120, tipCount * 4);
  energyBridge.spawnAccumulator += dt * tipCount * 1.2;
  while (energyBridge.spawnAccumulator > 1 && energyBridge.particles.length < targetParticles) {
    energyBridge.spawnAccumulator -= 1;
    energyBridge.particles.push({
      tipIndex: Math.floor(Math.random() * tipCount),
      t: Math.random() * 0.4,
      speed: 0.35 + Math.random() * 0.65
    });
  }

  for (let i = energyBridge.particles.length - 1; i >= 0; i--) {
    const p = energyBridge.particles[i];
    p.t += dt * p.speed;
    if (p.t > 1.1) {
      energyBridge.particles.splice(i, 1);
    }
  }
}

function projectPoint(point) {
  const { sx, sy } = project3D(point.x - core.x, point.y - core.y, point.z - core.z);
  return { x: core.x + sx, y: core.y + sy, z: point.z };
}

function drawEnergyBridge(now, tips) {
  if (!energyBridge.isActive) return;
  const palette = getPalette();
  const ease = Math.sin(Math.PI * energyBridge.progress);
  const source = { x: core.x, y: core.y, z: core.z };
  const stride = Math.max(1, Math.floor(tips.length / 8));
  const prevComposite = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';

  const innerColor = toRgba(palette.bridge.inner, 0.55 + ease * 0.25);
  const outerColor = toRgba(palette.bridge.outer, 0.25 + ease * 0.35);

  for (let i = 0; i < tips.length; i += stride) {
    const tip = tips[i];
    if (!tip) continue;
    const projTip = projectPoint(tip);
    const midX = (source.x + projTip.x) * 0.5;
    const midY = (source.y + projTip.y) * 0.5 - 80 * ease;

    ctx.strokeStyle = outerColor;
    ctx.lineWidth = 2.4 + ease * 1.6;
    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.quadraticCurveTo(midX, midY, projTip.x, projTip.y);
    ctx.stroke();

    ctx.strokeStyle = innerColor;
    ctx.lineWidth = 1.2 + ease * 1.2;
    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.quadraticCurveTo(midX, midY, projTip.x, projTip.y);
    ctx.stroke();
  }

  for (let i = 0; i < energyBridge.particles.length; i++) {
    const particle = energyBridge.particles[i];
    const tip = tips[particle.tipIndex];
    if (!tip) continue;
    const projTip = projectPoint(tip);
    const midX = (source.x + projTip.x) * 0.5;
    const midY = (source.y + projTip.y) * 0.5 - 80 * ease;
    const t = particle.t;

    const ax = source.x;
    const ay = source.y;
    const bx = projTip.x;
    const by = projTip.y;
    const cx = midX;
    const cy = midY;
    const u = 1 - t;
    const x = u * u * ax + 2 * u * t * cx + t * t * bx;
    const y = u * u * ay + 2 * u * t * cy + t * t * by;

    const alpha = Math.max(0, 0.35 + Math.sin(t * Math.PI) * 0.55);
    ctx.fillStyle = toRgba(palette.bridge.inner, alpha);
    ctx.beginPath();
    ctx.arc(x, y, 3.2 + Math.sin(t * Math.PI) * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = prevComposite;
}

// -----------------------------------------------------------------------------
// TENTACLE CLASS
// -----------------------------------------------------------------------------
class Tentacle {
  constructor(core, baseAngle, attachRadius) {
    this.core = core;
    this.baseAngle = baseAngle;
    this.attachRadius = attachRadius;
    this.segments = [];
    this.length = 30;
    this.segmentLength = 10;
    this.animation = Math.random() * 100;

    // Physics tuning
    this.iterations = 4;         // reduced for better performance
    this.airDamping = 0.995;     // slightly higher for stability
    this.bendStiffness = 0.08;   // increased for snappier response
    this.wave = {
      ampIdle: 0.18,
      ampActive: 0.33,
      speedIdle: 2.0,
      speedActive: 4.8,
      phaseOffset: 0.45
    };
    this.collisionPad = 2.5;     // keep segments outside orb by this margin
    this.zBias = 0.35 + Math.random() * 0.15; // out-of-plane bending bias for 3D look
    this.frictionStrength = 0.15; // 0..1, higher = more drag on canvas

    // Rotating anchor params
    this.anchorAngle = baseAngle;
    this.anchorAV = 0;
    this.anchorFriction = 0.9;
    this.anchorCoreInfluence = 0.6;
    this.anchorTensionInfluence = 0.15;
    this.anchorMaxAV = 6.0; // rad/s

    // Cache last attach position to inject core motion inertia
    this.lastAttachX = core.x + Math.cos(baseAngle) * attachRadius;
    this.lastAttachY = core.y + Math.sin(baseAngle) * attachRadius;
    this.lastAttachZ = 0;

    for (let i = 0; i < this.length; i++) {
      const x = core.x + Math.cos(baseAngle) * (attachRadius + i * this.segmentLength);
      const y = core.y + Math.sin(baseAngle) * (attachRadius + i * this.segmentLength);
      this.segments.push({
        x,
        y,
        z: 0,
        px: x,
        py: y,
        pz: 0,
        offset: i * 0.3 + Math.random() * 0.5
      });
    }
  }

  update(dt, time, isActive) {
    // Parameters
    const iter = this.iterations | 0;
    const damp = Math.pow(this.airDamping, Math.max(1, (dt * 60) || 1));
    const waveAmp = isActive ? this.wave.ampActive : this.wave.ampIdle;
    const waveSpeed = isActive ? this.wave.speedActive : this.wave.speedIdle;

    // Update rotating anchor angle (slides around orb circumference)
    {
      const tx = -Math.sin(this.anchorAngle);
      const ty =  Math.cos(this.anchorAngle);

      // Project core velocity onto tangent (scaled by radius)
      const coreTang = (this.core.vx * tx + this.core.vy * ty) / (this.attachRadius || 1);
      this.coreTangVel = coreTang;

      // Tension from first free segment projected onto tangent (use last attach for stability)
      let fTang = 0;
      if (this.segments.length > 1) {
        const s1 = this.segments[1];
        const ax = this.lastAttachX;
        const ay = this.lastAttachY;
        fTang = ((s1.x - ax) * tx + (s1.y - ay) * ty) / (this.segmentLength || 1);
      }

      const afr = Math.pow(this.anchorFriction, Math.max(1, (dt * 60) || 1));
      this.anchorAV = (this.anchorAV + this.anchorCoreInfluence * coreTang + this.anchorTensionInfluence * fTang) * afr;
      if (this.anchorAV > this.anchorMaxAV) this.anchorAV = this.anchorMaxAV;
      else if (this.anchorAV < -this.anchorMaxAV) this.anchorAV = -this.anchorMaxAV;

      // Accumulate for global spacing
      core._avAccum += this.anchorAV;
      core._avCount++;

      this.anchorAngle += this.anchorAV * dt;
      if (this.anchorAngle > Math.PI) this.anchorAngle -= Math.PI * 2;
      else if (this.anchorAngle < -Math.PI) this.anchorAngle += Math.PI * 2;
    }

    // Attachment point around orb’s circumference (uses rotating anchor)
    const attachX = this.core.x + Math.cos(this.anchorAngle) * this.attachRadius;
    const attachY = this.core.y + Math.sin(this.anchorAngle) * this.attachRadius;
    const attachZ = 0;

    // Pin root to attachment (Verlet pinned)
    const root = this.segments[0];
    root.x = attachX; root.y = attachY; root.z = attachZ;
    root.px = attachX; root.py = attachY; root.pz = attachZ;

    // Verlet integration for free segments with canvas friction
    for (let i = 1; i < this.segments.length; i++) {
      const p = this.segments[i];
      const vx = (p.x - p.px) * damp;
      const vy = (p.y - p.py) * damp;
      const vz = (p.z - p.pz) * damp;

      // Apply friction to simulate mop-like drag on canvas
      const friction = this.frictionStrength;
      const fx = -vx * friction;
      const fy = -vy * friction;
      const fz = -vz * friction;

      const nx = p.x + vx + fx;
      const ny = p.y + vy + fy;
      const nz = p.z + vz + fz;

      p.px = p.x; p.py = p.y; p.pz = p.z;
      p.x = nx;   p.y = ny;   p.z = nz;
    }

    // Inject a bit of the core motion into the first few segments to loosen trailing
    const vax = attachX - this.lastAttachX;
    const vay = attachY - this.lastAttachY;
    const vaz = attachZ - (this.lastAttachZ ?? 0);
    if (this.segments.length > 2) {
      this.segments[1].x += vax * 0.35;
      this.segments[1].y += vay * 0.35;
      this.segments[2].x += vax * 0.22;
      this.segments[2].y += vay * 0.22;
    }

    // Iterative constraint solver
    for (let k = 0; k < iter; k++) {
      // 1) Distance constraints to keep fixed segment length
      for (let i = 1; i < this.segments.length; i++) {
        const a = this.segments[i - 1];
        const b = this.segments[i];

        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dz = b.z - a.z;
        let dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        let diff = (dist - this.segmentLength) / dist;

        if (i - 1 === 0) {
          // Move only the free end when the previous is the pinned root (with some compliance)
          const comp = 0.6;
          b.x -= dx * diff * comp;
          b.y -= dy * diff * comp;
          b.z -= dz * diff * comp;
        } else {
          // Move both by half the correction
          const half = 0.5;
          const cx = dx * diff * half;
          const cy = dy * diff * half;
          const cz = dz * diff * half;
          a.x += cx; a.y += cy; a.z += cz;
          b.x -= cx; b.y -= cy; b.z -= cz;
        }
      }

      // Re-pin root after distance pass
      root.x = attachX; root.y = attachY; root.z = attachZ;

      // 2) Bend stiffness / curvature target (applied to middle points)
      for (let i = 1; i < this.segments.length - 1; i++) {
        const p0 = this.segments[i - 1];
        const p1 = this.segments[i];
        const p2 = this.segments[i + 1];

        const mx = (p0.x + p2.x) * 0.5;
        const my = (p0.y + p2.y) * 0.5;
        const mz = (p0.z + p2.z) * 0.5;

        // 3D tangent
        const tx3 = p2.x - p0.x;
        const ty3 = p2.y - p0.y;
        const tz3 = p2.z - p0.z;
        const tlen3 = Math.hypot(tx3, ty3, tz3) || 1;
        const tnx = tx3 / tlen3;
        const tny = ty3 / tlen3;
        const tnz = tz3 / tlen3;

        // Build a stable normal with out-of-plane bias.
        // Use radial (from core) and blend with global up (0,0,1) to get z.
        const rx = p1.x - this.core.x;
        const ry = p1.y - this.core.y;
        const rz = p1.z - 0;
        // Remove tangent component from radial to keep normal orthogonal to tangent
        const dotTR = rx * tnx + ry * tny + rz * tnz;
        let nx3 = rx - dotTR * tnx;
        let ny3 = ry - dotTR * tny;
        let nz3 = rz - dotTR * tnz;
        // Add global up bias to ensure out-of-plane movement
        nz3 += this.zBias * this.segmentLength;
        const nlen = Math.hypot(nx3, ny3, nz3) || 1;
        nx3 /= nlen; ny3 /= nlen; nz3 /= nlen;

        // traveling wave curvature
        const phase = time * 0.001 * waveSpeed - i * this.wave.phaseOffset + this.animation;
        // Amplitude envelope (tail stronger) and active gain by tangential speed
        const idxT = i / (this.segments.length - 1);
        const env = 0.6 + (1.25 - 0.6) * idxT; // base->tip
        const coreGain = Math.min(1.6, Math.max(0.8, 0.8 + 0.6 * Math.abs(this.coreTangVel || 0)));
        const curvature = waveAmp * env * coreGain * Math.sin(phase);

        const targetX = mx + nx3 * curvature * this.segmentLength;
        const targetY = my + ny3 * curvature * this.segmentLength;
        const targetZ = mz + nz3 * curvature * this.segmentLength;

        p1.x += (targetX - p1.x) * this.bendStiffness;
        p1.y += (targetY - p1.y) * this.bendStiffness;
        p1.z += (targetZ - p1.z) * this.bendStiffness;
      }

      // Collision with orb to keep segments outside radius
      const minR = this.attachRadius + this.collisionPad;
      for (let j = 1; j < this.segments.length; j++) {
        const p = this.segments[j];
        let dx = p.x - this.core.x;
        let dy = p.y - this.core.y;
        let dz = p.z - 0;
        let distc = Math.hypot(dx, dy, dz);
        if (distc < minR) {
          if (distc < 1e-6) {
            dx = Math.cos(this.anchorAngle);
            dy = Math.sin(this.anchorAngle);
            dz = 0;
            distc = 1;
          }
          const nx = dx / distc;
          const ny = dy / distc;
          const nz = dz / distc;
          p.x = this.core.x + nx * minR;
          p.y = this.core.y + ny * minR;
          p.z = 0 + nz * minR;
        }
      }
      // Ensure segment lines do not cross the orb (line-circle resolution)
      for (let j = 1; j < this.segments.length; j++) {
        const a = this.segments[j - 1];
        const b = this.segments[j];
        const vx = b.x - a.x;
        const vy = b.y - a.y;
        const vz = b.z - a.z;
        const denom = vx * vx + vy * vy + vz * vz || 1;
        const wx = this.core.x - a.x;
        const wy = this.core.y - a.y;
        const wz = 0 - a.z;
        let t = (vx * wx + vy * wy + vz * wz) / denom;
        if (t < 0) t = 0;
        else if (t > 1) t = 1;
        const cx = a.x + vx * t;
        const cy = a.y + vy * t;
        const cz = a.z + vz * t;

        let ndx = cx - this.core.x;
        let ndy = cy - this.core.y;
        let ndz = cz - 0;
        let d = Math.hypot(ndx, ndy, ndz);
        if (d < minR) {
          if (d < 1e-6) {
            ndx = Math.cos(this.anchorAngle);
            ndy = Math.sin(this.anchorAngle);
            ndz = 0;
            d = 1;
          }
          const nx = ndx / d;
          const ny = ndy / d;
          const nz = ndz / d;
          const push = (minR - d);
          // Push the free end primarily
          b.x += nx * push;
          b.y += ny * push;
          b.z += nz * push;
          if (j > 1) {
            a.x += nx * push * 0.2;
            a.y += ny * push * 0.2;
            a.z += nz * push * 0.2;
          }
        }
      }

      // Re-pin root after bend/collision pass
      root.x = attachX; root.y = attachY; root.z = attachZ;
    }

    // Cache attach for next frame inertia
    this.lastAttachX = attachX;
    this.lastAttachY = attachY;
    this.lastAttachZ = attachZ;

    // Apply global spacing nudge
    const targetAngle = this.baseAngle + anchorRing.offset;
    let angleDiff = targetAngle - this.anchorAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    this.anchorAV += angleDiff * 0.1; // spacingInfluence

    // Neighbor repulsion to prevent anchors from touching/crossing
    const repulsionStrength = 0.5;
    const minAngle = Math.PI * 2 / tentacles.length;
    for (let j = 0; j < tentacles.length; j++) {
      if (tentacles[j] === this) continue;
      let otherAngle = tentacles[j].anchorAngle;
      let diff = otherAngle - this.anchorAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) < minAngle * 0.8) {
        const sign = diff > 0 ? 1 : -1;
        this.anchorAV -= sign * repulsionStrength * (minAngle * 0.8 - Math.abs(diff)) / (minAngle * 0.8);
      }
    }
  }

  draw(ctx) {
    // Project all points
    const proj = this.segments.map(p => {
      const { sx, sy, scale } = project3D(p.x - core.x, p.y - core.y, p.z - core.z);
      return { sx: core.x + sx, sy: core.y + sy, z: p.z, scale };
    });
    const palette = getPalette();

    // Collect segments into back/front lists by average z
    const back = [];
    const front = [];
    for (let i = 1; i < proj.length; i++) {
      const a = proj[i - 1], b = proj[i];
      const avgZ = (this.segments[i - 1].z + this.segments[i].z) * 0.5;
      const seg = { a, b, avgZ, i, ar: this.attachRadius, len: this.segments.length };
      if (avgZ < 0) back.push(seg); else front.push(seg);
    }
    // Depth-sort for better occlusion: back (farther first), front (nearer first)
    back.sort((s1, s2) => s1.avgZ - s2.avgZ);
    front.sort((s1, s2) => s2.avgZ - s1.avgZ);

    // Helper to draw segments list
    const drawSegs = (list) => {
      for (const s of list) {
        const depthAlpha = Math.min(1, Math.max(0.2, 0.7 + (s.avgZ / (this.attachRadius * 2))));
        ctx.strokeStyle = toRgba(palette.tentacle, depthAlpha);
        // Average scale for width modulation
        const wscale = (s.a.scale + s.b.scale) * 0.5;
        const t = s.i / (this.segments.length - 1);
        const baseW = 6.4, tipW = 3.2;
        const width = (baseW + (tipW - baseW) * t) * Math.min(2.0, Math.max(0.6, wscale * 0.02));
        ctx.lineWidth = width;
        ctx.shadowColor = toRgba(palette.glow, 0.6);
        ctx.shadowBlur = 8;

        ctx.beginPath();
        ctx.moveTo(s.a.sx, s.a.sy);
        ctx.lineTo(s.b.sx, s.b.sy);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    };

    // Draw back segments now; front segments after orb
    drawSegs(back);
    // Save front segments to be drawn by caller after orb
    return { front };
  }
}

// -----------------------------------------------------------------------------
// CORE
// -----------------------------------------------------------------------------
const core = { x: canvas.width / 2, y: canvas.height / 2, z: 0, vx: 0, vy: 0 };
const tentacles = [];
const tentacleCount = 30;
const radius = 50; // Bigger orb

for (let i = 0; i < tentacleCount; i++) {
  const angle = (Math.PI * 2 / tentacleCount) * i;
  tentacles.push(new Tentacle(core, angle, radius)); // attach further from center
}

// -----------------------------------------------------------------------------
// CORE DRAW
// -----------------------------------------------------------------------------
function drawCore() {
  const { scale } = project3D(0, 0, 0);
  const r2d = radius * scale;
  const palette = getPalette();
  const gradient = ctx.createRadialGradient(core.x, core.y, 0, core.x, core.y, r2d);
  gradient.addColorStop(0, toRgba(palette.orb.inner, palette.orb.inner.a ?? 1));
  gradient.addColorStop(0.35, toRgba(palette.orb.mid, palette.orb.mid.a ?? 0.75));
  gradient.addColorStop(1, toRgba(palette.orb.outer, palette.orb.outer.a ?? 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(core.x, core.y, r2d, 0, Math.PI * 2);
  ctx.fill();

  // Halo accent when the energy bridge is active
  if (energyBridge.isActive) {
    const pulse = 0.4 + Math.sin(Math.PI * energyBridge.progress) * 0.35;
    ctx.strokeStyle = toRgba(palette.bridge.inner, 0.35 + pulse * 0.3);
    ctx.lineWidth = 4 + pulse * 6;
    ctx.beginPath();
    ctx.arc(core.x, core.y, r2d * (1.05 + pulse * 0.25), 0, Math.PI * 2);
    ctx.stroke();
  }
}

// -----------------------------------------------------------------------------
// ANIMATION LOOP
// -----------------------------------------------------------------------------
let lastTime = 0;
let lastCoreX = core.x;
let lastCoreY = core.y;
function animate(time) {
  const dt = (time - lastTime) * 0.001;
  lastTime = time;
  maybeActivateEnergyBridge(time);

  // Core follows mouse smoothly (physics untouched)
  const stiffness = 0.02;
  const drag = 0.85;
  const dx = mouse.x - core.x;
  const dy = mouse.y - core.y;
  if (mouse.isDown) {
    core.vx += dx * stiffness;
    core.vy += dy * stiffness;
  }
  core.vx *= drag;
  core.vy *= drag;
  core.x += core.vx;
  core.y += core.vy;

  const deltaCoreX = core.x - lastCoreX;
  const deltaCoreY = core.y - lastCoreY;
  lastCoreX = core.x;
  lastCoreY = core.y;

  updateBackground(dt, deltaCoreX, deltaCoreY);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();

  const isDragging = mouse.isDown;

  // Reset global anchor ring accumulators
  core._avAccum = 0;
  core._avCount = 0;

  // Update + draw tentacles (back segments first)
  const frontSegments = [];
  const tentacleTips = [];
  for (let t of tentacles) {
    t.update(dt, time, isDragging);
    tentacleTips.push(t.segments[t.segments.length - 1]);
    const res = t.draw(ctx);
    if (res && res.front) frontSegments.push(...res.front);
  }

  // Update global anchor ring rotation based on accumulated contributions (enforces equal spacing)
  if (core._avCount > 0) {
    const afr = Math.pow(anchorRing.friction, Math.max(1, (dt * 60) || 1));
    const avg = core._avAccum / core._avCount;
    anchorRing.av = (anchorRing.av + avg) * afr;
    if (anchorRing.av > anchorRing.maxAV) anchorRing.av = anchorRing.maxAV;
    else if (anchorRing.av < -anchorRing.maxAV) anchorRing.av = -anchorRing.maxAV;
    anchorRing.offset += anchorRing.av * dt;
    if (anchorRing.offset > Math.PI) anchorRing.offset -= Math.PI * 2;
    else if (anchorRing.offset < -Math.PI) anchorRing.offset += Math.PI * 2;
  }

  // Draw orb glow (projected)
  drawCore();

  // Draw front segments (in front of orb)
  const palette = getPalette();
  for (const s of frontSegments) {
    const depthAlpha = Math.min(1, Math.max(0.2, 0.7 + (s.avgZ / (s.ar * 2))));
    ctx.strokeStyle = toRgba(palette.tentacle, depthAlpha);
    const wscale = (s.a.scale + s.b.scale) * 0.5;
    const tNorm = s.i / (s.len - 1);
    const baseW = 6.4, tipW = 3.2;
    const width = (baseW + (tipW - baseW) * tNorm) * Math.min(2.0, Math.max(0.6, wscale * 0.02));
    ctx.lineWidth = width;
    ctx.shadowColor = toRgba(palette.glow, 0.6);
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(s.a.sx, s.a.sy);
    ctx.lineTo(s.b.sx, s.b.sy);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  updateEnergyBridge(dt, time, tentacleTips);
  drawEnergyBridge(time, tentacleTips);
  drawRipples(time);
  updateHud(time);

  requestAnimationFrame(animate);
}

initBackground();
setPalette(paletteState.index);
updateHud(0);
animate(0);
