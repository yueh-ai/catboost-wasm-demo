#ifdef CATBOOST_STUB_IMPLEMENTATION

#include <cstring>
#include <cstdlib>
#include <string>
#include <vector>

extern "C" {

struct ModelCalcerHandleImpl {
    std::vector<uint8_t> modelData;
    size_t floatFeatureCount = 3;  // age, income, hours_per_week
    size_t catFeatureCount = 3;    // education, occupation, marital_status
    size_t treeCount = 100;
};

typedef ModelCalcerHandleImpl ModelCalcerHandle;

static std::string g_lastError;

ModelCalcerHandle* ModelCalcerCreate() {
    return new ModelCalcerHandleImpl();
}

void ModelCalcerDelete(ModelCalcerHandle* modelHandle) {
    delete modelHandle;
}

const char* GetErrorString() {
    return g_lastError.empty() ? nullptr : g_lastError.c_str();
}

bool LoadFullModelFromBuffer(ModelCalcerHandle* modelHandle, const void* binaryBuffer, size_t binaryBufferSize) {
    if (!modelHandle || !binaryBuffer || binaryBufferSize == 0) {
        g_lastError = "Invalid parameters";
        return false;
    }
    
    // In stub mode, just store the buffer
    modelHandle->modelData.resize(binaryBufferSize);
    memcpy(modelHandle->modelData.data(), binaryBuffer, binaryBufferSize);
    
    return true;
}

bool CalcModelPrediction(
    ModelCalcerHandle* modelHandle,
    size_t docCount,
    const float** floatFeatures, size_t floatFeaturesSize,
    const char*** catFeatures, size_t catFeaturesSize,
    double* result, size_t resultSize
) {
    if (!modelHandle || docCount != 1 || resultSize < 1) {
        g_lastError = "Invalid parameters";
        return false;
    }
    
    // Stub prediction logic
    // Simple rule: if education is Masters/Doctorate and occupation is Tech, predict high probability
    bool highEducation = false;
    bool techJob = false;
    
    if (catFeaturesSize > 0 && catFeatures && catFeatures[0]) {
        // Check education (first categorical feature)
        const char* education = catFeatures[0][0];
        if (education && (strcmp(education, "Masters") == 0 || strcmp(education, "Doctorate") == 0)) {
            highEducation = true;
        }
        
        // Check occupation (second categorical feature)
        if (catFeaturesSize > 1 && catFeatures[0][1]) {
            const char* occupation = catFeatures[0][1];
            if (occupation && strcmp(occupation, "Tech") == 0) {
                techJob = true;
            }
        }
    }
    
    // Simple prediction
    if (highEducation && techJob) {
        result[0] = 0.85;  // High probability
    } else if (highEducation || techJob) {
        result[0] = 0.6;   // Medium probability
    } else {
        result[0] = 0.3;   // Low probability
    }
    
    return true;
}

size_t GetFloatFeaturesCount(ModelCalcerHandle* modelHandle) {
    return modelHandle ? modelHandle->floatFeatureCount : 0;
}

size_t GetCatFeaturesCount(ModelCalcerHandle* modelHandle) {
    return modelHandle ? modelHandle->catFeatureCount : 0;
}

size_t GetTreeCount(ModelCalcerHandle* modelHandle) {
    return modelHandle ? modelHandle->treeCount : 0;
}

} // extern "C"

#endif // CATBOOST_STUB_IMPLEMENTATION