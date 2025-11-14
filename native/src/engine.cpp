#include "engine.hpp"

#include <raymath.h>

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <random>
#include <sstream>

namespace {
constexpr float CAMERA_Z = 700.0f;
constexpr float CAMERA_F = 600.0f;
constexpr float PI2 = 2.0f * PI;

struct ScreenPoint {
    Vector2 pos;
    float scale;
    float z;
};

float ClampAngle(float angle) {
    while (angle > PI) angle -= PI2;
    while (angle < -PI) angle += PI2;
    return angle;
}

float RandRange(float minValue, float maxValue) {
    float t = static_cast<float>(GetRandomValue(0, 1000000)) / 1000000.0f;
    return Lerp(minValue, maxValue, t);
}

ScreenPoint ProjectPoint(const Vector3& origin, const Vector3& point) {
    float dx = point.x - origin.x;
    float dy = point.y - origin.y;
    float dz = point.z - origin.z;
    float denom = fmaxf(0.001f, CAMERA_Z - dz);
    float scale = CAMERA_F / denom;
    return {{origin.x + dx * scale, origin.y + dy * scale}, scale, dz};
}

Color HexToColor(const char* hex) {
    int r = 0, g = 0, b = 0;
    if (hex && hex[0] == '#') {
        unsigned int value = 0;
        std::stringstream ss;
        ss << std::hex << (hex + 1);
        ss >> value;
        r = (value >> 16) & 0xFF;
        g = (value >> 8) & 0xFF;
        b = value & 0xFF;
    }
    return Color{static_cast<unsigned char>(r), static_cast<unsigned char>(g), static_cast<unsigned char>(b), 255};
}

Color FadeColor(const RGB& rgb, float alpha) {
    return {
        static_cast<unsigned char>(std::clamp(rgb.r, 0, 255)),
        static_cast<unsigned char>(std::clamp(rgb.g, 0, 255)),
        static_cast<unsigned char>(std::clamp(rgb.b, 0, 255)),
        static_cast<unsigned char>(std::clamp(static_cast<int>(alpha * 255.0f), 0, 255))
    };
}

void DrawQuadraticCurve(const Vector2& a, const Vector2& b, const Vector2& c, Color color, float width) {
    const int steps = 48;
    Vector2 prev = a;
    for (int i = 1; i <= steps; ++i) {
        float t = static_cast<float>(i) / static_cast<float>(steps);
        float u = 1.0f - t;
        Vector2 point{
            u * u * a.x + 2 * u * t * b.x + t * t * c.x,
            u * u * a.y + 2 * u * t * b.y + t * t * c.y
        };
        DrawLineEx(prev, point, width, color);
        prev = point;
    }
}
}

Tentacle::Tentacle(Core& coreRef, float baseAngleIn, float attachRadiusIn)
    : core(coreRef), baseAngle(baseAngleIn), attachRadius(attachRadiusIn) {
    anchorAngle = baseAngle;
    animationSeed = RandRange(0.0f, 100.0f);
    const int segmentCount = static_cast<int>(length);
    segments.resize(segmentCount);
    for (int i = 0; i < segmentCount; ++i) {
        float dist = attachRadius + i * segmentLength;
        float px = core.pos.x + cosf(baseAngle) * dist;
        float py = core.pos.y + sinf(baseAngle) * dist;
        segments[i].pos = {px, py, 0.0f};
        segments[i].prev = segments[i].pos;
        segments[i].offset = i * 0.3f + RandRange(0.0f, 0.5f);
    }
    lastAttachX = segments.front().pos.x;
    lastAttachY = segments.front().pos.y;
}

const Vector3& Tentacle::Tip() const {
    return segments.back().pos;
}

