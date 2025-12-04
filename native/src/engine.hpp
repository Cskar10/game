#pragma once

#include <raylib.h>

#include <algorithm>
#include <array>
#include <cmath>
#include <string>
#include <vector>

struct RGB {
    int r{255};
    int g{255};
    int b{255};
    int a{255};

    Color ToColor(float alpha = 1.0f) const {
        const int aChannel = static_cast<int>((alpha * a));
        return {
            static_cast<unsigned char>(std::clamp(r, 0, 255)),
            static_cast<unsigned char>(std::clamp(g, 0, 255)),
            static_cast<unsigned char>(std::clamp(b, 0, 255)),
            static_cast<unsigned char>(std::clamp(aChannel, 0, 255))
        };
    }
};

struct Palette {
    std::string name;
    RGB tentacle;
    RGB glow;
    struct Orb {
        RGB inner;
        RGB mid;
        RGB outer;
    } orb;
    struct Background {
        Color top;
        Color mid;
        Color bottom;
        RGB star;
    } background;
    struct Bridge {
        RGB inner;
        RGB outer;
    } bridge;
    RGB ripple;
};

struct BackgroundParticle {
    Vector2 pos{};
    Vector2 drift{};
    float depth{};
    float size{};
    float twinkle{};
};

struct Ripple {
    Vector2 pos{};
    double start{0.0};
    double lifespan{0.9};
};

struct TrailParticle {
    Vector2 pos{};
    Vector2 vel{};
    float alpha{1.0f};
    float size{3.0f};
    float lifetime{0.0f};
    float maxLife{0.5f};
};

struct Prey {
    Vector2 pos{};
    float radius{18.0f};
    float pulsePhase{0.0f};
    bool captured{false};
    float captureAnim{0.0f};
    float spawnDelay{0.0f};
};


struct AnchorRing {
    float offset{0.0f};
    float angularVelocity{0.0f};
    float friction{0.9f};
    float maxAV{6.0f};
};

struct Core {
    Vector3 pos{0.0f, 0.0f, 0.0f};
    Vector2 vel{0.0f, 0.0f};
    float radius{50.0f};
    float vx{0.0f};
    float vy{0.0f};
    float avAccum{0.0f};
    int avCount{0};
};

struct EnergyParticle {
    int tipIndex{0};
    float t{0.0f};
    float speed{1.0f};
};

struct EnergyBridge {
    bool isActive{false};
    bool pending{false};
    float progress{0.0f};
    double startTime{0.0};
    double lastTrigger{-1e9};
    float duration{3.0f};
    float cooldown{3.5f};
    float spawnAccumulator{0.0f};
    std::vector<EnergyParticle> particles;
};

struct TentacleSegment {
    Vector3 pos{};
    Vector3 prev{};
    float offset{0.0f};
};

struct SegmentDraw {
    Vector2 a{};
    Vector2 b{};
    float avgZ{0.0f};
    float width{1.0f};
};

class Tentacle {
public:
    Tentacle(Core& core, float baseAngle, float attachRadius);

    void Update(float dt, double timeMs, bool isActive, AnchorRing& ring, const std::vector<Tentacle>& neighbors);
    void CollectSegments(const Core& core, std::vector<SegmentDraw>& back, std::vector<SegmentDraw>& front) const;
    const Vector3& Tip() const;
    float AnchorAngle() const { return anchorAngle; }

private:
    Core& core;
    float baseAngle{};
    float attachRadius{};
    std::vector<TentacleSegment> segments;
    int iterations{4};
    float airDamping{0.995f};
    float bendStiffness{0.08f};
    float collisionPad{2.5f};
    float waveAmpIdle{0.18f};
    float waveAmpActive{0.33f};
    float waveSpeedIdle{2.0f};
    float waveSpeedActive{4.8f};
    float wavePhaseOffset{0.45f};
    float zBias{0.4f};
    float frictionStrength{0.15f};
    float segmentLength{10.0f};
    float length{30.0f};
    float anchorAngle{0.0f};
    float anchorAV{0.0f};
    float anchorFriction{0.9f};
    float anchorCoreInfluence{0.6f};
    float anchorTensionInfluence{0.15f};
    float anchorMaxAV{6.0f};
    float animationSeed{0.0f};
    float lastAttachX{0.0f};
    float lastAttachY{0.0f};
    float lastAttachZ{0.0f};
    float coreTangentialVelocity{0.0f};

};

class Engine {
public:
    Engine(int width, int height);
    ~Engine();

    void Update(float dt);
    void Draw();

private:
    void handleInput();
    void updateCore(float dt);
    void rebuildBackground(int width, int height);
    void updateBackground(float dt);
    void drawBackground() const;
    void drawRipples() const;
    void drawCore() const;
    void drawTentacles();
    void drawEnergyBridge();
    void drawHud() const;
    void addRipple(Vector2 pos);
    void updateRipples();
    void updateEnergyBridge(float dt);
    void maybeActivateEnergyBridge();
    void cyclePalette(int direction);

    // New systems
    void updateTrails(float dt);
    void drawTrails() const;
    void updatePrey(float dt);
    void drawPrey() const;
    void spawnPrey();
    void updateTimer(float dt);
    void drawTimer() const;
    void resetGame();
    void initBloom();
    void resizeBloom(int width, int height);
    void drawWithBloom();

    Palette& currentPalette();
    const Palette& currentPalette() const;

    int screenWidth{};
    int screenHeight{};
    Vector2 mousePos{};
    bool mouseDown{false};
    bool hudVisible{true};
    double nowMs{0.0};

    Core core;
    AnchorRing ring;
    std::vector<Tentacle> tentacles;
    EnergyBridge bridge;
    std::vector<BackgroundParticle> background;
    std::vector<Ripple> ripples;
    std::vector<SegmentDraw> backSegments;
    std::vector<SegmentDraw> frontSegments;
    std::vector<Vector3> tipCache;

    // Trail particles
    std::vector<TrailParticle> trails;

    // Prey system
    std::vector<Prey> prey;
    int score{0};
    int maxPrey{8};

    // Timer system
    float gameTimer{60.0f};
    float maxTime{60.0f};
    bool gameOver{false};
    int highScore{0};

    // Bloom render textures
    RenderTexture2D sceneTexture{};
    RenderTexture2D bloomTexture{};
    RenderTexture2D blurTexture1{};
    RenderTexture2D blurTexture2{};
    bool bloomInitialized{false};

    std::array<Palette, 3> palettes;
    int paletteIndex{0};
};
