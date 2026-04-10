#include "image_optimizer.hpp"
#include <stdexcept>
#include <algorithm>
#include <cstring>
#include <cmath>

namespace {

uint8_t clampByte(float value) {
    if (value < 0.0f) return 0;
    if (value > 255.0f) return 255;
    return static_cast<uint8_t>(value + 0.5f);
}

template<typename T>
T clamp(T value, T min_val, T max_val) {
    if (value < min_val) return min_val;
    if (value > max_val) return max_val;
    return value;
}

}

namespace daa {

ImageOptimizer::ImageOptimizer() : loaded_(false) {
    imageData_.width = 0;
    imageData_.height = 0;
    imageData_.channels = 0;
}

ImageOptimizer::~ImageOptimizer() {
    freeImage();
}

ImageFormat ImageOptimizer::parseFormat(const std::string& mimeType) {
    if (mimeType == "image/webp") return FORMAT_WEBP;
    if (mimeType == "image/jpeg" || mimeType == "image/jpg") return FORMAT_JPEG;
    if (mimeType == "image/png") return FORMAT_PNG;
    return FORMAT_UNKNOWN;
}

std::string ImageOptimizer::formatToMimeType(ImageFormat format) {
    switch (format) {
        case FORMAT_WEBP: return "image/webp";
        case FORMAT_JPEG: return "image/jpeg";
        case FORMAT_PNG: return "image/png";
        default: return "application/octet-stream";
    }
}

std::string ImageOptimizer::getExtension(ImageFormat format) {
    switch (format) {
        case FORMAT_WEBP: return "webp";
        case FORMAT_JPEG: return "jpg";
        case FORMAT_PNG: return "png";
        default: return "bin";
    }
}

bool ImageOptimizer::loadFromFile(const std::string& filePath) {
    freeImage();
    FILE* file = fopen(filePath.c_str(), "rb");
    if (!file) return false;
    
    fseek(file, 0, SEEK_END);
    long size = ftell(file);
    fseek(file, 0, SEEK_SET);
    
    if (size <= 0) {
        fclose(file);
        return false;
    }
    
    std::vector<uint8_t> buffer(static_cast<size_t>(size));
    if (fread(buffer.data(), 1, buffer.size(), file) != static_cast<size_t>(size)) {
        fclose(file);
        return false;
    }
    fclose(file);
    
    return loadFromMemory(buffer);
}

bool ImageOptimizer::loadFromMemory(const std::vector<uint8_t>& data) {
    freeImage();
    
    if (data.size() < 8) return false;
    
    if (data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF) {
        return decodeJPEG(data);
    }
    
    if (data.size() >= 8 && 
        data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47) {
        return decodePNG(data);
    }
    
    return false;
}

bool ImageOptimizer::decodeJPEG(const std::vector<uint8_t>& data) {
    uint32_t width = 0, height = 0;
    int channels = 3;
    
    size_t i = 2;
    while (i < data.size() - 8) {
        if (data[i] != 0xFF) {
            i++;
            continue;
        }
        
        uint8_t marker = data[i + 1];
        
        if (marker == 0xC0 || marker == 0xC2) {
            height = (static_cast<uint32_t>(data[i + 5]) << 8) | data[i + 6];
            width = (static_cast<uint32_t>(data[i + 7]) << 8) | data[i + 8];
            channels = data[i + 9];
            
            imageData_.width = width;
            imageData_.height = height;
            imageData_.channels = channels;
            imageData_.pixels.assign(data.begin() + i, data.end());
            loaded_ = true;
            return true;
        }
        
        if (marker == 0xD9) break;
        
        uint16_t length = (static_cast<uint16_t>(data[i + 2]) << 8) | data[i + 3];
        i += 2 + length;
    }
    
    return false;
}

bool ImageOptimizer::decodePNG(const std::vector<uint8_t>& data) {
    if (data.size() < 24) return false;
    if (data[0] != 0x89 || data[1] != 0x50 || data[2] != 0x4E || data[3] != 0x47) return false;
    
    size_t offset = 8;
    bool hasIHDR = false, hasIEND = false;
    uint32_t width = 0, height = 0;
    int bitDepth = 0, colorType = 0;
    
    while (offset < data.size() - 4) {
        uint32_t chunkLen = (static_cast<uint32_t>(data[offset]) << 24) |
                           (static_cast<uint32_t>(data[offset + 1]) << 16) |
                           (static_cast<uint32_t>(data[offset + 2]) << 8) |
                           static_cast<uint32_t>(data[offset + 3]);
        
        if (offset + 12 + chunkLen > data.size()) break;
        
        uint8_t type[4] = {data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]};
        
        if (type[0] == 'I' && type[1] == 'H' && type[2] == 'D' && type[3] == 'R') {
            hasIHDR = true;
            width = (static_cast<uint32_t>(data[offset + 8]) << 24) |
                   (static_cast<uint32_t>(data[offset + 9]) << 16) |
                   (static_cast<uint32_t>(data[offset + 10]) << 8) |
                   static_cast<uint32_t>(data[offset + 11]);
            height = (static_cast<uint32_t>(data[offset + 12]) << 24) |
                    (static_cast<uint32_t>(data[offset + 13]) << 16) |
                    (static_cast<uint32_t>(data[offset + 14]) << 8) |
                    static_cast<uint32_t>(data[offset + 15]);
            bitDepth = data[offset + 16];
            colorType = data[offset + 17];
        }
        
        if (type[0] == 'I' && type[1] == 'E' && type[2] == 'N' && type[3] == 'D') {
            hasIEND = true;
            break;
        }
        
        offset += 12 + chunkLen;
    }
    
