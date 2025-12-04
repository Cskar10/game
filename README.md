Abyssal Tentacle
================

A mesmerizing tentacle simulation game powered by [raylib](https://www.raylib.com/). Guide your ethereal orb through the deep, catching glowing prey with your tentacles before time runs out!

## Features

- **Physics-based tentacles** — 30 tentacles with realistic Verlet integration, collision, and wave motion
- **Catch the prey** — Glowing orbs that flee from your core; touch them with tentacle tips to score
- **60-second challenge** — Race against the clock to maximize your score
- **Bloom & glow effects** — Multi-pass post-processing for a dreamy underwater aesthetic
- **Trail particles** — Fading particles at tentacle tips for fluid motion trails
- **Energy bridge** — Activate a spectacular energy effect connecting all tentacles
- **Multiple palettes** — Cycle through Neon Tide, Solar Bloom, and Abyss Warden themes
- **High score tracking** — Your best score is saved during the session

## Controls

| Input | Action |
|-------|--------|
| **Mouse drag** | Move the core orb |
| **Space** | Activate energy bridge |
| **Q / E** | Cycle color palettes |
| **H** | Toggle HUD |
| **R** | Restart game |

## Prerequisites

- CMake 3.16+
- Git (used by CMake to fetch raylib)
- A C++20 compiler (GCC 11+, Clang 13+, MSVC 2019+)

## Build & Run

```bash
# from the repository root
cd native
cmake -S . -B build
cmake --build build --config Release
./build/abyssal_tentacle    # use .\build\Release\abyssal_tentacle.exe on Windows
```

## Gameplay

You have **60 seconds** to catch as many glowing orbs as possible. Move your core orb with the mouse—the tentacles will follow with fluid, physics-driven motion. When a tentacle tip touches a prey orb, you score 10 points and the orb respawns elsewhere.

Use the **energy bridge** (Space) for a spectacular visual effect. The bridge has a cooldown, so use it strategically!

## Optional Packaging

The CMake project comes with basic CPack settings. Generate a distributable archive with:

```bash
cd native
cmake --build build --target package
```

CPack will emit a `.tar.gz` (Linux/macOS) or `.zip` (Windows) bundle inside `native/build`.
