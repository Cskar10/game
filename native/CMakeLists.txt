cmake_minimum_required(VERSION 3.16)
project(abyssal_tentacle_native LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type" FORCE)
endif()

include(FetchContent)
FetchContent_Declare(
  raylib
  GIT_REPOSITORY https://github.com/raysan5/raylib.git
  GIT_TAG 5.0
)
set(BUILD_EXAMPLES OFF CACHE INTERNAL "" FORCE)
set(BUILD_GAMES OFF CACHE INTERNAL "" FORCE)
FetchContent_MakeAvailable(raylib)

add_executable(abyssal_tentacle
  src/main.cpp
  src/engine.cpp
)

target_include_directories(abyssal_tentacle PRIVATE src)

target_link_libraries(abyssal_tentacle PRIVATE raylib)

if(APPLE)
  target_link_libraries(abyssal_tentacle PRIVATE "-framework IOKit" "-framework Cocoa" "-framework OpenGL")
elseif(UNIX AND NOT APPLE)
  target_link_libraries(abyssal_tentacle PRIVATE m pthread)
endif()

include(GNUInstallDirs)
install(TARGETS abyssal_tentacle
  RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
)

set(CPACK_PACKAGE_NAME "abyssal-tentacle")
set(CPACK_PACKAGE_VENDOR "Abyssal Labs")
set(CPACK_PACKAGE_VERSION ${PROJECT_VERSION})
set(CPACK_PACKAGE_DESCRIPTION_SUMMARY "Native C++ build of Abyssal Tentacle")
include(CPack)
