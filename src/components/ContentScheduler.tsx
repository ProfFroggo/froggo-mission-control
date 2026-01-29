import { useState, useEffect, useCallback, useRef } from 'react';
import { Calendar, Clock, Mail, Plus, Trash2, Edit2, Play, Pause, RefreshCw, X, Check, Paperclip, Image as ImageIcon, Video } from 'lucide-react';

// X logo component
const XIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);
import { showToast } from './Toast';
import IconBadge from './IconBadge';

type ScheduledItemType = 'tweet' | 'email' | 'message';
type ScheduledItemStatus = 'pending' | 'sent' | 'cancelled' | 'failed';

interface ScheduledItem {
  id: string;
  type: ScheduledItemType;
  content: string;
  scheduledFor: string; // ISO date
  status: ScheduledItemStatus;
  createdAt: string;
  sentAt?: string;
  error?: string;
  metadata?: {
    replyTo?: string;
    recipient?: string;
    subject?: string;
  };
}

const typeConfig: Record<ScheduledItemType, { icon: any; color: string; label: string }> = {
  tweet: { icon: XIcon, color: 'text-white bg-white/10', label: 'Post' },
  email: { icon: Mail, color: 'text-green-400 bg-green-500/10', label: 'Email' },
  message: { icon: Mail, color: 'text-purple-400 bg-purple-500/10', label: 'Message' },
};

