import { useState, useEffect } from 'react';
import { FileText, Sparkles, Loader2 } from 'lucide-react';
import { showToast } from './Toast';
import { getCurrentUserName } from '../utils/auth';

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

const GENERATION_STEPS = [
  'Analyzing content brief...',
  'Generating tweet copy...',
  'Optimizing engagement hooks...',
  'Formatting thread structure...',
  'Preparing for approval...',
];

export default function XPlanThreadComposer() {
  const [researchIdeas, setResearchIdeas] = useState<ResearchIdea[]>([]);
  const [selectedResearchId, setSelectedResearchId] = useState('');
  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState('educational');
  const [threadLength, setThreadLength] = useState(1);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState(0);

  useEffect(() => {
    loadApprovedResearch();
  }, []);

  // Progress animation during generation
  useEffect(() => {
    if (!generating) return;
    const interval = setInterval(() => {
      setGenStep(prev => {
        if (prev < GENERATION_STEPS.length - 1) return prev + 1;
        return prev;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [generating]);

  const loadApprovedResearch = async () => {
    try {
      setLoading(true);
      const result = await window.clawdbot?.xResearch?.list({
        status: 'approved',
        limit: 50
      });

      if (result?.success) {
        setResearchIdeas((result.ideas || []) as ResearchIdea[]);
      }
    } catch {
      // Silently fail - user can create plan without research
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!title.trim()) {
      showToast('error', 'Title is required');
      return;
    }

    if (!description.trim()) {
      showToast('error', 'Description is required');
      return;
    }

    try {
      setGenerating(true);
      setGenStep(0);

      // 1. Save the content plan
      const planResult = await window.clawdbot?.xPlan?.create({
        researchIdeaId: selectedResearchId || '',
        title: title.trim(),
        contentType,
        threadLength,
        description: description.trim(),
        proposedBy: getCurrentUserName(),
      });

      if (!planResult?.success) {
        throw new Error('Failed to save content plan');
      }

      // 2. Send to agent to generate actual tweet content
      const prompt = `Generate ${threadLength === 1 ? 'a tweet' : `a ${threadLength}-tweet thread`} based on this content plan:

Title: ${title.trim()}
Type: ${contentType}
Thread Length: ${threadLength}
Outline: ${description.trim()}
${selectedResearchId ? `Research: ${researchIdeas.find(i => i.id === selectedResearchId)?.description || ''}` : ''}

Write the actual tweet text. Keep each tweet under 280 characters. Make it engaging and on-brand.`;

      // Inject into agent chat
      window.dispatchEvent(new CustomEvent('x-agent-chat-inject', {
        detail: { message: prompt }
      }));

      // 3. Simulate progress while agent generates
      await new Promise(resolve => setTimeout(resolve, 3000));
      setGenStep(2);
      await new Promise(resolve => setTimeout(resolve, 2000));
      setGenStep(3);
      await new Promise(resolve => setTimeout(resolve, 1500));
      setGenStep(4);
      await new Promise(resolve => setTimeout(resolve, 1000));

      showToast('success', 'Content generated and sent for approval');

      // Reset form
      setSelectedResearchId('');
      setTitle('');
      setContentType('educational');
      setThreadLength(1);
      setDescription('');
    } catch (error: unknown) {
      showToast('error', `Generation failed: ${(error as Error).message}`);
    } finally {
      setGenerating(false);
      setGenStep(0);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-clawd-bg">
        <div className="w-8 h-8 border-2 border-info border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Generation progress overlay
  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-clawd-bg p-6">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="w-6 h-6 text-info animate-pulse" />
            <h3 className="text-lg font-semibold text-clawd-text">Generating Content</h3>
          </div>

          <div className="space-y-3">
            {GENERATION_STEPS.map((step, i) => (
              <div key={step} className="flex items-center gap-3">
                {i < genStep ? (
                  <div className="w-5 h-5 rounded-full bg-success flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : i === genStep ? (
                  <Loader2 className="w-5 h-5 text-info animate-spin flex-shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-clawd-border flex-shrink-0" />
                )}
                <span className={`text-sm ${i <= genStep ? 'text-clawd-text' : 'text-clawd-text-dim'}`}>
                  {step}
                </span>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="mt-6 h-2 bg-clawd-bg-alt rounded-full overflow-hidden">
            <div
              className="h-full bg-info rounded-full transition-all duration-500"
              style={{ width: `${((genStep + 1) / GENERATION_STEPS.length) * 100}%` }}
            />
          </div>
          <p className="text-xs text-clawd-text-dim mt-2 text-center">
            {title}
          </p>
        </div>
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
          Plan your content and generate tweet copy automatically.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6">
        {/* Research Idea Selector (optional, shown when ideas exist) */}
        {researchIdeas.length > 0 && (
          <div>
            <label htmlFor="research-idea-select" className="block text-sm font-medium text-clawd-text mb-2">
              Based on Research Idea <span className="text-clawd-text-dim text-xs">(optional)</span>
            </label>
            <select
              id="research-idea-select"
              aria-label="Select research idea"
              value={selectedResearchId}
              onChange={(e) => setSelectedResearchId(e.target.value)}
              className="w-full bg-clawd-bg-alt text-clawd-text border border-clawd-border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-info"
            >
              <option value="">None — start from scratch</option>
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
        )}

        {/* Title */}
        <div>
          <label htmlFor="content-title" className="block text-sm font-medium text-clawd-text mb-2">
            Content Title <span className="text-error">*</span>
          </label>
          <input
            id="content-title"
            type="text"
            aria-label="Content title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., AI Agents for Productivity - Complete Guide"
            className="w-full bg-clawd-bg-alt text-clawd-text placeholder-clawd-text-dim border border-clawd-border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-info"
          />
        </div>

        {/* Content Type */}
        <div>
          <span className="block text-sm font-medium text-clawd-text mb-2">
            Content Type <span className="text-error">*</span>
          </span>
          <div className="grid grid-cols-2 gap-2">
            {CONTENT_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => setContentType(type.value)}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                  contentType === type.value
                    ? 'border-info bg-info/20 text-clawd-text'
                    : 'border-clawd-border bg-clawd-bg-alt text-clawd-text-dim hover:border-clawd-border/80'
                }`}
              >
                <span className="text-xl">{type.emoji}</span>
                <span className="text-sm font-medium">{type.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Thread Length */}
        <div>
          <span className="block text-sm font-medium text-clawd-text mb-2">
            Thread Length <span className="text-error">*</span>
          </span>
          <div className="grid grid-cols-3 gap-2">
            {THREAD_LENGTHS.map((length) => (
              <button
                key={length.value}
                onClick={() => setThreadLength(length.value)}
                className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                  threadLength === length.value
                    ? 'border-info bg-info/20 text-clawd-text'
                    : 'border-clawd-border bg-clawd-bg-alt text-clawd-text-dim hover:border-clawd-border/80'
                }`}
              >
                <span className="text-sm font-medium">{length.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Description/Outline */}
        <div>
          <label htmlFor="content-outline" className="block text-sm font-medium text-clawd-text mb-2">
            Content Outline <span className="text-error">*</span>
          </label>
          <textarea
            id="content-outline"
            aria-label="Content outline"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={`Outline the ${threadLength === 1 ? 'tweet' : 'thread'}...\n\n${threadLength > 1 ? 'Example:\nTweet 1: Hook - grab attention\nTweet 2: Problem statement\nTweet 3: Solution\n...' : 'Keep it concise and impactful.'}`}
            rows={threadLength === 1 ? 6 : 12}
            className="w-full bg-clawd-bg-alt text-clawd-text placeholder-clawd-text-dim border border-clawd-border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-info resize-none font-mono text-sm"
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

      {/* Generate Content Button */}
      <div className="mt-6 pt-6 border-t border-clawd-border">
        <button
          onClick={handleGenerate}
          disabled={!title.trim() || !description.trim()}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-info hover:bg-info/80 disabled:bg-clawd-bg-alt disabled:opacity-50 disabled:cursor-not-allowed text-clawd-text font-medium rounded-lg transition-colors"
        >
          <Sparkles className="w-5 h-5" />
          Generate Content
        </button>
        <p className="text-xs text-clawd-text-dim mt-2 text-center">
          AI will generate tweet content from your outline and submit for approval
        </p>
      </div>
    </div>
  );
}
