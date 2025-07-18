# CatBoost WebAssembly Demo

This demo shows how to run CatBoost model inference in the browser using WebAssembly, including support for categorical features.

## Project Structure

```
catboost-wasm-demo/
├── src/
│   ├── catboost_wrapper.cpp    # C++ wrapper around CatBoost C API
│   └── catboost_stub.cpp       # Stub implementation for testing
├── web/
│   ├── index.html              # Main web interface
│   ├── main.js                 # Main JavaScript
│   └── worker.js               # Web Worker for model inference
├── models/
│   ├── demo_model.cbm          # Binary model file
│   └── demo_model.json         # JSON model (for inspection)
├── CMakeLists.txt              # CMake configuration
├── build.sh                    # Build script
└── create_model.py             # Python script to create test model
```

## Features

- ✅ Loads CatBoost models in binary format (.cbm)
- ✅ Supports both numerical and categorical features
- ✅ Runs inference entirely in the browser
- ✅ Uses Web Workers for non-blocking execution
- ✅ No server required - fully client-side

## Building

### Prerequisites

1. **Install Emscripten**:
   ```bash
   git clone https://github.com/emscripten-core/emsdk.git
   cd emsdk
   ./emsdk install latest
   ./emsdk activate latest
   source ./emsdk_env.sh
   ```

2. **Build the WebAssembly module**:
   ```bash
   ./build.sh
   ```

### Building with Full CatBoost Library

The current implementation uses a stub for demonstration. To build with the actual CatBoost library:

1. Build CatBoost with Emscripten support:
   ```bash
   cd /path/to/catboost
   mkdir build-wasm && cd build-wasm
   emcmake cmake .. \
     -DCMAKE_CXX_COMPILER=em++ \
     -DCMAKE_C_COMPILER=emcc \
     -DTBB_STRICT=OFF \
     -DBUILD_SHARED_LIBS=OFF \
     -DTBB_DISABLE_HWLOC_AUTOMATIC_SEARCH=ON \
     -DCMAKE_CXX_FLAGS="-Wno-unused-command-line-argument" \
     -DEMSCRIPTEN_WITHOUT_PTHREAD=true
   ```

2. Update CMakeLists.txt to link against the built library:
   ```cmake
   target_link_libraries(catboost_wasm PRIVATE 
     ${CATBOOST_BUILD_DIR}/catboost/libs/model_interface/libcatboostmodel.a
     # Add other required dependencies
   )
   ```

## Running the Demo

1. Start a local web server:
   ```bash
   cd web
   python -m http.server 8000
   ```

2. Open http://localhost:8000 in your browser

3. Load the model file (models/demo_model.cbm)

4. Enter feature values and click "Predict"

## Model Format

The demo expects a model with:
- 3 numerical features: age, income, hours_per_week
- 3 categorical features: education, occupation, marital_status

## Technical Notes

### Threading
- WebAssembly threading support is limited
- Consider using `-sPROXY_TO_PTHREAD` flag for better performance
- The stub implementation doesn't use threading

### Memory Management
- Uses `ALLOW_MEMORY_GROWTH=1` for flexible memory allocation
- Properly cleans up Emscripten vectors after use

### Browser Compatibility
- Requires browsers with WebAssembly and Web Worker support
- Tested on Chrome, Firefox, Safari (recent versions)

## Troubleshooting

1. **"emcc not found"**: Make sure to source the Emscripten environment:
   ```bash
   source /path/to/emsdk/emsdk_env.sh
   ```

2. **Model loading fails**: Ensure the model file is in the correct binary format (.cbm)

3. **Predictions seem wrong**: The stub implementation uses simple rules. Build with the actual CatBoost library for real predictions.

## Next Steps

1. Build with the actual CatBoost library
2. Add support for more model types (regression, multiclass)
3. Implement batch predictions
4. Add model visualization
5. Optimize for smaller file size

## License

This demo is for educational purposes. CatBoost is licensed under the Apache 2.0 license.