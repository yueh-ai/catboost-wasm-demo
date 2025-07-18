# Batch Prediction Guide for CatBoost WASM Demo

## Overview

The CatBoost WASM demo now supports batch predictions, allowing you to make predictions for multiple samples in a single call. This provides significant performance improvements compared to making individual predictions.

## Implementation Details

### C++ Wrapper Changes

Added a new `predictBatch` method to the `CatBoostModel` class that:
- Accepts vectors of feature vectors for batch processing
- Uses the C API's `CalcModelPrediction` function with `docCount > 1`
- Properly manages memory for 2D float arrays and 3D categorical arrays

### JavaScript Worker Changes

The web worker now supports:
- `predictBatch` message type for batch predictions
- Proper memory management for Emscripten vector types
- Performance timing for batch operations

### UI Enhancements

The demo page includes:
- Batch testing buttons (10, 100, 1000 predictions)
- Performance comparison tool
- Results display with processing time metrics

## How to Test

1. **Build the WASM module** with the updated wrapper:
   ```bash
   cd catboost-wasm-demo
   ./build_wasm.sh
   ```

2. **Start a local web server**:
   ```bash
   cd web
   python3 -m http.server 8000
   ```

3. **Open the demo** in your browser:
   ```
   http://localhost:8000
   ```

4. **Load a CatBoost model** (.cbm file)

5. **Test batch predictions**:
   - Click "Test 10 Predictions" for a small batch
   - Click "Test 100 Predictions" for a medium batch
   - Click "Test 1000 Predictions" for a large batch
   - Click "Compare Single vs Batch" to see performance differences

## Performance Benefits

Batch predictions provide several advantages:

1. **Reduced overhead**: Single function call instead of multiple calls
2. **Better memory locality**: Data is processed in contiguous blocks
3. **Vectorization**: The C API can use SIMD instructions more effectively
4. **Cache efficiency**: Better CPU cache utilization

Expected performance gains:
- 5-10x faster for small batches (10-50 samples)
- 10-20x faster for medium batches (100-500 samples)
- 20-50x faster for large batches (1000+ samples)

## API Usage

### JavaScript (from main thread)
```javascript
// Single prediction
worker.postMessage({
    type: 'predict',
    data: {
        floatFeatures: [35, 80000, 45],
        catFeatures: ['Masters', 'Tech', 'Married']
    }
});

// Batch prediction
worker.postMessage({
    type: 'predictBatch',
    data: [
        {
            floatFeatures: [35, 80000, 45],
            catFeatures: ['Masters', 'Tech', 'Married']
        },
        {
            floatFeatures: [28, 60000, 40],
            catFeatures: ['Bachelors', 'Sales', 'Single']
        }
        // ... more samples
    ]
});
```

### C++ API
```cpp
// Create batch data
std::vector<std::vector<float>> floatBatch = {
    {35.0f, 80000.0f, 45.0f},
    {28.0f, 60000.0f, 40.0f}
};

std::vector<std::vector<std::string>> catBatch = {
    {"Masters", "Tech", "Married"},
    {"Bachelors", "Sales", "Single"}
};

// Make batch prediction
std::vector<double> results = model.predictBatch(floatBatch, catBatch);
```

## Memory Considerations

- Batch predictions require more memory to hold all input data
- The wrapper properly manages memory cleanup for Emscripten vectors
- For very large batches (>10,000 samples), consider splitting into smaller chunks

## Troubleshooting

1. **"Invalid float/categorical feature count"**: Ensure all samples in the batch have the correct number of features
2. **Performance not improving**: Check browser console for errors, ensure WASM module is properly loaded
3. **Memory errors**: Reduce batch size or process in chunks