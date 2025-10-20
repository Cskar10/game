const canvas = document.getElementById('tentacleCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// -----------------------------------------------------------------------------
// INPUT HANDLING
// -----------------------------------------------------------------------------
const mouse = { x: canvas.width / 2, y: canvas.height / 2, isDown: false };
window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});
window.addEventListener('mousedown', e => { mouse.isDown = true; mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('mouseup', () => { mouse.isDown = false; });
window.addEventListener('mousemove', e => { if (mouse.isDown) { mouse.x = e.clientX; mouse.y = e.clientY; } });

// -----------------------------------------------------------------------------
// ENERGY BRIDGE STRUCTURE
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
  constructor(core, angle) {
    this.core = core;
    this.angle = angle;
    this.segments = [];
    this.length = 30;
    this.segmentLength = 10;
    this.animation = Math.random() * 100;
    this.elasticity = 0.25; // spring pullback strength
    this.damping = 0.9;     // velocity retention
    this.recoilForce = 0.15; // recoil after overextension
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
    const waveAmplitude = 0.4;

    // Root segment follows the core
    this.segments[0].x = this.core.x;
    this.segments[0].y = this.core.y;

    for (let i = 1; i < this.segments.length; i++) {
      const prev = this.segments[i - 1];
      const seg = this.segments[i];

      // Distance constraint
      const dx = seg.x - prev.x;
      const dy = seg.y - prev.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const diff = (dist - this.segmentLength) / dist;

      // Apply spring-like correction (elastic tension)
      const tensionX = dx * diff * this.elasticity;
      const tensionY = dy * diff * this.elasticity;
      seg.x -= tensionX;
      seg.y -= tensionY;

      // Add recoil if stretched too far
      if (Math.abs(dist - this.segmentLength) > this.segmentLength * 0.6) {
        seg.vx -= tensionX * this.recoilForce;
        seg.vy -= tensionY * this.recoilForce;
      }

      // Oscillating sine movement
      const oscillation = Math.sin(time * 0.002 + seg.offset + this.animation) * waveAmplitude;
      seg.x += Math.cos(this.angle + Math.PI / 2) * oscillation;
      seg.y += Math.sin(this.angle + Math.PI / 2) * oscillation;

      // Apply velocity + damping
      seg.vx = (seg.vx + tensionX * -0.1) * this.damping;
      seg.vy = (seg.vy + tensionY * -0.1) * this.damping;
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

    // Smooth glow gradient per tentacle
    const grad = ctx.createLinearGradient(
      this.segments[0].x, this.segments[0].y,
      this.segments[this.segments.length - 1].x,
      this.segments[this.segments.length - 1].y
    );
    grad.addColorStop(0, 'rgba(0,200,255,0.9)');
    grad.addColorStop(1, 'rgba(0,50,150,0.1)');

    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(0, 150, 255, 0.8)';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

// -----------------------------------------------------------------------------
// CORE SETUP
// -----------------------------------------------------------------------------
const core = { x: canvas.width / 2, y: canvas.height / 2, vx: 0, vy: 0 };
const tentacles = [];
const tentacleCount = 10;
const radius = 60;

for (let i = 0; i < tentacleCount; i++) {
  const angle = (Math.PI * 2 / tentacleCount) * i;
  tentacles.push(new Tentacle(core, angle));
}

// -----------------------------------------------------------------------------
// CORE DRAW
// -----------------------------------------------------------------------------
function drawCore() {
  const gradient = ctx.createRadialGradient(core.x, core.y, 0, core.x, core.y, radius);
  gradient.addColorStop(0, 'rgba(0,150,255,1)');
  gradient.addColorStop(0.4, 'rgba(0,150,255,0.6)');
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

  // Core follows mouse with spring physics
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

  // Update + draw tentacles
  for (let t of tentacles) {
    t.update(dt, time);
    t.draw(ctx);
  }

  // Draw core glow
  drawCore();

  requestAnimationFrame(animate);
}

animate(0);
