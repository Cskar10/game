const canvas = document.getElementById('tentacleCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const mouse = { x: canvas.width / 2, y: canvas.height / 2, isDown: false };
window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});
window.addEventListener('mousedown', e => { mouse.isDown = true; mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('mouseup', () => { mouse.isDown = false; });
window.addEventListener('mousemove', e => { if (mouse.isDown) { mouse.x = e.clientX; mouse.y = e.clientY; } });

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
// TENTACLE CLASS WITH PHYSICS
// -----------------------------------------------------------------------------
class Tentacle {
  constructor(core, angle) {
    this.core = core;
    this.angle = angle;
    this.segments = [];
    this.length = 30;
    this.segmentLength = 10;
    this.gradient = null;
    this.animation = Math.random() * 100;

    for (let i = 0; i < this.length; i++) {
      this.segments.push({
        x: core.x,
        y: core.y,
        vx: 0,
        vy: 0,
        offset: i * 0.3 + Math.random() * 0.5
      });
    }
  }

  update(dt, time) {
    const stiffness = 0.2;     // how strongly each segment follows the previous one
    const damping = 0.8;       // energy loss per frame
    const spread = 0.15;       // how far apart they try to stay
    const wave = 0.4;          // sine-based animation wave amplitude

    // The root (segment 0) follows the core position
    this.segments[0].x = this.core.x;
    this.segments[0].y = this.core.y;

    // Update each segment position with spring-like behavior
    for (let i = 1; i < this.segments.length; i++) {
      const prev = this.segments[i - 1];
      const seg = this.segments[i];

      // Target distance from previous segment
      const dx = seg.x - prev.x;
      const dy = seg.y - prev.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const diff = (dist - this.segmentLength) / dist;

      // Add spring force
      seg.x -= dx * diff * stiffness;
      seg.y -= dy * diff * stiffness;

      // Add oscillation (subtle wave)
      const oscillation = Math.sin(time * 0.002 + seg.offset + this.animation) * wave;
      seg.x += Math.cos(this.angle + Math.PI / 2) * oscillation;
      seg.y += Math.sin(this.angle + Math.PI / 2) * oscillation;

      // Simple Verlet integration with damping
      seg.vx = (seg.vx + (seg.x - seg.prevX || 0)) * damping;
      seg.vy = (seg.vy + (seg.y - seg.prevY || 0)) * damping;
      seg.prevX = seg.x;
      seg.prevY = seg.y;
    }
  }

  draw(ctx) {
    ctx.beginPath();
    ctx.moveTo(this.segments[0].x, this.segments[0].y);
    for (let i = 1; i < this.segments.length; i++) {
      const seg = this.segments[i];
      ctx.lineTo(seg.x, seg.y);
    }
    ctx.strokeStyle = this.gradient || 'rgba(0, 200, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(0, 150, 255, 0.7)';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

// -----------------------------------------------------------------------------
// CORE & TENTACLES INITIALIZATION
// -----------------------------------------------------------------------------
const core = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  vx: 0,
  vy: 0
};

const tentacles = [];
const tentacleCount = 10;
const radius = 60;

for (let i = 0; i < tentacleCount; i++) {
  const angle = (Math.PI * 2 / tentacleCount) * i;
  tentacles.push(new Tentacle(core, angle));
}

// -----------------------------------------------------------------------------
// CORE DRAWING
// -----------------------------------------------------------------------------
function drawCore() {
  const gradient = ctx.createRadialGradient(core.x, core.y, 0, core.x, core.y, radius);
  gradient.addColorStop(0, 'rgba(0,150,255,0.9)');
  gradient.addColorStop(1, 'rgba(0,0,50,0)');
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
  const dt = (time - lastTime) * 0.001; // delta time in seconds
  lastTime = time;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Update core position physics
  if (mouse.isDown) {
    // target follow with springiness
    const dx = mouse.x - core.x;
    const dy = mouse.y - core.y;
    core.vx += dx * 0.02;
    core.vy += dy * 0.02;
  }
  core.vx *= 0.85;
  core.vy *= 0.85;
  core.x += core.vx;
  core.y += core.vy;

  // Update and draw tentacles
  for (let t of tentacles) {
    t.update(dt, time);
    t.draw(ctx);
  }

  // Draw glowing orb
  drawCore();

  requestAnimationFrame(animate);
}

animate(0);
