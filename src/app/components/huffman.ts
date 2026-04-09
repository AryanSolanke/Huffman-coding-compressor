// Huffman Tree Node
class HuffmanNode {
  char: string | null;
  frequency: number;
  left: HuffmanNode | null;
  right: HuffmanNode | null;

  constructor(char: string | null, frequency: number) {
    this.char = char;
    this.frequency = frequency;
    this.left = null;
    this.right = null;
  }
}

export type HuffmanTree = HuffmanNode | null;

export interface CompressionStats {
  originalSize: number;
  compressedSize: number;
  ratio: string;
  savings: number;
}

export interface CompressionResult {
  compressed: string;
  codes: Map<string, string>;
  freqMap: Map<string, number>;
  tree: HuffmanTree;
}

export type FileCompressionMethod = 'gzip' | 'huffman';

export interface FileCompressionResult {
  method: FileCompressionMethod;
  compressedBytes: Uint8Array;
  compressedBitLength: number;
  previewBits: string;
  codes: Map<string, string>;
  freqMap: Map<string, number>;
  tree: HuffmanTree;
}

export interface FileHuffmanAnalysis {
  codes: Map<string, string>;
  freqMap: Map<string, number>;
  tree: HuffmanTree;
  compressedBitLength: number;
}

interface FileDecompressionOptions {
  bitLength?: number;
  tree?: HuffmanTree;
}

const PREVIEW_BIT_LIMIT = 5000;
const MAX_HUFFMAN_FILE_BYTES = 256 * 1024;

// Build frequency map from binary data
function buildFrequencyMapFromBytes(data: Uint8Array): Map<string, number> {
  const freqMap = new Map<string, number>();
  for (let i = 0; i < data.length; i++) {
    const byte = String(data[i]);
    freqMap.set(byte, (freqMap.get(byte) || 0) + 1);
  }
  return freqMap;
}

// Build frequency map
function buildFrequencyMap(text: string): Map<string, number> {
  const freqMap = new Map<string, number>();
  for (const char of text) {
    freqMap.set(char, (freqMap.get(char) || 0) + 1);
  }
  return freqMap;
}

// Build Huffman Tree
function buildHuffmanTree(freqMap: Map<string, number>): HuffmanTree {
  if (freqMap.size === 0) return null;

  // Create leaf nodes for all characters
  const nodes: HuffmanNode[] = Array.from(freqMap.entries()).map(
    ([char, freq]) => new HuffmanNode(char, freq)
  );

  // Build tree by repeatedly combining two smallest nodes
  while (nodes.length > 1) {
    nodes.sort((a, b) => a.frequency - b.frequency);

    const left = nodes.shift()!;
    const right = nodes.shift()!;

    const parent = new HuffmanNode(null, left.frequency + right.frequency);
    parent.left = left;
    parent.right = right;

    nodes.push(parent);
  }

  return nodes[0];
}

// Generate Huffman codes
function generateCodes(
  node: HuffmanNode | null,
  code: string,
  codes: Map<string, string>
): void {
  if (!node) return;

  // Leaf node - store the code
  if (node.char !== null) {
    codes.set(node.char, code || '0'); // Handle single character case
    return;
  }

  generateCodes(node.left, code + '0', codes);
  generateCodes(node.right, code + '1', codes);
}

// Compress text
export function compress(text: string): CompressionResult {
  if (!text) {
    return { compressed: '', codes: new Map(), freqMap: new Map(), tree: null };
  }

  const freqMap = buildFrequencyMap(text);
  const tree = buildHuffmanTree(freqMap);
  const codes = new Map<string, string>();

  generateCodes(tree, '', codes);

  // Encode the text
  let compressed = '';
  for (const char of text) {
    compressed += codes.get(char) || '';
  }

  return { compressed, codes, freqMap, tree };
}

// Decompress text
export function decompress(
  compressed: string,
  tree: HuffmanTree
): string {
  if (!compressed || !tree) return '';

  if (tree.char !== null) {
    return tree.char.repeat(compressed.length);
  }

  let result = '';
  let current = tree;

  for (const bit of compressed) {
    // Traverse the tree based on bit
    if (bit === '0') {
      current = current.left!;
    } else {
      current = current.right!;
    }

    // Reached a leaf node
    if (current.char !== null) {
      result += current.char;
      current = tree; // Reset to root
    }
  }

  return result;
}

// Calculate compression ratio
export function calculateStats(originalText: string, compressed: string): CompressionStats {
  const originalBits = originalText.length * 8; // ASCII = 8 bits per char
  const compressedBits = compressed.length;
  const ratio = originalBits > 0 ? ((originalBits - compressedBits) / originalBits) * 100 : 0;

  return {
    originalSize: originalBits,
    compressedSize: compressedBits,
    ratio: ratio.toFixed(2),
    savings: originalBits - compressedBits
  };
}

// Compress binary data (files)
function packBits(bitString: string): Uint8Array {
  const bytes = new Uint8Array(Math.ceil(bitString.length / 8));

  for (let index = 0; index < bytes.length; index++) {
    const start = index * 8;
    const byte = bitString.slice(start, start + 8).padEnd(8, '0');
    bytes[index] = parseInt(byte, 2);
  }

  return bytes;
}

function unpackBits(data: Uint8Array, bitLength: number): string {
  let bitString = '';

  for (const byte of data) {
    bitString += byte.toString(2).padStart(8, '0');
  }

  return bitString.slice(0, bitLength);
}