void Tentacle::Update(float dt, double timeMs, bool isActive, AnchorRing& ring, const std::vector<Tentacle>& neighbors) {
    if (segments.empty()) return;

    const float waveAmp = isActive ? waveAmpActive : waveAmpIdle;
    const float waveSpeed = isActive ? waveSpeedActive : waveSpeedIdle;
    const float damp = powf(airDamping, fmaxf(1.0f, dt * 60.0f));
    const float time = static_cast<float>(timeMs * 0.001);

    // Anchor dynamics
    const float tx = -sinf(anchorAngle);
    const float ty = cosf(anchorAngle);
    const float baseRadius = fmaxf(attachRadius, 1.0f);
    const float coreTang = (core.vx * tx + core.vy * ty) / baseRadius;
    coreTangentialVelocity = coreTang;

    float tension = 0.0f;
    if (segments.size() > 1) {
        const auto& s1 = segments[1].pos;
        tension = ((s1.x - lastAttachX) * tx + (s1.y - lastAttachY) * ty) / fmaxf(segmentLength, 1.0f);
    }

    const float afr = powf(anchorFriction, fmaxf(1.0f, dt * 60.0f));
    anchorAV = (anchorAV + anchorCoreInfluence * coreTang + anchorTensionInfluence * tension) * afr;
    anchorAV = std::clamp(anchorAV, -anchorMaxAV, anchorMaxAV);

    core.avAccum += anchorAV;
    core.avCount += 1;

    anchorAngle = ClampAngle(anchorAngle + anchorAV * dt);

    const float attachX = core.pos.x + cosf(anchorAngle) * attachRadius;
    const float attachY = core.pos.y + sinf(anchorAngle) * attachRadius;
    const float attachZ = 0.0f;

    auto& root = segments.front();
    root.pos = {attachX, attachY, attachZ};
    root.prev = root.pos;

    for (size_t i = 1; i < segments.size(); ++i) {
        auto& seg = segments[i];
        float vx = (seg.pos.x - seg.prev.x) * damp;
        float vy = (seg.pos.y - seg.prev.y) * damp;
        float vz = (seg.pos.z - seg.prev.z) * damp;
        float friction = frictionStrength;
        seg.prev = seg.pos;
        seg.pos.x += vx * (1.0f - friction);
        seg.pos.y += vy * (1.0f - friction);
        seg.pos.z += vz * (1.0f - friction);
    }

    const float vax = attachX - lastAttachX;
    const float vay = attachY - lastAttachY;
    const float vaz = attachZ - lastAttachZ;
    if (segments.size() > 2) {
        segments[1].pos.x += vax * 0.35f;
        segments[1].pos.y += vay * 0.35f;
        segments[2].pos.x += vax * 0.22f;
        segments[2].pos.y += vay * 0.22f;
    }

    const int iter = iterations;
    const float minRadius = attachRadius + collisionPad;

    for (int pass = 0; pass < iter; ++pass) {
        // distance constraints
        for (size_t i = 1; i < segments.size(); ++i) {
            auto& a = segments[i - 1];
            auto& b = segments[i];
            Vector3 delta = Vector3Subtract(b.pos, a.pos);
            float dist = Vector3Length(delta);
            if (dist < 1e-4f) dist = 1.0f;
            float diff = (dist - segmentLength) / dist;
            if (i - 1 == 0) {
                b.pos.x -= delta.x * diff * 0.6f;
                b.pos.y -= delta.y * diff * 0.6f;
                b.pos.z -= delta.z * diff * 0.6f;
            } else {
                Vector3 corr{delta.x * diff * 0.5f, delta.y * diff * 0.5f, delta.z * diff * 0.5f};
                a.pos = Vector3Add(a.pos, corr);
                b.pos = Vector3Subtract(b.pos, corr);
            }
        }
        root.pos = {attachX, attachY, attachZ};

        // bend stiffness & wave
        for (size_t i = 1; i + 1 < segments.size(); ++i) {
            const auto& p0 = segments[i - 1].pos;
            auto& p1 = segments[i].pos;
            const auto& p2 = segments[i + 1].pos;

            Vector3 mid{(p0.x + p2.x) * 0.5f, (p0.y + p2.y) * 0.5f, (p0.z + p2.z) * 0.5f};
            Vector3 tangent = Vector3Normalize(Vector3Subtract(p2, p0));
            if (Vector3Length(tangent) < 1e-4f) {
                tangent = {0.0f, 1.0f, 0.0f};
            }
            Vector3 radial = Vector3Subtract(p1, core.pos);
            float dotTR = Vector3DotProduct(radial, tangent);
            Vector3 normal = Vector3Subtract(radial, Vector3Scale(tangent, dotTR));
            normal.z += zBias * segmentLength;
            float nlen = Vector3Length(normal);
            if (nlen < 1e-4f) {
                normal = {0.0f, 0.0f, 1.0f};
                nlen = 1.0f;
            }
            normal = Vector3Scale(normal, 1.0f / nlen);

            const float idxT = static_cast<float>(i) / static_cast<float>(segments.size() - 1);
            const float env = 0.6f + (1.25f - 0.6f) * idxT;
            const float coreGain = std::clamp(0.8f + 0.6f * fabsf(coreTangentialVelocity), 0.8f, 1.6f);
            const float curvature = waveAmp * env * coreGain * sinf(time * waveSpeed - i * wavePhaseOffset + animationSeed);

            Vector3 target = Vector3Add(mid, Vector3Scale(normal, curvature * segmentLength));
            p1.x += (target.x - p1.x) * bendStiffness;
            p1.y += (target.y - p1.y) * bendStiffness;
            p1.z += (target.z - p1.z) * bendStiffness;
        }

        // collision with orb
        for (size_t j = 1; j < segments.size(); ++j) {
            auto& p = segments[j].pos;
            Vector3 delta = Vector3Subtract(p, core.pos);
            float dist = Vector3Length(delta);
            if (dist < minRadius) {
                if (dist < 1e-4f) {
                    delta = {cosf(anchorAngle), sinf(anchorAngle), 0.0f};
                    dist = 1.0f;
                }
                Vector3 normal = Vector3Scale(delta, 1.0f / dist);
                p = Vector3Add(core.pos, Vector3Scale(normal, minRadius));
            }
        }
        // segment-line collision vs orb
        for (size_t j = 1; j < segments.size(); ++j) {
            auto& a = segments[j - 1].pos;
            auto& b = segments[j].pos;
            Vector3 v = Vector3Subtract(b, a);
            float denom = Vector3DotProduct(v, v);
            if (denom < 1e-5f) continue;
            Vector3 w = Vector3Subtract(core.pos, a);
            float t = Vector3DotProduct(v, w) / denom;
            t = std::clamp(t, 0.0f, 1.0f);
            Vector3 c{a.x + v.x * t, a.y + v.y * t, a.z + v.z * t};
            Vector3 delta = Vector3Subtract(c, core.pos);
            float dist = Vector3Length(delta);
            if (dist < minRadius) {
                if (dist < 1e-4f) {
                    delta = {cosf(anchorAngle), sinf(anchorAngle), 0.0f};
                    dist = 1.0f;
                }
                Vector3 normal = Vector3Scale(delta, 1.0f / dist);
                float push = (minRadius - dist);
                b.x += normal.x * push;
                b.y += normal.y * push;
                b.z += normal.z * push;
                if (j > 1) {
                    a.x += normal.x * push * 0.2f;
                    a.y += normal.y * push * 0.2f;
                    a.z += normal.z * push * 0.2f;
                }
            }
        }
        root.pos = {attachX, attachY, attachZ};
    }

    lastAttachX = attachX;
    lastAttachY = attachY;
    lastAttachZ = attachZ;

    const float targetAngle = baseAngle + ring.offset;
    float angleDiff = ClampAngle(targetAngle - anchorAngle);
    anchorAV += angleDiff * 0.1f;

    const float repulsionStrength = 0.5f;
    const float minAngle = PI2 / static_cast<float>(neighbors.size());
    for (const auto& other : neighbors) {
        if (&other == this) continue;
        float diff = ClampAngle(other.AnchorAngle() - anchorAngle);
        if (fabsf(diff) < minAngle * 0.8f) {
            float sign = diff > 0 ? 1.0f : -1.0f;
            anchorAV -= sign * repulsionStrength * ((minAngle * 0.8f) - fabsf(diff)) / (minAngle * 0.8f);
        }
    }
}

