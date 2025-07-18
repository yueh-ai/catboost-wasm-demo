// Web Worker for CatBoost model inference

let catboostModule = null;
let model = null;

// Initialize the WebAssembly module
async function initializeModule() {
    try {
        console.log('Initializing CatBoost WebAssembly module...');
        
        // Load the WebAssembly module
        catboostModule = await CatBoostModule();
        
        console.log('CatBoost module loaded successfully');
        postMessage({ type: 'moduleLoaded' });
    } catch (error) {
        console.error('Failed to initialize module:', error);
        postMessage({ type: 'error', message: 'Failed to initialize WebAssembly module: ' + error.message });
    }
}

// Load model from buffer
function loadModel(buffer) {
    try {
        if (!catboostModule) {
            throw new Error('Module not initialized');
        }
        
        // Create model instance
        model = new catboostModule.CatBoostModel();
        
        // Convert ArrayBuffer to Uint8Array vector
        const uint8Array = new Uint8Array(buffer);
        const vectorData = new catboostModule.Uint8Vector();
        for (let i = 0; i < uint8Array.length; i++) {
            vectorData.push_back(uint8Array[i]);
        }
        
        // Load model
        const success = model.loadModel(vectorData);
        vectorData.delete(); // Clean up
        
        if (!success) {
            const error = model.getLastError();
            throw new Error(error || 'Unknown error loading model');
        }
        
        // Get model information
        const modelInfo = {
            treeCount: model.getTreeCount(),
            floatFeatureCount: model.getFloatFeatureCount(),
            catFeatureCount: model.getCatFeatureCount()
        };
        
        console.log('Model loaded:', modelInfo);
        postMessage({ type: 'modelLoaded', modelInfo });
        
    } catch (error) {
        console.error('Failed to load model:', error);
        postMessage({ type: 'error', message: 'Failed to load model: ' + error.message });
        if (model) {
            model.delete();
            model = null;
        }
    }
}

// Make prediction
function predict(features) {
    try {
        if (!model) {
            throw new Error('Model not loaded');
        }
        
        // Create float features vector
        const floatVector = new catboostModule.FloatVector();
        features.floatFeatures.forEach(f => floatVector.push_back(f));
        
        // Create categorical features vector
        const catVector = new catboostModule.StringVector();
        features.catFeatures.forEach(f => catVector.push_back(f));
        
        // Make prediction
        const result = model.predict(floatVector, catVector);
        
        // Convert result to array
        const prediction = [];
        for (let i = 0; i < result.size(); i++) {
            prediction.push(result.get(i));
        }
        
        // Clean up
        floatVector.delete();
        catVector.delete();
        result.delete();
        
        postMessage({ type: 'prediction', result: prediction });
        
    } catch (error) {
        console.error('Prediction failed:', error);
        postMessage({ type: 'error', message: 'Prediction failed: ' + error.message });
    }
}

// Make batch predictions
function predictBatch(featuresBatch) {
    try {
        if (!model) {
            throw new Error('Model not loaded');
        }
        
        const startTime = performance.now();
        
        // Create vector of float feature vectors
        const floatVectorVector = new catboostModule.FloatVectorVector();
        featuresBatch.forEach(features => {
            const floatVector = new catboostModule.FloatVector();
            features.floatFeatures.forEach(f => floatVector.push_back(f));
            floatVectorVector.push_back(floatVector);
        });
        
        // Create vector of categorical feature vectors
        const catVectorVector = new catboostModule.StringVectorVector();
        featuresBatch.forEach(features => {
            const catVector = new catboostModule.StringVector();
            features.catFeatures.forEach(f => catVector.push_back(f));
            catVectorVector.push_back(catVector);
        });
        
        // Make batch prediction
        const result = model.predictBatch(floatVectorVector, catVectorVector);
        
        // Convert result to array
        const predictions = [];
        for (let i = 0; i < result.size(); i++) {
            predictions.push(result.get(i));
        }
        
        const endTime = performance.now();
        const processingTime = endTime - startTime;
        
        // Clean up - need to delete individual vectors first
        for (let i = 0; i < floatVectorVector.size(); i++) {
            floatVectorVector.get(i).delete();
        }
        floatVectorVector.delete();
        
        for (let i = 0; i < catVectorVector.size(); i++) {
            catVectorVector.get(i).delete();
        }
        catVectorVector.delete();
        
        result.delete();
        
        postMessage({ 
            type: 'batchPrediction', 
            result: predictions,
            processingTime: processingTime,
            batchSize: featuresBatch.length
        });
        
    } catch (error) {
        console.error('Batch prediction failed:', error);
        postMessage({ type: 'error', message: 'Batch prediction failed: ' + error.message });
    }
}

// Handle messages from main thread
self.onmessage = async function(e) {
    const { type, data } = e.data;
    
    switch (type) {
        case 'init':
            await initializeModule();
            break;
            
        case 'loadModel':
            loadModel(data);
            break;
            
        case 'predict':
            predict(data);
            break;
            
        case 'predictBatch':
            predictBatch(data);
            break;
            
        default:
            console.error('Unknown message type:', type);
    }
};

// Load the WebAssembly module script
importScripts('catboost_wasm.js');