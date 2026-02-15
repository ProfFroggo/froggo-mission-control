import { useState, useEffect } from 'react';
import { FileText, Send, AlertCircle } from 'lucide-react';
import { showToast } from './Toast';

interface ResearchIdea {
  id: string;
  title: string;
  description: string;
}

const CONTENT_TYPES = [
  { value: 'educational', label: 'Educational', emoji: '📚' },
  { value: 'promotional', label: 'Promotional', emoji: '📣' },
  { value: 'engagement', label: 'Engagement', emoji: '💬' },
  { value: 'reactive', label: 'Reactive', emoji: '⚡' },
];

const THREAD_LENGTHS = [
  { value: 1, label: 'Single Tweet' },
  { value: 2, label: '2-tweet thread' },
  { value: 3, label: '3-tweet thread' },
  { value: 5, label: '5-tweet thread' },
  { value: 7, label: '7-tweet thread' },
  { value: 10, label: '10-tweet thread' },
];

const getCurrentUserName = () => {
  return "TEST_USER"; //Replace with proper authentication.
}

export default function XPlanThreadComposer() {
  const [researchIdeas, setResearchIdeas] = useState<ResearchIdea[]>([]);
  const [selectedResearchId, setSelectedResearchId] = useState('');
  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState('educational');
  const [threadLength, setThreadLength] = useState(1);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadApprovedResearch();
  }, []);

  const loadApprovedResearch = async () => {
    try {
      setLoading(true);
      const result = await (window as any).clawdbot.xResearch.list({ 
        status: 'approved', 
        limit: 50 
      });
      
      if (result.success) {
        setResearchIdeas(result.ideas || []);
      }
    } catch (error) {
      console.error('[XPlanComposer] Load research error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!selectedResearchId) {
      showToast('error', 'Please select a research idea');
      return;
    }
    
    if (!title.trim()) {
      showToast('error', 'Title is required');
      return;
    }
    
    if (!description.trim()) {
      showToast('error', 'Description is required');
      return;
    }

    try {
      setSubmitting(true);
      
      const result = await (window as any).clawdbot.xPlan.create({
        researchIdeaId: selectedResearchId,
        title: title.trim(),
        contentType,
        threadLength,
        description: description.trim(),
        import { getAgentName } from 'src/auth';
...
proposedBy: getAgentName(),
      });

      if (result.success) {
        showToast('success', 'Content plan submitted for approval');
        // Reset form
        setSelectedResearchId('');
        setTitle('');
        setContentType('educational');
        setThreadLength(1);
        setDescription('');
      } else {
        throw new Error(result.error || 'Failed to create content plan');
      }
    } catch (error: any) {
      console.error('[XPlanComposer] Submit error:', error);
      showToast('error', `Failed to submit: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-clawd-bg">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-clawd-bg p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-5 h-5 text-info" />
          <h3 className="text-lg font-semibold text-clawd-text">Create Content Plan</h3>
        </div>
        <p className="text-sm text-clawd-text-dim">
          Turn approved research into a content plan with thread structure.
        </p>
      </div>

      {researchIdeas.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-clawd-text-dim">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-clawd-text-dim" />
            <p className="font-medium text-clawd-text">No approved research ideas</p>
            <p className="text-sm mt-1">Research ideas must be approved before creating plans</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto space-y-6">
            {/* Research Idea Selector */}
            <div>
              <label className="block text-sm font-medium text-clawd-text mb-2">
                Based on Research Idea <span className="text-error">*</span>
              </label>
              <select
                value={selectedResearchId}
                onChange={(e) => setSelectedResearchId(e.target.value)}
                className="w-full bg-clawd-bg-alt text-clawd-text border border-clawd-border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={submitting}
              >
                <option value="">Select a research idea...</option>
                {researchIdeas.map((idea) => (
                  <option key={idea.id} value={idea.id}>
                    {idea.title}
                  </option>
                ))}
              </select>
              {selectedResearchId && (
                <div className="mt-2 p-3 bg-clawd-bg-alt rounded-lg">
                  <p className="text-xs text-clawd-text-dim">
                    {researchIdeas.find(i => i.id === selectedResearchId)?.description.slice(0, 200)}
                    {(researchIdeas.find(i => i.id === selectedResearchId)?.description.length || 0) > 200 ? '...' : ''}
                  </p>
                </div>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-clawd-text mb-2">
                Content Title <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., AI Agents for Productivity - Complete Guide"
                className="w-full bg-clawd-bg-alt text-clawd-text placeholder-clawd-text-dim border border-clawd-border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={submitting}
              />
            </div>

            {/* Content Type */}
            <div>
              <label className="block text-sm font-medium text-clawd-text mb-2">
                Content Type <span className="text-error">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CONTENT_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setContentType(type.value)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                      contentType === type.value
                        ? 'border-blue-500 bg-blue-500/20 text-clawd-text'
                        : 'border-clawd-border bg-clawd-bg-alt text-clawd-text-dim hover:border-clawd-border/80'
                    }`}
                    disabled={submitting}
                  >
                    <span className="text-xl">{type.emoji}</span>
                    <span className="text-sm font-medium">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Thread Length */}
            <div>
              <label className="block text-sm font-medium text-clawd-text mb-2">
                Thread Length <span className="text-error">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {THREAD_LENGTHS.map((length) => (
                  <button
                    key={length.value}
                    onClick={() => setThreadLength(length.value)}
                    className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                      threadLength === length.value
                        ? 'border-blue-500 bg-blue-500/20 text-clawd-text'
                        : 'border-clawd-border bg-clawd-bg-alt text-clawd-text-dim hover:border-clawd-border/80'
                    }`}
                    disabled={submitting}
                  >
                    <span className="text-sm font-medium">{length.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Description/Outline */}
            <div>
              <label className="block text-sm font-medium text-clawd-text mb-2">
                Content Outline <span className="text-error">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`Outline the ${threadLength === 1 ? 'tweet' : 'thread'}...\n\n${threadLength > 1 ? 'Example:\nTweet 1: Hook - grab attention\nTweet 2: Problem statement\nTweet 3: Solution\n...' : 'Keep it concise and impactful.'}`}
                rows={threadLength === 1 ? 6 : 12}
                className="w-full bg-clawd-bg-alt text-clawd-text placeholder-clawd-text-dim border border-clawd-border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-sm"
                disabled={submitting}
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-clawd-text-dim">
                  {description.length} characters
                </p>
                <p className="text-xs text-clawd-text-dim">
                  ~{Math.ceil(description.length / 280)} tweet{Math.ceil(description.length / 280) !== 1 ? 's' : ''} worth of content
                </p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="mt-6 pt-6 border-t border-clawd-border">
            <button
              onClick={handleSubmit}
              disabled={submitting || !selectedResearchId || !title.trim() || !description.trim()}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-clawd-bg-alt disabled:opacity-50 disabled:cursor-not-allowed text-clawd-text font-medium rounded-lg transition-colors"
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
        </>
      )}
    </div>
  );
}
