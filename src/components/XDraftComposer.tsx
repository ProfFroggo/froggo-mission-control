import { useState, useEffect } from 'react';
import { FileText, Send, Plus, Trash2, AlertCircle, Eye } from 'lucide-react';
import { showToast } from './Toast';

interface ContentPlan {
  id: string;
  title: string;
  content_type: string;
  thread_length: number;
}

const TWEET_CHAR_LIMIT = 280;

export default function XDraftComposer() {
  const [contentPlans, setContentPlans] = useState<ContentPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [version, setVersion] = useState('A');
  const [tweets, setTweets] = useState<string[]>(['']);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    loadApprovedPlans();
  }, []);

  useEffect(() => {
    // Reset tweets when plan changes
    if (selectedPlanId) {
      const plan = contentPlans.find(p => p.id === selectedPlanId);
      if (plan) {
        setTweets(Array(plan.thread_length).fill(''));
      }
    }
  }, [selectedPlanId, contentPlans]);

  const loadApprovedPlans = async () => {
    try {
      setLoading(true);
      const result = await (window as any).clawdbot.xPlan.list({ 
        status: 'approved', 
        limit: 50 
      });
      
      if (result.success) {
        setContentPlans(result.plans || []);
      }
    } catch (error) {
      console.error('[XDraftComposer] Load plans error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTweetChange = (index: number, value: string) => {
    const updated = [...tweets];
    updated[index] = value;
    setTweets(updated);
  };

  const addTweet = () => {
    setTweets([...tweets, '']);
  };

  const removeTweet = (index: number) => {
    if (tweets.length > 1) {
      setTweets(tweets.filter((_, i) => i !== index));
    }
  };

  const getCharCount = (text: string) => text.length;
  const isOverLimit = (text: string) => getCharCount(text) > TWEET_CHAR_LIMIT;

  const handleSubmit = async () => {
    // Validation
    if (!selectedPlanId) {
      showToast('error', 'Please select a content plan');
      return;
    }
    
    if (!version) {
      showToast('error', 'Version is required');
      return;
    }

    // Check if all tweets have content
    const emptyTweets = tweets.filter(t => !t.trim());
    if (emptyTweets.length > 0) {
      showToast('error', 'All tweets must have content');
      return;
    }

    // Check character limits
    const overLimit = tweets.filter(isOverLimit);
    if (overLimit.length > 0) {
      showToast('error', 'Some tweets exceed 280 character limit');
      return;
    }

    try {
      setSubmitting(true);
      
      // Format content as JSON for threads
      const content = JSON.stringify({
        tweets: tweets.filter(t => t.trim())
      });
      
      const result = await (window as any).clawdbot.xDraft.create({
        planId: selectedPlanId,
        version,
        content,
        proposedBy: 'writer', // TODO: Get from agent context
      });

      if (result.success) {
        showToast('success', `Draft ${version} submitted for approval`);
        // Reset form
        setSelectedPlanId('');
        setVersion('A');
        setTweets(['']);
      } else {
        throw new Error(result.error || 'Failed to create draft');
      }
    } catch (error: any) {
      console.error('[XDraftComposer] Submit error:', error);
      showToast('error', `Failed to submit: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const selectedPlan = contentPlans.find(p => p.id === selectedPlanId);

  return (
    <div className="flex flex-col h-full bg-gray-900 p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-info" />
            <h3 className="text-lg font-semibold text-white">Create Draft</h3>
          </div>
          {selectedPlanId && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-2 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors"
            >
              <Eye className="w-4 h-4" />
              {showPreview ? 'Hide' : 'Show'} Preview
            </button>
          )}
        </div>
        <p className="text-sm text-gray-400">
          Turn approved content plan into final draft with A/B versions.
        </p>
      </div>

      {contentPlans.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-600" />
            <p className="font-medium text-gray-300">No approved content plans</p>
            <p className="text-sm mt-1">Content plans must be approved before drafting</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto space-y-6">
            {/* Plan Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Content Plan <span className="text-error">*</span>
              </label>
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={submitting}
              >
                <option value="">Select a content plan...</option>
                {contentPlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.title} ({plan.thread_length} tweet{plan.thread_length > 1 ? 's' : ''})
                  </option>
                ))}
              </select>
              {selectedPlan && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="px-2 py-1 text-xs bg-info-subtle text-info rounded-full">
                    {selectedPlan.content_type}
                  </span>
                  <span className="px-2 py-1 text-xs bg-review-subtle text-review rounded-full">
                    {selectedPlan.thread_length} tweet{selectedPlan.thread_length > 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>

            {/* Version Selector */}
            {selectedPlanId && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Version <span className="text-error">*</span>
                </label>
                <div className="flex gap-2">
                  {['A', 'B', 'C'].map((v) => (
                    <button
                      key={v}
                      onClick={() => setVersion(v)}
                      className={`px-6 py-2 rounded-lg border-2 transition-colors ${
                        version === v
                          ? 'border-blue-500 bg-blue-500/20 text-white'
                          : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                      }`}
                      disabled={submitting}
                    >
                      Version {v}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tweet Editor */}
            {selectedPlanId && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-300">
                    Tweets <span className="text-error">*</span>
                  </label>
                  {tweets.length < 10 && (
                    <button
                      onClick={addTweet}
                      className="flex items-center gap-1 text-sm text-info hover:text-blue-300"
                      disabled={submitting}
                    >
                      <Plus className="w-4 h-4" />
                      Add Tweet
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {tweets.map((tweet, index) => (
                    <div key={index} className="relative">
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <div className="relative">
                            <textarea
                              value={tweet}
                              onChange={(e) => handleTweetChange(index, e.target.value)}
                              placeholder={`Tweet ${index + 1}/${tweets.length}...`}
                              rows={3}
                              className={`w-full bg-gray-800 text-white placeholder-gray-500 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 resize-none ${
                                isOverLimit(tweet)
                                  ? 'border-red-500 focus:ring-red-500'
                                  : 'border-gray-700 focus:ring-blue-500'
                              }`}
                              disabled={submitting}
                            />
                            <div className={`absolute bottom-2 right-2 text-xs font-mono ${
                              isOverLimit(tweet) ? 'text-error' : 'text-gray-500'
                            }`}>
                              {getCharCount(tweet)}/{TWEET_CHAR_LIMIT}
                            </div>
                          </div>
                        </div>
                        {tweets.length > 1 && (
                          <button
                            onClick={() => removeTweet(index)}
                            className="p-2 text-error hover:bg-red-500/20 rounded-lg transition-colors"
                            disabled={submitting}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preview */}
            {showPreview && selectedPlanId && (
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-white mb-3">Preview (X/Twitter Style)</h4>
                <div className="space-y-3">
                  {tweets.filter(t => t.trim()).map((tweet, index) => (
                    <div key={index} className="bg-black rounded-lg p-4 border border-gray-800">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-semibold">K</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-white">Kevin MacArthur</span>
                            <span className="text-gray-500 text-sm">@kevin • now</span>
                          </div>
                          <p className="text-white whitespace-pre-wrap break-words">{tweet}</p>
                          {index < tweets.filter(t => t.trim()).length - 1 && (
                            <div className="mt-2 text-info text-sm">
                              Show this thread
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="mt-6 pt-6 border-t border-gray-700">
            <button
              onClick={handleSubmit}
              disabled={submitting || !selectedPlanId || tweets.every(t => !t.trim()) || tweets.some(isOverLimit)}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Submit Version {version} for Approval
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
