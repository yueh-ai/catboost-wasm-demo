#include <emscripten/emscripten.h>
#include <emscripten/bind.h>
#include <string>
#include <vector>
#include <memory>
#include <cstring>

// Include stub implementation if defined
#ifdef CATBOOST_STUB_IMPLEMENTATION
#include "catboost_stub.cpp"
#else
// CatBoost C API declarations (we'll link against the actual implementation)
extern "C" {
    typedef void ModelCalcerHandle;
    
    ModelCalcerHandle* ModelCalcerCreate();
    void ModelCalcerDelete(ModelCalcerHandle* modelHandle);
    const char* GetErrorString();
    bool LoadFullModelFromBuffer(ModelCalcerHandle* modelHandle, const void* binaryBuffer, size_t binaryBufferSize);
    bool CalcModelPrediction(
        ModelCalcerHandle* modelHandle,
        size_t docCount,
        const float** floatFeatures, size_t floatFeaturesSize,
        const char*** catFeatures, size_t catFeaturesSize,
        double* result, size_t resultSize
    );
    size_t GetFloatFeaturesCount(ModelCalcerHandle* modelHandle);
    size_t GetCatFeaturesCount(ModelCalcerHandle* modelHandle);
    size_t GetTreeCount(ModelCalcerHandle* modelHandle);
}
#endif

class CatBoostModel {
private:
    ModelCalcerHandle* model;
    std::vector<uint8_t> modelBuffer;
    
public:
    CatBoostModel() : model(nullptr) {
        model = ModelCalcerCreate();
        if (!model) {
            throw std::runtime_error("Failed to create model handle");
        }
    }
    
    ~CatBoostModel() {
        if (model) {
            ModelCalcerDelete(model);
        }
    }
    
    bool loadModel(const std::vector<uint8_t>& buffer) {
        modelBuffer = buffer;
        return LoadFullModelFromBuffer(model, modelBuffer.data(), modelBuffer.size());
    }
    
    std::string getLastError() {
        const char* error = GetErrorString();
        return error ? std::string(error) : "";
    }
    
    int getFloatFeatureCount() {
        return model ? GetFloatFeaturesCount(model) : 0;
    }
    
    int getCatFeatureCount() {
        return model ? GetCatFeaturesCount(model) : 0;
    }
    
    int getTreeCount() {
        return model ? GetTreeCount(model) : 0;
    }
    
    std::vector<double> predict(
        const std::vector<float>& floatFeatures,
        const std::vector<std::string>& catFeatures
    ) {
        if (!model) {
            throw std::runtime_error("Model not loaded");
        }
        
        size_t floatFeatureCount = getFloatFeatureCount();
        size_t catFeatureCount = getCatFeatureCount();
        
        // Validate input sizes
        if (floatFeatures.size() != floatFeatureCount) {
            throw std::runtime_error("Invalid float feature count");
        }
        if (catFeatures.size() != catFeatureCount) {
            throw std::runtime_error("Invalid categorical feature count");
        }
        
        // Prepare float features
        const float* floatPtr = floatFeatures.data();
        
        // Prepare categorical features
        std::vector<const char*> catPtrs;
        for (const auto& cat : catFeatures) {
            catPtrs.push_back(cat.c_str());
        }
        const char** catPtrsPtr = catPtrs.data();
        
        // Make prediction
        std::vector<double> result(1);  // For binary classification
        
        bool success = CalcModelPrediction(
            model,
            1,  // single prediction
            &floatPtr, floatFeatureCount,
            &catPtrsPtr, catFeatureCount,
            result.data(), result.size()
        );
        
        if (!success) {
            throw std::runtime_error("Prediction failed: " + getLastError());
        }
        
        return result;
    }
    
    std::vector<double> predictBatch(
        const std::vector<std::vector<float>>& floatFeaturesBatch,
        const std::vector<std::vector<std::string>>& catFeaturesBatch
    ) {
        if (!model) {
            throw std::runtime_error("Model not loaded");
        }
        
        size_t docCount = floatFeaturesBatch.size();
        if (docCount == 0) {
            return std::vector<double>();
        }
        
        // Validate batch sizes match
        if (catFeaturesBatch.size() != docCount) {
            throw std::runtime_error("Float and categorical feature batch sizes don't match");
        }
        
        size_t floatFeatureCount = getFloatFeatureCount();
        size_t catFeatureCount = getCatFeatureCount();
        
        // Validate all feature counts
        for (size_t i = 0; i < docCount; ++i) {
            if (floatFeaturesBatch[i].size() != floatFeatureCount) {
                throw std::runtime_error("Invalid float feature count at index " + std::to_string(i));
            }
            if (catFeaturesBatch[i].size() != catFeatureCount) {
                throw std::runtime_error("Invalid categorical feature count at index " + std::to_string(i));
            }
        }
        
        // Prepare float features array of pointers
        std::vector<const float*> floatPtrs;
        floatPtrs.reserve(docCount);
        for (const auto& features : floatFeaturesBatch) {
            floatPtrs.push_back(features.data());
        }
        
        // Prepare categorical features array of arrays of pointers
        std::vector<std::vector<const char*>> catPtrsVec;
        catPtrsVec.reserve(docCount);
        for (const auto& catFeatures : catFeaturesBatch) {
            std::vector<const char*> catPtrs;
            catPtrs.reserve(catFeatureCount);
            for (const auto& cat : catFeatures) {
                catPtrs.push_back(cat.c_str());
            }
            catPtrsVec.push_back(std::move(catPtrs));
        }
        
        // Create array of pointers to categorical feature arrays
        std::vector<const char**> catPtrsPtrs;
        catPtrsPtrs.reserve(docCount);
        for (const auto& catPtrs : catPtrsVec) {
            catPtrsPtrs.push_back(catPtrs.data());
        }
        
        // Allocate result array
        std::vector<double> result(docCount);
        
        // Make batch prediction
        bool success = CalcModelPrediction(
            model,
            docCount,
            floatPtrs.data(), floatFeatureCount,
            catPtrsPtrs.data(), catFeatureCount,
            result.data(), result.size()
        );
        
        if (!success) {
            throw std::runtime_error("Batch prediction failed: " + getLastError());
        }
        
        return result;
    }
};

// Emscripten bindings
using namespace emscripten;

EMSCRIPTEN_BINDINGS(catboost_module) {
    register_vector<uint8_t>("Uint8Vector");
    register_vector<float>("FloatVector");
    register_vector<std::string>("StringVector");
    register_vector<double>("DoubleVector");
    register_vector<std::vector<float>>("FloatVectorVector");
    register_vector<std::vector<std::string>>("StringVectorVector");
    
    class_<CatBoostModel>("CatBoostModel")
        .constructor<>()
        .function("loadModel", &CatBoostModel::loadModel)
        .function("getLastError", &CatBoostModel::getLastError)
        .function("getFloatFeatureCount", &CatBoostModel::getFloatFeatureCount)
        .function("getCatFeatureCount", &CatBoostModel::getCatFeatureCount)
        .function("getTreeCount", &CatBoostModel::getTreeCount)
        .function("predict", &CatBoostModel::predict)
        .function("predictBatch", &CatBoostModel::predictBatch);
}