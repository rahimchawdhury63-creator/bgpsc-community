interface MarkdownToolbarProps {
  onInsert: (before: string, after?: string) => void;
}

export default function MarkdownToolbar({ onInsert }: MarkdownToolbarProps) {
  const buttons = [
    { label: 'B', title: 'Bold', before: '**', after: '**' },
    { label: 'I', title: 'Italic', before: '_', after: '_' },
    { label: 'S', title: 'Strikethrough', before: '~~', after: '~~' },
    { label: '<>', title: 'Code', before: '`', after: '`' },
    { label: '"', title: 'Quote', before: '> ' },
    { label: 'H1', title: 'Heading 1', before: '# ' },
    { label: 'H2', title: 'Heading 2', before: '## ' },
    { label: 'H3', title: 'Heading 3', before: '### ' },
    { label: '•', title: 'Bullet List', before: '- ' },
    { label: '1.', title: 'Numbered List', before: '1. ' },
    { label: '🔗', title: 'Link', before: '[', after: '](url)' },
    { label: '📷', title: 'Image', before: '![alt](', after: ')' },
  ];

  return (
    <div className="mb-2 flex flex-wrap gap-1 rounded-lg border border-gray-200 p-2 dark:border-gray-700">
      {buttons.map((btn, idx) => (
        <button
          key={idx}
          onClick={() => onInsert(btn.before, btn.after)}
          title={btn.title}
          className="rounded px-2 py-1 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
          type="button"
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
}
