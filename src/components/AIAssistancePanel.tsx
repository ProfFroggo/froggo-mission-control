import { useState, useEffect } from 'react';
import { Sparkles, MessageSquare, TrendingUp, Zap, X, ChevronRight, Copy, Check, Loader2, Briefcase, Smile, AlignLeft, FileText, type LucideIcon } from 'lucide-react';
import { Button, Flex } from '@radix-ui/themes';
import { gateway } from '../lib/gateway';
import { showToast } from './Toast';
import { copyToClipboard } from '../utils/clipboard';

interface InboxItem {
  id: number;
  created: string;
  type: 'tweet' | 'reply' | 'email' | 'message' | 'task' | 'action';
  title: string;
  content: string;
  context?: string;
  status: string;
  metadata?: string;
  source_channel?: string;
}

interface AIAssistancePanelProps {
  selectedItem: InboxItem | null;
  onClose: () => void;
  onApplySuggestion: (suggestion: string) => void;
}

interface Suggestion {
  id: string;
  type: 'quick_reply' | 'compose' | 'revision';
  text: string;
  tone: 'professional' | 'friendly' | 'concise' | 'detailed';
}

interface SentimentAnalysis {
  overall: 'positive' | 'neutral' | 'negative' | 'urgent' | 'questioning';
  confidence: number;
  keywords: string[];
  urgency: 'low' | 'medium' | 'high';
  actionItems: string[];
}

