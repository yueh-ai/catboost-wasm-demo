# CatBoost WebAssembly Compilation Guide

This guide documents the complete process of compiling CatBoost to WebAssembly, enabling machine learning inference directly in web browsers with support for categorical features.

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Project Structure](#project-structure)
4. [Step-by-Step Compilation](#step-by-step-compilation)
5. [Key Technical Decisions](#key-technical-decisions)
6. [Troubleshooting](#troubleshooting)
7. [Performance Considerations](#performance-considerations)

## Overview

This project demonstrates how to:
- Compile CatBoost's C API to WebAssembly using Emscripten
- Create JavaScript bindings for seamless browser integration
- Handle categorical features in WebAssembly
- Run ML inference in Web Workers for non-blocking execution

### Why This Approach Works

1. **C API Usage**: CatBoost provides a clean C API (`c_api.h`) which is ideal for WebAssembly compilation
2. **Emscripten Bindings**: We use Embind to automatically generate JavaScript wrappers
3. **Memory Management**: Careful handling of memory between JavaScript and WASM
4. **Modular Design**: Separates concerns between model loading, inference, and UI

## Prerequisites

### 1. Install Emscripten

```bash
# Clone the Emscripten SDK
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk

# Install and activate the latest SDK
./emsdk install latest
./emsdk activate latest

# Set up environment (needed for each terminal session)
source ./emsdk_env.sh
```

### 2. Install CMake
- macOS: `brew install cmake`
- Linux: `apt-get install cmake` or `yum install cmake`
- Windows: Download from https://cmake.org/

### 3. Python 3.x (for CatBoost model creation)
```bash
pip install catboost numpy pandas
```

## Project Structure

```
catboost-wasm-demo/
├── src/
│   ├── catboost_wrapper.cpp    # C++ wrapper with Embind bindings
│   └── catboost_stub.cpp       # Stub implementation for testing
├── web/
│   ├── index.html              # Main demo interface
│   ├── main.js                 # UI coordination
│   ├── worker.js               # Web Worker for WASM execution
│   └── catboost_wasm.js        # Generated WASM module
├── models/
│   └── demo_model.cbm          # Binary model file
├── CMakeLists.txt              # Build configuration
├── build.sh                    # Build automation script
└── create_model.py             # Model generation script
```

## Step-by-Step Compilation

### Step 1: Create the C++ Wrapper

The wrapper (`catboost_wrapper.cpp`) bridges CatBoost's C API with JavaScript:

```cpp
#include <emscripten/emscripten.h>
#include <emscripten/bind.h>

// CatBoost C API declarations
extern "C" {
    typedef void ModelCalcerHandle;
    ModelCalcerHandle* ModelCalcerCreate();
    bool LoadFullModelFromBuffer(ModelCalcerHandle* handle, 
                                const void* buffer, size_t size);
    bool CalcModelPrediction(ModelCalcerHandle* handle, size_t docCount,
                           const float** floatFeatures, size_t floatSize,
                           const char*** catFeatures, size_t catSize,
                           double* result, size_t resultSize);
    // ... other declarations
}

class CatBoostModel {
    // C++ wrapper implementation
    std::vector<double> predict(
        const std::vector<float>& floatFeatures,
        const std::vector<std::string>& catFeatures
    ) {
        // Convert C++ types to C API format
        // Handle categorical features as char***
        // Return predictions
    }
};

// Emscripten bindings
EMSCRIPTEN_BINDINGS(catboost_module) {
    emscripten::class_<CatBoostModel>("CatBoostModel")
        .constructor<>()
        .function("loadModel", &CatBoostModel::loadModel)
        .function("predict", &CatBoostModel::predict);
        
    // Register STL containers
    emscripten::register_vector<float>("FloatVector");
    emscripten::register_vector<std::string>("StringVector");
}
```

### Step 2: Configure CMake for Emscripten

`CMakeLists.txt` configuration:

```cmake
cmake_minimum_required(VERSION 3.13)
project(catboost_wasm)

set(CMAKE_CXX_STANDARD 17)

if(EMSCRIPTEN)
    # Critical Emscripten flags
    set(EMSCRIPTEN_FLAGS 
        "-s WASM=1"                          # Generate WebAssembly
        "-s MODULARIZE=1"                    # Create a module function
        "-s EXPORT_NAME='CatBoostModule'"    # Module name in JavaScript
        "-s ALLOW_MEMORY_GROWTH=1"           # Dynamic memory allocation
        "-s SINGLE_FILE=1"                   # Embed WASM in JS file
        "-s ENVIRONMENT='web,worker'"        # Support Web Workers
        "-s EXPORTED_RUNTIME_METHODS=['ccall','cwrap']"
        "--bind"                             # Enable Embind
    )
    
    string(REPLACE ";" " " EMSCRIPTEN_FLAGS_STR "${EMSCRIPTEN_FLAGS}")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} ${EMSCRIPTEN_FLAGS_STR}")
    set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} ${EMSCRIPTEN_FLAGS_STR}")
endif()

add_executable(catboost_wasm src/catboost_wrapper.cpp)

# For production: link against actual CatBoost library
# target_link_libraries(catboost_wasm PRIVATE catboostmodel)
```

### Step 3: Build with Emscripten

```bash
# Set up environment
source /path/to/emsdk/emsdk_env.sh

# Create build directory
mkdir build && cd build

# Configure with Emscripten's CMake wrapper
emcmake cmake .. \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_CXX_FLAGS="-O3"

# Build
emmake make -j4
```

### Step 4: Handle Categorical Features

Categorical features require special handling due to C API's `char***` format:

```javascript
// In worker.js - Converting JavaScript strings to WASM format
function predict(features) {
    // Create vectors for Emscripten
    const floatVector = new Module.FloatVector();
    features.floatFeatures.forEach(f => floatVector.push_back(f));
    
    const catVector = new Module.StringVector();
    features.catFeatures.forEach(f => catVector.push_back(f));
    
    // Make prediction
    const result = model.predict(floatVector, catVector);
    
    // Clean up (important!)
    floatVector.delete();
    catVector.delete();
    result.delete();
}
```

### Step 5: Web Worker Integration

Using Web Workers prevents blocking the main thread:

```javascript
// main.js
const worker = new Worker('worker.js');

worker.onmessage = function(e) {
    if (e.data.type === 'prediction') {
        displayResult(e.data.result);
    }
};

// worker.js
let Module;

async function initializeModule() {
    Module = await CatBoostModule();
    // Module is now ready for use
}

self.onmessage = async function(e) {
    switch (e.data.type) {
        case 'init':
            await initializeModule();
            break;
        case 'predict':
            predict(e.data.features);
            break;
    }
};
```

## Key Technical Decisions

### 1. Why Use C API Instead of C++?
- **Simpler FFI**: C has a stable ABI, making it easier to interface with WASM
- **No Name Mangling**: C functions have predictable names
- **Proven Pattern**: Most successful WASM projects use C APIs

### 2. Memory Management Strategy
- **RAII in C++**: Use C++ wrappers to ensure proper cleanup
- **Explicit Deletion in JS**: Always call `.delete()` on Emscripten objects
- **Single File Mode**: Embed WASM in JS to avoid loading issues

### 3. Categorical Feature Handling
```cpp
// Convert vector<string> to char*** format required by C API
std::vector<const char*> catPtrs;
for (const auto& cat : catFeatures) {
    catPtrs.push_back(cat.c_str());
}
const char** catPtrsPtr = catPtrs.data();

// Pass to C API as &catPtrsPtr
```

### 4. Threading Considerations
- **Current**: Single-threaded with Web Workers for non-blocking
- **Future**: Can enable pthread support with `-s USE_PTHREADS=1`
- **TBB Support**: Requires `-s PROXY_TO_PTHREAD=1` flag

## Building Production CatBoost

To build the actual CatBoost library for WebAssembly:

### 1. Prepare CatBoost Source
```bash
cd /path/to/catboost
```

### 2. Create Emscripten Platform Files
Create `cmake/platform/EMSCRIPTEN.cmake`:
```cmake
set(CMAKE_SYSTEM_NAME Emscripten)
set(CMAKE_SYSTEM_PROCESSOR wasm32)

# Disable features not available in WASM
set(HAVE_EXECINFO OFF)
set(CMAKE_THREAD_LIBS_INIT "")

# Remove system library dependencies
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -DNO_LIBDL -DNO_LIBRT")
```

### 3. Build Command
```bash
mkdir build-wasm && cd build-wasm

emcmake cmake .. \
    -DCMAKE_TOOLCHAIN_FILE=$EMSDK/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake \
    -DCMAKE_BUILD_TYPE=Release \
    -DCATBOOST_COMPONENTS="libs-model_interface" \
    -DHAVE_CUDA=OFF \
    -DTBB_STRICT=OFF \
    -DBUILD_SHARED_LIBS=OFF \
    -DCMAKE_CXX_FLAGS="-O3 -DEMSCRIPTEN"

emmake make catboostmodel -j4
```

### 4. Link Your Project
Update your `CMakeLists.txt`:
```cmake
target_link_libraries(catboost_wasm PRIVATE 
    ${CATBOOST_WASM_BUILD}/catboost/libs/model_interface/libcatboostmodel.a
    ${CATBOOST_WASM_BUILD}/catboost/libs/model/libcatboost-libs-model.a
    # Add other dependencies as needed
)
```

## Troubleshooting

### Common Issues and Solutions

1. **"emcc not found"**
   ```bash
   source /path/to/emsdk/emsdk_env.sh
   ```

2. **Linking errors with system libraries**
   - Remove `-ldl`, `-lrt`, `-lpthread` from link flags
   - Add stubs for missing functions

3. **Module not loading in browser**
   - Check browser console for errors
   - Ensure CORS headers are set correctly
   - Verify file paths in worker.js

4. **Memory errors**
   - Always clean up Emscripten objects with `.delete()`
   - Use `ALLOW_MEMORY_GROWTH=1` flag
   - Monitor browser memory usage

5. **Categorical features not working**
   - Ensure strings are null-terminated
   - Check feature count matches model expectations
   - Verify string encoding (UTF-8)

## Performance Considerations

### Optimization Flags
```cmake
# Compilation optimizations
set(CMAKE_CXX_FLAGS_RELEASE "-O3 -DNDEBUG")

# Emscripten-specific optimizations
set(EMSCRIPTEN_FLAGS ${EMSCRIPTEN_FLAGS}
    "-s AGGRESSIVE_VARIABLE_ELIMINATION=1"
    "-s DISABLE_EXCEPTION_CATCHING=1"
    "--closure 1"  # Use Closure Compiler
)
```

### File Size Optimization
1. **Use SINGLE_FILE mode** for easier deployment
2. **Enable compression** on web server (gzip/brotli)
3. **Strip debug symbols** in release builds
4. **Consider splitting large models** into chunks

### Runtime Performance
1. **Reuse model instances** - don't create/destroy repeatedly
2. **Batch predictions** when possible
3. **Use Web Workers** to avoid blocking UI
4. **Pre-allocate vectors** for better performance

## Next Steps

1. **Security**: Implement model validation and sandboxing
2. **Caching**: Use IndexedDB for model storage
3. **Streaming**: Support progressive model loading
4. **Monitoring**: Add performance metrics and error tracking
5. **Testing**: Implement automated tests for WASM module

## Resources

- [Emscripten Documentation](https://emscripten.org/docs/)
- [CatBoost C API Reference](https://catboost.ai/docs/concepts/c-plus-plus-api.html)
- [WebAssembly MDN Guide](https://developer.mozilla.org/en-US/docs/WebAssembly)
- [oneTBB WASM Support](https://github.com/oneapi-src/oneTBB/blob/master/WASM_Support.md)

## License

This guide and example code are provided under the same license as CatBoost (Apache 2.0).