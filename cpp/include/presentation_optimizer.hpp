#ifndef PRESENTATION_OPTIMIZER_H
#define PRESENTATION_OPTIMIZER_H

#include <cstdint>
#include <string>
#include <vector>
#include <map>

namespace daa {

struct PresentationOptimizationOptions {
    int quality;
    double scalePercent;
};

struct PresentationOptimizationResult {
    std::vector<uint8_t> bytes;
    int optimizedImages;
    int totalImages;
    int skippedImages;
};

class PresentationOptimizer {
public:
    explicit PresentationOptimizer(const PresentationOptimizationOptions& options);
    ~PresentationOptimizer();

    PresentationOptimizationResult optimize(const std::vector<uint8_t>& sourceBytes);

    static bool isPptxFile(const std::string& filePath);
    static bool isPptxData(const std::vector<uint8_t>& data);

private:
    PresentationOptimizationOptions options_;

    static std::string getMediaMimeType(const std::string& fileName);
};

class ZipHandler {
public:
    typedef std::map<std::string, std::vector<uint8_t>> EntryMap;

    static EntryMap unzip(const std::vector<uint8_t>& data);
    static std::vector<uint8_t> zip(const EntryMap& entries, int compressionLevel = 9);
};

}

#endif
