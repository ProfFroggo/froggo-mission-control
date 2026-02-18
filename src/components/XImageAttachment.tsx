import { Image } from 'lucide-react';

interface XImageAttachButtonProps {
  onImagesSelected: (paths: string[]) => void;
  existingImages?: string[];
  disabled?: boolean;
}

export function XImageAttachButton({ onImagesSelected, existingImages, disabled }: XImageAttachButtonProps) {
  const handleClick = async () => {
    try {
      const result = await window.clawdbot?.xDraft?.pickImage();
      if (result?.success && result.filePaths?.length > 0) {
        onImagesSelected(result.filePaths);
      }
    } catch {
      // Silently fail — user can retry
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-2 text-sm bg-clawd-bg-alt text-clawd-text-dim hover:text-clawd-text border border-clawd-border rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Image className="w-4 h-4" />
        Attach Image
      </button>
      {existingImages && existingImages.length > 0 && (
        <XImageThumbnails paths={existingImages} />
      )}
    </div>
  );
}

interface XImageThumbnailsProps {
  paths: string[];
  maxDisplay?: number;
}

export function XImageThumbnails({ paths, maxDisplay = 4 }: XImageThumbnailsProps) {
  const displayPaths = paths.slice(0, maxDisplay);
  const remaining = paths.length - maxDisplay;

  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      {displayPaths.map((filePath, idx) => (
        <img
          key={idx}
          src={`file://${filePath}`}
          alt={`Attachment ${idx + 1}`}
          className="w-16 h-16 object-cover rounded-lg border border-clawd-border"
        />
      ))}
      {remaining > 0 && (
        <span className="text-xs text-clawd-text-dim">+{remaining} more</span>
      )}
    </div>
  );
}
