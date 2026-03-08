import { Image } from 'lucide-react';

interface XImageAttachButtonProps {
  onImagesSelected: (paths: string[]) => void;
  existingImages?: string[];
  disabled?: boolean;
}

export function XImageAttachButton({ onImagesSelected, existingImages, disabled }: XImageAttachButtonProps) {
  const handleClick = () => {
    // Use browser File API instead of Electron dialog
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = () => {
      if (input.files && input.files.length > 0) {
        const urls = Array.from(input.files).map(f => URL.createObjectURL(f));
        onImagesSelected(urls);
      }
    };
    input.click();
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-2 text-sm bg-mission-control-bg-alt text-mission-control-text-dim hover:text-mission-control-text border border-mission-control-border rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
          src={filePath.startsWith('blob:') || filePath.startsWith('data:') ? filePath : `file://${filePath}`}
          alt={`Attachment ${idx + 1}`}
          className="w-16 h-16 object-cover rounded-lg border border-mission-control-border"
        />
      ))}
      {remaining > 0 && (
        <span className="text-xs text-mission-control-text-dim">+{remaining} more</span>
      )}
    </div>
  );
}
