import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  analyzeFileData,
  compress,
  decompress,
  calculateStats,
  compressFile,
  decompressFile,
  calculateFileStats,
  type CompressionStats,
  type FileCompressionMethod,
  type HuffmanTree,
} from './components/huffman';
import {
  getImageOutputExtension,
  optimizeImageFile,
  type ImageOptimizationFormat,
  type ImageOptimizationResult,
} from './components/image-optimizer';
import {
  isPptxFile,
  optimizePresentationFile,
  type PresentationOptimizationResult,
} from './components/presentation-optimizer';
import { FileText, Zap, BarChart3, Upload, Download, X } from 'lucide-react';

function createBlobFromBytes(data: Uint8Array, type: string) {
  return new Blob([Uint8Array.from(data)], { type });
}

function formatKilobytesFromBytes(byteCount: number) {
  return `${(byteCount / 1024).toFixed(2)} KB`;
}

function formatKilobytesFromBits(bitCount: number) {
  return formatKilobytesFromBytes(bitCount / 8);
}

function stripFileExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '');
}

type FileProcessingMode = 'lossless' | 'image-optimize' | 'presentation-optimize';

export default function App() {
  const [inputText, setInputText] = useState('');
  const [compressedBits, setCompressedBits] = useState('');
  const [decompressedText, setDecompressedText] = useState('');
  const [huffmanCodes, setHuffmanCodes] = useState<Map<string, string>>(new Map());
  const [freqMap, setFreqMap] = useState<Map<string, number>>(new Map());
  const [tree, setTree] = useState<HuffmanTree>(null);
  const [stats, setStats] = useState<CompressionStats | null>(null);

  // File handling state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<Uint8Array | null>(null);
  const [compressedFileData, setCompressedFileData] = useState<Uint8Array | null>(null);
  const [compressedFileBitLength, setCompressedFileBitLength] = useState(0);
  const [decompressedData, setDecompressedData] = useState<Uint8Array | null>(null);
  const [fileCompressionMethod, setFileCompressionMethod] = useState<FileCompressionMethod | null>(null);
  const [mode, setMode] = useState<'text' | 'file'>('text');
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [compressionView, setCompressionView] = useState<'saved' | 'ratio'>('saved');
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileProcessingMode, setFileProcessingMode] = useState<FileProcessingMode>('lossless');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [imageFormat, setImageFormat] = useState<ImageOptimizationFormat>('image/webp');
  const [imageQuality, setImageQuality] = useState(72);
  const [imageScalePercent, setImageScalePercent] = useState(100);
  const [optimizedImage, setOptimizedImage] = useState<ImageOptimizationResult | null>(null);
  const [optimizedPresentation, setOptimizedPresentation] = useState<PresentationOptimizationResult | null>(null);
  const [optimizedImagePreviewUrl, setOptimizedImagePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const optimizedPreviewUrlRef = useRef<string | null>(null);

  const isImageFile = uploadedFile?.type.startsWith('image/') ?? false;
  const isUploadedPptx = isPptxFile(uploadedFile);
  const isImageOptimizationMode = mode === 'file' && isImageFile && fileProcessingMode === 'image-optimize';
  const isPresentationOptimizationMode = mode === 'file' && isUploadedPptx && fileProcessingMode === 'presentation-optimize';
  const hasImageOptimizationIncrease = !!uploadedFile && !!optimizedImage && optimizedImage.bytes.length >= uploadedFile.size;
  const hasPresentationOptimizationIncrease = !!uploadedFile && !!optimizedPresentation && optimizedPresentation.bytes.length >= uploadedFile.size;

  useEffect(() => {
    return () => {
      if (optimizedPreviewUrlRef.current) {
        URL.revokeObjectURL(optimizedPreviewUrlRef.current);
      }
    };
  }, []);

  const updateOptimizedImagePreview = (url: string | null) => {
    if (optimizedPreviewUrlRef.current) {
      URL.revokeObjectURL(optimizedPreviewUrlRef.current);
    }

    optimizedPreviewUrlRef.current = url;
    setOptimizedImagePreviewUrl(url);
  };

  const clearOptimizationResults = () => {
    setOptimizedImage(null);
    setOptimizedPresentation(null);
    updateOptimizedImagePreview(null);
  };

  const clearLosslessResults = () => {
    setCompressedBits('');
    setCompressedFileData(null);
    setCompressedFileBitLength(0);
    setDecompressedData(null);
    setFileCompressionMethod(null);
  };

  const applyLosslessCompression = async (fileBytes: Uint8Array) => {
    clearOptimizationResults();

    const result = await compressFile(fileBytes);
    setCompressedBits(result.previewBits);
    setCompressedFileData(result.compressedBytes);
    setCompressedFileBitLength(result.compressedBitLength);
    setFileCompressionMethod(result.method);
    setHuffmanCodes(result.codes);
    setFreqMap(result.freqMap);
    setTree(result.tree);
    setStats(calculateFileStats(fileBytes.length, result.compressedBitLength));
    setDecompressedData(null);
  };

  const applyImageOptimization = async (file: File, fileBytes: Uint8Array) => {
    clearLosslessResults();

    const result = await optimizeImageFile(file, {
      format: imageFormat,
      quality: imageQuality,
      scalePercent: imageScalePercent,
    });
    const previewUrl = URL.createObjectURL(createBlobFromBytes(result.bytes, result.mimeType));

    updateOptimizedImagePreview(previewUrl);
    setOptimizedImage(result);
    setStats(calculateFileStats(fileBytes.length, result.bytes.length * 8));
  };

  const applyPresentationOptimization = async (fileBytes: Uint8Array) => {
    clearLosslessResults();
    clearOptimizationResults();

    const result = await optimizePresentationFile(fileBytes, {
      quality: imageQuality,
      scalePercent: imageScalePercent,
    });

    setOptimizedPresentation(result);
    setStats(calculateFileStats(fileBytes.length, result.bytes.length * 8));
  };

  const processUploadedFile = async (
    file: File,
    fileBytes: Uint8Array,
    processingMode: FileProcessingMode
  ) => {
    setIsProcessingFile(true);
    setFileError(null);

    try {
      if (processingMode === 'image-optimize' && file.type.startsWith('image/')) {
        await applyImageOptimization(file, fileBytes);
      } else if (processingMode === 'presentation-optimize' && isPptxFile(file)) {
        await applyPresentationOptimization(fileBytes);
      } else {
        await applyLosslessCompression(fileBytes);
      }
    } catch {
      clearLosslessResults();
      clearOptimizationResults();
      setStats(null);
      setFileError('The file could not be processed in this browser. Try a smaller image or switch to lossless mode.');
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleCompress = () => {
    if (!inputText.trim()) return;

    const result = compress(inputText);
    setCompressedBits(result.compressed);
    setHuffmanCodes(result.codes);
    setFreqMap(result.freqMap);
    setTree(result.tree);

    const statistics = calculateStats(inputText, result.compressed);
    setStats(statistics);
    setDecompressedText('');
  };

  const handleDecompress = () => {
    if (!compressedBits || !tree) return;

    const result = decompress(compressedBits, tree);
    setDecompressedText(result);
  };

  const handleClear = () => {
    setInputText('');
    setCompressedBits('');
    setDecompressedText('');
    setHuffmanCodes(new Map());
    setFreqMap(new Map());
    setTree(null);
    setStats(null);
    setUploadedFile(null);
    setFileData(null);
    setCompressedFileData(null);
    setCompressedFileBitLength(0);
    setDecompressedData(null);
    setFileCompressionMethod(null);
    setFilePreview(null);
    setFileError(null);
    setFileProcessingMode('lossless');
    setIsProcessingFile(false);
    setImageFormat('image/webp');
    setImageQuality(72);
    setImageScalePercent(100);
    clearOptimizationResults();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const loadSample = () => {
    const sample = "Hello, World! This is a sample text for Huffman coding compression algorithm demonstration.";
    setInputText(sample);
    setMode('text');
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadedFile(file);
      setMode('file');
      setDecompressedData(null);
      setFileError(null);

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setFilePreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }

      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      setFileData(uint8Array);
      const analysis = analyzeFileData(uint8Array);
      setHuffmanCodes(analysis.codes);
      setFreqMap(analysis.freqMap);
      setTree(analysis.tree);
      const nextProcessingMode: FileProcessingMode = file.type.startsWith('image/')
        ? 'image-optimize'
        : isPptxFile(file)
          ? 'presentation-optimize'
          : 'lossless';
      setFileProcessingMode(nextProcessingMode);

      await processUploadedFile(file, uint8Array, nextProcessingMode);
    } catch {
      clearLosslessResults();
      clearOptimizationResults();
      setHuffmanCodes(new Map());
      setFreqMap(new Map());
      setTree(null);
      setStats(null);
      setFileError('The file could not be loaded in this browser. Try a smaller file or a different format.');
    }
  };

  const handleFileModeChange = async (nextMode: FileProcessingMode) => {
    setFileProcessingMode(nextMode);

    if (!uploadedFile || !fileData) return;
    await processUploadedFile(uploadedFile, fileData, nextMode);
  };

  const handleOptimizeImage = async () => {
    if (!uploadedFile || !fileData || !uploadedFile.type.startsWith('image/')) return;
    await processUploadedFile(uploadedFile, fileData, 'image-optimize');
  };

  const handleOptimizePresentation = async () => {
    if (!uploadedFile || !fileData || !isPptxFile(uploadedFile)) return;
    await processUploadedFile(uploadedFile, fileData, 'presentation-optimize');
  };

  const handleFileDecompress = async () => {
    if (!compressedFileData || !fileCompressionMethod) return;

    const result = await decompressFile(compressedFileData, fileCompressionMethod, {
      tree,
      bitLength: compressedFileBitLength,
    });
    setDecompressedData(result);
  };

  const downloadCompressed = () => {
    if (!compressedFileData) return;

    const blob = createBlobFromBytes(compressedFileData, 'application/octet-stream');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${uploadedFile?.name || 'compressed'}${fileCompressionMethod === 'gzip' ? '.gz' : '.huff'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadOptimizedImage = () => {
    if (!optimizedImage || !uploadedFile) return;

    const blob = createBlobFromBytes(optimizedImage.bytes, optimizedImage.mimeType);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${stripFileExtension(uploadedFile.name)}-optimized.${getImageOutputExtension(optimizedImage.mimeType)}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadOptimizedPresentation = () => {
    if (!optimizedPresentation || !uploadedFile) return;

    const blob = createBlobFromBytes(
      optimizedPresentation.bytes,
      uploadedFile.type || 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${stripFileExtension(uploadedFile.name)}-optimized.pptx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadDecompressed = () => {
    if (!decompressedData) return;

    const blob = createBlobFromBytes(
      decompressedData,
      uploadedFile?.type || 'application/octet-stream'
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = uploadedFile?.name || 'decompressed';
    a.click();
    URL.revokeObjectURL(url);
  };

  const removeFile = () => {
    setUploadedFile(null);
    setFileData(null);
    setCompressedFileData(null);
    setCompressedFileBitLength(0);
    setDecompressedData(null);
    setFileCompressionMethod(null);
    setFilePreview(null);
    setFileError(null);
    setFileProcessingMode('lossless');
    setIsProcessingFile(false);
    setCompressedBits('');
    setHuffmanCodes(new Map());
    setFreqMap(new Map());
    setTree(null);
    setStats(null);
    clearOptimizationResults();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Zap className="w-10 h-10 text-indigo-600" />
            <h1 className="text-4xl font-bold text-gray-800">Huffman Coding Compressor</h1>
          </div>
          <p className="text-gray-600">Text mode uses Huffman coding. File mode supports reversible lossless compression, image optimization, and PPTX slide-image optimization.</p>
        </div>

        {/* Mode Selector */}
        <div className="flex justify-center mb-6">
          <div className="bg-white rounded-lg shadow-md p-1 inline-flex">
            <button
              onClick={() => {
                setMode('text');
                if (uploadedFile) handleClear();
              }}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                mode === 'text'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Text Mode
              </div>
            </button>
            <button
              onClick={() => {
                setMode('file');
                if (inputText) handleClear();
              }}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                mode === 'file'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                File Mode
              </div>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Input Section */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            {mode === 'text' ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    <h2 className="font-semibold text-gray-800">Input Text</h2>
                  </div>
                  <button
                    onClick={loadSample}
                    className="text-sm text-indigo-600 hover:text-indigo-700 underline"
                  >
                    Load Sample
                  </button>
                </div>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Enter text to compress..."
                  className="w-full h-48 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none font-mono text-sm"
                />
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleCompress}
                    disabled={!inputText.trim()}
                    className="flex-1 bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    Compress
                  </button>
                  <button
                    onClick={handleClear}
                    className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <Upload className="w-5 h-5 text-indigo-600" />
                  <h2 className="font-semibold text-gray-800">Upload File</h2>
                </div>

                {!uploadedFile ? (
                  <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col items-center justify-center py-8">
                      <Upload className="w-12 h-12 text-gray-400 mb-3" />
                      <p className="mb-2 text-sm text-gray-600">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">
                        Upload any file. Images and PPTX files unlock format-specific optimization modes for better compression.
                      </p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                ) : (
                  <div className="border-2 border-gray-300 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3">
                        <FileText className="w-8 h-8 text-indigo-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 truncate">{uploadedFile.name}</p>
                          <p className="text-sm text-gray-500">
                            {(uploadedFile.size / 1024).toFixed(2)} KB
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {uploadedFile.type || 'application/octet-stream'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={removeFile}
                        className="text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {filePreview && (
                      <div className="mt-4">
                        <img
                          src={filePreview}
                          alt="Preview"
                          className="w-full h-auto max-h-48 object-contain rounded border border-gray-200"
                        />
                      </div>
                    )}

                    {fileData && (
                      <div className="mt-4 p-3 bg-gray-50 rounded">
                        <p className="text-sm text-gray-600">
                          File loaded: {formatKilobytesFromBytes(fileData.length)}
                        </p>
                        {isImageOptimizationMode && optimizedImage ? (
                          <p className="text-sm text-gray-600 mt-1">
                            Image output: {optimizedImage.mimeType.replace('image/', '').toUpperCase()} at {imageQuality}% quality and {imageScalePercent}% scale
                          </p>
                        ) : isPresentationOptimizationMode && optimizedPresentation ? (
                          <p className="text-sm text-gray-600 mt-1">
                            Presentation output: {optimizedPresentation.optimizedImages} of {optimizedPresentation.totalImages} slide images optimized
                          </p>
                        ) : fileCompressionMethod && (
                          <p className="text-sm text-gray-600 mt-1">
                            Compression engine: {fileCompressionMethod === 'gzip' ? 'Adaptive gzip (LZ77 + Huffman)' : 'Pure Huffman'}
                          </p>
                        )}
                      </div>
                    )}

                    {isUploadedPptx && (
                      <div className="mt-4 rounded-lg border border-gray-200 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h3 className="font-medium text-gray-800">Presentation Processing</h3>
                            <p className="text-sm text-gray-500">Optimize slide images inside the PPTX file or keep the file exactly reversible.</p>
                          </div>
                          <div className="bg-gray-100 rounded-lg p-1 inline-flex">
                            <button
                              onClick={() => void handleFileModeChange('lossless')}
                              disabled={isProcessingFile}
                              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                fileProcessingMode === 'lossless'
                                  ? 'bg-white text-gray-800 shadow-sm'
                                  : 'text-gray-600 hover:text-gray-800'
                              }`}
                            >
                              Lossless
                            </button>
                            <button
                              onClick={() => void handleFileModeChange('presentation-optimize')}
                              disabled={isProcessingFile}
                              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                fileProcessingMode === 'presentation-optimize'
                                  ? 'bg-white text-gray-800 shadow-sm'
                                  : 'text-gray-600 hover:text-gray-800'
                              }`}
                            >
                              Optimize PPTX
                            </button>
                          </div>
                        </div>

                        {fileProcessingMode === 'presentation-optimize' ? (
                          <div className="mt-4 space-y-4">
                            <div className="rounded-lg bg-gray-50 p-3">
                              <div className="flex items-center justify-between text-sm font-medium text-gray-700">
                                <span>Slide Image Quality</span>
                                <span>{imageQuality}%</span>
                              </div>
                              <input
                                type="range"
                                min="35"
                                max="95"
                                step="1"
                                value={imageQuality}
                                onChange={(e) => setImageQuality(Number(e.target.value))}
                                disabled={isProcessingFile}
                                className="mt-3 w-full accent-indigo-600"
                              />
                            </div>

                            <div className="rounded-lg bg-gray-50 p-3">
                              <div className="flex items-center justify-between text-sm font-medium text-gray-700">
                                <span>Slide Image Scale</span>
                                <span>{imageScalePercent}%</span>
                              </div>
                              <input
                                type="range"
                                min="40"
                                max="100"
                                step="5"
                                value={imageScalePercent}
                                onChange={(e) => setImageScalePercent(Number(e.target.value))}
                                disabled={isProcessingFile}
                                className="mt-3 w-full accent-indigo-600"
                              />
                            </div>

                            <button
                              onClick={() => void handleOptimizePresentation()}
                              disabled={isProcessingFile}
                              className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors"
                            >
                              {isProcessingFile ? 'Optimizing PPTX...' : 'Apply PPTX Optimization'}
                            </button>

                            <p className="text-xs text-gray-500">
                              This recompresses slide images inside the presentation. It helps most when the deck contains large photos or screenshots.
                            </p>
                          </div>
                        ) : (
                          <p className="mt-4 text-sm text-gray-500">
                            Lossless mode keeps the PPTX exactly reversible, but PowerPoint files are already zipped so the size reduction is usually small.
                          </p>
                        )}
                      </div>
                    )}

                    {isImageFile && (
                      <div className="mt-4 rounded-lg border border-gray-200 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h3 className="font-medium text-gray-800">Image Processing</h3>
                            <p className="text-sm text-gray-500">Choose between exact restoration or aggressive browser-side image optimization.</p>
                          </div>
                          <div className="bg-gray-100 rounded-lg p-1 inline-flex">
                            <button
                              onClick={() => void handleFileModeChange('lossless')}
                              disabled={isProcessingFile}
                              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                fileProcessingMode === 'lossless'
                                  ? 'bg-white text-gray-800 shadow-sm'
                                  : 'text-gray-600 hover:text-gray-800'
                              }`}
                            >
                              Lossless
                            </button>
                            <button
                              onClick={() => void handleFileModeChange('image-optimize')}
                              disabled={isProcessingFile}
                              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                fileProcessingMode === 'image-optimize'
                                  ? 'bg-white text-gray-800 shadow-sm'
                                  : 'text-gray-600 hover:text-gray-800'
                              }`}
                            >
                              Optimize Image
                            </button>
                          </div>
                        </div>

                        {fileProcessingMode === 'image-optimize' ? (
                          <div className="mt-4 space-y-4">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <label className="block">
                                <span className="text-sm font-medium text-gray-700">Output Format</span>
                                <select
                                  value={imageFormat}
                                  onChange={(e) => setImageFormat(e.target.value as ImageOptimizationFormat)}
                                  disabled={isProcessingFile}
                                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none"
                                >
                                  <option value="image/webp">WebP</option>
                                  <option value="image/jpeg">JPEG</option>
                                </select>
                              </label>

                              <div className="rounded-lg bg-gray-50 p-3">
                                <div className="flex items-center justify-between text-sm font-medium text-gray-700">
                                  <span>Quality</span>
                                  <span>{imageQuality}%</span>
                                </div>
                                <input
                                  type="range"
                                  min="35"
                                  max="95"
                                  step="1"
                                  value={imageQuality}
                                  onChange={(e) => setImageQuality(Number(e.target.value))}
                                  disabled={isProcessingFile}
                                  className="mt-3 w-full accent-indigo-600"
                                />
                              </div>
                            </div>

                            <div className="rounded-lg bg-gray-50 p-3">
                              <div className="flex items-center justify-between text-sm font-medium text-gray-700">
                                <span>Scale</span>
                                <span>{imageScalePercent}%</span>
                              </div>
                              <input
                                type="range"
                                min="40"
                                max="100"
                                step="5"
                                value={imageScalePercent}
                                onChange={(e) => setImageScalePercent(Number(e.target.value))}
                                disabled={isProcessingFile}
                                className="mt-3 w-full accent-indigo-600"
                              />
                            </div>

                            <button
                              onClick={() => void handleOptimizeImage()}
                              disabled={isProcessingFile}
                              className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors"
                            >
                              {isProcessingFile ? 'Optimizing...' : 'Apply Image Optimization'}
                            </button>

                            <p className="text-xs text-gray-500">
                              WebP usually gives the best size-to-quality balance and keeps transparency. Lower quality or scale only if you need smaller files.
                            </p>
                          </div>
                        ) : (
                          <p className="mt-4 text-sm text-gray-500">
                            Lossless mode keeps the upload reversible. It is useful for exact restoration, but already-compressed images usually shrink only a little.
                          </p>
                        )}
                      </div>
                    )}

                    {compressedFileData && !isImageOptimizationMode && !isPresentationOptimizationMode && (
                      <button
                        onClick={downloadCompressed}
                        className="w-full mt-4 flex items-center justify-center gap-2 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download Compressed
                      </button>
                    )}
                  </div>
                )}

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleClear}
                    className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                  >
                    Clear All
                  </button>
                </div>
                {fileError && (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {fileError}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Compressed Output */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-green-600" />
              <h2 className="font-semibold text-gray-800">
                {isImageOptimizationMode
                  ? 'Optimized Image'
                  : isPresentationOptimizationMode
                    ? 'Optimized Presentation'
                    : 'Compressed (Binary)'}
              </h2>
            </div>
            {isImageOptimizationMode ? (
              <>
                <div className="w-full h-48 p-4 border border-gray-300 rounded-lg bg-gray-50 overflow-hidden">
                  {optimizedImagePreviewUrl ? (
                    <img
                      src={optimizedImagePreviewUrl}
                      alt="Optimized preview"
                      className="w-full h-full object-contain rounded"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-gray-400">
                      Optimized image preview will appear here...
                    </div>
                  )}
                </div>

                {optimizedImage && (
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="rounded-lg bg-gray-50 p-3">
                      <div className="text-xs uppercase tracking-wide text-gray-500">Format</div>
                      <div className="mt-1 font-medium text-gray-800">
                        {optimizedImage.mimeType.replace('image/', '').toUpperCase()}
                      </div>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                      <div className="text-xs uppercase tracking-wide text-gray-500">Output Size</div>
                      <div className="mt-1 font-medium text-gray-800">
                        {(optimizedImage.bytes.length / 1024).toFixed(2)} KB
                      </div>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                      <div className="text-xs uppercase tracking-wide text-gray-500">Original</div>
                      <div className="mt-1 font-medium text-gray-800">
                        {optimizedImage.originalWidth} x {optimizedImage.originalHeight}
                      </div>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                      <div className="text-xs uppercase tracking-wide text-gray-500">Output</div>
                      <div className="mt-1 font-medium text-gray-800">
                        {optimizedImage.outputWidth} x {optimizedImage.outputHeight}
                      </div>
                    </div>
                  </div>
                )}

                {hasImageOptimizationIncrease && (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    These settings made the image larger than the original. Lower the quality or scale to push the size down further.
                  </div>
                )}

                <button
                  onClick={downloadOptimizedImage}
                  disabled={!optimizedImage || isProcessingFile}
                  className="w-full mt-4 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {isProcessingFile ? 'Optimizing...' : 'Download Optimized Image'}
                </button>
              </>
            ) : isPresentationOptimizationMode ? (
              <>
                {optimizedPresentation ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-gray-50 p-3">
                      <div className="text-xs uppercase tracking-wide text-gray-500">Output Size</div>
                      <div className="mt-1 font-medium text-gray-800">
                        {formatKilobytesFromBytes(optimizedPresentation.bytes.length)}
                      </div>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                      <div className="text-xs uppercase tracking-wide text-gray-500">Images Optimized</div>
                      <div className="mt-1 font-medium text-gray-800">
                        {optimizedPresentation.optimizedImages} / {optimizedPresentation.totalImages}
                      </div>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                      <div className="text-xs uppercase tracking-wide text-gray-500">Unchanged</div>
                      <div className="mt-1 font-medium text-gray-800">
                        {optimizedPresentation.totalImages - optimizedPresentation.optimizedImages}
                      </div>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                      <div className="text-xs uppercase tracking-wide text-gray-500">Skipped</div>
                      <div className="mt-1 font-medium text-gray-800">
                        {optimizedPresentation.skippedImages}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-48 items-center justify-center rounded-lg border border-gray-300 bg-gray-50 text-sm text-gray-400">
                    Optimized presentation details will appear here...
                  </div>
                )}

                {optimizedPresentation?.totalImages === 0 && (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    No supported raster slide images were found in this presentation, so there is little to optimize.
                  </div>
                )}

                {hasPresentationOptimizationIncrease && (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    These settings did not reduce the PPTX size. Lower the slide image quality or scale to push the deck down further.
                  </div>
                )}

                <button
                  onClick={downloadOptimizedPresentation}
                  disabled={!optimizedPresentation || isProcessingFile}
                  className="w-full mt-4 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {isProcessingFile ? 'Optimizing PPTX...' : 'Download Optimized PPTX'}
                </button>
              </>
            ) : (
              <>
                <div className="w-full h-48 p-4 border border-gray-300 rounded-lg bg-gray-50 overflow-auto font-mono text-xs break-all">
                  {compressedBits ? (
                    <span className="text-gray-800">
                      {(mode === 'file' ? compressedFileBitLength > compressedBits.length : compressedBits.length > 5000)
                        ? `${compressedBits.slice(0, 5000)}... (${mode === 'file' ? formatKilobytesFromBits(compressedFileBitLength) : formatKilobytesFromBits(compressedBits.length)} total)`
                        : compressedBits}
                    </span>
                  ) : (
                    <span className="text-gray-400">Compressed binary output will appear here...</span>
                  )}
                </div>
                <button
                  onClick={mode === 'text' ? handleDecompress : handleFileDecompress}
                  disabled={!compressedBits || isProcessingFile}
                  className="w-full mt-4 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {isProcessingFile ? 'Processing...' : 'Decompress'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-600" />
                <h2 className="font-semibold text-gray-800">Compression Statistics</h2>
              </div>
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setCompressionView('saved')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    compressionView === 'saved'
                      ? 'bg-white text-gray-800 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Space Saved
                </button>
                <button
                  onClick={() => setCompressionView('ratio')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    compressionView === 'ratio'
                      ? 'bg-white text-gray-800 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Compression Ratio
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Original Size</div>
                <div className="text-2xl font-bold text-blue-600">
                  {formatKilobytesFromBits(stats.originalSize)}
                </div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Compressed Size</div>
                <div className="text-2xl font-bold text-green-600">
                  {formatKilobytesFromBits(stats.compressedSize)}
                </div>
              </div>
              {compressionView === 'saved' ? (
                <>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600 mb-1">{stats.savings >= 0 ? 'Space Saved' : 'Size Increase'}</div>
                    <div className="text-2xl font-bold text-purple-600">
                      {`${Math.abs(parseFloat(stats.ratio)).toFixed(2)}%`}
                    </div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600 mb-1">
                      {stats.savings >= 0 ? 'Storage Saved' : 'Extra Storage'}
                    </div>
                    <div className="text-2xl font-bold text-orange-600">
                      {formatKilobytesFromBits(Math.abs(stats.savings))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600 mb-1">Compressed to</div>
                    <div className="text-2xl font-bold text-purple-600">
                      {(stats.compressedSize > 0 ? (stats.compressedSize / stats.originalSize) * 100 : 0).toFixed(2)}%
                    </div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600 mb-1">Compression Ratio</div>
                    <div className="text-2xl font-bold text-orange-600">
                      {stats.compressedSize > 0 ? (stats.originalSize / stats.compressedSize).toFixed(2) : '0.00'}:1
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Decompressed Output */}
        {(decompressedText || (decompressedData && !isImageOptimizationMode && !isPresentationOptimizationMode)) && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-green-600" />
              <h2 className="font-semibold text-gray-800">
                {mode === 'text' ? 'Decompressed Text' : 'Decompressed File'}
              </h2>
            </div>
            {mode === 'text' ? (
              <>
                <div className="w-full p-4 border border-gray-300 rounded-lg bg-green-50 font-mono text-sm max-h-64 overflow-auto">
                  {decompressedText}
                </div>
                {decompressedText === inputText && (
                  <div className="mt-3 flex items-center gap-2 text-green-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-medium">Decompression successful! Text matches original.</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="p-4 border border-gray-300 rounded-lg bg-green-50">
                  {uploadedFile?.type.startsWith('image/') && decompressedData && (
                    <div className="mb-4">
                      <img
                        src={URL.createObjectURL(createBlobFromBytes(decompressedData, uploadedFile.type))}
                        alt="Decompressed preview"
                        className="w-full h-auto max-h-64 object-contain rounded border border-gray-200"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-3 mb-3">
                    <FileText className="w-8 h-8 text-green-600" />
                    <div>
                      <p className="font-medium text-gray-800">{uploadedFile?.name}</p>
                      <p className="text-sm text-gray-600">
                        Decompressed: {formatKilobytesFromBytes(decompressedData?.length ?? 0)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={downloadDecompressed}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download Decompressed File
                  </button>
                </div>
                {fileData && decompressedData && fileData.length === decompressedData.length && (
                  <div className="mt-3 flex items-center gap-2 text-green-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-medium">Decompression successful! File matches original size.</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Huffman Codes Table */}
        {huffmanCodes.size > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="font-semibold text-gray-800 mb-4">Huffman Codes</h2>
              <div className="max-h-64 overflow-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-medium text-gray-700">Character</th>
                      <th className="text-left p-2 font-medium text-gray-700">Binary Code</th>
                      <th className="text-right p-2 font-medium text-gray-700">Bits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(huffmanCodes.entries())
                      .sort((a, b) => a[1].length - b[1].length)
                      .map(([char, code]) => {
                        let displayChar = char;
                        if (mode === 'file') {
                          const byteVal = parseInt(char);
                          displayChar = `0x${byteVal.toString(16).toUpperCase().padStart(2, '0')} (${byteVal})`;
                        } else {
                          displayChar = char === ' ' ? '␣' : char === '\n' ? '↵' : char;
                        }
                        return (
                          <tr key={char} className="border-t border-gray-200">
                            <td className="p-2 font-mono text-sm">
                              {displayChar}
                            </td>
                            <td className="p-2 font-mono text-sm text-indigo-600">{code}</td>
                            <td className="p-2 text-right text-gray-600">{code.length}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="font-semibold text-gray-800 mb-4">Character Frequency</h2>
              <div className="max-h-64 overflow-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-medium text-gray-700">Character</th>
                      <th className="text-right p-2 font-medium text-gray-700">Count</th>
                      <th className="text-right p-2 font-medium text-gray-700">Frequency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(freqMap.entries())
                      .sort((a, b) => b[1] - a[1])
                      .map(([char, freq]) => {
                        const totalLength = mode === 'file' ? (fileData?.length || 1) : inputText.length;
                        const percentage = ((freq / totalLength) * 100).toFixed(1);
                        let displayChar = char;
                        if (mode === 'file') {
                          const byteVal = parseInt(char);
                          displayChar = `0x${byteVal.toString(16).toUpperCase().padStart(2, '0')} (${byteVal})`;
                        } else {
                          displayChar = char === ' ' ? '␣' : char === '\n' ? '↵' : char;
                        }
                        return (
                          <tr key={char} className="border-t border-gray-200">
                            <td className="p-2 font-mono text-sm">
                              {displayChar}
                            </td>
                            <td className="p-2 text-right">{freq}</td>
                            <td className="p-2 text-right text-gray-600">{percentage}%</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
