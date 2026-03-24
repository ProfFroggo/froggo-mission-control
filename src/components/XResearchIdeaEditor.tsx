import { useState } from 'react';
import { Plus, X, Send, FileText } from 'lucide-react';
import { Button, Spinner, TextArea, TextField } from '@radix-ui/themes';
import { showToast } from './Toast';
import { useStore } from '../store/store';
import { scheduleApi } from '../lib/api';

export default function XResearchIdeaEditor() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [citations, setCitations] = useState<string[]>(['']);
  const [submitting, setSubmitting] = useState(false);
  
  // Get agent name from store - use researcher agent as default for research tasks
  const { agents } = useStore();
  // Defensive: ensure agents is an array before calling find
  const researcherAgent = Array.isArray(agents) ? agents.find(a => a.id === 'researcher') : undefined;
  const proposedBy = researcherAgent?.name || 'researcher';

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
      
      await scheduleApi.create({
        type: 'research',
        content: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          citations: validCitations,
        }),
        platform: 'twitter',
        status: 'pending',
        metadata: { proposedBy },
      });

      showToast('success', 'Research idea submitted for approval');
      // Reset form
      setTitle('');
      setDescription('');
      setCitations(['']);
    } catch (error: unknown) {
      // '[XResearchEditor] Submit error:', error;
      showToast('error', `Failed to submit: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-mission-control-bg p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-5 h-5 text-info" />
          <h3 className="text-lg font-semibold text-mission-control-text">Propose Research Idea</h3>
        </div>
        <p className="text-sm text-mission-control-text-dim">
          Create a new research idea with citations. It will be submitted for approval.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6">
        {/* Title */}
        <div>
          <label htmlFor="research-title" className="block text-sm font-medium text-mission-control-text mb-2">
            Title <span className="text-error">*</span>
          </label>
          <TextField.Root
            id="research-title"
            aria-label="Research idea title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., AI Agents for Content Creation"
            disabled={submitting}
            size="2"
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="research-description" className="block text-sm font-medium text-mission-control-text mb-2">
            Description <span className="text-error">*</span>
          </label>
          <TextArea
            id="research-description"
            aria-label="Research idea description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the research idea, key insights, and why it's relevant..."
            rows={8}
            resize="vertical"
            disabled={submitting}
          />
          <p className="text-xs text-mission-control-text-dim mt-1">
            {description.length} characters
          </p>
        </div>

        {/* Citations */}
        <div>
          <label htmlFor="research-citations" className="block text-sm font-medium text-mission-control-text mb-2">
            Citations <span className="text-error">*</span>
          </label>
          <div className="space-y-2">
            {citations.map((citation, index) => (
              <div key={`${citation}-${index}`} className="flex gap-2">
                <div className="flex-1">
                  <TextField.Root
                    id={`citation-${index}`}
                    type="url"
                    aria-label={`Citation URL ${index + 1}`}
                    value={citation}
                    onChange={(e) => handleCitationChange(index, e.target.value)}
                    placeholder="https://example.com/article"
                    disabled={submitting}
                    size="2"
                  />
                </div>
                {citations.length > 1 && (
                  <Button
                    onClick={() => handleRemoveCitation(index)}
                    variant="soft"
                    color="red"
                    size="2"
                    disabled={submitting}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <Button
            onClick={handleAddCitation}
            variant="ghost"
            color="blue"
            size="1"
            disabled={submitting}
            className="mt-3"
          >
            <Plus className="w-4 h-4" />
            Add Citation
          </Button>
        </div>
      </div>

      {/* Submit Button */}
      <div className="mt-6 pt-6 border-t border-mission-control-border">
        <Button
          onClick={handleSubmit}
          disabled={submitting || !title.trim() || !description.trim()}
          variant="solid"
          color="blue"
          size="3"
          className="w-full"
        >
          {submitting ? (
            <>
              <Spinner size="1" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Submit for Approval
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
