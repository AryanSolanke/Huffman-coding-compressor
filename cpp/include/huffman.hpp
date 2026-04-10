#ifndef HUFFMAN_H
#define HUFFMAN_H

#include <cstdint>
#include <map>
#include <string>
#include <vector>

namespace daa {

struct HuffmanNode {
    uint8_t byte;
    bool hasByte;
    uint32_t frequency;
    HuffmanNode* left;
    HuffmanNode* right;

    HuffmanNode(uint8_t b, bool has, uint32_t freq);
    ~HuffmanNode();

    bool isLeaf() const;
};

struct CompressionStats {
    uint64_t originalSize;
    uint64_t compressedSize;
    double ratio;
    int64_t savings;
};

struct HuffmanCode {
    std::vector<bool> bits;
};

class HuffmanCoder {
public:
    typedef std::map<uint8_t, uint32_t> FreqMap;
    typedef std::map<uint8_t, HuffmanCode> CodeMap;

    HuffmanCoder();
    ~HuffmanCoder();

    void buildTree(const FreqMap& frequencyMap);
    void buildTree(const std::vector<uint8_t>& data);
    
    CodeMap generateCodes() const;
    FreqMap getFrequencyMap() const;
    
    std::vector<uint8_t> compress(const std::vector<uint8_t>& data);
    std::vector<uint8_t> decompress(const std::vector<uint8_t>& compressedData, size_t originalSize);
    
    std::string compressToString(const std::string& text);
    std::string decompressFromString(const std::string& compressed, const std::string& originalText);
    
    static CompressionStats calculateStats(uint64_t originalBits, uint64_t compressedBits);
    
    void clear();

private:
    FreqMap freqMap_;
    HuffmanNode* root_;
    
    void generateCodesRecursive(const HuffmanNode* node, const HuffmanCode& currentCode, CodeMap& codes) const;
    void deleteTree(HuffmanNode* node);
};

class HuffmanFileCompressor {
public:
    struct AnalysisResult {
        HuffmanCoder::CodeMap codes;
        HuffmanCoder::FreqMap freqMap;
        size_t compressedBitLength;
    };

    HuffmanFileCompressor();
    ~HuffmanFileCompressor();

    AnalysisResult analyze(const std::vector<uint8_t>& data);
    
    std::vector<uint8_t> compress(const std::vector<uint8_t>& data);
    std::vector<uint8_t> decompress(const std::vector<uint8_t>& compressedData, 
                                     size_t bitLength,
                                     const HuffmanCoder::CodeMap& codes);
    
    static std::vector<uint8_t> packBits(const std::string& bitString);
    static std::string unpackBits(const std::vector<uint8_t>& data, size_t bitLength);

private:
    HuffmanCoder coder_;
    AnalysisResult analysis_;
};

}

#endif