    if (hasIHDR && hasIEND) {
        imageData_.width = width;
        imageData_.height = height;
        imageData_.channels = (colorType == 2) ? 3 : (colorType == 6) ? 4 : 1;
        imageData_.pixels = data;
        loaded_ = true;
        return true;
    }
    
    return false;
}

ImageOptimizationResult ImageOptimizer::optimize(const ImageOptimizationOptions& options) {
    if (!loaded_) {
        throw std::runtime_error("No image loaded");
    }

    double scale = clamp(options.scalePercent / 100.0, 0.1, 1.0);
    uint32_t outputWidth = std::max(1u, static_cast<uint32_t>(imageData_.width * scale));
    uint32_t outputHeight = std::max(1u, static_cast<uint32_t>(imageData_.height * scale));

    ImageData resized = ImageProcessor::resize(imageData_, outputWidth, outputHeight);

    std::vector<uint8_t> encoded;
    switch (options.format) {
        case FORMAT_JPEG:
            encoded = ImageProcessor::encodeJPEG(resized, options.quality);
            break;
        case FORMAT_PNG:
            encoded = ImageProcessor::encodePNG(resized);
            break;
        default:
            encoded = ImageProcessor::encodeJPEG(resized, options.quality);
            break;
    }

    return ImageOptimizationResult{
        std::move(encoded),
        formatToMimeType(options.format),
        imageData_.width,
        imageData_.height,
        outputWidth,
        outputHeight
    };
}

void ImageOptimizer::freeImage() {
    imageData_.pixels.clear();
    imageData_.pixels.shrink_to_fit();
    imageData_.width = 0;
    imageData_.height = 0;
    imageData_.channels = 0;
    loaded_ = false;
}

ImageData ImageProcessor::resize(const ImageData& source, uint32_t newWidth, uint32_t newHeight) {
    if (source.width == newWidth && source.height == newHeight) {
        return source;
    }

    std::vector<uint8_t> resizedPixels(newWidth * newHeight * source.channels);
    
    float xRatio = static_cast<float>(source.width) / newWidth;
    float yRatio = static_cast<float>(source.height) / newHeight;

    for (uint32_t y = 0; y < newHeight; ++y) {
        for (uint32_t x = 0; x < newWidth; ++x) {
            float srcX = x * xRatio;
            float srcY = y * yRatio;
            
            uint32_t x0 = static_cast<uint32_t>(srcX);
            uint32_t y0 = static_cast<uint32_t>(srcY);
            uint32_t x1 = std::min(x0 + 1, source.width - 1);
            uint32_t y1 = std::min(y0 + 1, source.height - 1);

            float xFrac = srcX - x0;
            float yFrac = srcY - y0;

            for (int c = 0; c < source.channels; ++c) {
                float p00 = source.pixels[(y0 * source.width + x0) * source.channels + c];
                float p10 = source.pixels[(y0 * source.width + x1) * source.channels + c];
                float p01 = source.pixels[(y1 * source.width + x0) * source.channels + c];
                float p11 = source.pixels[(y1 * source.width + x1) * source.channels + c];

                float value = p00 * (1 - xFrac) * (1 - yFrac)
                            + p10 * xFrac * (1 - yFrac)
                            + p01 * (1 - xFrac) * yFrac
                            + p11 * xFrac * yFrac;

                resizedPixels[(y * newWidth + x) * source.channels + c] = clampByte(value);
            }
        }
    }

    ImageData result;
    result.channels = source.channels;
    result.width = newWidth;
    result.height = newHeight;
    result.pixels = std::move(resizedPixels);
    return result;
}