function createBitPreview(data: Uint8Array, totalBits: number): string {
  const previewBytes = Math.ceil(Math.min(totalBits, PREVIEW_BIT_LIMIT) / 8);
  return unpackBits(data.slice(0, previewBytes), Math.min(totalBits, PREVIEW_BIT_LIMIT));
}

function calculateCompressedBitLength(
  freqMap: Map<string, number>,
  codes: Map<string, string>
): number {
  let compressedBitLength = 0;

  for (const [char, frequency] of freqMap.entries()) {
    compressedBitLength += frequency * (codes.get(char)?.length ?? 0);
  }

  return compressedBitLength;
}

export function analyzeFileData(data: Uint8Array): FileHuffmanAnalysis {
  if (data.length === 0) {
    return {
      codes: new Map(),
      freqMap: new Map(),
      tree: null,
      compressedBitLength: 0,
    };
  }

  const freqMap = buildFrequencyMapFromBytes(data);
  const tree = buildHuffmanTree(freqMap);
  const codes = new Map<string, string>();

  generateCodes(tree, '', codes);

  return {
    codes,
    freqMap,
    tree,
    compressedBitLength: calculateCompressedBitLength(freqMap, codes),
  };
}

function compressFileWithHuffman(
  data: Uint8Array,
  analysis: FileHuffmanAnalysis = analyzeFileData(data)
): FileCompressionResult {
  if (data.length === 0) {
    return {
      method: 'huffman',
      compressedBytes: new Uint8Array(0),
      compressedBitLength: 0,
      previewBits: '',
      codes: new Map(),
      freqMap: new Map(),
      tree: null,
    };
  }

  const { codes, freqMap, tree, compressedBitLength } = analysis;

  let compressed = '';
  for (let i = 0; i < data.length; i++) {
    compressed += codes.get(String(data[i])) || '';
  }

  return {
    method: 'huffman',
    compressedBytes: packBits(compressed),
    compressedBitLength,
    previewBits: compressed.slice(0, PREVIEW_BIT_LIMIT),
    codes,
    freqMap,
    tree,
  };
}

function supportsStreamCompression(): boolean {
  return (
    typeof CompressionStream !== 'undefined' &&
    typeof DecompressionStream !== 'undefined'
  );
}

async function gzipTransform(
  data: Uint8Array,
  mode: 'compress' | 'decompress'
): Promise<Uint8Array> {
  const source = new Blob([Uint8Array.from(data)]).stream();
  const transformed = mode === 'compress'
    ? source.pipeThrough(new CompressionStream('gzip'))
    : source.pipeThrough(new DecompressionStream('gzip'));
  const buffer = await new Response(transformed).arrayBuffer();
  return new Uint8Array(buffer);
}

export async function compressFile(data: Uint8Array): Promise<FileCompressionResult> {
  if (data.length === 0) {
    return compressFileWithHuffman(data);
  }

  const analysis = analyzeFileData(data);
  const canUseStreamCompression = supportsStreamCompression();
  const shouldSkipHuffmanComparison = data.length > MAX_HUFFMAN_FILE_BYTES;

  if (!canUseStreamCompression) {
    if (shouldSkipHuffmanComparison) {
      throw new Error('Large file compression requires stream compression support.');
    }

    return compressFileWithHuffman(data, analysis);
  }

  const gzipBytes = await gzipTransform(data, 'compress');
  const gzipBits = gzipBytes.length * 8;
  const gzipResult: FileCompressionResult = {
    method: 'gzip',
    compressedBytes: gzipBytes,
    compressedBitLength: gzipBits,
    previewBits: createBitPreview(gzipBytes, gzipBits),
    codes: analysis.codes,
    freqMap: analysis.freqMap,
    tree: analysis.tree,
  };

  if (shouldSkipHuffmanComparison) {
    return gzipResult;
  }

  try {
    const huffmanResult = compressFileWithHuffman(data, analysis);
    if (gzipBits >= analysis.compressedBitLength) {
      return huffmanResult;
    }

    return gzipResult;
  } catch {
    return gzipResult;
  }
}

// Decompress to binary data
export async function decompressFile(
  compressedData: Uint8Array,
  method: FileCompressionMethod,
  options: FileDecompressionOptions = {}
): Promise<Uint8Array> {
  if (compressedData.length === 0) return new Uint8Array(0);

  if (method === 'gzip') {
    return gzipTransform(compressedData, 'decompress');
  }

  const tree = options.tree ?? null;
  const bitLength = options.bitLength ?? compressedData.length * 8;
  const compressed = unpackBits(compressedData, bitLength);

  if (!compressed || !tree) return new Uint8Array(0);

  if (tree.char !== null) {
    return new Uint8Array(compressed.length).fill(parseInt(tree.char, 10));
  }

  const result: number[] = [];
  let current = tree;

  for (const bit of compressed) {
    if (bit === '0') {
      current = current.left!;
    } else {
      current = current.right!;
    }

    if (current.char !== null) {
      result.push(parseInt(current.char));
      current = tree;
    }
  }

  return new Uint8Array(result);
}

// Calculate file compression statistics
export function calculateFileStats(originalSize: number, compressedBits: number): CompressionStats {
  const originalBits = originalSize * 8;
  const compressedSize = compressedBits;
  const savings = originalBits - compressedSize;
  const ratio = originalBits > 0 ? ((originalBits - compressedSize) / originalBits) * 100 : 0;

  return {
    originalSize: originalBits,
    compressedSize,
    savings,
    ratio: ratio.toFixed(2)
  };
}
