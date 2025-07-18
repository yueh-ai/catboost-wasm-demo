// Main JavaScript file for CatBoost WebAssembly demo

let worker = null;
let modelLoaded = false;

// Initialize worker
function initWorker() {
    worker = new Worker('worker.js');
    
    worker.onmessage = function(e) {
        const { type, data, modelInfo, result, message } = e.data;
        
        switch (type) {
            case 'moduleLoaded':
                console.log('WebAssembly module loaded');
                document.getElementById('loadModel').disabled = false;
                break;
                
            case 'modelLoaded':
                handleModelLoaded(modelInfo);
                break;
                
            case 'prediction':
                handlePredictionResult(result);
                break;
                
            case 'error':
                handleError(message);
                break;
        }
    };
    
    // Initialize the module
    worker.postMessage({ type: 'init' });
}

// Handle model loaded
function handleModelLoaded(modelInfo) {
    modelLoaded = true;
    document.getElementById('predictBtn').disabled = false;
    document.getElementById('modelInfo').style.display = 'block';
    document.getElementById('treeCount').textContent = modelInfo.treeCount;
    document.getElementById('floatFeatureCount').textContent = modelInfo.floatFeatureCount;
    document.getElementById('catFeatureCount').textContent = modelInfo.catFeatureCount;
    
    showResult('Model loaded successfully!', 'success');
}

// Handle prediction result
function handlePredictionResult(result) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('predictBtn').disabled = false;
    
    const probability = result[0];
    const percentage = (probability * 100).toFixed(2);
    
    showResult(`
        <h3>Prediction Result</h3>
        <p>Raw score: ${probability.toFixed(4)}</p>
        <p>Probability: ${percentage}%</p>
        <p>Classification: ${probability > 0.5 ? 'Positive' : 'Negative'}</p>
    `, 'success');
}

// Handle errors
function handleError(message) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('predictBtn').disabled = modelLoaded;
    showResult(message, 'error');
}

// Show result message
function showResult(message, type) {
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = message;
    resultDiv.className = type;
    resultDiv.style.display = 'block';
}

// Load model file
document.getElementById('loadModel').addEventListener('click', async function() {
    const fileInput = document.getElementById('modelFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showResult('Please select a model file', 'error');
        return;
    }
    
    try {
        const buffer = await file.arrayBuffer();
        worker.postMessage({ type: 'loadModel', data: buffer }, [buffer]);
        showResult('Loading model...', '');
    } catch (error) {
        showResult('Failed to read file: ' + error.message, 'error');
    }
});

// Make prediction
document.getElementById('predictBtn').addEventListener('click', function() {
    if (!modelLoaded) {
        showResult('Please load a model first', 'error');
        return;
    }
    
    // Get feature values
    const floatFeatures = [
        parseFloat(document.getElementById('age').value),
        parseFloat(document.getElementById('income').value),
        parseFloat(document.getElementById('hoursPerWeek').value)
    ];
    
    const catFeatures = [
        document.getElementById('education').value,
        document.getElementById('occupation').value,
        document.getElementById('maritalStatus').value
    ];
    
    // Validate inputs
    if (floatFeatures.some(isNaN)) {
        showResult('Please enter valid numeric values', 'error');
        return;
    }
    
    // Send to worker
    document.getElementById('loading').style.display = 'inline';
    document.getElementById('predictBtn').disabled = true;
    
    worker.postMessage({
        type: 'predict',
        data: {
            floatFeatures: floatFeatures,
            catFeatures: catFeatures
        }
    });
});

// Initialize on page load
window.addEventListener('load', function() {
    initWorker();
});

// For testing without actual WASM file
// You can use this mock implementation
if (!window.Worker) {
    alert('Web Workers are not supported in your browser. This demo requires Web Worker support.');
}