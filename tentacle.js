const canvas = document.getElementById('tentacleCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

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

let energyBridge = {
  isActive: false,
  progress: 0,
  startTime: 0,
  duration: 3000,
  particles: []
};

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
        offset: i * 0.3 + Math.random() * 0.5
      });
    }
  }

  update(time) {
    let prev = { x: this.core.x, y: this.core.y };
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      const angleOffset = Math.sin(time * 0.002 + seg.offset + this.animation) * 0.4;
      const dir = this.angle + angleOffset;

      seg.x = prev.x + Math.cos(dir) * this.segmentLength;
      seg.y = prev.y + Math.sin(dir) * this.segmentLength;

      prev = seg;
    }
  }

  draw(ctx) {
    ctx.beginPath();
    ctx.moveTo(this.core.x, this.core.y);
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      ctx.lineTo(seg.x, seg.y);
    }
    ctx.strokeStyle = this.gradient || 'rgba(0, 150, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

const core = { x: canvas.width / 2, y: canvas.height / 2 };
const tentacles = [];
const tentacleCount = 10;
const radius = 60;

for (let i = 0; i < tentacleCount; i++) {
  const angle = (Math.PI * 2 / tentacleCount) * i;
  tentacles.push(new Tentacle(core, angle));
}

function drawCore() {
  const gradient = ctx.createRadialGradient(core.x, core.y, 0, core.x, core.y, radius);
  gradient.addColorStop(0, 'rgba(0,150,255,0.9)');
  gradient.addColorStop(1, 'rgba(0,0,50,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(core.x, core.y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function animate(time) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Update tentacles
  for (let t of tentacles) {
    t.update(time);
    t.draw(ctx);
  }

  // Draw core
  drawCore();

  // Smooth core movement toward mouse when dragging
  if (mouse.isDown) {
    core.x += (mouse.x - core.x) * 0.15;
    core.y += (mouse.y - core.y) * 0.15;
  }

  requestAnimationFrame(animate);
}

animate(0);
