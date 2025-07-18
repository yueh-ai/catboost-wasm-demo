cmake_minimum_required(VERSION 3.13)
project(catboost_wasm)

# Set C++ standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Emscripten-specific settings
if(EMSCRIPTEN)
    set(CMAKE_EXECUTABLE_SUFFIX ".js")
    
    # Core Emscripten flags
    set(EMSCRIPTEN_FLAGS 
        "-s WASM=1"
        "-s MODULARIZE=1"
        "-s EXPORT_NAME='CatBoostModule'"
        "-s ALLOW_MEMORY_GROWTH=1"
        "-s SINGLE_FILE=1"
        "-s ENVIRONMENT='web,worker'"
        "-s EXPORTED_RUNTIME_METHODS=['ccall','cwrap']"
        "--bind"
    )
    
    # Threading support (optional, can be enabled later)
    # set(EMSCRIPTEN_FLAGS ${EMSCRIPTEN_FLAGS} 
    #     "-s USE_PTHREADS=1"
    #     "-s PTHREAD_POOL_SIZE=4"
    #     "-s PROXY_TO_PTHREAD=1"
    # )
    
    # Convert list to string
    string(REPLACE ";" " " EMSCRIPTEN_FLAGS_STR "${EMSCRIPTEN_FLAGS}")
    
    # Apply flags
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} ${EMSCRIPTEN_FLAGS_STR}")
    set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} ${EMSCRIPTEN_FLAGS_STR}")
endif()

# Add the wrapper executable
add_executable(catboost_wasm src/catboost_wrapper.cpp)

# For now, we'll create a stub implementation of the C API functions
# In a real build, you would link against the actual CatBoost library
target_compile_definitions(catboost_wasm PRIVATE CATBOOST_STUB_IMPLEMENTATION)

# Include directories (adjust paths as needed)
target_include_directories(catboost_wasm PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/../catboost/libs/model_interface
)

# If building with actual CatBoost library:
# target_link_libraries(catboost_wasm PRIVATE catboostmodel)

# Output to web directory
set_target_properties(catboost_wasm PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/web
)