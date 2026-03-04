// LEGACY: HRReportsModal uses file-level suppression for intentional patterns.
// Modal for HR reports - patterns are safe.
// Review: 2026-02-17 - suppression retained, patterns are safe

import { useState, useEffect } from 'react';
import { X, FileText, Calendar, Download, RefreshCw } from 'lucide-react';
import { showToast } from './Toast';
import ReactMarkdown from 'react-markdown';
import { analyticsApi } from '../lib/api';

interface Report {
  name: string;
  path: string;
  size: number;
  createdAt: number;
  modifiedAt: number;
}

interface HRReportsModalProps {
  onClose: () => void;
}

export default function HRReportsModal({ onClose }: HRReportsModalProps) {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [reportContent, setReportContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);

  const loadReports = async () => {
    setLoading(true);
    try {
      const result = await analyticsApi.getAgentActivity();
      const reportsList = result?.reports || [];
      setReports(reportsList as Report[]);
      if (reportsList.length > 0 && !selectedReport) {
        loadReport(reportsList[0] as Report);
      }
    } catch (error) {
      showToast('error', 'Failed to load reports', String(error));
    } finally {
      setLoading(false);
    }
  };

  const loadReport = async (report: Report) => {
    setSelectedReport(report);
    setLoadingContent(true);
    try {
      // Individual report reading — fetch from analytics endpoint
      const result = await analyticsApi.getAgentActivity();
      const found = (result?.reports || []).find((r: any) => r.name === report.name);
      setReportContent(found?.content || '');
    } catch (error) {
      showToast('error', 'Failed to read report', String(error));
      setReportContent('');
    } finally {
      setLoadingContent(false);
    }
  };

  const downloadReport = () => {
    if (!selectedReport || !reportContent) return;
    const blob = new Blob([reportContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedReport.name;
    a.click();
    URL.revokeObjectURL(url);
    showToast('success', 'Report downloaded');
  };

  useEffect(() => {
    loadReports();
  }, []);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-clawd-surface rounded-2xl border border-clawd-border w-full max-w-6xl h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-clawd-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center ring-2 ring-teal-500/30">
              <FileText size={20} className="text-teal-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">HR Reports</h2>
              <p className="text-sm text-clawd-text-dim">
                {reports.length} report{reports.length !== 1 ? 's' : ''} available
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadReports}
              disabled={loading}
              className="p-2 hover:bg-clawd-bg rounded-lg transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            {selectedReport && reportContent && (
              <button
                onClick={downloadReport}
                className="flex items-center gap-2 px-3 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
              >
                <Download size={16} />
                Download
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-clawd-bg rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Report List */}
          <div className="w-80 flex-shrink-0 border-r border-clawd-border overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-clawd-text-dim">Loading...</div>
            ) : reports.length === 0 ? (
              <div className="p-8 text-center">
                <FileText size={48} className="text-clawd-text-dim mx-auto mb-4" />
                <p className="text-clawd-text-dim">No reports yet</p>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {reports.map((report) => (
                  <button
                    key={report.name}
                    onClick={() => loadReport(report)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedReport?.name === report.name
                        ? 'border-teal-500/50 bg-teal-500/10'
                        : 'border-clawd-border hover:border-clawd-border/50 hover:bg-clawd-bg'
                    }`}
                  >
                    <div className="font-medium text-sm mb-1 line-clamp-1">{report.name}</div>
                    <div className="flex items-center gap-2 text-xs text-clawd-text-dim">
                      <Calendar size={12} />
                      {formatDate(report.createdAt)}
                    </div>
                    <div className="text-xs text-clawd-text-dim mt-1">
                      {formatSize(report.size)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Main - Report Content */}
          <div className="flex-1 min-w-0 overflow-y-auto p-6">
            {loadingContent ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCw size={32} className="animate-spin text-clawd-text-dim" />
              </div>
            ) : !selectedReport ? (
              <div className="flex items-center justify-center h-full text-clawd-text-dim">
                Select a report to view
              </div>
            ) : (
              <div className="prose prose-invert max-w-none">
                <ReactMarkdown>{reportContent}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