void Tentacle::CollectSegments(const Core& coreRef, std::vector<SegmentDraw>& back, std::vector<SegmentDraw>& front) const {
    if (segments.size() < 2) return;
    std::vector<ScreenPoint> projected(segments.size());
    for (size_t i = 0; i < segments.size(); ++i) {
        projected[i] = ProjectPoint(coreRef.pos, segments[i].pos);
    }

    for (size_t i = 1; i < segments.size(); ++i) {
        const auto& a = projected[i - 1];
        const auto& b = projected[i];
        float avgZ = (segments[i - 1].pos.z + segments[i].pos.z) * 0.5f;
        const float t = static_cast<float>(i) / static_cast<float>(segments.size() - 1);
        const float baseW = 6.4f;
        const float tipW = 3.2f;
        float width = (baseW + (tipW - baseW) * t) * std::clamp((a.scale + b.scale) * 0.5f * 0.02f, 0.6f, 2.0f);
        SegmentDraw seg{{a.pos.x, a.pos.y}, {b.pos.x, b.pos.y}, avgZ, width};
        if (avgZ < 0.0f)
            back.push_back(seg);
        else
            front.push_back(seg);
    }
}

Engine::Engine(int width, int height) : screenWidth(width), screenHeight(height) {
    SetRandomSeed(static_cast<unsigned int>(GetTime() * 1000));
    mousePos = {static_cast<float>(width) * 0.5f, static_cast<float>(height) * 0.5f};
    core.pos = {mousePos.x, mousePos.y, 0.0f};
    core.radius = 60.0f;

    palettes = {
        Palette{
            "Neon Tide",
            RGB{0, 200, 255},
            RGB{0, 150, 255},
            Palette::Orb{RGB{0, 190, 255, 255}, RGB{0, 120, 245, 204}, RGB{0, 40, 110, 0}},
            Palette::Background{HexToColor("#020916"), HexToColor("#031c32"), HexToColor("#000a14"), RGB{120, 200, 255}},
            Palette::Bridge{RGB{120, 225, 255}, RGB{20, 140, 255}},
            RGB{0, 190, 255}
        },
        Palette{
            "Solar Bloom",
            RGB{255, 150, 40},
            RGB{255, 80, 20},
            Palette::Orb{RGB{255, 180, 70, 255}, RGB{255, 90, 50, 191}, RGB{120, 30, 0, 0}},
            Palette::Background{HexToColor("#1a0524"), HexToColor("#32092c"), HexToColor("#140310"), RGB{255, 160, 90}},
            Palette::Bridge{RGB{255, 200, 120}, RGB{255, 90, 40}},
            RGB{255, 140, 70}
        },
        Palette{
            "Abyss Warden",
            RGB{120, 90, 255},
            RGB{80, 60, 220},
            Palette::Orb{RGB{190, 160, 255, 255}, RGB{120, 90, 255, 199}, RGB{20, 0, 60, 0}},
            Palette::Background{HexToColor("#06011a"), HexToColor("#12082c"), HexToColor("#04010f"), RGB{160, 130, 255}},
            Palette::Bridge{RGB{210, 190, 255}, RGB{110, 80, 250}},
            RGB{170, 140, 255}
        }
    };

    rebuildBackground(width, height);

    const int tentacleCount = 30;
    tentacles.reserve(tentacleCount);
    for (int i = 0; i < tentacleCount; ++i) {
        float angle = (PI2 / tentacleCount) * i;
        tentacles.emplace_back(core, angle, core.radius);
    }
}

