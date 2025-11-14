#include "engine.hpp"

#include <raylib.h>

constexpr const char* APP_NAME = "Abyssal Tentacle (Native)";

int main() {
    SetConfigFlags(FLAG_WINDOW_RESIZABLE | FLAG_MSAA_4X_HINT);
    InitWindow(1280, 720, APP_NAME);
    SetTargetFPS(60);

    Engine engine(GetScreenWidth(), GetScreenHeight());

    while (!WindowShouldClose()) {
        float dt = GetFrameTime();
        engine.Update(dt);

        BeginDrawing();
        ClearBackground(BLACK);
        engine.Draw();
        EndDrawing();
    }

    CloseWindow();
    return 0;
}
