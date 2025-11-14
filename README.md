Tentacle Game
================

## Run in a browser

Open `index.html` directly in a modern browser to explore the web version.

## Run as a desktop app

1. Install dependencies:
   ```bash
   npm install
   ```
2. Launch the Electron shell:
   ```bash
   npm start
   ```

The Electron window simply wraps the existing canvas experience, so the physics and interactivity remain unchanged. To make a distributable build later on, add a packager such as `electron-builder` or `electron-packager`.

## Native C++ engine

The repository now ships with a full C++ rewrite of the simulation powered by [raylib](https://www.raylib.com/). You can compile it on Linux, macOS, or Windows with CMake ≥ 3.16 and a C++20 toolchain.

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

The executable opens a resizable window and renders the same tentacle simulation with native performance. Drag with the mouse to move the core, hit `Space` to trigger the energy bridge, `Q/E` to cycle palettes, and `H` to toggle the HUD.

### Optional packaging

The CMake project comes with basic CPack settings. Generate a distributable archive with:

```bash
cd native
cmake --build build --target package
```

CPack will emit a `.tar.gz` (Linux/macOS) or `.zip` (Windows) bundle inside `native/build`. Adjust the packaging settings in `native/CMakeLists.txt` for platform-specific installers if needed.