Palette& Engine::currentPalette() {
    return palettes[paletteIndex];
}

const Palette& Engine::currentPalette() const {
    return palettes[paletteIndex];
}

void Engine::handleInput() {
    if (IsMouseButtonPressed(MOUSE_BUTTON_LEFT)) {
        mouseDown = true;
        mousePos = GetMousePosition();
        addRipple(mousePos);
    } else if (IsMouseButtonReleased(MOUSE_BUTTON_LEFT)) {
        mouseDown = false;
    }

    if (mouseDown) {
        mousePos = GetMousePosition();
    }

    if (IsKeyPressed(KEY_SPACE)) {
        bridge.pending = true;
    }
    if (IsKeyPressed(KEY_Q)) {
        cyclePalette(-1);
    }
    if (IsKeyPressed(KEY_E)) {
        cyclePalette(1);
    }
    if (IsKeyPressed(KEY_H)) {
        hudVisible = !hudVisible;
    }
}

void Engine::cyclePalette(int direction) {
    const int total = static_cast<int>(palettes.size());
    paletteIndex = (paletteIndex + direction) % total;
    if (paletteIndex < 0) paletteIndex += total;
    rebuildBackground(screenWidth, screenHeight);
}

void Engine::addRipple(Vector2 pos) {
    ripples.push_back({pos, nowMs, 0.9});
}

