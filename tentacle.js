const canvas = document.getElementById('tentacleCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// -----------------------------------------------------------------------------
// INPUT
// -----------------------------------------------------------------------------
const mouse = { x: canvas.width / 2, y: canvas.height / 2, isDown: false };
window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});
window.addEventListener('mousedown', e => {
  mouse.isDown = true;
  mouse.x = e.clientX;
  mouse.y = e.clientY;
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

// -----------------------------------------------------------------------------
// ENERGY BRIDGE SYSTEM
// -----------------------------------------------------------------------------
let energyBridge = {
  isActive: false,
  progress: 0,
  startTime: 0,
  duration: 3000,
  particles: []
};

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
    this.iterations = 8;        // constraint iterations per frame
    this.airDamping = 0.985;    // 0..1, higher = more inertia
    this.bendStiffness = 0.08;  // 0..1, small for stability
    this.wave = {
      ampIdle: 0.12,
      ampActive: 0.28,
      speedIdle: 2.2,
      speedActive: 4.2,
      phaseOffset: 0.45
    };

    for (let i = 0; i < this.length; i++) {
      const x = core.x + Math.cos(baseAngle) * (attachRadius + i * this.segmentLength);
      const y = core.y + Math.sin(baseAngle) * (attachRadius + i * this.segmentLength);
      this.segments.push({
        x,
        y,
        px: x,
        py: y,
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

    // Attachment point around orb’s circumference
    const attachX = this.core.x + Math.cos(this.baseAngle) * this.attachRadius;
    const attachY = this.core.y + Math.sin(this.baseAngle) * this.attachRadius;

    // Pin root to attachment (Verlet pinned)
    const root = this.segments[0];
    root.x = attachX; root.y = attachY;
    root.px = attachX; root.py = attachY;

    // Verlet integration for free segments
    for (let i = 1; i < this.segments.length; i++) {
      const p = this.segments[i];
      const vx = (p.x - p.px) * damp;
      const vy = (p.y - p.py) * damp;

      const nx = p.x + vx;
      const ny = p.y + vy;

      p.px = p.x; p.py = p.y;
      p.x = nx;   p.y = ny;
    }

    // Iterative constraint solver
    for (let k = 0; k < iter; k++) {
      // 1) Distance constraints to keep fixed segment length
      for (let i = 1; i < this.segments.length; i++) {
        const a = this.segments[i - 1];
        const b = this.segments[i];

        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        let diff = (dist - this.segmentLength) / dist;

        if (i - 1 === 0) {
          // Move only the free end when the previous is the pinned root
          b.x -= dx * diff;
          b.y -= dy * diff;
        } else {
          // Move both by half the correction
          const half = 0.5;
          const cx = dx * diff * half;
          const cy = dy * diff * half;
          a.x += cx; a.y += cy;
          b.x -= cx; b.y -= cy;
        }
      }

      // Re-pin root after distance pass
      root.x = attachX; root.y = attachY;

      // 2) Bend stiffness / curvature target (applied to middle points)
      for (let i = 1; i < this.segments.length - 1; i++) {
        const p0 = this.segments[i - 1];
        const p1 = this.segments[i];
        const p2 = this.segments[i + 1];

        const mx = (p0.x + p2.x) * 0.5;
        const my = (p0.y + p2.y) * 0.5;

        const tx = p2.x - p0.x;
        const ty = p2.y - p0.y;
        const tlen = Math.hypot(tx, ty) || 1;

        // normal to tangent
        const nx = -ty / tlen;
        const ny =  tx / tlen;

        // traveling wave curvature
        const phase = time * 0.001 * waveSpeed - i * this.wave.phaseOffset + this.animation;
        const curvature = waveAmp * Math.sin(phase);

        const targetX = mx + nx * curvature * this.segmentLength;
        const targetY = my + ny * curvature * this.segmentLength;

        p1.x += (targetX - p1.x) * this.bendStiffness;
        p1.y += (targetY - p1.y) * this.bendStiffness;
      }

      // Re-pin root after bend pass
      root.x = attachX; root.y = attachY;
    }
  }

  draw(ctx) {
    ctx.beginPath();
    ctx.moveTo(this.segments[0].x, this.segments[0].y);
    for (let i = 1; i < this.segments.length; i++) {
      const seg = this.segments[i];
      ctx.lineTo(seg.x, seg.y);
    }

    const grad = ctx.createLinearGradient(
      this.segments[0].x, this.segments[0].y,
      this.segments[this.segments.length - 1].x,
      this.segments[this.segments.length - 1].y
    );
    grad.addColorStop(0, 'rgba(0,200,255,0.9)');
    grad.addColorStop(1, 'rgba(0,50,150,0.1)');

    ctx.strokeStyle = grad;
    ctx.lineWidth = 2.2;
    ctx.shadowColor = 'rgba(0,150,255,0.8)';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

// -----------------------------------------------------------------------------
// CORE
// -----------------------------------------------------------------------------
const core = { x: canvas.width / 2, y: canvas.height / 2, vx: 0, vy: 0 };
const tentacles = [];
const tentacleCount = 15;
const radius = 50; // Bigger orb

for (let i = 0; i < tentacleCount; i++) {
  const angle = (Math.PI * 2 / tentacleCount) * i;
  tentacles.push(new Tentacle(core, angle, radius)); // attach further from center
}

// -----------------------------------------------------------------------------
// CORE DRAW
// -----------------------------------------------------------------------------
function drawCore() {
  const gradient = ctx.createRadialGradient(core.x, core.y, 0, core.x, core.y, radius);
  gradient.addColorStop(0, 'rgba(0,180,255,1)');
  gradient.addColorStop(0.3, 'rgba(0,150,255,0.8)');
  gradient.addColorStop(1, 'rgba(0,0,30,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(core.x, core.y, radius, 0, Math.PI * 2);
  ctx.fill();
}

// -----------------------------------------------------------------------------
// ANIMATION LOOP
// -----------------------------------------------------------------------------
let lastTime = 0;
function animate(time) {
  const dt = (time - lastTime) * 0.001;
  lastTime = time;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Core follows mouse smoothly
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

  const isActive = mouse.isDown || Math.abs(core.vx) > 0.5 || Math.abs(core.vy) > 0.5;

  // Update + draw tentacles
  for (let t of tentacles) {
    t.update(dt, time, isActive);
    t.draw(ctx);
  }

  // Draw orb glow
  drawCore();

  requestAnimationFrame(animate);
}

animate(0);
