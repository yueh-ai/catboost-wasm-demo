// Main JavaScript file for CatBoost WebAssembly demo

let worker = null;
let modelLoaded = false;

// Initialize worker
function initWorker() {
    worker = new Worker('worker.js');
    
    worker.onmessage = function(e) {
        const { type, data, modelInfo, result, message, processingTime, batchSize } = e.data;
        
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
                
            case 'batchPrediction':
                handleBatchPredictionResult(result, processingTime, batchSize);
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

// Handle batch prediction result
function handleBatchPredictionResult(results, processingTime, batchSize) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('predictBatchBtn').disabled = false;
    
    let resultHTML = `
        <h3>Batch Prediction Results</h3>
        <p><strong>Batch size:</strong> ${batchSize} samples</p>
        <p><strong>Processing time:</strong> ${processingTime.toFixed(2)}ms</p>
        <p><strong>Avg time per prediction:</strong> ${(processingTime / batchSize).toFixed(2)}ms</p>
        <hr>
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="background-color: #f0f0f0;">
                    <th style="padding: 8px; border: 1px solid #ddd;">Sample</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Raw Score</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Probability</th>
                    <th style="padding: 8px; border: 1px solid #ddd;">Classification</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    results.forEach((probability, index) => {
        const percentage = (probability * 100).toFixed(2);
        resultHTML += `
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${index + 1}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${probability.toFixed(4)}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${percentage}%</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${probability > 0.5 ? 'Positive' : 'Negative'}</td>
            </tr>
        `;
    });
    
    resultHTML += `
            </tbody>
        </table>
    `;
    
    showResult(resultHTML, 'success');
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

// Test batch predictions with random data
function testBatchPredictions(batchSize = 100) {
    if (!modelLoaded) {
        showResult('Please load a model first', 'error');
        return;
    }
    
    // Generate random test data
    const featuresBatch = [];
    for (let i = 0; i < batchSize; i++) {
        const floatFeatures = [
            20 + Math.random() * 50,        // age: 20-70
            20000 + Math.random() * 100000, // income: 20k-120k
            20 + Math.random() * 40         // hours per week: 20-60
        ];
        
        const educations = ['Bachelors', 'Masters', 'HS-grad', 'Some-college', 'Assoc-voc'];
        const occupations = ['Tech-support', 'Sales', 'Executive', 'Prof-specialty', 'Other'];
        const maritalStatuses = ['Married', 'Single', 'Divorced', 'Separated'];
        
        const catFeatures = [
            educations[Math.floor(Math.random() * educations.length)],
            occupations[Math.floor(Math.random() * occupations.length)],
            maritalStatuses[Math.floor(Math.random() * maritalStatuses.length)]
        ];
        
        featuresBatch.push({
            floatFeatures: floatFeatures,
            catFeatures: catFeatures
        });
    }
    
    // Send batch to worker
    document.getElementById('loading').style.display = 'inline';
    if (document.getElementById('predictBatchBtn')) {
        document.getElementById('predictBatchBtn').disabled = true;
    }
    
    console.log(`Sending batch of ${batchSize} predictions to worker...`);
    worker.postMessage({
        type: 'predictBatch',
        data: featuresBatch
    });
}

// Compare single vs batch prediction performance
async function comparePredictionPerformance(numSamples = 50) {
    if (!modelLoaded) {
        showResult('Please load a model first', 'error');
        return;
    }
    
    // Generate test data
    const testData = [];
    for (let i = 0; i < numSamples; i++) {
        testData.push({
            floatFeatures: [
                20 + Math.random() * 50,
                20000 + Math.random() * 100000,
                20 + Math.random() * 40
            ],
            catFeatures: ['Bachelors', 'Tech-support', 'Married']
        });
    }
    
    // Test single predictions
    const singleStartTime = performance.now();
    let singlePredictionCount = 0;
    
    // Create promise to track when all single predictions are done
    const singlePredictionPromise = new Promise((resolve) => {
        const originalHandler = worker.onmessage;
        worker.onmessage = function(e) {
            if (e.data.type === 'prediction') {
                singlePredictionCount++;
                if (singlePredictionCount === numSamples) {
                    const singleEndTime = performance.now();
                    const singleTime = singleEndTime - singleStartTime;
                    worker.onmessage = originalHandler;
                    resolve(singleTime);
                }
            } else {
                originalHandler(e);
            }
        };
    });
    
    // Send single predictions
    for (const data of testData) {
        worker.postMessage({ type: 'predict', data: data });
    }
    
    const singleTime = await singlePredictionPromise;
    
    // Test batch prediction
    const batchStartTime = performance.now();
    worker.postMessage({ type: 'predictBatch', data: testData });
    
    // Update result display to show comparison
    const originalHandler = worker.onmessage;
    worker.onmessage = function(e) {
        if (e.data.type === 'batchPrediction') {
            const batchTime = e.data.processingTime;
            
            showResult(`
                <h3>Performance Comparison</h3>
                <p><strong>Number of predictions:</strong> ${numSamples}</p>
                <hr>
                <h4>Single Predictions (Sequential)</h4>
                <p>Total time: ${singleTime.toFixed(2)}ms</p>
                <p>Avg per prediction: ${(singleTime / numSamples).toFixed(2)}ms</p>
                <hr>
                <h4>Batch Prediction</h4>
                <p>Total time: ${batchTime.toFixed(2)}ms</p>
                <p>Avg per prediction: ${(batchTime / numSamples).toFixed(2)}ms</p>
                <hr>
                <h4>Performance Gain</h4>
                <p><strong>Speedup:</strong> ${(singleTime / batchTime).toFixed(2)}x faster</p>
                <p><strong>Time saved:</strong> ${(singleTime - batchTime).toFixed(2)}ms</p>
            `, 'success');
            
            worker.onmessage = originalHandler;
        } else {
            originalHandler(e);
        }
    };
}

// Initialize on page load
window.addEventListener('load', function() {
    initWorker();
});

// For testing without actual WASM file
// You can use this mock implementation
if (!window.Worker) {
    alert('Web Workers are not supported in your browser. This demo requires Web Worker support.');
}

// Export test functions for console access
window.testBatchPredictions = testBatchPredictions;
window.comparePredictionPerformance = comparePredictionPerformance;