void Engine::updateCore(float dt) {
    const float stiffness = 0.02f;
    const float drag = 0.85f;
    Vector2 delta = Vector2Subtract(mousePos, Vector2{core.pos.x, core.pos.y});
    if (mouseDown) {
        core.vx += delta.x * stiffness;
        core.vy += delta.y * stiffness;
    }
    core.vx *= drag;
    core.vy *= drag;
    core.pos.x += core.vx;
    core.pos.y += core.vy;
}

void Engine::rebuildBackground(int width, int height) {
    screenWidth = width;
    screenHeight = height;
    background.clear();
    const float area = static_cast<float>(width * height);
    const int density = std::clamp(static_cast<int>(area / 3600.0f), 90, 260);
    background.reserve(density);
    for (int i = 0; i < density; ++i) {
        float depth = RandRange(0.25f, 1.0f);
        background.push_back({
            {RandRange(0.0f, static_cast<float>(width)), RandRange(0.0f, static_cast<float>(height))},
            {(RandRange(-0.5f, 0.5f)) * 6.0f, (RandRange(-0.5f, 0.5f)) * 4.0f},
            depth,
            0.6f + depth * 1.4f,
            RandRange(0.0f, 1.0f)
        });
    }
}

void Engine::updateBackground(float dt) {
    const float parallaxFactor = 0.12f;
    Vector2 coreDelta{core.vx * dt, core.vy * dt};
    for (auto& p : background) {
        float parallax = (1.0f - p.depth) * parallaxFactor;
        p.pos.x -= core.vx * parallax;
        p.pos.y -= core.vy * parallax;
        p.pos.x += p.drift.x * dt;
        p.pos.y += p.drift.y * dt;
        p.twinkle = fmodf(p.twinkle + dt * 0.35f + RandRange(0.0f, 0.01f), 1.0f);
        if (p.pos.x < -50) p.pos.x += screenWidth + 100;
        else if (p.pos.x > screenWidth + 50) p.pos.x -= screenWidth + 100;
        if (p.pos.y < -50) p.pos.y += screenHeight + 100;
        else if (p.pos.y > screenHeight + 50) p.pos.y -= screenHeight + 100;
    }
}

void Engine::updateRipples() {
    const double lifespan = 0.9;
    ripples.erase(std::remove_if(ripples.begin(), ripples.end(), [&](const Ripple& r) {
        return (nowMs - r.start) > (r.lifespan * 1000.0);
    }), ripples.end());
}

void Engine::maybeActivateEnergyBridge() {
    if (!bridge.pending) return;
    bridge.pending = false;
    double elapsed = nowMs - bridge.lastTrigger;
    if (bridge.isActive) return;
    if (elapsed < bridge.cooldown * 1000.0) return;
    bridge.isActive = true;
    bridge.startTime = nowMs;
    bridge.progress = 0.0f;
    bridge.lastTrigger = nowMs;
    bridge.particles.clear();
    bridge.spawnAccumulator = 0.0f;
    addRipple({core.pos.x, core.pos.y});
}

void Engine::updateEnergyBridge(float dt) {
    if (!bridge.isActive) return;
    const double elapsed = nowMs - bridge.startTime;
    bridge.progress = std::clamp(static_cast<float>(elapsed / (bridge.duration * 1000.0)), 0.0f, 1.0f);
    if (elapsed >= bridge.duration * 1000.0) {
        bridge.isActive = false;
        bridge.particles.clear();
        return;
    }

    const int tipCount = static_cast<int>(tipCache.size());
    const int targetParticles = std::min(120, std::max(1, tipCount * 4));
    bridge.spawnAccumulator += dt * tipCount * 1.2f;
    while (bridge.spawnAccumulator > 1.0f && static_cast<int>(bridge.particles.size()) < targetParticles) {
        bridge.spawnAccumulator -= 1.0f;
        bridge.particles.push_back({GetRandomValue(0, std::max(0, tipCount - 1)), RandRange(0.0f, 0.4f), RandRange(0.35f, 1.0f)});
    }

    for (auto it = bridge.particles.begin(); it != bridge.particles.end();) {
        it->t += dt * it->speed;
        if (it->t > 1.1f) {
            it = bridge.particles.erase(it);
        } else {
            ++it;
        }
    }
}

