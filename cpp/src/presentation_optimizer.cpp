#include "presentation_optimizer.hpp"
#include "image_optimizer.hpp"
#include <stdexcept>
#include <algorithm>
#include <cstring>

namespace {

const uint32_t kLocalFileSignature = 0x04034b50;
const uint32_t kCentralDirSignature = 0x02014b50;
const uint32_t kEndCentralDirSignature = 0x06054b50;

#pragma pack(push, 1)
struct LocalFileHeader {
    uint32_t signature;
    uint16_t versionNeeded;
    uint16_t flags;
    uint16_t compressionMethod;
    uint16_t lastModTime;
    uint16_t lastModDate;
    uint32_t crc32;
    uint32_t compressedSize;
    uint32_t uncompressedSize;
    uint16_t filenameLength;
    uint16_t extraFieldLength;
};

struct CentralDirectoryHeader {
    uint32_t signature;
    uint16_t versionMadeBy;
    uint16_t versionNeeded;
    uint16_t flags;
    uint16_t compressionMethod;
    uint16_t lastModTime;
    uint16_t lastModDate;
    uint32_t crc32;
    uint32_t compressedSize;
    uint32_t uncompressedSize;
    uint16_t filenameLength;
    uint16_t extraFieldLength;
    uint16_t commentLength;
    uint16_t diskNumber;
    uint16_t internalAttr;
    uint32_t externalAttr;
    uint32_t localHeaderOffset;
};

struct EndOfCentralDirectory {
    uint32_t signature;
    uint16_t diskNumber;
    uint16_t centralDirDisk;
    uint16_t entriesOnDisk;
    uint16_t totalEntries;
    uint32_t centralDirSize;
    uint32_t centralDirOffset;
    uint16_t commentLength;
};
#pragma pack(pop)

}

