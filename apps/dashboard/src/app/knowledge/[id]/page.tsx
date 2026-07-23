'use client';
import { useAuth } from '@clerk/nextjs';
import { useEffect, useState, useRef } from 'react';
import { api, setClerkToken } from '@/lib/api';

export default function KnowledgeBaseDetailPage({ params }: { params: { id: string } }) {
  const { getToken } = useAuth();
  const [kb, setKb] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getToken().then(t => { setClerkToken(t); loadData(); });
  }, [params.id]);

  async function loadData() {
    try {
      const [kbData, docsData] = await Promise.all([
        api.knowledge.get(params.id),
        api.knowledge.listDocuments(params.id),
      ]);
      setKb(kbData);
      setDocuments(docsData);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load knowledge base');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);

    const progressInterval = setInterval(() => {
      setUploadProgress(prev => prev !== null && prev < 90 ? prev + 10 : prev);
    }, 200);

    try {
      const result = await api.knowledge.uploadDocument(params.id, file);

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (result.success) {
        setUploadProgress(null);
        await loadData();
      }
    } catch (err) {
      clearInterval(progressInterval);
      console.error('Upload failed:', err);
      alert('Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm('Delete this document?')) return;
    try {
      await api.knowledge.deleteDocument(params.id, docId);
      await loadData();
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Delete failed');
    }
  }

  function triggerFileInput() {
    fileInputRef.current?.click();
  }

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!kb) return <div className="p-8">Not found</div>;

  // Calculate stats
  const totalDocuments = documents.length;
  const totalChunks = documents.reduce((sum, d) => sum + (d.chunkCount || 0), 0);
  const totalSize = documents.reduce((sum, d) => sum + (d.sizeBytes || 0), 0);
  const completedDocs = documents.filter(d => d.status === 'completed').length;
  const processingDocs = documents.filter(d => ['queued', 'downloading', 'parsing', 'chunking', 'embedding', 'indexing'].includes(d.status)).length;
  const failedDocs = documents.filter(d => d.status === 'failed').length;

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'queued':
      case 'downloading':
      case 'parsing':
      case 'chunking':
      case 'embedding':
      case 'indexing': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{kb.name}</h1>
          {kb.description && <p className="text-gray-500 mt-1">{kb.description}</p>}
        </div>
        <button
          onClick={triggerFileInput}
          disabled={uploading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : 'Upload Document'}
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.md,.html,.csv,.json"
        onChange={handleUpload}
        className="hidden"
      />

      {uploadProgress !== null && (
        <div className="mb-4">
          <div className="h-2 bg-gray-200 rounded overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 mt-1">Uploading... {uploadProgress}%</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white shadow rounded-lg p-4">
          <p className="text-sm text-gray-500">Total Documents</p>
          <p className="text-2xl font-bold text-gray-900">{totalDocuments}</p>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <p className="text-sm text-gray-500">Completed</p>
          <p className="text-2xl font-bold text-green-600">{completedDocs}</p>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <p className="text-sm text-gray-500">Processing</p>
          <p className="text-2xl font-bold text-yellow-600">{processingDocs}</p>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <p className="text-sm text-gray-500">Failed</p>
          <p className="text-2xl font-bold text-red-600">{failedDocs}</p>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <p className="text-sm text-gray-500">Total Size</p>
          <p className="text-2xl font-bold text-gray-900">{formatSize(totalSize)}</p>
        </div>
      </div>

      <div className="mb-6">
        <span className="text-sm text-gray-500">{totalDocuments} documents • {totalChunks} chunks</span>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No documents yet. Click "Upload Document" to add files.
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map(doc => (
            <div key={doc.id} className="p-4 border rounded flex items-center justify-between">
              <div>
                <div className="font-medium">{doc.filename}</div>
                <div className="text-sm text-gray-500">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(doc.status)}`}>
                    {doc.status}
                  </span>
                  {' '}
                  {doc.chunkCount !== undefined && `• ${doc.chunkCount} chunks`}
                  {' '}
                  {doc.sizeBytes && `• ${formatSize(doc.sizeBytes)}`}
                  {' '}
                  {doc.updatedAt && `• Updated ${new Date(doc.updatedAt).toLocaleDateString()}`}
                </div>
              </div>
              <button
                onClick={() => handleDelete(doc.id)}
                disabled={uploading}
                className="px-3 py-1 text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
