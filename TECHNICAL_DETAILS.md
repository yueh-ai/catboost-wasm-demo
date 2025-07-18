# Technical Details: CatBoost WebAssembly Implementation

This document provides in-depth technical details about the CatBoost WebAssembly implementation, focusing on the compilation process and architectural decisions.

## Compilation Deep Dive

### Understanding the Build Process

The compilation from C++ to WebAssembly involves several stages:

```
C++ Source → Emscripten Frontend → LLVM IR → WASM Backend → WebAssembly + JS Glue
```

### Critical Compilation Flags Explained

Each Emscripten flag serves a specific purpose:

```cmake
# Generate WebAssembly instead of asm.js
"-s WASM=1"

# Create a JavaScript module function instead of global initialization
# This allows: const module = await CatBoostModule();
"-s MODULARIZE=1"

# Name of the module factory function
"-s EXPORT_NAME='CatBoostModule'"

# Allow dynamic memory growth (critical for ML models)
"-s ALLOW_MEMORY_GROWTH=1"

# Embed WASM binary as base64 in the JS file
# Pros: Single file, no loading issues
# Cons: 33% larger file size
"-s SINGLE_FILE=1"

# Enable in both web pages and Web Workers
"-s ENVIRONMENT='web,worker'"

# Export helper functions for C interop
"-s EXPORTED_RUNTIME_METHODS=['ccall','cwrap']"

# Enable Emscripten's C++ binding system
"--bind"
```

### Memory Layout and Management

WebAssembly uses a linear memory model:

```
WASM Linear Memory
┌─────────────────┐ 0x00000000
│  Static Data    │
├─────────────────┤
│  Stack          │ ↓ grows down
├─────────────────┤
│  ...            │
├─────────────────┤
│  Heap           │ ↑ grows up
└─────────────────┘ MEMORY_SIZE
```

For CatBoost models:
- **Model data**: Stored on heap
- **Feature vectors**: Temporary heap allocations
- **Predictions**: Stack for small results, heap for batch

### Handling CatBoost's C API

The C API uses specific patterns that need careful handling:

#### 1. Triple Pointer for Categorical Features
```cpp
// C API expects: const char*** catFeatures
// This is: array of documents → array of features → string pointer

// JavaScript strings
["Tech", "Married", "Masters"]

// Must convert to:
const char* features[] = {"Tech", "Married", "Masters"};
const char** featuresPtr = features;
const char*** catFeatures = &featuresPtr;
```

#### 2. Memory Ownership
```cpp
// CatBoost C API pattern
ModelCalcerHandle* handle = ModelCalcerCreate();  // We own this
bool success = LoadFullModelFromBuffer(
    handle, 
    buffer,      // We own the buffer
    bufferSize
);
ModelCalcerDelete(handle);  // Must explicitly delete
```

#### 3. Error Handling
```cpp
// C API uses global error string
if (!CalcModelPrediction(...)) {
    const char* error = GetErrorString();
    // Handle error
}
```

### JavaScript ↔ WebAssembly Bridge

Emscripten's Embind creates automatic conversions:

```cpp
// C++ side
std::vector<double> predict(
    const std::vector<float>& floatFeatures,
    const std::vector<std::string>& catFeatures
);

// JavaScript side (auto-generated)
const floatVec = new Module.FloatVector();
floatVec.push_back(35);  // Calls C++ vector::push_back

const result = model.predict(floatVec, catVec);
// Returns Module.DoubleVector

// Must clean up!
floatVec.delete();  // Calls C++ destructor
```

### Web Worker Architecture

```
Main Thread                    Worker Thread
───────────                    ─────────────
                              
UI Events ──┐                  
            ↓                  
         main.js               
            │                  
            ├─postMessage────→ worker.js
            │                      │
            │                      ├─ Load WASM Module
            │                      ├─ Create Model Instance
            │                      ├─ Run Inference
            │                      │
            ←──postMessage─────────┘
            │                  
            ↓                  
    Update DOM                 
```

