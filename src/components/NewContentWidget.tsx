import { useEffect, useState } from 'react';
import { FileText, Image, FileBarChart, AlertCircle, Sparkles } from 'lucide-react';

interface LibraryFile {
  id: string;
  name: string;
  path: string;
  category: string;
  mimeType?: string;
  createdAt: string;
  updatedAt: string;
}

interface ContentCounts {
  files: number;
  images: number;
  reports: number;
}

export default function NewContentWidget() {
  const [counts, setCounts] = useState<ContentCounts>({ files: 0, images: 0, reports: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadContent = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await (window as any).clawdbot?.library?.list();
      if (result?.success && Array.isArray(result.files)) {
        const now = Date.now();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);
        
        // Filter files created in last 24 hours
        const recentFiles = result.files.filter((file: LibraryFile) => {
          const createdAt = new Date(file.createdAt).getTime();
          return createdAt > oneDayAgo;
        });

        // Count by type
        let fileCount = 0;
        let imageCount = 0;
        let reportCount = 0;

        recentFiles.forEach((file: LibraryFile) => {
          // Images
          if (file.mimeType?.startsWith('image/')) {
            imageCount++;
          }
          // Reports (documents, PDFs, strategy docs)
          else if (
            file.category === 'document' ||
            file.category === 'strategy' ||
            file.category === 'research' ||
            file.mimeType?.includes('pdf') ||
            file.mimeType?.includes('document')
          ) {
            reportCount++;
          }
          // Other files
          else {
            fileCount++;
          }
        });

        setCounts({ files: fileCount, images: imageCount, reports: reportCount });
      } else {
        setCounts({ files: 0, images: 0, reports: 0 });
      }
    } catch (err) {
      console.error('[NewContentWidget] Load error:', err);
      setError('Failed to load');
      setCounts({ files: 0, images: 0, reports: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContent();
    // Refresh every minute
    const interval = setInterval(loadContent, 60000);
    return () => clearInterval(interval);
  }, []);

  const totalNew = counts.files + counts.images + counts.reports;

  if (loading && totalNew === 0) {
    return (
      <div className="p-6 animate-pulse">
        <div className="h-8 w-8 bg-clawd-border/50 rounded-full mb-4" />
        <div className="space-y-2">
          <div className="h-4 bg-clawd-border/50 rounded" />
          <div className="h-4 bg-clawd-border/50 rounded" />
          <div className="h-4 bg-clawd-border/50 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-red-400 mb-2">
          <AlertCircle size={20} />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <Sparkles 
          size={28} 
          className={totalNew > 0 ? 'text-purple-400' : 'text-clawd-text-dim'} 
        />
        {totalNew > 0 && (
          <span className="px-3 py-1 bg-purple-500 text-white text-sm font-bold rounded-full shadow-lg">
            {totalNew}
          </span>
        )}
      </div>
      
      <div className="text-3xl font-bold mb-3 bg-gradient-to-br from-clawd-text to-purple-400 bg-clip-text text-transparent">
        {totalNew} New
      </div>
      
      <div className="space-y-2.5">
        {/* Files */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-clawd-bg/30 border border-clawd-border/30">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-green-400" />
            <span className="text-sm text-clawd-text-dim">Files</span>
          </div>
          <span className={`text-sm font-bold ${
            counts.files > 0 ? 'text-green-400' : 'text-clawd-text-dim'
          }`}>
            {counts.files}
          </span>
        </div>

        {/* Images */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-clawd-bg/30 border border-clawd-border/30">
          <div className="flex items-center gap-2">
            <Image size={16} className="text-purple-400" />
            <span className="text-sm text-clawd-text-dim">Images</span>
          </div>
          <span className={`text-sm font-bold ${
            counts.images > 0 ? 'text-purple-400' : 'text-clawd-text-dim'
          }`}>
            {counts.images}
          </span>
        </div>

        {/* Reports */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-clawd-bg/30 border border-clawd-border/30">
          <div className="flex items-center gap-2">
            <FileBarChart size={16} className="text-blue-400" />
            <span className="text-sm text-clawd-text-dim">Reports</span>
          </div>
          <span className={`text-sm font-bold ${
            counts.reports > 0 ? 'text-blue-400' : 'text-clawd-text-dim'
          }`}>
            {counts.reports}
          </span>
        </div>
      </div>

      {totalNew === 0 && (
        <div className="mt-4 text-xs text-clawd-text-dim text-center">
          No new content (24h)
        </div>
      )}
      
      {totalNew > 0 && (
        <div className="mt-4 text-xs text-purple-400 text-center">
          Last 24 hours
        </div>
      )}
    </div>
  );
}