std::vector<uint8_t> ImageProcessor::encodeJPEG(const ImageData& image, int quality) {
    std::vector<uint8_t> output;
    output.reserve(image.width * image.height * image.channels);
    
    output.push_back(0xFF);
    output.push_back(0xD8);
    
    std::vector<uint8_t> comment = {'D', 'A', 'A', ' ', 'O', 'p', 't', 'i', 'm', 'i', 'z', 'e', 'd'};
    output.push_back(0xFF);
    output.push_back(0xFE);
    output.push_back(static_cast<uint8_t>((comment.size() + 2) >> 8));
    output.push_back(static_cast<uint8_t>((comment.size() + 2) & 0xFF));
    output.insert(output.end(), comment.begin(), comment.end());
    
    output.push_back(0xFF);
    output.push_back(0xC0);
    uint16_t len = 17;
    output.push_back(static_cast<uint8_t>(len >> 8));
    output.push_back(static_cast<uint8_t>(len & 0xFF));
    output.push_back(8);
    output.push_back(static_cast<uint8_t>(image.height >> 8));
    output.push_back(static_cast<uint8_t>(image.height & 0xFF));
    output.push_back(static_cast<uint8_t>(image.width >> 8));
    output.push_back(static_cast<uint8_t>(image.width & 0xFF));
    output.push_back(3);
    output.push_back(1);
    output.push_back(17);
    output.push_back(0);
    output.push_back(2);
    output.push_back(17);
    output.push_back(1);
    output.push_back(3);
    output.push_back(17);
    output.push_back(1);
    
    output.insert(output.end(), image.pixels.begin(), image.pixels.end());
    
    output.push_back(0xFF);
    output.push_back(0xD9);
    
    return output;
}

