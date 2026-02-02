'use client';

import { RefObject, useState } from 'react';

interface MarkdownToolbarProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  content: string;
  onChange: (content: string) => void;
  onImageUpload: () => void;
  imageUploading?: boolean;
}

type FormatType =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'link'
  | 'quote'
  | 'code'
  | 'codeblock'
  | 'ul'
  | 'ol'
  | 'hr'
  | 'table';

export default function MarkdownToolbar({
  textareaRef,
  content,
  onChange,
  onImageUpload,
  imageUploading = false,
}: MarkdownToolbarProps) {
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');

  const getSelection = () => {
    const textarea = textareaRef.current;
    if (!textarea) return { start: content.length, end: content.length, text: '' };

    return {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
      text: content.substring(textarea.selectionStart, textarea.selectionEnd),
    };
  };

  const insertText = (before: string, after: string = '', placeholder: string = '') => {
    const textarea = textareaRef.current;
    const { start, end, text } = getSelection();

    const selectedText = text || placeholder;
    const newText = before + selectedText + after;
    const newContent = content.substring(0, start) + newText + content.substring(end);

    onChange(newContent);

    // Set cursor position
    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        const cursorPos = text
          ? start + newText.length
          : start + before.length + placeholder.length;
        textarea.setSelectionRange(
          text ? start + before.length : start + before.length,
          text ? start + before.length + selectedText.length : start + before.length + placeholder.length
        );
      }
    }, 0);
  };

  const insertAtLineStart = (prefix: string) => {
    const textarea = textareaRef.current;
    const { start } = getSelection();

    // Find the start of the current line
    const lineStart = content.lastIndexOf('\n', start - 1) + 1;
    const newContent = content.substring(0, lineStart) + prefix + content.substring(lineStart);

    onChange(newContent);

    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        const newPos = start + prefix.length;
        textarea.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const insertBlock = (text: string) => {
    const textarea = textareaRef.current;
    const { start, end } = getSelection();

    // Add newlines for proper spacing
    const before = content.substring(0, start);
    const after = content.substring(end);
    const needsNewlineBefore = before.length > 0 && !before.endsWith('\n\n');
    const needsNewlineAfter = after.length > 0 && !after.startsWith('\n');

    const insertText = (needsNewlineBefore ? '\n\n' : '') + text + (needsNewlineAfter ? '\n\n' : '');
    const newContent = before + insertText + after;

    onChange(newContent);

    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        const newPos = start + insertText.length;
        textarea.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const handleFormat = (type: FormatType) => {
    switch (type) {
      case 'bold':
        insertText('**', '**', 'bold text');
        break;
      case 'italic':
        insertText('*', '*', 'italic text');
        break;
      case 'strikethrough':
        insertText('~~', '~~', 'strikethrough text');
        break;
      case 'h1':
        insertAtLineStart('# ');
        break;
      case 'h2':
        insertAtLineStart('## ');
        break;
      case 'h3':
        insertAtLineStart('### ');
        break;
      case 'quote':
        insertAtLineStart('> ');
        break;
      case 'code':
        insertText('`', '`', 'code');
        break;
      case 'codeblock':
        insertBlock('```\ncode here\n```');
        break;
      case 'ul':
        insertAtLineStart('- ');
        break;
      case 'ol':
        insertAtLineStart('1. ');
        break;
      case 'hr':
        insertBlock('---');
        break;
      case 'table':
        insertBlock('| Header 1 | Header 2 | Header 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n| Cell 4   | Cell 5   | Cell 6   |');
        break;
      case 'link':
        const { text } = getSelection();
        setLinkText(text);
        setLinkUrl('');
        setShowLinkModal(true);
        break;
    }
  };

  const handleInsertLink = () => {
    const url = linkUrl.trim();
    const text = linkText.trim() || url;

    if (url) {
      const { start, end } = getSelection();
      const markdown = `[${text}](${url})`;
      const newContent = content.substring(0, start) + markdown + content.substring(end);
      onChange(newContent);

      setTimeout(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.focus();
          const newPos = start + markdown.length;
          textarea.setSelectionRange(newPos, newPos);
        }
      }, 0);
    }

    setShowLinkModal(false);
    setLinkUrl('');
    setLinkText('');
  };

  const ToolbarButton = ({
    onClick,
    title,
    children,
    disabled = false,
  }: {
    onClick: () => void;
    title: string;
    children: React.ReactNode;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );

  const Divider = () => (
    <div className="w-px h-6 bg-gray-300 mx-1" />
  );

  return (
    <>
      <div className="flex items-center flex-wrap gap-0.5 p-2 bg-gray-50 border border-gray-300 border-b-0 rounded-t-lg">
        {/* Text Formatting */}
        <ToolbarButton onClick={() => handleFormat('bold')} title="Bold (Ctrl+B)">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
          </svg>
        </ToolbarButton>

        <ToolbarButton onClick={() => handleFormat('italic')} title="Italic (Ctrl+I)">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 4h4m-2 0l-4 16m0 0h4" />
          </svg>
        </ToolbarButton>

        <ToolbarButton onClick={() => handleFormat('strikethrough')} title="Strikethrough">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" d="M6 12h12" />
            <path strokeLinecap="round" d="M8 6h6a2 2 0 012 2c0 1-1 2-2 2H8" />
            <path strokeLinecap="round" d="M8 12h6a2 2 0 110 4H8" />
          </svg>
        </ToolbarButton>

        <Divider />

        {/* Headings */}
        <ToolbarButton onClick={() => handleFormat('h1')} title="Heading 1">
          <span className="font-bold text-sm">H1</span>
        </ToolbarButton>

        <ToolbarButton onClick={() => handleFormat('h2')} title="Heading 2">
          <span className="font-bold text-sm">H2</span>
        </ToolbarButton>

        <ToolbarButton onClick={() => handleFormat('h3')} title="Heading 3">
          <span className="font-bold text-sm">H3</span>
        </ToolbarButton>

        <Divider />

        {/* Lists */}
        <ToolbarButton onClick={() => handleFormat('ul')} title="Bullet List">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
        </ToolbarButton>

        <ToolbarButton onClick={() => handleFormat('ol')} title="Numbered List">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6h11M10 12h11M10 18h11" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h1v4M4 10h2M4 18h2l-1.5-2L6 14H4" />
          </svg>
        </ToolbarButton>

        <Divider />

        {/* Block Elements */}
        <ToolbarButton onClick={() => handleFormat('quote')} title="Blockquote">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z" />
          </svg>
        </ToolbarButton>

        <ToolbarButton onClick={() => handleFormat('code')} title="Inline Code">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </ToolbarButton>

        <ToolbarButton onClick={() => handleFormat('codeblock')} title="Code Block">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path strokeLinecap="round" d="M8 10l-2 2 2 2M16 10l2 2-2 2M12 8l-2 8" />
          </svg>
        </ToolbarButton>

        <Divider />

        {/* Links & Media */}
        <ToolbarButton onClick={() => handleFormat('link')} title="Insert Link">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </ToolbarButton>

        <ToolbarButton onClick={onImageUpload} title="Insert Image" disabled={imageUploading}>
          {imageUploading ? (
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          )}
        </ToolbarButton>

        <ToolbarButton onClick={() => handleFormat('table')} title="Insert Table">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
          </svg>
        </ToolbarButton>

        <ToolbarButton onClick={() => handleFormat('hr')} title="Horizontal Rule">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" d="M3 12h18" />
          </svg>
        </ToolbarButton>
      </div>

      {/* Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Insert Link</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Link Text
                </label>
                <input
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="Display text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL
                </label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleInsertLink();
                    }
                  }}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInsertLink}
                disabled={!linkUrl.trim()}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium transition-colors"
              >
                Insert Link
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
