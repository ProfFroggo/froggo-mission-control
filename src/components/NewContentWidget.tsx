import { useEffect, useState } from 'react';
import { FileText, Image, FileBarChart, AlertCircle, Sparkles } from 'lucide-react';
import { libraryApi } from '../lib/api';
import { Box, Flex } from '@radix-ui/themes';

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
      const result = await libraryApi.getFiles().catch(() => null);
      if (result) {
        const filesArray = Array.isArray(result) ? result : (result.files || []);
        const now = Date.now();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);
        const files = filesArray as unknown as LibraryFile[];

        // Filter files created in last 24 hours
        const recentFiles = files.filter((file) => {
          const createdAt = new Date(file.createdAt).getTime();
          return createdAt > oneDayAgo;
        });

        // Count by type
        let fileCount = 0;
        let imageCount = 0;
        let reportCount = 0;

        (recentFiles as LibraryFile[]).forEach((file) => {
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
      // '[NewContentWidget] Load error:', err;
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
      <Box p="6" className="animate-pulse">
        <Box className="h-8 w-8 bg-mission-control-border/50 rounded-full mb-4" />
        <Box className="space-y-2">
          <Box className="h-4 bg-mission-control-border/50 rounded" />
          <Box className="h-4 bg-mission-control-border/50 rounded" />
          <Box className="h-4 bg-mission-control-border/50 rounded" />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p="6">
        <Flex align="center" gap="2" mb="2" className="text-[var(--color-error)]">
          <AlertCircle size={20} />
          <span className="text-sm">{error}</span>
        </Flex>
      </Box>
    );
  }

  return (
    <Box p="6">
      <Flex align="center" justify="between" mb="4">
        <Sparkles
          size={28}
          className={totalNew > 0 ? 'text-[var(--color-review)]' : 'text-mission-control-text-dim'}
        />
        {totalNew > 0 && (
          <span className="px-3 py-1 text-white text-sm font-bold rounded-full shadow-lg" style={{ background: 'var(--color-review)' }}>
            {totalNew}
          </span>
        )}
      </Flex>

      <Box className="text-3xl font-bold mb-3 text-mission-control-text">
        {totalNew} New
      </Box>

      <Box className="space-y-2.5">
        {/* Files */}
        <Flex align="center" justify="between" p="2" className="rounded-lg bg-mission-control-bg/30 border border-mission-control-border/30">
          <Flex align="center" gap="2">
            <FileText size={16} className="text-[var(--color-success)]" />
            <span className="text-sm text-mission-control-text-dim">Files</span>
          </Flex>
          <span className={`text-sm font-bold ${
            counts.files > 0 ? 'text-[var(--color-success)]' : 'text-mission-control-text-dim'
          }`}>
            {counts.files}
          </span>
        </Flex>

        {/* Images */}
        <Flex align="center" justify="between" p="2" className="rounded-lg bg-mission-control-bg/30 border border-mission-control-border/30">
          <Flex align="center" gap="2">
            <Image size={16} className="text-[var(--color-review)]" />
            <span className="text-sm text-mission-control-text-dim">Images</span>
          </Flex>
          <span className={`text-sm font-bold ${
            counts.images > 0 ? 'text-[var(--color-review)]' : 'text-mission-control-text-dim'
          }`}>
            {counts.images}
          </span>
        </Flex>

        {/* Reports */}
        <Flex align="center" justify="between" p="2" className="rounded-lg bg-mission-control-bg/30 border border-mission-control-border/30">
          <Flex align="center" gap="2">
            <FileBarChart size={16} className="text-[var(--color-info)]" />
            <span className="text-sm text-mission-control-text-dim">Reports</span>
          </Flex>
          <span className={`text-sm font-bold ${
            counts.reports > 0 ? 'text-[var(--color-info)]' : 'text-mission-control-text-dim'
          }`}>
            {counts.reports}
          </span>
        </Flex>
      </Box>

      {totalNew === 0 && (
        <Box mt="4" className="text-xs text-mission-control-text-dim text-center">
          No new content (24h)
        </Box>
      )}

      {totalNew > 0 && (
        <Box mt="4" className="text-xs text-[var(--color-review)] text-center">
          Last 24 hours
        </Box>
      )}
    </Box>
  );
}
