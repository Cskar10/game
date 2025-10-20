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
    this.elasticity = 0.25;
    this.damping = 0.9;
    this.restAngle = baseAngle;

    for (let i = 0; i < this.length; i++) {
      this.segments.push({
        x: core.x + Math.cos(baseAngle) * (attachRadius + i * this.segmentLength),
        y: core.y + Math.sin(baseAngle) * (attachRadius + i * this.segmentLength),
        vx: 0,
        vy: 0,
        offset: i * 0.3 + Math.random() * 0.5
      });
    }
  }

  update(dt, time, isActive) {
    const waveAmplitude = isActive ? 0.4 : 0.6; // softer waves when idle
    const stiffness = isActive ? 0.25 : 0.1; // less pull in idle state

    // Tentacle attachment point around orb’s circumference
    const attachX = this.core.x + Math.cos(this.baseAngle) * this.attachRadius;
    const attachY = this.core.y + Math.sin(this.baseAngle) * this.attachRadius;
    this.segments[0].x = attachX;
    this.segments[0].y = attachY;

    // Update each segment like a flexible spring chain
    for (let i = 1; i < this.segments.length; i++) {
      const prev = this.segments[i - 1];
      const seg = this.segments[i];

      // Distance constraint
      const dx = seg.x - prev.x;
      const dy = seg.y - prev.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const diff = (dist - this.segmentLength) / dist;

      // Elastic correction (subtle)
      seg.x -= dx * diff * stiffness;
      seg.y -= dy * diff * stiffness;

      // Oscillation wave — idle tentacles sway gently
      const oscillation = Math.sin(time * 0.002 + seg.offset + this.animation) * waveAmplitude;
      seg.x += Math.cos(this.restAngle + Math.PI / 2) * oscillation;
      seg.y += Math.sin(this.restAngle + Math.PI / 2) * oscillation;

      // Damping (reduces jitter)
      seg.vx *= this.damping;
      seg.vy *= this.damping;
      seg.x += seg.vx;
      seg.y += seg.vy;
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
const tentacleCount = 10;
const radius = 100; // Bigger orb

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
