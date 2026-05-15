'use client';

import { RefObject, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { Markdown } from 'tiptap-markdown';

interface WysiwygEditorProps {
  /** Markdown source — source of truth lives in the parent form. */
  value: string;
  onChange: (markdown: string) => void;
  /** Forwarded to the source-pane <textarea> so the existing MarkdownToolbar
   *  (and the image-upload toolbar button) can still operate on it. */
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  placeholder?: string;
  minHeight?: number;
}

/**
 * Side-by-side bidirectional markdown editor.
 *
 *   - Left pane: live WYSIWYG (TipTap). Type formatted text directly here.
 *   - Right pane: raw markdown source. Edit / paste / find-replace here.
 *
 * Edits in either pane sync to the other. HTML embedded inside the markdown
 * (tables, custom blocks, etc.) is preserved end-to-end thanks to tiptap-markdown
 * configured with `html: true`.
 *
 * Sync model:
 *   - parent owns the canonical markdown string (`value`).
 *   - TipTap is initialized from `value`; on every change it serializes back to
 *     markdown via `(editor.storage as any).markdown.getMarkdown()` and calls onChange.
 *   - When `value` changes externally (textarea edit, toolbar insert), an effect
 *     re-loads TipTap from the new value — but only if the editor's current
 *     serialized output differs, so we don't loop on round-trip equivalents.
 */
export default function WysiwygEditor({
  value,
  onChange,
  textareaRef,
  placeholder = 'Start writing… (markdown on the right, formatted preview on the left)',
  minHeight = 500,
}: WysiwygEditorProps) {
  // Tracks the most recent value we wrote into TipTap. Prevents the parent's
  // re-render (from our own onChange) from being re-applied as an external
  // edit that re-parses the markdown into TipTap. Without this guard, every
  // keystroke in the rich pane would cause a setContent → cursor reset.
  const lastWrittenToEditor = useRef<string>(value);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      Markdown.configure({
        html: true,
        breaks: false,
        linkify: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: value,
    // Required by Next.js App Router — defer initial render to client so
    // SSR/hydration doesn't mismatch on the editor's content.
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const md = (editor.storage as any).markdown.getMarkdown();
      lastWrittenToEditor.current = md;
      if (md !== value) onChange(md);
    },
  });

  // External edits → push into TipTap (only if not already there).
  useEffect(() => {
    if (!editor) return;
    if (value === lastWrittenToEditor.current) return;
    lastWrittenToEditor.current = value;
    // emitUpdate=false avoids onUpdate firing back into onChange with a
    // potentially-different round-tripped string.
    editor.commands.setContent(value, { emitUpdate: false });
  }, [value, editor]);

  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-200"
      style={{ minHeight }}
    >
      {/* WYSIWYG pane */}
      <div className="flex flex-col">
        <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          Preview · click to edit
        </div>
        <div className="flex-1 overflow-auto">
          <EditorContent
            editor={editor}
            className="prose prose-sm sm:prose max-w-none px-5 py-4 focus:outline-none [&_.ProseMirror]:min-h-full [&_.ProseMirror]:focus:outline-none"
          />
        </div>
      </div>

      {/* Markdown source pane */}
      <div className="flex flex-col">
        <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          Markdown / HTML source
        </div>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 w-full px-5 py-4 font-mono text-[13px] leading-relaxed text-gray-800 border-0 focus:ring-0 focus:outline-none resize-none bg-white"
          placeholder={placeholder}
          spellCheck={false}
          style={{ minHeight }}
        />
      </div>
    </div>
  );
}
