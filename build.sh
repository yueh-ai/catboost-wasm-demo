#!/bin/bash

# Build script for CatBoost WebAssembly demo

echo "CatBoost WebAssembly Build Script"
echo "================================="

# Check if Emscripten is installed
if ! command -v emcc &> /dev/null; then
    echo "Error: Emscripten not found!"
    echo ""
    echo "Please install Emscripten first:"
    echo "1. Clone the emsdk repository:"
    echo "   git clone https://github.com/emscripten-core/emsdk.git"
    echo ""
    echo "2. Enter the directory:"
    echo "   cd emsdk"
    echo ""
    echo "3. Install and activate latest SDK:"
    echo "   ./emsdk install latest"
    echo "   ./emsdk activate latest"
    echo ""
    echo "4. Source the environment:"
    echo "   source ./emsdk_env.sh"
    echo ""
    echo "Then run this script again."
    exit 1
fi

echo "Emscripten found at: $(which emcc)"
echo "Emscripten version: $(emcc --version | head -n1)"

# Create build directory
mkdir -p build
cd build

# Configure with CMake
echo ""
echo "Configuring with CMake..."
emcmake cmake .. \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_CXX_FLAGS="-O3"

# Build
echo ""
echo "Building..."
emmake make -j$(nproc)

echo ""
echo "Build complete! Output files are in the 'web' directory."