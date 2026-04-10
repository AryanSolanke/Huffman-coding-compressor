#include "huffman.hpp"
#include "image_optimizer.hpp"
#include "presentation_optimizer.hpp"
#include <emscripten.h>

#ifdef __cplusplus
extern "C" {
#endif

EMSCRIPTEN_KEEPALIVE
uint8_t* huffmanCompress(uint8_t* data, size_t size, size_t* outputSize) {
    std::vector<uint8_t> input(data, data + size);
    daa::HuffmanCoder coder;
    std::vector<uint8_t> result = coder.compress(input);
    
    *outputSize = result.size();
    uint8_t* output = new uint8_t[result.size()];
    std::copy(result.begin(), result.end(), output);
    return output;
}

EMSCRIPTEN_KEEPALIVE
uint8_t* huffmanDecompress(uint8_t* data, size_t size, size_t originalSize, size_t* outputSize) {
    std::vector<uint8_t> input(data, data + size);
    daa::HuffmanCoder coder;
    std::vector<uint8_t> result = coder.decompress(input, originalSize);
    
    *outputSize = result.size();
    uint8_t* output = new uint8_t[result.size()];
    std::copy(result.begin(), result.end(), output);
    return output;
}

EMSCRIPTEN_KEEPALIVE
uint8_t* optimizeImage(uint8_t* data, size_t size, int format, int quality, double scale, size_t* outputSize) {
    std::vector<uint8_t> input(data, data + size);
    
    daa::ImageOptimizer optimizer;
    optimizer.loadFromMemory(input);
    
    daa::ImageOptimizationOptions options;
    options.format = static_cast<daa::ImageFormat>(format);
    options.quality = quality;
    options.scalePercent = scale;
    
    daa::ImageOptimizationResult result = optimizer.optimize(options);
    
    *outputSize = result.bytes.size();
    uint8_t* output = new uint8_t[result.bytes.size()];
    std::copy(result.bytes.begin(), result.bytes.end(), output);
    return output;
}

EMSCRIPTEN_KEEPALIVE
uint8_t* optimizePresentation(uint8_t* data, size_t size, int quality, double scale, size_t* outputSize) {
    std::vector<uint8_t> input(data, data + size);
    
    daa::PresentationOptimizationOptions options;
    options.quality = quality;
    options.scalePercent = scale;
    
    daa::PresentationOptimizer optimizer(options);
    daa::PresentationOptimizationResult result = optimizer.optimize(input);
    
    *outputSize = result.bytes.size();
    uint8_t* output = new uint8_t[result.bytes.size()];
    std::copy(result.bytes.begin(), result.bytes.end(), output);
    return output;
}

EMSCRIPTEN_KEEPALIVE
int isPptxFile(const char* filename) {
    return daa::PresentationOptimizer::isPptxFile(std::string(filename)) ? 1 : 0;
}

EMSCRIPTEN_KEEPALIVE
int isPptxData(uint8_t* data, size_t size) {
    std::vector<uint8_t> input(data, data + size);
    return daa::PresentationOptimizer::isPptxData(input) ? 1 : 0;
}

#ifdef __cplusplus
}
#endif