export default function AIAssistancePanel({ selectedItem, onClose, onApplySuggestion }: AIAssistancePanelProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [sentiment, setSentiment] = useState<SentimentAnalysis | null>(null);
  const [summary, setSummary] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'suggestions' | 'sentiment' | 'summary'>('suggestions');

  // Only regenerate when selectedItem changes - internal helpers are stable for same item
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (selectedItem) {
      generateAssistance();
    }
  }, [selectedItem]);

  const generateAssistance = async () => {
    if (!selectedItem) return;
    
    setLoading(true);
    try {
      // Generate all assistance in parallel
      await Promise.all([
        generateSuggestions(),
        analyzeSentiment(),
        generateSummary()
      ]);
    } catch (error: unknown) {
      // '[AI Assistance] Error:', error;
      showToast('error', 'AI assistance failed', error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  const generateSuggestions = async () => {
    if (!selectedItem) return;

    try {
      const prompt = buildSuggestionsPrompt(selectedItem);
      
      // BUGFIX: Route to Mission Control's main session (not dashboard session)
      const previousSessionKey = gateway.getSessionKey();
      gateway.setSessionKey('main'); // Mission Control's main session
      
      const response = await gateway.sendChat(prompt);
      
      // Restore previous session key
      gateway.setSessionKey(previousSessionKey);
      
      // Parse suggestions from response
      const parsed = parseSuggestions(response.content);
      setSuggestions(parsed);
    } catch (error) {
      // '[AI Assistance] Suggestions error:', error;
      setSuggestions([]);
    }
  };

  const analyzeSentiment = async () => {
    if (!selectedItem) return;

    try {
      const prompt = buildSentimentPrompt(selectedItem);
      
      // BUGFIX: Route to Mission Control's main session
      const previousSessionKey = gateway.getSessionKey();
      gateway.setSessionKey('main');
      
      const response = await gateway.sendChat(prompt);
      
      // Restore previous session key
      gateway.setSessionKey(previousSessionKey);
      
      // Parse sentiment analysis
      const parsed = parseSentiment(response.content);
      setSentiment(parsed);
    } catch (error) {
      // '[AI Assistance] Sentiment error:', error;
      setSentiment(null);
    }
  };

  const generateSummary = async () => {
    if (!selectedItem) return;

    try {
      const prompt = buildSummaryPrompt(selectedItem);
      
      // BUGFIX: Route to Mission Control's main session
      const previousSessionKey = gateway.getSessionKey();
      gateway.setSessionKey('main');
      
      const response = await gateway.sendChat(prompt);
      
      // Restore previous session key
      gateway.setSessionKey(previousSessionKey);
      
      setSummary(response.content);
    } catch (error) {
      // '[AI Assistance] Summary error:', error;
      setSummary('');
    }
  };

  const buildSuggestionsPrompt = (item: InboxItem): string => {
    return `Analyze this ${item.type} and provide 3-4 contextually appropriate response suggestions.

Type: ${item.type}
Title: ${item.title}
Content: ${item.content}
${item.context ? `Context: ${item.context}` : ''}

Provide suggestions in different tones:
1. Professional/formal
2. Friendly/casual  
3. Concise/brief
4. Detailed/thorough

Format as JSON array:
[
  {"type": "quick_reply", "text": "...", "tone": "professional"},
  {"type": "compose", "text": "...", "tone": "friendly"},
  ...
]

ONLY return the JSON array, no additional text.`;
  };

  const buildSentimentPrompt = (item: InboxItem): string => {
    return `Analyze the sentiment and urgency of this ${item.type}.

Title: ${item.title}
Content: ${item.content}
${item.context ? `Context: ${item.context}` : ''}

Provide analysis as JSON:
{
  "overall": "positive|neutral|negative|urgent|questioning",
  "confidence": 0.0-1.0,
  "keywords": ["key", "words"],
  "urgency": "low|medium|high",
  "actionItems": ["action 1", "action 2"]
}

ONLY return the JSON object, no additional text.`;
  };

  const buildSummaryPrompt = (item: InboxItem): string => {
    return `Summarize this ${item.type} in 2-3 concise sentences, highlighting key points and any required actions.

Title: ${item.title}
Content: ${item.content}
${item.context ? `Context: ${item.context}` : ''}

Provide a brief, actionable summary.`;
  };

  const parseSuggestions = (content: string): Suggestion[] => {
    try {
      // Extract JSON from response (handle cases where AI adds extra text)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return [];
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.map((s: any, idx: number) => ({
        id: `suggestion-${idx}`,
        type: s.type || 'quick_reply',
        text: s.text || '',
        tone: s.tone || 'professional',
      }));
    } catch {
      // Parse error handled gracefully - return empty suggestions
      return [];
    }
  };

  const parseSentiment = (content: string): SentimentAnalysis | null => {
    try {
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return null;
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        overall: parsed.overall || 'neutral',
        confidence: parsed.confidence || 0.5,
        keywords: parsed.keywords || [],
        urgency: parsed.urgency || 'low',
        actionItems: parsed.actionItems || [],
      };
    } catch {
      // Parse error handled gracefully - return null sentiment
      return null;
    }
  };

  const handleCopySuggestion = async (suggestion: Suggestion) => {
    const success = await copyToClipboard(suggestion.text);
    if (success) {
      setCopiedId(suggestion.id);
      setTimeout(() => setCopiedId(null), 2000);
      showToast('success', 'Copied to clipboard');
    } else {
      showToast('error', 'Copy failed', 'Unable to copy to clipboard');
    }
  };

  const handleApplySuggestion = (suggestion: Suggestion) => {
    onApplySuggestion(suggestion.text);
    showToast('success', 'Suggestion applied');
  };

  if (!selectedItem) {
    return (
      <div className="flex-1 flex items-center justify-center bg-mission-control-surface border-l border-mission-control-border">
        <div className="text-center text-mission-control-text-dim px-8">
          <div className="p-4 bg-mission-control-accent/10 rounded-full w-24 h-24 mx-auto mb-4 flex items-center justify-center">
            <Sparkles size={48} className="text-mission-control-accent opacity-50" />
          </div>
          <h3 className="text-lg font-medium mb-2">AI Assistance</h3>
          <p className="text-sm">Click the <Sparkles size={14} className="inline text-mission-control-accent" /> button on any inbox item to get:</p>
          <ul className="text-xs mt-3 space-y-1 text-left max-w-xs mx-auto">
            <li className="flex items-start gap-2">
              <Zap size={14} className="text-mission-control-accent mt-0.5 flex-shrink-0" />
              <span>Smart compose suggestions in multiple tones</span>
            </li>
            <li className="flex items-start gap-2">
              <TrendingUp size={14} className="text-mission-control-accent mt-0.5 flex-shrink-0" />
              <span>Sentiment analysis and urgency detection</span>
            </li>
            <li className="flex items-start gap-2">
              <MessageSquare size={14} className="text-mission-control-accent mt-0.5 flex-shrink-0" />
              <span>Concise summaries with action items</span>
            </li>
          </ul>
        </div>
      </div>
    );
  }

  const sentimentColors = {
    positive: 'text-[var(--color-success)] bg-[var(--color-success)]/10',
    neutral: 'text-[var(--color-info)] bg-[var(--color-info)]/10',
    negative: 'text-[var(--color-error)] bg-[var(--color-error)]/10',
    urgent: 'text-[var(--color-warning)] bg-[var(--color-warning)]/10',
    questioning: 'text-[var(--color-review)] bg-[var(--color-review)]-subtle',
  };

  const urgencyColors = {
    low: 'text-[var(--color-success)]',
    medium: 'text-[var(--color-warning)]',
    high: 'text-[var(--color-error)]',
  };

  const toneIcons: Record<string, LucideIcon> = {
    professional: Briefcase,
    friendly: Smile,
    concise: AlignLeft,
    detailed: FileText,
  };

  return (
    <div className="flex-1 flex flex-col bg-mission-control-surface border-l border-mission-control-border max-w-md">
      {/* Header */}
      <Flex align="center" justify="between" className="p-4 border-b border-mission-control-border bg-mission-control-bg">
        <Flex align="center" gap="2">
          <Sparkles size={20} className="text-mission-control-accent" />
          <h2 className="font-semibold">AI Assistance</h2>
        </Flex>
        <button
          onClick={onClose}
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
          aria-label="Close panel"
        >
          <X size={16} />
        </button>
      </Flex>

      {/* Tab Navigation */}
      <div className="flex border-b border-mission-control-border bg-mission-control-bg">
        <button
          onClick={() => setActiveTab('suggestions')}
          className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
            activeTab === 'suggestions'
              ? 'border-mission-control-accent text-mission-control-accent'
              : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
          }`}
        >
          <Zap size={16} />
          Suggestions
        </button>
        <button
          onClick={() => setActiveTab('sentiment')}
          className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
            activeTab === 'sentiment'
              ? 'border-mission-control-accent text-mission-control-accent'
              : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
          }`}
        >
          <TrendingUp size={16} />
          Sentiment
        </button>
        <button
          onClick={() => setActiveTab('summary')}
          className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
            activeTab === 'summary'
              ? 'border-mission-control-accent text-mission-control-accent'
              : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
          }`}
        >
          <MessageSquare size={16} />
          Summary
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <Flex align="center" justify="center" className="py-12">
            <Loader2 size={32} className="animate-spin text-mission-control-accent" />
          </Flex>
        ) : (
          <>
            {/* Suggestions Tab */}
            {activeTab === 'suggestions' && (
              <div className="space-y-3">
                {suggestions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center min-h-[200px] text-mission-control-text-dim">
                    <Zap size={32} className="mb-3 opacity-40" />
                    <p className="text-sm font-medium mb-1">No suggestions generated yet</p>
                    <p className="text-xs">Select an inbox item to get smart suggestions</p>
                  </div>
                ) : (
                  suggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="p-3 bg-mission-control-bg border border-mission-control-border rounded-lg hover:border-mission-control-accent/50 transition-colors"
                    >
                      <Flex align="center" justify="between" className="mb-2">
                        <span className="text-xs px-2 py-1 bg-mission-control-border rounded flex items-center gap-1">
                          {(() => { const ToneIcon = toneIcons[suggestion.tone]; return ToneIcon ? <ToneIcon size={12} className="text-mission-control-text-dim" /> : null; })()}
                          <span className="capitalize">{suggestion.tone}</span>
                        </span>
                        <Flex gap="1">
                          <button
                            onClick={() => handleCopySuggestion(suggestion)}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                            title="Copy to clipboard"
                          >
                            {copiedId === suggestion.id ? (
                              <Check size={14} className="text-[var(--color-success)]" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                          <button
                            onClick={() => handleApplySuggestion(suggestion)}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                            title="Apply suggestion"
                          >
                            <ChevronRight size={14} />
                          </button>
                        </Flex>
                      </Flex>
                      <p className="text-sm text-mission-control-text leading-relaxed">
                        {suggestion.text}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Sentiment Tab */}
            {activeTab === 'sentiment' && sentiment && (
              <div className="space-y-4">
                {/* Overall Sentiment */}
                <div className="p-4 bg-mission-control-bg border border-mission-control-border rounded-lg">
                  <h3 className="text-xs font-medium text-mission-control-text-dim mb-2">Overall Sentiment</h3>
                  <Flex align="center" gap="3">
                    <span className={`px-3 py-1.5 rounded-lg capitalize font-medium ${sentimentColors[sentiment.overall]}`}>
                      {sentiment.overall}
                    </span>
                    <span className="text-sm text-mission-control-text-dim tabular-nums">
                      {Math.round(sentiment.confidence * 100)}% confidence
                    </span>
                  </Flex>
                </div>

                {/* Urgency */}
                <div className="p-4 bg-mission-control-bg border border-mission-control-border rounded-lg">
                  <h3 className="text-xs font-medium text-mission-control-text-dim mb-2">Urgency Level</h3>
                  <div className={`text-lg font-semibold capitalize ${urgencyColors[sentiment.urgency]}`}>
                    {sentiment.urgency}
                  </div>
                </div>

                {/* Keywords */}
                {sentiment.keywords.length > 0 && (
                  <div className="p-4 bg-mission-control-bg border border-mission-control-border rounded-lg">
                    <h3 className="text-xs font-medium text-mission-control-text-dim mb-2">Key Topics</h3>
                    <div className="flex flex-wrap gap-2">
                      {sentiment.keywords.map((keyword, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-mission-control-accent/20 text-mission-control-accent rounded text-xs"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Items */}
                {sentiment.actionItems.length > 0 && (
                  <div className="p-4 bg-mission-control-bg border border-mission-control-border rounded-lg">
                    <h3 className="text-xs font-medium text-mission-control-text-dim mb-2">Detected Action Items</h3>
                    <ul className="space-y-2">
                      {sentiment.actionItems.map((item, idx) => (
                        <li key={idx} className="text-sm flex items-start gap-2">
                          <ChevronRight size={14} className="text-mission-control-accent mt-0.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Summary Tab */}
            {activeTab === 'summary' && (
              <div className="p-4 bg-mission-control-bg border border-mission-control-border rounded-lg">
                {summary ? (
                  <p className="text-sm leading-relaxed text-mission-control-text">
                    {summary}
                  </p>
                ) : (
                  <div className="flex flex-col items-center justify-center min-h-[200px] text-mission-control-text-dim">
                    <Sparkles size={32} className="mb-3 opacity-40" />
                    <p className="text-sm font-medium mb-1">No summary generated yet</p>
                    <p className="text-xs">Select an inbox item to generate a summary</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-mission-control-border bg-mission-control-bg">
        <Button
          onClick={generateAssistance}
          disabled={loading}
          variant="solid"
          size="2"
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Regenerate
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
