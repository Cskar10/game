# Tentacle Physics Upgrade TODO

Scope: Improve tentacle physics for the draggable orb with tentacles (tentacle.js only).

## Plan Steps

- [ ] Switch to Verlet integration per segment
  - [ ] Store previous positions (px, py) in each segment
  - [ ] Integrate positions via x += (x - px) * airDamping (+ optional acceleration)
  - [ ] Initialize px, py to initial positions

- [ ] Add iterative constraint solver
  - [ ] Run 6–10 iterations per frame
  - [ ] Enforce fixed segment length between neighbors
  - [ ] Pin root (segment[0]) to the orb attachment point each iteration

- [ ] Add bend stiffness / curvature smoothing
  - [ ] For triplets (i-1, i, i+1), nudge middle point toward midpoint + normal * target curvature
  - [ ] Use small stiffness factor for stability

- [ ] Implement traveling wave as curvature target
  - [ ] curvature = A * sin(phaseSpeed * time - i * phaseOffset)
  - [ ] Lower amplitude and slower speed when idle; increase when active
  - [ ] Apply inside bend constraint step

- [ ] Inertia from core motion
  - [ ] Slightly bias the first few segments using previous attach point to create trailing effect (via pinned root each iteration + Verlet inertia)

- [ ] Parameterization
  - [ ] Expose tuning constants on Tentacle: iterations, airDamping, bendStiffness, waveAmplitudeIdle/Active, waveSpeedIdle/Active, wavePhaseOffset
  - [ ] Keep draw() unchanged

## Tuning / Testing

- [ ] Tune parameters for stability and responsiveness for fast drags
- [ ] Verify idle sway looks natural
- [ ] Stress test with rapid direction changes
- [ ] Visual regression: ensure gradient and width unchanged

## Implementation Notes

- Use implicit integration (Verlet) for stability at larger time steps.
- Apply constraints multiple times per frame for rigidity without high stiffness.
- Keep first segment pinned to orb edge: attachX = core.x + cos(baseAngle) * attachRadius; same for Y.
- For distance constraint:
  - If prev is pinned (i-1 === 0), move only the current segment.
  - Else, move both prev and current by half the correction.
- For bend constraint:
  - For points p0, p1, p2:
    - Midpoint (mx, my) = (p0 + p2) / 2
    - Tangent t = p2 - p0, normal n = perp(t) / |t|
    - Target offset = segmentLength * curvature
    - Desired p1 = midpoint + n * target offset
    - p1 += (desired - p1) * bendStiffness (small)
