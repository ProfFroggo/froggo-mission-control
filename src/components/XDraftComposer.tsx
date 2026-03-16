import { useState, useEffect } from 'react';
import { FileText, Send, Plus, Trash2, Eye } from 'lucide-react';
import { showToast } from './Toast';
import { getCurrentUserName } from '../utils/auth';
import { XImageAttachButton } from './XImageAttachment';
import { scheduleApi, approvalApi } from '../lib/api';

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
  const [scheduling, setScheduling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [mediaPaths, setMediaPaths] = useState<string[]>([]);
  const [scheduledTime, setScheduledTime] = useState('');

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
      const result = await scheduleApi.getAll();
      const plans = (Array.isArray(result) ? result : [])
        .filter((item: any) => item.type === 'plan' && item.status === 'approved');
      setContentPlans(plans as ContentPlan[]);
    } catch (error) {
      // '[XDraftComposer] Load plans error:', error;
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
    // Validation - plan is optional
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
      
      // Save as schedule item + create approval
      await scheduleApi.create({
        type: 'draft',
        content,
        platform: 'twitter',
        planId: selectedPlanId || undefined,
        version,
        mediaUrls: mediaPaths.length > 0 ? mediaPaths : undefined,
        proposedBy: getCurrentUserName(),
      });
      await approvalApi.create({
        type: 'tweet',
        content,
        tier: 3,
        metadata: { planId: selectedPlanId, version },
      });

      showToast('success', `Draft ${version} submitted for approval`);
      // Reset form
      setSelectedPlanId('');
      setVersion('A');
      setTweets(['']);
      setMediaPaths([]);
    } catch (error: unknown) {
      // '[XDraftComposer] Submit error:', error;
      showToast('error', `Failed to submit: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduledTime) {
      showToast('error', 'Please select a date and time');
      return;
    }
    
    const emptyTweets = tweets.filter(t => !t.trim());
    if (emptyTweets.length > 0) {
      showToast('error', 'All tweets must have content');
      return;
    }

    const overLimit = tweets.filter(isOverLimit);
    if (overLimit.length > 0) {
      showToast('error', 'Some tweets exceed character limit');
      return;
    }

    try {
      setScheduling(true);
      const content = tweets.join('\n\n---\n\n');
      const timestamp = new Date(scheduledTime).getTime();
      
      await scheduleApi.create({
        type: 'draft',
        content,
        platform: 'twitter',
        scheduledTime: timestamp,
      });

      showToast('success', 'Tweet scheduled!');
      setTweets(['']);
      setScheduledTime('');
    } catch (error: unknown) {
      showToast('error', `Failed to schedule: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setScheduling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-mission-control-bg">
        <div className="w-8 h-8 border-2 border-info border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const selectedPlan = contentPlans.find(p => p.id === selectedPlanId);

  return (
    <div className="flex flex-col h-full bg-mission-control-bg p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-info" />
            <h3 className="text-lg font-semibold text-mission-control-text">Create Draft</h3>
          </div>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-2 px-3 py-1 bg-review hover:bg-review/80 text-mission-control-text text-sm rounded-lg transition-colors"
            >
              <Eye className="w-4 h-4" />
              {showPreview ? 'Hide' : 'Show'} Preview
            </button>
        </div>
        <p className="text-sm text-mission-control-text-dim">
          Turn approved content plan into final draft with A/B versions.
        </p>
      </div>

        <>
          <div className="flex-1 overflow-y-auto space-y-6">
            {/* Plan Selector (optional) */}
            {contentPlans.length > 0 && (
            <div>
              <label htmlFor="content-plan" className="block text-sm font-medium text-mission-control-text mb-2">
                Content Plan <span className="text-xs text-mission-control-text-dim">(optional)</span>
              </label>
              <select
                id="content-plan"
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="w-full bg-mission-control-surface text-mission-control-text border border-mission-control-border rounded-lg px-4 py-2 focus:outline-none focus:border-mission-control-accent"
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
            )}

            {/* Version Selector */}
              <div>
                <span className="block text-sm font-medium text-mission-control-text mb-2">
                  Version <span className="text-error">*</span>
                </span>
                <div className="flex gap-2" role="radiogroup" aria-label="Version selection">
                  {['A', 'B', 'C'].map((v) => (
                    <button
                      key={v}
                      onClick={() => setVersion(v)}
                      aria-pressed={version === v}
                      className={`px-6 py-2 rounded-lg border-2 transition-colors ${
                        version === v
                          ? 'border-info bg-info/20 text-mission-control-text'
                          : 'border-mission-control-border bg-mission-control-bg-alt text-mission-control-text-dim hover:border-mission-control-border/80'
                      }`}
                      disabled={submitting}
                    >
                      Version {v}
                    </button>
                  ))}
                </div>
              </div>

            {/* Tweet Editor */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label htmlFor="tweet-content" className="text-sm font-medium text-mission-control-text">
                    Tweets <span className="text-error">*</span>
                  </label>
                  {tweets.length < 10 && (
                    <button
                      onClick={addTweet}
                      className="flex items-center gap-1 text-sm text-info hover:text-info"
                      disabled={submitting}
                    >
                      <Plus className="w-4 h-4" />
                      Add Tweet
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {tweets.map((tweet, index) => (
                    <div key={`${tweet.slice(0, 20)}-${index}`} className="relative">
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <div className="relative">
                            <textarea
                              value={tweet}
                              onChange={(e) => handleTweetChange(index, e.target.value)}
                              placeholder={`Tweet ${index + 1}/${tweets.length}...`}
                              aria-label={`Tweet ${index + 1} content`}
                              rows={3}
                              className={`w-full bg-mission-control-bg-alt text-mission-control-text placeholder-mission-control-text-dim border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 resize-none ${
                                isOverLimit(tweet)
                                  ? 'border-error focus:ring-error'
                                  : 'border-mission-control-border focus:ring-info'
                              }`}
                              disabled={submitting}
                            />
                            <div className={`absolute bottom-2 right-2 text-xs font-mono ${
                              isOverLimit(tweet) ? 'text-error' : 'text-mission-control-text-dim'
                            }`}>
                              {getCharCount(tweet)}/{TWEET_CHAR_LIMIT}
                            </div>
                          </div>
                        </div>
                        {tweets.length > 1 && (
                          <button
                            onClick={() => removeTweet(index)}
                            className="p-2 text-error hover:bg-error-subtle rounded-lg transition-colors"
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

            {/* Preview */}
            {showPreview && (
              <div className="bg-mission-control-bg-alt border border-mission-control-border rounded-lg p-4">
                <h4 className="text-sm font-semibold text-mission-control-text mb-3">Preview (X Style)</h4>
                <div className="space-y-3">
                  {tweets.filter(t => t.trim()).map((tweet, index) => (
                    <div key={`${tweet.slice(0, 20)}-${index}`} className="bg-mission-control-bg-alt rounded-lg p-4 border border-mission-control-border">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-mission-control-accent rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-mission-control-text font-semibold">K</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-mission-control-text">Your Name</span>
                            <span className="text-mission-control-text-dim text-sm">@you • now</span>
                          </div>
                          <p className="text-mission-control-text whitespace-pre-wrap break-words">{tweet}</p>
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

          {/* Image Attachment */}
            <div className="mt-4">
              <XImageAttachButton
                onImagesSelected={(paths) => setMediaPaths(prev => [...prev, ...paths])}
                existingImages={mediaPaths}
                disabled={submitting}
              />
            </div>

          {/* Schedule Button */}
          <div className="mt-6 pt-6 border-t border-mission-control-border">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-sm text-mission-control-text-dim mb-2">Schedule for later</label>
                <input
                  type="datetime-local"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full px-4 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text"
                />
              </div>
              <button
                onClick={handleSchedule}
                disabled={scheduling || tweets.every(t => !t.trim()) || tweets.some(isOverLimit)}
                className="px-6 py-2 bg-mission-control-accent hover:bg-mission-control-accent/80 disabled:bg-mission-control-bg-alt disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {scheduling ? 'Scheduling...' : 'Schedule'}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <div className="mt-4 pt-4 border-t border-mission-control-border">
            <button
              onClick={handleSubmit}
              disabled={submitting || tweets.every(t => !t.trim()) || tweets.some(isOverLimit)}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-info hover:bg-info/80 disabled:bg-mission-control-bg-alt disabled:cursor-not-allowed text-mission-control-text font-medium rounded-lg transition-colors"
            >
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-mission-control-text border-t-transparent rounded-full animate-spin" />
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
    </div>
  );
}