void Engine::Update(float dt) {
    nowMs = GetTime() * 1000.0;
    if (IsWindowResized()) {
        rebuildBackground(GetScreenWidth(), GetScreenHeight());
    }

    handleInput();
    updateCore(dt);
    updateBackground(dt);
    updateRipples();
    maybeActivateEnergyBridge();

    core.avAccum = 0.0f;
    core.avCount = 0;

    tipCache.clear();
    backSegments.clear();
    frontSegments.clear();

    for (auto& t : tentacles) {
        t.Update(dt, nowMs, mouseDown, ring, tentacles);
        tipCache.push_back(t.Tip());
        t.CollectSegments(core, backSegments, frontSegments);
    }

    if (core.avCount > 0) {
        const float afr = powf(ring.friction, fmaxf(1.0f, dt * 60.0f));
        const float avg = core.avAccum / static_cast<float>(core.avCount);
        ring.angularVelocity = (ring.angularVelocity + avg) * afr;
        ring.angularVelocity = std::clamp(ring.angularVelocity, -ring.maxAV, ring.maxAV);
        ring.offset = ClampAngle(ring.offset + ring.angularVelocity * dt);
    }

    updateEnergyBridge(dt);
}

void Engine::drawBackground() const {
    const auto& palette = currentPalette();
    DrawRectangleGradientV(0, 0, screenWidth, screenHeight, palette.background.top, palette.background.bottom);
    for (const auto& p : background) {
        float alpha = 0.2f + p.twinkle * 0.6f;
        Color color = FadeColor(palette.background.star, alpha);
        float size = p.size * (0.8f + p.twinkle * 0.6f);
        DrawCircleV(p.pos, size, color);
    }
}

void Engine::drawRipples() const {
    const auto& palette = currentPalette();
    for (const auto& ripple : ripples) {
        double age = nowMs - ripple.start;
        double t = (age / (ripple.lifespan * 1000.0));
        if (t < 0 || t > 1) continue;
        float radius = 30.0f + static_cast<float>(t) * 180.0f;
        float alpha = std::clamp(1.0f - static_cast<float>(t), 0.0f, 1.0f);
        Color color = FadeColor(palette.ripple, alpha * 0.35f);
        DrawRing(ripple.pos, radius - 2.0f, radius, 0.0f, 360.0f, 48, color);
    }
}

void Engine::drawCore() const {
    const auto& palette = currentPalette();
    ScreenPoint projected = ProjectPoint(core.pos, core.pos);
    float r = core.radius * projected.scale;
    for (int i = 0; i < 3; ++i) {
        float t = static_cast<float>(i) / 2.0f;
        float radius = r * (1.0f + t * 0.35f);
        float alpha = 1.0f - t * 0.65f;
        const RGB* color = nullptr;
        if (i == 0) color = &palette.orb.inner;
        else if (i == 1) color = &palette.orb.mid;
        else color = &palette.orb.outer;
        DrawCircleV({core.pos.x, core.pos.y}, radius, color->ToColor(alpha));
    }
    if (bridge.isActive) {
        float pulse = 0.4f + sinf(static_cast<float>(PI) * bridge.progress) * 0.35f;
        DrawRing({core.pos.x, core.pos.y}, r * (1.05f + pulse * 0.1f), r * (1.1f + pulse * 0.2f), 0.0f, 360.0f, 64,
                 FadeColor(palette.bridge.inner, 0.35f + pulse * 0.3f));
    }
}

void Engine::drawTentacles() {
    const auto& palette = currentPalette();
    auto drawList = [&](std::vector<SegmentDraw>& list, bool back) {
        std::sort(list.begin(), list.end(), [&](const SegmentDraw& a, const SegmentDraw& b) {
            return back ? (a.avgZ < b.avgZ) : (a.avgZ > b.avgZ);
        });
        for (const auto& seg : list) {
            float depthAlpha = std::clamp(0.7f + (seg.avgZ / (core.radius * 2.0f)), 0.2f, 1.0f);
            Color color = FadeColor(palette.tentacle, depthAlpha);
            DrawLineEx(seg.a, seg.b, seg.width, color);
            DrawLineEx(seg.a, seg.b, seg.width * 0.6f, FadeColor(palette.glow, depthAlpha * 0.6f));
        }
    };

    drawList(backSegments, true);
    drawCore();
    drawList(frontSegments, false);
}

