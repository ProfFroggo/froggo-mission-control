import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Typography from '@tiptap/extension-typography';
import Link from '@tiptap/extension-link';
import EditorToolbar from './EditorToolbar';
import { useWritingStore } from '../../store/writingStore';
import { useEffect, useRef, useCallback } from 'react';
import '../../styles/writing-editor.css';

const AUTOSAVE_DELAY = 1500; // ms debounce

export default function ChapterEditor() {
  const {
    activeChapterId,
    activeChapterContent,
    chapterDirty,
    chapterLoading,
    saveChapter,
    setChapterDirty,
    setActiveChapterContent,
  } = useWritingStore();

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingContent = useRef<string | null>(null);
  const isSettingContent = useRef(false);

  // Flush any pending save — used on unmount and chapter switch
  const flushSave = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    if (pendingContent.current !== null) {
      const content = pendingContent.current;
      pendingContent.current = null;
      saveChapter(content);
    }
  }, [saveChapter]);

  // Debounced save
  const debouncedSave = useCallback(
    (content: string) => {
      pendingContent.current = content;
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        debounceTimer.current = null;
        pendingContent.current = null;
        saveChapter(content);
      }, AUTOSAVE_DELAY);
    },
    [saveChapter]
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Undo/redo extension comes with StarterKit
        undoRedo: {
          depth: 100,
        },
      }),
      Highlight,
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
      CharacterCount,
      Typography,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'editor-link',
        },
      }),
    ],
    content: activeChapterContent || '',
    shouldRerenderOnTransaction: false,
    onUpdate: ({ editor: ed }) => {
      if (isSettingContent.current) return;
      const html = ed.getHTML();
      setActiveChapterContent(html);
      setChapterDirty(true);
      debouncedSave(html);
    },
  });

  // When active chapter changes, load its content into the editor
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    // Only set content when it comes from store (chapter switch),
    // not from our own onUpdate handler
    const currentContent = editor.getHTML();
    if (activeChapterContent !== null && activeChapterContent !== currentContent) {
      isSettingContent.current = true;
      editor.commands.setContent(activeChapterContent, { emitUpdate: false });
      isSettingContent.current = false;
    }
  }, [activeChapterId]); // eslint-disable-line react-hooks/exhaustive-deps — intentionally only on chapter switch

  // Cleanup: flush save on unmount
  useEffect(() => {
    return () => {
      flushSave();
    };
  }, [flushSave]);

  // Word count from CharacterCount extension
  const wordCount = editor?.storage.characterCount?.words() ?? 0;

  if (chapterLoading) {
    return (
      <div className="flex items-center justify-center h-full text-clawd-text-dim">
        <span className="text-sm">Loading chapter...</span>
      </div>
    );
  }

  return (
    <div className="writing-editor flex flex-col h-full">
      <EditorToolbar editor={editor} />
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
      <div className="border-t border-clawd-border px-4 py-2 text-xs text-clawd-text-dim flex justify-between flex-shrink-0">
        <span>{wordCount.toLocaleString()} words</span>
        <span>{chapterDirty ? 'Saving...' : 'Saved'}</span>
      </div>
    </div>
  );
}
