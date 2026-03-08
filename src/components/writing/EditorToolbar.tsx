import { Editor } from '@tiptap/react';
import { useState } from 'react';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link,
  Undo,
  Redo,
} from 'lucide-react';
import BaseModal, { BaseModalBody, BaseModalFooter } from '../BaseModal';
import { LoadingButton } from '../LoadingStates';

interface EditorToolbarProps {
  editor: Editor | null;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-mission-control-border text-mission-control-text'
          : 'text-mission-control-text-dim hover:bg-mission-control-border hover:text-mission-control-text'
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <div className="w-px h-5 bg-mission-control-border mx-1" />;
}

export default function EditorToolbar({ editor }: EditorToolbarProps) {
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  if (!editor) return null;

  const handleLink = () => {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    setUrlDialogOpen(true);
  };

  const handleUrlSubmit = () => {
    if (urlInput) {
      editor.chain().focus().setLink({ href: urlInput }).run();
    }
    setUrlDialogOpen(false);
    setUrlInput('');
  };

  return (
    <>
      <div className="flex items-center gap-0.5 px-3 py-2 bg-mission-control-surface border-b border-mission-control-border flex-shrink-0">
        {/* Headings */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
          title="Heading 1"
        >
          <Heading1 size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          <Heading2 size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          <Heading3 size={16} />
        </ToolbarButton>

        <Separator />

        {/* Inline formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold (Cmd+B)"
        >
          <Bold size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic (Cmd+I)"
        >
          <Italic size={16} />
        </ToolbarButton>

        <Separator />

        {/* Lists and blockquote */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Ordered List"
        >
          <ListOrdered size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Blockquote"
        >
          <Quote size={16} />
        </ToolbarButton>

        <Separator />

        {/* Link */}
        <ToolbarButton
          onClick={handleLink}
          active={editor.isActive('link')}
          title="Link"
        >
          <Link size={16} />
        </ToolbarButton>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Undo / Redo */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo (Cmd+Z)"
        >
          <Undo size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo (Cmd+Shift+Z)"
        >
          <Redo size={16} />
        </ToolbarButton>
      </div>

      {/* URL Input Dialog */}
      <BaseModal
        isOpen={urlDialogOpen}
        onClose={() => {
          setUrlDialogOpen(false);
          setUrlInput('');
        }}
        size="sm"
        ariaLabel="Add Link"
      >
        <div className="p-4 border-b border-mission-control-border">
          <h3 className="text-lg font-semibold text-mission-control-text">Add Link</h3>
        </div>
        <BaseModalBody>
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com"
            className="w-full px-3 py-2 bg-mission-control-bg border border-mission-control-border rounded-lg text-mission-control-text placeholder-mission-control-text-dim focus:outline-none focus:ring-2 focus:ring-mission-control-accent"
            onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
          />
        </BaseModalBody>
        <BaseModalFooter align="right">
          <LoadingButton
            onClick={() => {
              setUrlDialogOpen(false);
              setUrlInput('');
            }}
            variant="ghost"
          >
            Cancel
          </LoadingButton>
          <LoadingButton
            onClick={handleUrlSubmit}
            variant="primary"
            disabled={!urlInput}
          >
            Add Link
          </LoadingButton>
        </BaseModalFooter>
      </BaseModal>
    </>
  );
}
