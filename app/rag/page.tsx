'use client';
import { useState } from 'react';

interface Chunk {
  text: string;
  metadata: {
    page: number;
    lines: { from: number; to: number };
  };
}

interface ProcessingResult {
  success: boolean;
  chunks: Chunk[];
  totalChunks: number;
  fileName: string;
  fileSize: number;
  mistralFileId: string;
  vectorized: boolean;
  namespace: string;
  classDetails: {
    classId: string;
    materialId: string;
    title: string;
  };
}

export default function TestUploadPage() {
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedChunk, setSelectedChunk] = useState<number | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/rag', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process file');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Shayan RAG Document Processor</h1>
          
          {/* File Upload Section */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input 
              type="file" 
              onChange={handleUpload}
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              id="file-upload"
            />
            <label 
              htmlFor="file-upload"
              className="cursor-pointer inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Choose File
            </label>
            <p className="text-sm text-gray-500 mt-2">
              Supports PDF, JPEG, PNG (max 20MB)
            </p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="mt-6 text-center">
              <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-md">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing document...
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="mt-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
              <strong>Error:</strong> {error}
            </div>
          )}
        </div>

        {/* Results Section */}
        {result && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Summary Card */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Processing Summary</h2>
              <div className="space-y-3">
                <div>
                  <span className="text-sm font-medium text-gray-500">File Name:</span>
                  <p className="text-sm text-gray-900">{result.fileName}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">File Size:</span>
                  <p className="text-sm text-gray-900">{formatFileSize(result.fileSize)}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Total Chunks:</span>
                  <p className="text-sm text-gray-900">{result.totalChunks}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Vectorized:</span>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    result.vectorized ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {result.vectorized ? 'Yes' : 'No'}
                  </span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Namespace:</span>
                  <p className="text-sm text-gray-900">{result.namespace}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Mistral File ID:</span>
                  <p className="text-xs text-gray-900 font-mono break-all">{result.mistralFileId}</p>
                </div>
              </div>
            </div>

            {/* Chunks List */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Text Chunks ({result.chunks.length})</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {result.chunks.map((chunk, index) => (
                  <div 
                    key={index}
                    className={`p-3 border rounded-md cursor-pointer transition-colors ${
                      selectedChunk === index 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedChunk(selectedChunk === index ? null : index)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-medium text-gray-500">Chunk {index + 1}</span>
                      <span className="text-xs text-gray-400">
                        Page {chunk.metadata.page} | Lines {chunk.metadata.lines.from}-{chunk.metadata.lines.to}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 line-clamp-3">
                      {chunk.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Chunk Detail */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {selectedChunk !== null ? `Chunk ${selectedChunk + 1} Details` : 'Select a Chunk'}
              </h2>
              {selectedChunk !== null ? (
                <div className="space-y-4">
                  <div>
                    <span className="text-sm font-medium text-gray-500">Page:</span>
                    <p className="text-sm text-gray-900">{result.chunks[selectedChunk].metadata.page}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Lines:</span>
                    <p className="text-sm text-gray-900">
                      {result.chunks[selectedChunk].metadata.lines.from} - {result.chunks[selectedChunk].metadata.lines.to}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Text:</span>
                    <div className="mt-2 p-3 bg-gray-50 rounded-md">
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">
                        {result.chunks[selectedChunk].text}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Click on a chunk to view its details</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