### Binary Size Analysis

Typical size breakdown for CatBoost WASM:

```
Component                Size (gzipped)
─────────────────────────────────────
Emscripten runtime       ~50 KB
Embind bindings          ~30 KB
CatBoost C API stub      ~20 KB
─────────────────────────────────────
Total (stub)             ~100 KB

Full CatBoost library    ~2-5 MB (depends on features)
Model file (.cbm)        10-500 KB (depends on model)
```

### Performance Profiling

Key metrics to monitor:

1. **Module Load Time**
   ```javascript
   const start = performance.now();
   const module = await CatBoostModule();
   console.log(`Load time: ${performance.now() - start}ms`);
   ```

2. **Inference Time**
   ```javascript
   const inferStart = performance.now();
   const result = model.predict(features);
   console.log(`Inference: ${performance.now() - inferStart}ms`);
   ```

3. **Memory Usage**
   ```javascript
   if (performance.memory) {
       console.log(`Heap: ${performance.memory.usedJSHeapSize / 1048576}MB`);
   }
   ```

## Advanced Topics

### Custom Memory Allocator

For better performance with large models:

```cpp
// Override Emscripten's malloc
extern "C" {
    void* custom_malloc(size_t size) {
        // Custom allocation strategy
        // e.g., memory pools for fixed-size allocations
    }
}

// Build with:
// -s MALLOC="custom_malloc"
```

### SIMD Optimization

Enable SIMD for faster inference:

```cmake
set(EMSCRIPTEN_FLAGS ${EMSCRIPTEN_FLAGS}
    "-msimd128"
    "-s SIMD=1"
)
```

Note: Requires browser support and CatBoost SIMD implementations.

### Debugging WebAssembly

1. **Source Maps**
   ```bash
   emcc -g4 -s ASSERTIONS=2 -s SAFE_HEAP=1
   ```

2. **Chrome DevTools**
   - Enable WebAssembly debugging in experiments
   - Set breakpoints in C++ source

3. **Logging from C++**
   ```cpp
   #include <emscripten/console.h>
   emscripten_console_log("Debug message");
   ```

### Security Considerations

1. **Model Validation**
   ```cpp
   bool validateModel(const uint8_t* data, size_t size) {
       // Check magic numbers
       // Verify checksums
       // Validate size limits
   }
   ```

2. **Sandboxing**
   - WASM runs in browser sandbox
   - No file system access by default
   - Limited to allocated memory

3. **Input Sanitization**
   ```javascript
   function sanitizeFeatures(features) {
       // Validate ranges
       // Check for NaN/Infinity
       // Limit string lengths
   }
   ```

## Production Deployment

### Optimization Checklist

- [ ] Build with `-O3` optimization
- [ ] Enable closure compiler: `--closure 1`
- [ ] Strip debug symbols
- [ ] Enable gzip/brotli compression
- [ ] Use CDN with proper caching headers
- [ ] Implement progressive loading for large models
- [ ] Add error boundaries and fallbacks

### Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| WebAssembly | 57+ | 52+ | 11+ | 16+ |
| Web Workers | 4+ | 3.5+ | 4+ | 12+ |
| BigInt64Array | 67+ | 68+ | 15+ | 79+ |
| WASM Threads | 74+ | 79+ | 14.1+ | 79+ |

### Future Improvements

1. **WebAssembly Threads**
   - Enable with `-s USE_PTHREADS=1`
   - Requires COOP/COEP headers
   - Can improve performance 2-4x

2. **WASM GC Proposal**
   - Better integration with JS GC
   - Reduced memory overhead
   - Not yet widely supported

3. **Model Quantization**
   - Reduce model size
   - Faster inference
   - Slight accuracy trade-off

4. **Streaming Compilation**
   ```javascript
   const response = await fetch('model.wasm');
   const module = await WebAssembly.compileStreaming(response);
   ```

This implementation demonstrates that running complex ML models in the browser is not only possible but practical with modern WebAssembly tooling.