namespace daa {

PresentationOptimizer::PresentationOptimizer(const PresentationOptimizationOptions& options)
    : options_(options) {}

PresentationOptimizer::~PresentationOptimizer() {}

PresentationOptimizationResult PresentationOptimizer::optimize(const std::vector<uint8_t>& sourceBytes) {
    ZipHandler::EntryMap entries = ZipHandler::unzip(sourceBytes);
    
    std::map<std::string, std::vector<uint8_t>> rebuiltArchive;
    int optimizedImages = 0;
    int totalImages = 0;
    int skippedImages = 0;

    ImageOptimizer optimizer;
    ImageOptimizationOptions imgOptions;

    for (std::map<std::string, std::vector<uint8_t>>::iterator it = entries.begin(); 
         it != entries.end(); ++it) {
        const std::string& entryName = it->first;
        std::vector<uint8_t>& entryBytes = it->second;
        
        std::string mimeType = getMediaMimeType(entryName);
        
        if (mimeType.empty()) {
            rebuiltArchive[entryName] = entryBytes;
            continue;
        }

        totalImages++;

        try {
            if (!mimeType.empty()) {
                imgOptions.format = ImageOptimizer::parseFormat(mimeType);
                imgOptions.quality = options_.quality;
                imgOptions.scalePercent = options_.scalePercent;

                if (optimizer.loadFromMemory(entryBytes)) {
                    ImageOptimizationResult result = optimizer.optimize(imgOptions);
                    
                    if (result.bytes.size() < entryBytes.size()) {
                        rebuiltArchive[entryName] = std::move(result.bytes);
                        optimizedImages++;
                    } else {
                        rebuiltArchive[entryName] = entryBytes;
                        skippedImages++;
                    }
                } else {
                    rebuiltArchive[entryName] = entryBytes;
                    skippedImages++;
                }
            } else {
                rebuiltArchive[entryName] = entryBytes;
                skippedImages++;
            }
        } catch (const std::exception&) {
            rebuiltArchive[entryName] = entryBytes;
            skippedImages++;
        }
    }

    std::vector<uint8_t> optimizedArchive = ZipHandler::zip(rebuiltArchive, 9);

    if (optimizedArchive.size() >= sourceBytes.size()) {
        return PresentationOptimizationResult{
            sourceBytes,
            0,
            totalImages,
            skippedImages
        };
    }

    return PresentationOptimizationResult{
        std::move(optimizedArchive),
        optimizedImages,
        totalImages,
        skippedImages
    };
}

bool PresentationOptimizer::isPptxFile(const std::string& filePath) {
    if (filePath.size() >= 5) {
        std::string ext = filePath.substr(filePath.size() - 5);
        std::transform(ext.begin(), ext.end(), ext.begin(), ::tolower);
        if (ext == ".pptx") return true;
    }
    return false;
}

bool PresentationOptimizer::isPptxData(const std::vector<uint8_t>& data) {
    if (data.size() < 4) return false;
    uint32_t sig = static_cast<uint32_t>(data[0]) | 
                   (static_cast<uint32_t>(data[1]) << 8) |
                   (static_cast<uint32_t>(data[2]) << 16) |
                   (static_cast<uint32_t>(data[3]) << 24);
    return sig == kLocalFileSignature;
}

std::string PresentationOptimizer::getMediaMimeType(const std::string& fileName) {
    if (fileName.find("ppt/media/") != 0) return "";
    
    std::string lowerFileName = fileName;
    std::transform(lowerFileName.begin(), lowerFileName.end(), lowerFileName.begin(), ::tolower);
    
    if (lowerFileName.size() >= 5) {
        std::string ext = lowerFileName.substr(lowerFileName.size() - 4);
        if (ext == ".jpg" || ext == "jpeg") return "image/jpeg";
        if (ext == ".png") return "image/png";
        if (ext == ".webp") return "image/webp";
    }
    
    return "";
}

ZipHandler::EntryMap ZipHandler::unzip(const std::vector<uint8_t>& data) {
    EntryMap entries;
    size_t offset = 0;

    while (offset + sizeof(LocalFileHeader) <= data.size()) {
        LocalFileHeader header;
        std::memcpy(&header, data.data() + offset, sizeof(LocalFileHeader));
        
        if (header.signature != kLocalFileSignature) {
            if (header.signature == kCentralDirSignature) break;
            if (header.signature == kEndCentralDirSignature) break;
            break;
        }

        offset += sizeof(LocalFileHeader);

        if (offset + header.filenameLength > data.size()) break;

        std::string filename(reinterpret_cast<const char*>(data.data() + offset), header.filenameLength);
        offset += header.filenameLength;
        offset += header.extraFieldLength;

        if (offset + header.compressedSize > data.size()) break;

        std::vector<uint8_t> fileData(header.uncompressedSize);

        if (header.compressionMethod == 0) {
            std::memcpy(fileData.data(), data.data() + offset, header.uncompressedSize);
        } else if (header.compressionMethod == 8) {
            uLongf destLen = header.uncompressedSize;
            int result = uncompress(fileData.data(), &destLen, 
                                   data.data() + offset, header.compressedSize);
            if (result != Z_OK) {
                throw std::runtime_error("Failed to decompress entry: " + filename);
            }
        }

        entries[filename] = std::move(fileData);
        offset += header.compressedSize;
    }

    return entries;
}

std::vector<uint8_t> ZipHandler::zip(const EntryMap& entries, int compressionLevel) {
    std::vector<uint8_t> result;
    std::vector<size_t> centralDirOffsets;
    uint32_t centralDirOffset = 0;
    uint16_t entryCount = 0;

    for (EntryMap::const_iterator it = entries.begin(); it != entries.end(); ++it) {
        const std::string& filename = it->first;
        const std::vector<uint8_t>& data = it->second;
        
        centralDirOffsets.push_back(result.size());

        LocalFileHeader localHeader;
        std::memset(&localHeader, 0, sizeof(LocalFileHeader));
        localHeader.signature = kLocalFileSignature;
        localHeader.versionNeeded = 20;
        localHeader.compressionMethod = 8;
        localHeader.lastModTime = 0;
        localHeader.lastModDate = 0;
        localHeader.crc32 = static_cast<uint32_t>(crc32(0, data.data(), static_cast<uInt>(data.size())));
        
        std::vector<uint8_t> compressedData(data.size());
        uLongf compressedSize = static_cast<uLongf>(compressedData.size());
        int result_code = compress2(compressedData.data(), &compressedSize,
                                     data.data(), data.size(), compressionLevel);
        if (result_code != Z_OK) {
            throw std::runtime_error("Compression failed");
        }
        compressedData.resize(compressedSize);
        localHeader.compressedSize = static_cast<uint32_t>(compressedSize);
        localHeader.uncompressedSize = static_cast<uint32_t>(data.size());
        localHeader.filenameLength = static_cast<uint16_t>(filename.size());
        localHeader.extraFieldLength = 0;

        result.insert(result.end(), reinterpret_cast<uint8_t*>(&localHeader),
                      reinterpret_cast<uint8_t*>(&localHeader) + sizeof(LocalFileHeader));
        result.insert(result.end(), filename.begin(), filename.end());
        result.insert(result.end(), compressedData.begin(), compressedData.end());

        entryCount++;
    }

    centralDirOffset = static_cast<uint32_t>(result.size());

    size_t idx = 0;
    for (EntryMap::const_iterator it = entries.begin(); it != entries.end(); ++it, ++idx) {
        const std::string& filename = it->first;
        const std::vector<uint8_t>& data = it->second;

        CentralDirectoryHeader cdHeader;
        std::memset(&cdHeader, 0, sizeof(CentralDirectoryHeader));
        cdHeader.signature = kCentralDirSignature;
        cdHeader.versionMadeBy = 20;
        cdHeader.versionNeeded = 20;
        cdHeader.compressionMethod = 8;
        cdHeader.lastModTime = 0;
        cdHeader.lastModDate = 0;
        cdHeader.crc32 = static_cast<uint32_t>(crc32(0, data.data(), static_cast<uInt>(data.size())));
        cdHeader.compressedSize = 0;
        cdHeader.uncompressedSize = static_cast<uint32_t>(data.size());
        cdHeader.filenameLength = static_cast<uint16_t>(filename.size());
        cdHeader.extraFieldLength = 0;
        cdHeader.commentLength = 0;
        cdHeader.localHeaderOffset = static_cast<uint32_t>(centralDirOffsets[idx]);

        result.insert(result.end(), reinterpret_cast<uint8_t*>(&cdHeader),
                      reinterpret_cast<uint8_t*>(&cdHeader) + sizeof(CentralDirectoryHeader));
        result.insert(result.end(), filename.begin(), filename.end());
    }

    uint32_t centralDirSize = static_cast<uint32_t>(result.size() - centralDirOffset);

    EndOfCentralDirectory eocd;
    std::memset(&eocd, 0, sizeof(EndOfCentralDirectory));
    eocd.signature = kEndCentralDirSignature;
    eocd.diskNumber = 0;
    eocd.centralDirDisk = 0;
    eocd.entriesOnDisk = entryCount;
    eocd.totalEntries = entryCount;
    eocd.centralDirSize = centralDirSize;
    eocd.centralDirOffset = centralDirOffset;
    eocd.commentLength = 0;

    result.insert(result.end(), reinterpret_cast<uint8_t*>(&eocd),
                  reinterpret_cast<uint8_t*>(&eocd) + sizeof(EndOfCentralDirectory));

    return result;
}

}
