#include "huffman.hpp"
#include <queue>
#include <algorithm>
#include <cstring>

namespace daa {

HuffmanNode::HuffmanNode(uint8_t b, bool has, uint32_t freq)
    : byte(b), hasByte(has), frequency(freq), left(nullptr), right(nullptr) {}

HuffmanNode::~HuffmanNode() {
    delete left;
    delete right;
}

bool HuffmanNode::isLeaf() const {
    return left == nullptr && right == nullptr;
}

HuffmanCoder::HuffmanCoder() : root_(nullptr) {}

HuffmanCoder::~HuffmanCoder() {
    clear();
}

void HuffmanCoder::clear() {
    delete root_;
    root_ = nullptr;
    freqMap_.clear();
}

void HuffmanCoder::buildTree(const FreqMap& frequencyMap) {
    clear();
    freqMap_ = frequencyMap;

    if (frequencyMap.empty()) return;

    auto compare = [](const HuffmanNode* a, const HuffmanNode* b) {
        return a->frequency > b->frequency;
    };
    std::priority_queue<HuffmanNode*, std::vector<HuffmanNode*>, decltype(compare)> minHeap(compare);

    for (FreqMap::const_iterator it = frequencyMap.begin(); it != frequencyMap.end(); ++it) {
        minHeap.push(new HuffmanNode(it->first, true, it->second));
    }

    while (minHeap.size() > 1) {
        HuffmanNode* left = minHeap.top();
        minHeap.pop();
        HuffmanNode* right = minHeap.top();
        minHeap.pop();

        HuffmanNode* parent = new HuffmanNode(0, false, left->frequency + right->frequency);
        parent->left = left;
        parent->right = right;

        minHeap.push(parent);
    }

    root_ = minHeap.top();
}

void HuffmanCoder::buildTree(const std::vector<uint8_t>& data) {
    FreqMap freqMap;
    for (size_t i = 0; i < data.size(); ++i) {
        freqMap[data[i]]++;
    }
    buildTree(freqMap);
}

HuffmanCoder::CodeMap HuffmanCoder::generateCodes() const {
    CodeMap codes;
    if (!root_) return codes;

    HuffmanCode currentCode;
    HuffmanCode emptyCode;
    generateCodesRecursive(root_, emptyCode, codes);
    return codes;
}

void HuffmanCoder::generateCodesRecursive(const HuffmanNode* node, 
                                          const HuffmanCode& currentCode,
                                          CodeMap& codes) const {
    if (!node) return;

    if (node->isLeaf() && node->hasByte) {
        HuffmanCode code = currentCode;
        if (code.bits.empty()) {
            code.bits.push_back(false);
        }
        codes[node->byte] = code;
        return;
    }

    HuffmanCode leftCode = currentCode;
    leftCode.bits.push_back(false);
    generateCodesRecursive(node->left, leftCode, codes);

    HuffmanCode rightCode = currentCode;
    rightCode.bits.push_back(true);
    generateCodesRecursive(node->right, rightCode, codes);
}

HuffmanCoder::FreqMap HuffmanCoder::getFrequencyMap() const {
    return freqMap_;
}

std::vector<uint8_t> HuffmanCoder::compress(const std::vector<uint8_t>& data) {
    if (data.empty()) return std::vector<uint8_t>();

    buildTree(data);
    CodeMap codes = generateCodes();

    std::vector<bool> bitBuffer;
    for (size_t i = 0; i < data.size(); ++i) {
        CodeMap::iterator it = codes.find(data[i]);
        if (it != codes.end()) {
            bitBuffer.insert(bitBuffer.end(), it->second.bits.begin(), it->second.bits.end());
        }
    }

    std::vector<uint8_t> result;
    for (size_t i = 0; i < bitBuffer.size(); i += 8) {
        uint8_t byte = 0;
        for (size_t j = 0; j < 8 && i + j < bitBuffer.size(); ++j) {
            if (bitBuffer[i + j]) {
                byte |= (1 << (7 - j));
            }
        }
        result.push_back(byte);
    }

    return result;
}

std::vector<uint8_t> HuffmanCoder::decompress(const std::vector<uint8_t>& compressedData, 
                                               size_t originalSize) {
    if (compressedData.empty() || !root_) return std::vector<uint8_t>();

    if (root_->isLeaf() && root_->hasByte) {
        return std::vector<uint8_t>(originalSize, root_->byte);
    }

    std::vector<uint8_t> result;
    HuffmanNode* current = root_;
    size_t bitsProcessed = 0;

    for (size_t byteIdx = 0; byteIdx < compressedData.size() && bitsProcessed < originalSize; ++byteIdx) {
        uint8_t byte = compressedData[byteIdx];
        for (int i = 7; i >= 0 && bitsProcessed < originalSize; --i) {
            bool bit = (byte >> i) & 1;
            current = bit ? current->right : current->left;

            if (!current) return result;

            if (current->isLeaf() && current->hasByte) {
                result.push_back(current->byte);
                current = root_;
                bitsProcessed++;

                if (bitsProcessed >= originalSize) break;
            }
        }
    }

    return result;
}

std::string HuffmanCoder::compressToString(const std::string& text) {
    if (text.empty()) return "";

    FreqMap freqMap;
    for (size_t i = 0; i < text.size(); ++i) {
        freqMap[static_cast<uint8_t>(text[i])]++;
    }
    buildTree(freqMap);
    CodeMap codes = generateCodes();

    std::string result;
    for (size_t i = 0; i < text.size(); ++i) {
        CodeMap::iterator it = codes.find(static_cast<uint8_t>(text[i]));
        if (it != codes.end()) {
            for (size_t j = 0; j < it->second.bits.size(); ++j) {
                result += it->second.bits[j] ? '1' : '0';
            }
        }
    }

    return result;
}

std::string HuffmanCoder::decompressFromString(const std::string& compressed, 
                                                 const std::string& originalText) {
    if (compressed.empty() || !root_) return "";

    if (root_->isLeaf() && root_->hasByte) {
        return std::string(originalText.size(), static_cast<char>(root_->byte));
    }

    std::string result;
    HuffmanNode* current = root_;

    for (size_t i = 0; i < compressed.size(); ++i) {
        bool bit = (compressed[i] == '1');
        current = bit ? current->right : current->left;

        if (!current) return result;

        if (current->isLeaf() && current->hasByte) {
            result += static_cast<char>(current->byte);
            current = root_;

            if (result.size() >= originalText.size()) break;
        }
    }

    return result;
}

CompressionStats HuffmanCoder::calculateStats(uint64_t originalBits, uint64_t compressedBits) {
    CompressionStats stats;
    stats.originalSize = originalBits;
    stats.compressedSize = compressedBits;
    stats.savings = static_cast<int64_t>(originalBits) - static_cast<int64_t>(compressedBits);
    stats.ratio = originalBits > 0 ? (static_cast<double>(stats.savings) / originalBits) * 100.0 : 0.0;
    return stats;
}

HuffmanFileCompressor::HuffmanFileCompressor() {}
HuffmanFileCompressor::~HuffmanFileCompressor() {}

HuffmanFileCompressor::AnalysisResult HuffmanFileCompressor::analyze(const std::vector<uint8_t>& data) {
    coder_.buildTree(data);
    analysis_.codes = coder_.generateCodes();
    analysis_.freqMap = coder_.getFrequencyMap();

    analysis_.compressedBitLength = 0;
    typedef HuffmanCoder::FreqMap FMap;
    typedef HuffmanCoder::CodeMap CMap;
    for (FMap::iterator it = analysis_.freqMap.begin(); it != analysis_.freqMap.end(); ++it) {
        CMap::iterator cit = analysis_.codes.find(it->first);
        if (cit != analysis_.codes.end()) {
            analysis_.compressedBitLength += it->second * cit->second.bits.size();
        }
    }

    return analysis_;
}

std::vector<uint8_t> HuffmanFileCompressor::compress(const std::vector<uint8_t>& data) {
    analyze(data);
    return coder_.compress(data);
}

std::vector<uint8_t> HuffmanFileCompressor::decompress(const std::vector<uint8_t>& compressedData,
                                                       size_t bitLength,
                                                       const HuffmanCoder::CodeMap& codes) {
    (void)codes;
    return coder_.decompress(compressedData, bitLength);
}

std::vector<uint8_t> HuffmanFileCompressor::packBits(const std::string& bitString) {
    std::vector<uint8_t> bytes;
    for (size_t i = 0; i < bitString.size(); i += 8) {
        uint8_t byte = 0;
        for (size_t j = 0; j < 8 && i + j < bitString.size(); ++j) {
            if (bitString[i + j] == '1') {
                byte |= (1 << (7 - j));
            }
        }
        bytes.push_back(byte);
    }
    return bytes;
}

std::string HuffmanFileCompressor::unpackBits(const std::vector<uint8_t>& data, size_t bitLength) {
    std::string result;
    size_t bitsAdded = 0;

    for (size_t i = 0; i < data.size() && bitsAdded < bitLength; ++i) {
        uint8_t byte = data[i];
        for (int j = 7; j >= 0 && bitsAdded < bitLength; --j) {
            result += ((byte >> j) & 1) ? '1' : '0';
            bitsAdded++;
        }
    }

    return result;
}

}
