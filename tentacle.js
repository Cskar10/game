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
    this.iterations = 6;         // fewer iterations = looser feel
    this.airDamping = 0.993;     // higher = more inertia/trailing
    this.bendStiffness = 0.05;   // smaller = less stiffness/kinks
    this.wave = {
      ampIdle: 0.22,             // more visible idle sway
      ampActive: 0.05,           // almost no wave while dragging
      speedIdle: 1.4,
      speedActive: 3.2,
      phaseOffset: 0.45
    };
    this.collisionPad = 2.5;     // keep segments outside orb by this margin

    // Cache last attach position to inject core motion inertia
    this.lastAttachX = core.x + Math.cos(baseAngle) * attachRadius;
    this.lastAttachY = core.y + Math.sin(baseAngle) * attachRadius;

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

    // Inject a bit of the core motion into the first few segments to loosen trailing
    const vax = attachX - this.lastAttachX;
    const vay = attachY - this.lastAttachY;
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
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        let diff = (dist - this.segmentLength) / dist;

        if (i - 1 === 0) {
          // Move only the free end when the previous is the pinned root (with some compliance)
          const comp = 0.6;
          b.x -= dx * diff * comp;
          b.y -= dy * diff * comp;
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

      // Collision with orb to keep segments outside radius
      const minR = this.attachRadius + this.collisionPad;
      for (let j = 1; j < this.segments.length; j++) {
        const p = this.segments[j];
        let dx = p.x - this.core.x;
        let dy = p.y - this.core.y;
        let distc = Math.hypot(dx, dy);
        if (distc < minR) {
          if (distc < 1e-6) {
            dx = Math.cos(this.baseAngle);
            dy = Math.sin(this.baseAngle);
            distc = 1;
          }
          const nx = dx / distc;
          const ny = dy / distc;
          p.x = this.core.x + nx * minR;
          p.y = this.core.y + ny * minR;
        }
      }
      // Ensure segment lines do not cross the orb (line-circle resolution)
      for (let j = 1; j < this.segments.length; j++) {
        const a = this.segments[j - 1];
        const b = this.segments[j];
        const vx = b.x - a.x;
        const vy = b.y - a.y;
        const denom = vx * vx + vy * vy || 1;
        const wx = this.core.x - a.x;
        const wy = this.core.y - a.y;
        let t = (vx * wx + vy * wy) / denom;
        if (t < 0) t = 0;
        else if (t > 1) t = 1;
        const cx = a.x + vx * t;
        const cy = a.y + vy * t;

        let ndx = cx - this.core.x;
        let ndy = cy - this.core.y;
        let d = Math.hypot(ndx, ndy);
        if (d < minR) {
          if (d < 1e-6) {
            ndx = Math.cos(this.baseAngle);
            ndy = Math.sin(this.baseAngle);
            d = 1;
          }
          const nx = ndx / d;
          const ny = ndy / d;
          const push = (minR - d);
          // Push the free end primarily
          b.x += nx * push;
          b.y += ny * push;
          if (j > 1) {
            a.x += nx * push * 0.2;
            a.y += ny * push * 0.2;
          }
        }
      }

      // Re-pin root after bend/collision pass
      root.x = attachX; root.y = attachY;
    }

    // Cache attach for next frame inertia
    this.lastAttachX = attachX;
    this.lastAttachY = attachY;
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

  const isDragging = mouse.isDown;

  // Update + draw tentacles
  for (let t of tentacles) {
    t.update(dt, time, isDragging);
    t.draw(ctx);
  }

  // Draw orb glow
  drawCore();

  requestAnimationFrame(animate);
}

animate(0);