std::vector<uint8_t> ImageProcessor::encodePNG(const ImageData& image) {
    std::vector<uint8_t> output;
    
    output.push_back(0x89);
    output.push_back(0x50);
    output.push_back(0x4E);
    output.push_back(0x47);
    output.push_back(0x0D);
    output.push_back(0x0A);
    output.push_back(0x1A);
    output.push_back(0x0A);
    
    uint32_t ihdrLen = 13;
    
    std::vector<uint8_t> ihdrData;
    ihdrData.push_back(static_cast<uint8_t>(image.width >> 24));
    ihdrData.push_back(static_cast<uint8_t>((image.width >> 16) & 0xFF));
    ihdrData.push_back(static_cast<uint8_t>((image.width >> 8) & 0xFF));
    ihdrData.push_back(static_cast<uint8_t>(image.width & 0xFF));
    ihdrData.push_back(static_cast<uint8_t>(image.height >> 24));
    ihdrData.push_back(static_cast<uint8_t>((image.height >> 16) & 0xFF));
    ihdrData.push_back(static_cast<uint8_t>((image.height >> 8) & 0xFF));
    ihdrData.push_back(static_cast<uint8_t>(image.height & 0xFF));
    ihdrData.push_back(8);
    ihdrData.push_back(image.channels == 1 ? 0 : (image.channels == 3 ? 2 : 6));
    ihdrData.push_back(0);
    ihdrData.push_back(0);
    ihdrData.push_back(0);
    
    output.push_back(static_cast<uint8_t>(ihdrLen >> 24));
    output.push_back(static_cast<uint8_t>((ihdrLen >> 16) & 0xFF));
    output.push_back(static_cast<uint8_t>((ihdrLen >> 8) & 0xFF));
    output.push_back(static_cast<uint8_t>(ihdrLen & 0xFF));
    output.push_back('I');
    output.push_back('H');
    output.push_back('D');
    output.push_back('R');
    output.insert(output.end(), ihdrData.begin(), ihdrData.end());
    uint32_t crc = crc32(0, reinterpret_cast<const uint8_t*>("IHDR"), 4);
    crc = crc32_update(crc, ihdrData.data(), ihdrData.size());
    output.push_back(static_cast<uint8_t>(crc >> 24));
    output.push_back(static_cast<uint8_t>((crc >> 16) & 0xFF));
    output.push_back(static_cast<uint8_t>((crc >> 8) & 0xFF));
    output.push_back(static_cast<uint8_t>(crc & 0xFF));
    
    std::vector<uint8_t> rawData;
    uint8_t filter = 0;
    for (uint32_t y = 0; y < image.height; ++y) {
        rawData.push_back(filter);
        for (uint32_t x = 0; x < image.width; ++x) {
            for (int c = 0; c < image.channels; ++c) {
                rawData.push_back(image.pixels[(y * image.width + x) * image.channels + c]);
            }
        }
    }
    
    uLongf compressedSize = static_cast<uLongf>(rawData.size() * 2);
    std::vector<uint8_t> compressed(rawData.size() * 2);
    
    int zlibResult = compress2(compressed.data(), &compressedSize, rawData.data(), static_cast<uLong>(rawData.size()), 6);
    if (zlibResult != Z_OK) {
        compressed = rawData;
        compressedSize = rawData.size();
    }
    compressed.resize(compressedSize);
    
    std::vector<uint8_t> idatChunk;
    idatChunk.push_back('I');
    idatChunk.push_back('D');
    idatChunk.push_back('A');
    idatChunk.push_back('T');
    idatChunk.insert(idatChunk.end(), compressed.begin(), compressed.end());
    
    output.push_back(static_cast<uint8_t>((idatChunk.size()) >> 24));
    output.push_back(static_cast<uint8_t>((idatChunk.size() >> 16) & 0xFF));
    output.push_back(static_cast<uint8_t>((idatChunk.size() >> 8) & 0xFF));
    output.push_back(static_cast<uint8_t>(idatChunk.size() & 0xFF));
    output.insert(output.end(), idatChunk.begin(), idatChunk.end());
    crc = crc32(0, idatChunk.data(), idatChunk.size());
    output.push_back(static_cast<uint8_t>(crc >> 24));
    output.push_back(static_cast<uint8_t>((crc >> 16) & 0xFF));
    output.push_back(static_cast<uint8_t>((crc >> 8) & 0xFF));
    output.push_back(static_cast<uint8_t>(crc & 0xFF));
    
    output.push_back(0);
    output.push_back(0);
    output.push_back(0);
    output.push_back(0);
    output.push_back('I');
    output.push_back('E');
    output.push_back('N');
    output.push_back('D');
    crc = crc32(0, reinterpret_cast<const uint8_t*>("IEND"), 4);
    output.push_back(static_cast<uint8_t>(crc >> 24));
    output.push_back(static_cast<uint8_t>((crc >> 16) & 0xFF));
    output.push_back(static_cast<uint8_t>((crc >> 8) & 0xFF));
    output.push_back(static_cast<uint8_t>(crc & 0xFF));
    
    return output;
}

uint32_t ImageProcessor::crc32(uint32_t crc, const uint8_t* data, size_t len) {
    static uint32_t table[256] = {0};
    static bool init = false;
    
    if (!init) {
        for (uint32_t i = 0; i < 256; ++i) {
            uint32_t c = i;
            for (int j = 0; j < 8; ++j) {
                c = (c & 1) ? (0xEDB88320 ^ (c >> 1)) : (c >> 1);
            }
            table[i] = c;
        }
        init = true;
    }
    
    crc = ~crc;
    for (size_t i = 0; i < len; ++i) {
        crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >> 8);
    }
    return ~crc;
}

uint32_t ImageProcessor::crc32_update(uint32_t crc, const uint8_t* data, size_t len) {
    return crc32(crc, data, len);
}

}
