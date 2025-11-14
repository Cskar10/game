Tentacle Game (Native)
======================

This repository now contains only the native C++ implementation of the tentacle simulation, powered by [raylib](https://www.raylib.com/). Drag the orb with your mouse, trigger the energy bridge, and cycle palettes—all rendered in a high-performance desktop window.

### Prerequisites

- CMake 3.16+
- Git (used by CMake to fetch raylib)
- A C++20 compiler (GCC 11+, Clang 13+, MSVC 2019+)

### Build & run

```bash
# from the repository root
cd native
cmake -S . -B build
cmake --build build --config Release
./build/abyssal_tentacle    # use .\build\Release\abyssal_tentacle.exe on Windows
```

Controls: drag with the mouse to move the core, press `Space` to activate the energy bridge, `Q/E` to cycle palettes, and `H` to toggle the HUD.

### Optional packaging

The CMake project comes with basic CPack settings. Generate a distributable archive with:

```bash
cd native
cmake --build build --target package
```

CPack will emit a `.tar.gz` (Linux/macOS) or `.zip` (Windows) bundle inside `native/build`. Adjust the packaging settings in `native/CMakeLists.txt` for platform-specific installers if needed.