export default function ContentScheduler() {
  const [items, setItems] = useState<ScheduledItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'sent'>('pending');

  // Form state
  const [formType, setFormType] = useState<ScheduledItemType>('tweet');
  const [formContent, setFormContent] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formRecipient, setFormRecipient] = useState('');
  const [formSubject, setFormSubject] = useState('');
  
  // Media upload state
  const [mediaFile, setMediaFile] = useState<{ path: string; fileName: string; size: number; type: string } | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const result = await (window as any).clawdbot?.schedule?.list();
      if (result?.success) {
        setItems(result.items || []);
      }
    } catch (error) {
      console.error('[Schedule] Load error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchedule();
    // Poll every 30 seconds
    const interval = setInterval(loadSchedule, 30000);
    return () => clearInterval(interval);
  }, [loadSchedule]);
  
  // Clean up old uploads on mount (7 days)
  useEffect(() => {
    const cleanup = async () => {
      const result = await (window as any).clawdbot?.media?.cleanup();
      if (result?.success && result.deletedCount > 0) {
        console.log(`[MediaCleanup] Removed ${result.deletedCount} old file(s)`);
      }
    };
    cleanup();
  }, []);

  const handleFileSelect = async (file: File) => {
    setUploadError(null);
    
    // Validate file type
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const validVideoTypes = ['video/mp4', 'video/quicktime'];
    const isImage = validImageTypes.includes(file.type);
    const isVideo = validVideoTypes.includes(file.type);
    
    if (!isImage && !isVideo) {
      setUploadError('Invalid file type. Accepted: JPG, PNG, GIF, WEBP, MP4, MOV');
      return;
    }
    
    // Validate file size
    const maxImageSize = 5 * 1024 * 1024; // 5MB
    const maxVideoSize = 50 * 1024 * 1024; // 50MB
    const maxSize = isImage ? maxImageSize : maxVideoSize;
    
    if (file.size > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024);
      setUploadError(`File too large. Max size: ${maxSizeMB}MB`);
      return;
    }
    
    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = (e.target?.result as string)?.split(',')[1];
        
        if (!base64Data) {
          setUploadError('Failed to read file');
          return;
        }
        
        // Upload to backend
        const result = await (window as any).clawdbot?.media?.upload(file.name, base64Data);
        
        if (result?.success) {
          setMediaFile({
            path: result.path,
            fileName: result.fileName,
            size: result.size,
            type: isImage ? 'image' : 'video',
          });
          
          // Create preview for images
          if (isImage) {
            setMediaPreview(e.target?.result as string);
          }
          
          showToast('success', 'Uploaded', `${file.name} uploaded successfully`);
        } else {
          setUploadError(result?.error || 'Upload failed');
        }
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      setUploadError(String(error));
    }
  };
  
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };
  
  const handleRemoveMedia = async () => {
    if (mediaFile) {
      // Delete from backend
      await (window as any).clawdbot?.media?.delete(mediaFile.path);
    }
    setMediaFile(null);
    setMediaPreview(null);
    setUploadError(null);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!formContent.trim() || !formDate || !formTime) {
      showToast('error', 'Missing fields', 'Please fill in all required fields');
      return;
    }

    const scheduledFor = new Date(`${formDate}T${formTime}`).toISOString();
    
    try {
      const item = {
        type: formType,
        content: formContent,
        scheduledFor,
        metadata: {
          ...(formType === 'email' ? {
            recipient: formRecipient,
            subject: formSubject,
          } : {}),
          ...(mediaFile ? {
            mediaPath: mediaFile.path,
            mediaFileName: mediaFile.fileName,
            mediaType: mediaFile.type,
            mediaSize: mediaFile.size,
          } : {}),
        },
      };

      const result = editingId
        ? await (window as any).clawdbot?.schedule?.update(editingId, item)
        : await (window as any).clawdbot?.schedule?.add(item);

      if (result?.success) {
        showToast('success', editingId ? 'Updated' : 'Scheduled', `${typeConfig[formType].label} scheduled for ${new Date(scheduledFor).toLocaleString()}`);
        resetForm();
        loadSchedule();
      } else {
        showToast('error', 'Failed', result?.error || 'Unknown error');
      }
    } catch (error) {
      showToast('error', 'Failed', String(error));
    }
  };

  const handleCancel = async (id: string) => {
    try {
      const result = await (window as any).clawdbot?.schedule?.cancel(id);
      if (result?.success) {
        showToast('success', 'Cancelled', 'Scheduled item cancelled');
        loadSchedule();
      }
    } catch (error) {
      showToast('error', 'Failed', String(error));
    }
  };

  const handleSendNow = async (id: string) => {
    try {
      const result = await (window as any).clawdbot?.schedule?.sendNow(id);
      if (result?.success) {
        showToast('success', 'Sent', 'Item sent immediately');
        loadSchedule();
      }
    } catch (error) {
      showToast('error', 'Failed', String(error));
    }
  };

  const handleEdit = (item: ScheduledItem) => {
    setEditingId(item.id);
    setFormType(item.type);
    setFormContent(item.content);
    const date = new Date(item.scheduledFor);
    setFormDate(date.toISOString().split('T')[0]);
    setFormTime(date.toTimeString().slice(0, 5));
    if (item.metadata) {
      setFormRecipient(item.metadata.recipient || '');
      setFormSubject(item.metadata.subject || '');
    }
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormType('tweet');
    setFormContent('');
    setFormDate('');
    setFormTime('');
    setFormRecipient('');
    setFormSubject('');
    
    // Clear media
    handleRemoveMedia();
    setUploadError(null);
  };

  const formatScheduledTime = (isoDate: string) => {
    const date = new Date(isoDate);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    
    if (diff < 0) return 'Overdue';
    if (diff < 3600000) return `in ${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `in ${Math.floor(diff / 3600000)}h`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const filteredItems = items.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'pending') return item.status === 'pending';
    if (filter === 'sent') return item.status === 'sent';
    return true;
  });

  const pendingCount = items.filter(i => i.status === 'pending').length;
  const sentCount = items.filter(i => i.status === 'sent').length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-clawd-border bg-clawd-surface">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-clawd-accent/20 rounded-xl">
              <Calendar size={24} className="text-clawd-accent" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Schedule Queue</h1>
              <p className="text-sm text-clawd-text-dim">
                {pendingCount} pending • {sentCount} sent
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={loadSchedule}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 bg-clawd-border text-clawd-text-dim rounded-xl hover:bg-clawd-border/80 transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-clawd-accent text-white rounded-xl hover:bg-clawd-accent/90 transition-colors"
            >
              <Plus size={16} />
              Schedule New
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {(['pending', 'sent', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                filter === f
                  ? 'bg-clawd-accent text-white'
                  : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'
              }`}
            >
              {f === 'pending' && `Pending (${pendingCount})`}
              {f === 'sent' && `Sent (${sentCount})`}
              {f === 'all' && `All (${items.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Schedule Form */}
      {showForm && (
        <div className="p-6 border-b border-clawd-border bg-clawd-bg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">{editingId ? 'Edit Scheduled Item' : 'Schedule New Item'}</h3>
            <button onClick={resetForm} className="p-1 hover:bg-clawd-border rounded">
              <X size={16} />
            </button>
          </div>

          <div className="space-y-4">
            {/* Type selector */}
            <div className="flex gap-2">
              {(['tweet', 'email'] as const).map((t) => {
                const config = typeConfig[t];
                const Icon = config.icon;
                return (
                  <button
                    key={t}
                    onClick={() => setFormType(t)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                      formType === t
                        ? 'border-clawd-accent bg-clawd-accent/10 text-clawd-accent'
                        : 'border-clawd-border text-clawd-text-dim hover:text-clawd-text'
                    }`}
                  >
                    <Icon size={16} />
                    {config.label}
                  </button>
                );
              })}
            </div>

            {/* Email fields */}
            {formType === 'email' && (
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  value={formRecipient}
                  onChange={(e) => setFormRecipient(e.target.value)}
                  placeholder="Recipient email"
                  className="px-3 py-2 bg-clawd-surface border border-clawd-border rounded-lg focus:outline-none focus:border-clawd-accent"
                />
                <input
                  type="text"
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  placeholder="Subject"
                  className="px-3 py-2 bg-clawd-surface border border-clawd-border rounded-lg focus:outline-none focus:border-clawd-accent"
                />
              </div>
            )}

            {/* Content */}
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder={formType === 'tweet' ? 'What do you want to tweet?' : 'Email body...'}
              rows={3}
              className="w-full px-3 py-2 bg-clawd-surface border border-clawd-border rounded-lg focus:outline-none focus:border-clawd-accent resize-none"
            />
            {formType === 'tweet' && (
              <div className="text-xs text-clawd-text-dim text-right">
                {formContent.length}/280 characters
              </div>
            )}

            {/* Media Upload */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Media (optional)</label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-clawd-border hover:bg-clawd-border/80 rounded-lg transition-colors"
                >
                  <Paperclip size={14} />
                  {mediaFile ? 'Change' : 'Attach'}
                </button>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,video/mp4,video/quicktime"
                onChange={handleFileInput}
                className="hidden"
              />
              
              {/* Drag & Drop Zone */}
              {!mediaFile && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                    isDragging 
                      ? 'border-clawd-accent bg-clawd-accent/10' 
                      : 'border-clawd-border hover:border-clawd-border/60'
                  }`}
                >
                  <p className="text-sm text-clawd-text-dim">
                    Drag & drop image or video, or click Attach button
                  </p>
                  <p className="text-xs text-clawd-text-dim mt-1">
                    Images: JPG, PNG, GIF, WEBP (max 5MB) • Videos: MP4, MOV (max 50MB)
                  </p>
                </div>
              )}
              
              {/* Media Preview */}
              {mediaFile && (
                <div className="border border-clawd-border rounded-lg p-3 bg-clawd-surface">
                  <div className="flex items-start gap-3">
                    {/* Preview/Icon */}
                    <div className="flex-shrink-0">
                      {mediaFile.type === 'image' && mediaPreview ? (
                        <img 
                          src={mediaPreview} 
                          alt="Preview" 
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-clawd-border rounded-lg flex items-center justify-center">
                          {mediaFile.type === 'image' ? (
                            <ImageIcon size={24} className="text-clawd-text-dim" />
                          ) : (
                            <Video size={24} className="text-clawd-text-dim" />
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {mediaFile.type === 'image' ? (
                          <ImageIcon size={14} className="text-green-400" />
                        ) : (
                          <Video size={14} className="text-blue-400" />
                        )}
                        <span className="text-sm font-medium truncate">{mediaFile.fileName}</span>
                      </div>
                      <p className="text-xs text-clawd-text-dim mt-1">
                        {(mediaFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    
                    {/* Remove Button */}
                    <button
                      type="button"
                      onClick={handleRemoveMedia}
                      className="p-1 hover:bg-red-500/20 rounded transition-colors"
                      title="Remove media"
                    >
                      <X size={16} className="text-red-400" />
                    </button>
                  </div>
                </div>
              )}
              
              {/* Upload Error */}
              {uploadError && (
                <div className="text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded">
                  {uploadError}
                </div>
              )}
            </div>

            {/* Date/Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-clawd-text-dim mb-1">Date</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 bg-clawd-surface border border-clawd-border rounded-lg focus:outline-none focus:border-clawd-accent"
                />
              </div>
              <div>
                <label className="block text-sm text-clawd-text-dim mb-1">Time</label>
                <input
                  type="time"
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  className="w-full px-3 py-2 bg-clawd-surface border border-clawd-border rounded-lg focus:outline-none focus:border-clawd-accent"
                />
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-2">
              <button
                onClick={resetForm}
                className="px-4 py-2 bg-clawd-border text-clawd-text-dim rounded-lg hover:bg-clawd-border/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formContent.trim() || !formDate || !formTime}
                className="flex items-center gap-2 px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent/90 transition-colors disabled:opacity-50"
              >
                <Check size={16} />
                {editingId ? 'Update' : 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Items list */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-clawd-text-dim">
            <Calendar size={64} className="opacity-20 mb-4" />
            <p className="text-lg">No scheduled items</p>
            <p className="text-sm">Schedule tweets and emails for later</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-clawd-accent text-white rounded-xl hover:bg-clawd-accent/90 transition-colors"
            >
              <Plus size={16} />
              Schedule First Item
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => {
              const config = typeConfig[item.type];
              const Icon = config.icon;
              const isPending = item.status === 'pending';
              
              return (
                <div
                  key={item.id}
                  className={`p-4 bg-clawd-surface border border-clawd-border rounded-xl ${
                    isPending ? 'hover:border-clawd-accent/30' : 'opacity-70'
                  } transition-colors`}
                >
                  <div className="flex items-start gap-4">
                    <IconBadge icon={Icon} size={16} color={config.color} />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          item.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          item.status === 'sent' ? 'bg-green-500/20 text-green-400' :
                          item.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {item.status}
                        </span>
                        <span className="text-xs text-clawd-text-dim flex items-center gap-1">
                          <Clock size={14} />
                          {formatScheduledTime(item.scheduledFor)}
                        </span>
                      </div>
                      
                      <p className="text-sm mb-2">{item.content}</p>
                      
                      {item.metadata?.recipient && (
                        <p className="text-xs text-clawd-text-dim">
                          To: {item.metadata.recipient}
                          {item.metadata.subject && ` • ${item.metadata.subject}`}
                        </p>
                      )}
                      
                      {/* Media indicator */}
                      {item.metadata?.mediaPath && (
                        <div className="flex items-center gap-1 text-xs text-clawd-accent mt-1">
                          {item.metadata.mediaType === 'image' ? (
                            <ImageIcon size={14} />
                          ) : (
                            <Video size={14} />
                          )}
                          <span>{item.metadata.mediaFileName}</span>
                        </div>
                      )}
                    </div>

                    {isPending && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleSendNow(item.id)}
                          className="p-2 hover:bg-green-500/20 rounded-lg transition-colors"
                          title="Send now"
                        >
                          <Play size={16} className="text-green-400" />
                        </button>
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={16} className="text-clawd-text-dim" />
                        </button>
                        <button
                          onClick={() => handleCancel(item.id)}
                          className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                          title="Cancel"
                        >
                          <Trash2 size={16} className="text-red-400" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
