#ifndef IMAGE_OPTIMIZER_H
#define IMAGE_OPTIMIZER_H

#include <cstdint>
#include <string>
#include <vector>

#ifdef _WIN32
    #include <windows.h>
    #include <cstdio>
#else
    #include <cstdio>
    #include <unistd.h>
#endif

#include <zlib.h>

namespace daa {

enum ImageFormat {
    FORMAT_WEBP,
    FORMAT_JPEG,
    FORMAT_PNG,
    FORMAT_UNKNOWN
};

struct ImageOptimizationOptions {
    ImageFormat format;
    int quality;
    double scalePercent;
};

struct ImageOptimizationResult {
    std::vector<uint8_t> bytes;
    std::string mimeType;
    uint32_t originalWidth;
    uint32_t originalHeight;
    uint32_t outputWidth;
    uint32_t outputHeight;
};

struct ImageData {
    uint32_t width;
    uint32_t height;
    int channels;
    std::vector<uint8_t> pixels;
};

class ImageOptimizer {
public:
    ImageOptimizer();
    ~ImageOptimizer();

    static ImageFormat parseFormat(const std::string& mimeType);
    static std::string formatToMimeType(ImageFormat format);
    static std::string getExtension(ImageFormat format);

    bool loadFromFile(const std::string& filePath);
    bool loadFromMemory(const std::vector<uint8_t>& data);
    
    bool hasImage() const { return loaded_; }
    ImageData getImage() const { return imageData_; }
    
    ImageOptimizationResult optimize(const ImageOptimizationOptions& options);

    void freeImage();

private:
    ImageData imageData_;
    bool loaded_;
    
    bool decodeJPEG(const std::vector<uint8_t>& data);
    bool decodePNG(const std::vector<uint8_t>& data);
};

class ImageProcessor {
public:
    static ImageData resize(const ImageData& source, uint32_t newWidth, uint32_t newHeight);

    static std::vector<uint8_t> encodeJPEG(const ImageData& image, int quality);
    static std::vector<uint8_t> encodePNG(const ImageData& image);

    static uint32_t crc32(uint32_t crc, const uint8_t* data, size_t len);
    static uint32_t crc32_update(uint32_t crc, const uint8_t* data, size_t len);
};

}

#endif
