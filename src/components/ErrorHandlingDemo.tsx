/**
 * ErrorHandlingDemo - Reference implementation showing all error handling features
 * 
 * This component demonstrates:
 * - Input validation with ValidatedInput
 * - Error display with recovery actions
 * - Confirmation dialogs for destructive actions
 * - Loading states and empty states
 * - File upload with validation
 * - Toast notifications
 * - Error boundary integration
 * 
 * Use this as a reference when implementing error handling in other components.
 */

import { useState } from 'react';
import { Trash2, Upload, Plus } from 'lucide-react';
import { ValidatedInput, ValidatedTextarea, ValidatedSelect } from './ValidatedInput';
import ErrorDisplay from './ErrorDisplay';
import ConfirmDialog, { useConfirmDialog } from './ConfirmDialog';
import { LoadingButton, LoadingOverlay, InlineLoader } from './LoadingStates';
import EmptyState from './EmptyState';
import { showToast } from './Toast';
import { commonRules, validateFile, formatFileSize } from '../utils/validation';

interface DemoItem {
  id: string;
  title: string;
  description: string;
  priority: string;
  createdAt: number;
}

export default function ErrorHandlingDemo() {
  // State
  const [items, setItems] = useState<DemoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('');
  const [formValid, setFormValid] = useState(false);
  const [titleValid, setTitleValid] = useState(false);
  const [descValid, setDescValid] = useState(true); // Optional field

  // File upload state
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Confirm dialog
  const { open, config, onConfirm, showConfirm, closeConfirm } = useConfirmDialog();

  // Update form validity
  const updateFormValidity = (titleValid: boolean, descValid: boolean, priorityValid: boolean) => {
    setFormValid(titleValid && descValid && priorityValid && priority !== '');
  };

  // Simulate API call with controlled error
  const simulateAPI = async (shouldFail: boolean = false, errorType?: string): Promise<DemoItem> => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    if (shouldFail) {
      // Simulate different error types for testing
      const errors: Record<string, any> = {
        network: new Error('Failed to fetch'),
        timeout: { code: 'ETIMEDOUT', message: 'Request timeout' },
        auth: { status: 401, message: 'Unauthorized' },
        validation: { status: 400, message: 'Invalid input' },
        server: { status: 500, message: 'Internal server error' },
      };
      throw errors[errorType || 'network'];
    }
    
    return {
      id: `item-${Date.now()}`,
      title,
      description,
      priority,
      createdAt: Date.now(),
    };
  };

  // Create item
  const handleCreate = async () => {
    if (!formValid) return;

    setLoading(true);
    setError(null);

    try {
      const newItem = await simulateAPI(false);
      setItems([...items, newItem]);
      showToast('success', 'Item created', 'Your item has been added successfully');
      
      // Reset form
      setTitle('');
      setDescription('');
      setPriority('');
      setShowForm(false);
    } catch (err) {
      setError(err);
      showToast('error', 'Creation failed', 'Unable to create item');
    } finally {
      setLoading(false);
    }
  };

  // Delete item with confirmation
  const handleDelete = (item: DemoItem) => {
    showConfirm(
      {
        title: 'Delete Item',
        message: `Are you sure you want to delete "${item.title}"? This action cannot be undone.`,
        confirmLabel: 'Delete',
        type: 'danger',
      },
      async () => {
        try {
          await simulateAPI(false);
          setItems(items.filter(i => i.id !== item.id));
          showToast('success', 'Item deleted');
        } catch (err) {
          showToast('error', 'Delete failed');
        }
      }
    );
  };

  // Simulate network error
  const simulateNetworkError = async () => {
    setLoading(true);
    setError(null);
    try {
      await simulateAPI(true, 'network');
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  // Simulate server error
  const simulateServerError = async () => {
    setLoading(true);
    setError(null);
    try {
      await simulateAPI(true, 'server');
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  // File upload with validation
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    const validation = validateFile(file, {
      maxSize: 5 * 1024 * 1024, // 5MB
      allowedTypes: ['image/png', 'image/jpeg', 'application/pdf'],
      allowedExtensions: ['png', 'jpg', 'jpeg', 'pdf'],
    });

    if (!validation.valid) {
      setUploadError(validation.error || 'Invalid file');
      showToast('error', 'Upload failed', validation.error);
      return;
    }

    setUploadError(null);
    setUploading(true);

    try {
      await simulateAPI(false);
      showToast('success', 'File uploaded', `${file.name} (${formatFileSize(file.size)})`);
    } catch (err) {
      setUploadError('Upload failed');
      showToast('error', 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset input
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-clawd-text">Error Handling Demo</h1>
        <p className="text-sm text-clawd-text-dim">
          Reference implementation showing all error handling features
        </p>
      </div>

      {/* Error Simulation Buttons */}
      <div className="bg-clawd-surface border border-clawd-border rounded-lg p-4">
        <h3 className="text-sm font-semibold text-clawd-text mb-3">Test Error Scenarios</h3>
        <div className="flex flex-wrap gap-2">
          <LoadingButton
            onClick={simulateNetworkError}
            variant="secondary"
            size="sm"
            loading={loading}
          >
            Network Error
          </LoadingButton>
          <LoadingButton
            onClick={simulateServerError}
            variant="secondary"
            size="sm"
            loading={loading}
          >
            Server Error
          </LoadingButton>
        </div>
      </div>

      {/* Global Error Display */}
      {error && (
        <ErrorDisplay
          error={error}
          context={{ action: 'load items', resource: 'items' }}
          onRetry={() => {
            setError(null);
            setLoading(false);
          }}
          inline
          onDismiss={() => setError(null)}
        />
      )}

      {/* File Upload with Validation */}
      <div className="bg-clawd-surface border border-clawd-border rounded-lg p-4">
        <h3 className="text-sm font-semibold text-clawd-text mb-3">File Upload with Validation</h3>
        {uploadError && (
          <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
            {uploadError}
          </div>
        )}
        <div className="flex items-center gap-3">
          <label className="cursor-pointer">
            <input
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
              accept=".png,.jpg,.jpeg,.pdf"
            />
            <div className="px-4 py-2 bg-clawd-accent text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2">
              <Upload size={16} />
              {uploading ? 'Uploading...' : 'Choose File'}
            </div>
          </label>
          {uploading && <InlineLoader text="Uploading..." />}
        </div>
        <p className="text-xs text-clawd-text-dim mt-2">
          Max 5MB • PNG, JPG, PDF only
        </p>
      </div>

      {/* Create Form */}
      <div className="bg-clawd-surface border border-clawd-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-clawd-text">Create New Item</h3>
          <LoadingButton
            onClick={() => setShowForm(!showForm)}
            variant="ghost"
            size="sm"
            icon={<Plus size={16} />}
          >
            {showForm ? 'Cancel' : 'New Item'}
          </LoadingButton>
        </div>

        {showForm && (
          <div className="space-y-4">
            {/* Validated Input */}
            <ValidatedInput
              label="Title"
              rules={commonRules.taskTitle()}
              value={title}
              onChange={(value, valid) => {
                setTitle(value);
                setTitleValid(valid);
                updateFormValidity(valid, descValid, priority !== '');
              }}
              placeholder="Enter item title..."
              helpText="3-200 characters"
            />

            {/* Validated Textarea */}
            <ValidatedTextarea
              label="Description"
              rules={commonRules.taskDescription()}
              value={description}
              onChange={(value, valid) => {
                setDescription(value);
                setDescValid(valid);
                updateFormValidity(titleValid, valid, priority !== '');
              }}
              placeholder="Enter description..."
              maxLength={2000}
              showCharCount
              rows={4}
            />

            {/* Validated Select */}
            <ValidatedSelect
              label="Priority"
              options={[
                { value: '', label: 'Select priority...' },
                { value: 'p0', label: 'Urgent' },
                { value: 'p1', label: 'High' },
                { value: 'p2', label: 'Medium' },
                { value: 'p3', label: 'Low' },
              ]}
              rules={[commonRules.required('Priority')]}
              value={priority}
              onChange={(value, valid) => {
                setPriority(value);
                updateFormValidity(titleValid, descValid, valid);
              }}
            />

            {/* Submit Button */}
            <LoadingButton
              onClick={handleCreate}
              variant="primary"
              loading={loading}
              disabled={!formValid}
              className="w-full"
            >
              Create Item
            </LoadingButton>
          </div>
        )}
      </div>

      {/* Items List */}
      <div className="bg-clawd-surface border border-clawd-border rounded-lg p-4">
        <h3 className="text-sm font-semibold text-clawd-text mb-4">Items</h3>

        {loading && <LoadingOverlay message="Loading items..." />}

        {!loading && items.length === 0 && (
          <EmptyState
            type="tasks"
            title="No items yet"
            description="Create your first item to get started"
            action={
              <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Plus size={16} /> Create Item
              </button>
            }
          />
        )}

        {!loading && items.length > 0 && (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between p-3 bg-clawd-bg rounded-lg border border-clawd-border"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-clawd-text">{item.title}</h4>
                  <p className="text-sm text-clawd-text-dim mt-1">{item.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs px-2 py-1 bg-clawd-surface rounded">
                      {item.priority.toUpperCase()}
                    </span>
                    <span className="text-xs text-clawd-text-dim">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
                <LoadingButton
                  onClick={() => handleDelete(item)}
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 size={14} />}
                  className="text-red-400 hover:bg-red-500/10"
                >
                  Delete
                </LoadingButton>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={open}
        {...config}
        onConfirm={onConfirm}
        onClose={closeConfirm}
      />

      {/* Documentation Link */}
      <div className="text-center text-xs text-clawd-text-dim">
        <p>
          See <code className="bg-clawd-surface px-1 rounded">docs/error-handling-guide.md</code> for
          complete documentation
        </p>
      </div>
    </div>
  );
}
