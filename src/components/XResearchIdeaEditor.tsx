import { useState } from 'react';
import { Plus, X, Send, FileText } from 'lucide-react';
import { showToast } from './Toast';

export default function XResearchIdeaEditor() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [citations, setCitations] = useState<string[]>(['']);
  const [submitting, setSubmitting] = useState(false);

  const handleAddCitation = () => {
    setCitations([...citations, '']);
  };

  const handleRemoveCitation = (index: number) => {
    setCitations(citations.filter((_, i) => i !== index));
  };

  const handleCitationChange = (index: number, value: string) => {
    const updated = [...citations];
    updated[index] = value;
    setCitations(updated);
  };

  const handleSubmit = async () => {
    // Validation
    if (!title.trim()) {
      showToast('error', 'Title is required');
      return;
    }
    
    if (!description.trim()) {
      showToast('error', 'Description is required');
      return;
    }

    const validCitations = citations.filter(c => c.trim());
    if (validCitations.length === 0) {
      showToast('error', 'At least one citation is required');
      return;
    }

    try {
      setSubmitting(true);
      
      const result = await (window as any).clawdbot.xResearch.propose({
        title: title.trim(),
        description: description.trim(),
        citations: validCitations,
        proposedBy: 'researcher', // TODO: Get from agent context
      });

      if (result.success) {
        showToast('success', 'Research idea submitted for approval');
        // Reset form
        setTitle('');
        setDescription('');
        setCitations(['']);
      } else {
        throw new Error(result.error || 'Failed to submit research idea');
      }
    } catch (error: any) {
      console.error('[XResearchEditor] Submit error:', error);
      showToast('error', `Failed to submit: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-clawd-bg p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-5 h-5 text-info" />
          <h3 className="text-lg font-semibold text-clawd-text">Propose Research Idea</h3>
        </div>
        <p className="text-sm text-clawd-text-dim">
          Create a new research idea with citations. It will be submitted for approval.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-clawd-text mb-2">
            Title <span className="text-error">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., AI Agents for Content Creation"
            className="w-full bg-clawd-bg-alt text-clawd-text placeholder-clawd-text-dim border border-clawd-border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={submitting}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-clawd-text mb-2">
            Description <span className="text-error">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the research idea, key insights, and why it's relevant..."
            rows={8}
            className="w-full bg-clawd-bg-alt text-clawd-text placeholder-clawd-text-dim border border-clawd-border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            disabled={submitting}
          />
          <p className="text-xs text-clawd-text-dim mt-1">
            {description.length} characters
          </p>
        </div>

        {/* Citations */}
        <div>
          <label className="block text-sm font-medium text-clawd-text mb-2">
            Citations <span className="text-error">*</span>
          </label>
          <div className="space-y-2">
            {citations.map((citation, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="url"
                  value={citation}
                  onChange={(e) => handleCitationChange(index, e.target.value)}
                  placeholder="https://example.com/article"
                  className="flex-1 bg-clawd-bg-alt text-clawd-text placeholder-clawd-text-dim border border-clawd-border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={submitting}
                />
                {citations.length > 1 && (
                  <button
                    onClick={() => handleRemoveCitation(index)}
                    className="p-2 text-error hover:bg-red-500/20 rounded-lg transition-colors"
                    disabled={submitting}
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={handleAddCitation}
            className="mt-3 flex items-center gap-2 text-sm text-info hover:text-blue-300 transition-colors"
            disabled={submitting}
          >
            <Plus className="w-4 h-4" />
            Add Citation
          </button>
        </div>
      </div>

      {/* Submit Button */}
      <div className="mt-6 pt-6 border-t border-clawd-border">
        <button
          onClick={handleSubmit}
          disabled={submitting || !title.trim() || !description.trim()}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-clawd-bg-alt disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
        >
          {submitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Submit for Approval
            </>
          )}
        </button>
      </div>
    </div>
  );
}