void Engine::drawEnergyBridge() {
    if (!bridge.isActive || tipCache.empty()) return;
    const auto& palette = currentPalette();
    float ease = sinf(static_cast<float>(PI) * bridge.progress);
    Vector2 source{core.pos.x, core.pos.y};
    const int stride = std::max(1, static_cast<int>(tipCache.size() / 8));

    for (size_t i = 0; i < tipCache.size(); i += stride) {
        ScreenPoint tipProj = ProjectPoint(core.pos, tipCache[i]);
        Vector2 tip{tipProj.pos.x, tipProj.pos.y};
        Vector2 mid{(source.x + tip.x) * 0.5f, (source.y + tip.y) * 0.5f - 80.0f * ease};
        DrawQuadraticCurve(source, mid, tip, FadeColor(palette.bridge.outer, 0.25f + ease * 0.35f), 2.4f + ease * 1.6f);
        DrawQuadraticCurve(source, mid, tip, FadeColor(palette.bridge.inner, 0.55f + ease * 0.25f), 1.2f + ease * 1.2f);
    }

    for (const auto& particle : bridge.particles) {
        if (particle.tipIndex < 0 || particle.tipIndex >= static_cast<int>(tipCache.size())) continue;
        ScreenPoint tipProj = ProjectPoint(core.pos, tipCache[particle.tipIndex]);
        Vector2 tip{tipProj.pos.x, tipProj.pos.y};
        Vector2 mid{(source.x + tip.x) * 0.5f, (source.y + tip.y) * 0.5f - 80.0f * ease};
        float t = particle.t;
        float u = 1.0f - t;
        Vector2 point{
            u * u * source.x + 2 * u * t * mid.x + t * t * tip.x,
            u * u * source.y + 2 * u * t * mid.y + t * t * tip.y
        };
        float alpha = std::clamp(0.35f + sinf(t * PI) * 0.55f, 0.0f, 1.0f);
        DrawCircleV(point, 3.2f + sinf(t * PI) * 1.8f, FadeColor(palette.bridge.inner, alpha));
    }
}

void Engine::drawHud() const {
    if (!hudVisible) return;
    const auto& palette = currentPalette();
    Rectangle rect{20.0f, 20.0f, 280.0f, 160.0f};
    Color bg{10, 18, 42, 180};
    DrawRectangleRounded(rect, 0.1f, 8, bg);
    DrawRectangleRoundedLines(rect, 0.1f, 8, 2.0f, FadeColor(palette.glow, 0.4f));

    int fontSizeTitle = 20;
    DrawText(palette.name.c_str(), rect.x + 16, rect.y + 12, fontSizeTitle, WHITE);
    DrawText("Drag the core, weave the current.", rect.x + 16, rect.y + 44, 16, FadeColor(palette.glow, 0.7f));

    int y = rect.y + 72;
    DrawText("Drag: Move core", rect.x + 16, y, 16, FadeColor(palette.tentacle, 0.8f));
    y += 20;
    DrawText("Space: Energy bridge", rect.x + 16, y, 16, FadeColor(palette.tentacle, 0.8f));
    y += 20;
    DrawText("Q/E: Palettes", rect.x + 16, y, 16, FadeColor(palette.tentacle, 0.8f));
    y += 20;
    DrawText("H: Toggle HUD", rect.x + 16, y, 16, FadeColor(palette.tentacle, 0.8f));

    std::string status = "Ready";
    if (bridge.isActive) status = "Bridge active";
    else {
        double remaining = (bridge.cooldown * 1000.0) - (nowMs - bridge.lastTrigger);
        if (remaining > 50) {
            char buffer[64];
            snprintf(buffer, sizeof(buffer), "Recharging (%.1fs)", remaining / 1000.0);
            status = buffer;
        }
    }
    DrawText(status.c_str(), rect.x + 16, rect.y + rect.height - 32, 16, FadeColor(palette.bridge.inner, 0.9f));
}

void Engine::Draw() {
    drawBackground();
    drawRipples();
    drawTentacles();
    drawEnergyBridge();
    drawHud();
}
