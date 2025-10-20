const canvas = document.getElementById('tentacleCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

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
    this.zBias = 0.35 + Math.random() * 0.15; // out-of-plane bending bias for 3D look

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

    // Verlet integration for free segments
    for (let i = 1; i < this.segments.length; i++) {
      const p = this.segments[i];
      const vx = (p.x - p.px) * damp;
      const vy = (p.y - p.py) * damp;
      const vz = (p.z - p.pz) * damp;

      const nx = p.x + vx;
      const ny = p.y + vy;
      const nz = p.z + vz;

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
        const curvature = waveAmp * Math.sin(phase);

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
  }

  draw(ctx) {
    // Project all points
    const proj = this.segments.map(p => {
      const { sx, sy, scale } = project3D(p.x - core.x, p.y - core.y, p.z - core.z);
      return { sx: core.x + sx, sy: core.y + sy, z: p.z, scale };
    });

    // Collect segments into back/front lists by average z
    const back = [];
    const front = [];
    for (let i = 1; i < proj.length; i++) {
      const a = proj[i - 1], b = proj[i];
      const avgZ = (this.segments[i - 1].z + this.segments[i].z) * 0.5;
      const seg = { a, b, avgZ, i, ar: this.attachRadius };
      if (avgZ < 0) back.push(seg); else front.push(seg);
    }
    // Depth-sort for better occlusion: back (farther first), front (nearer first)
    back.sort((s1, s2) => s1.avgZ - s2.avgZ);
    front.sort((s1, s2) => s2.avgZ - s1.avgZ);

    // Helper to draw segments list
    const drawSegs = (list) => {
      for (const s of list) {
        const depthAlpha = Math.min(1, Math.max(0.2, 0.7 + (s.avgZ / (this.attachRadius * 2))));
        ctx.strokeStyle = `rgba(0,200,255,${depthAlpha})`;
        // Average scale for width modulation
        const wscale = (s.a.scale + s.b.scale) * 0.5;
        ctx.lineWidth = 1.5 * Math.min(2.0, Math.max(0.6, wscale * 0.02));
        ctx.shadowColor = 'rgba(0,150,255,0.6)';
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
  const { scale } = project3D(0, 0, 0);
  const r2d = radius * scale;
  const gradient = ctx.createRadialGradient(core.x, core.y, 0, core.x, core.y, r2d);
  gradient.addColorStop(0, 'rgba(0,180,255,1)');
  gradient.addColorStop(0.3, 'rgba(0,150,255,0.8)');
  gradient.addColorStop(1, 'rgba(0,0,30,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(core.x, core.y, r2d, 0, Math.PI * 2);
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

  // Update + draw tentacles (back segments first)
  const frontSegments = [];
  for (let t of tentacles) {
    t.update(dt, time, isDragging);
    const res = t.draw(ctx);
    if (res && res.front) frontSegments.push(...res.front);
  }

  // Draw orb glow (projected)
  drawCore();

  // Draw front segments (in front of orb)
  for (const s of frontSegments) {
    const depthAlpha = Math.min(1, Math.max(0.2, 0.7 + (s.avgZ / (s.ar * 2))));
    ctx.strokeStyle = `rgba(0,200,255,${depthAlpha})`;
    const wscale = (s.a.scale + s.b.scale) * 0.5;
    ctx.lineWidth = 1.5 * Math.min(2.0, Math.max(0.6, wscale * 0.02));
    ctx.shadowColor = 'rgba(0,150,255,0.6)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(s.a.sx, s.a.sy);
    ctx.lineTo(s.b.sx, s.b.sy);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  requestAnimationFrame(animate);
}

animate(0);
