interface LinkPreviewProps {
  preview: any;
  onRemove: () => void;
}

export default function LinkPreview({ preview, onRemove }: LinkPreviewProps) {
  return (
    <div className="relative rounded-lg border border-gray-200 overflow-hidden dark:border-gray-700">
      <button
        onClick={onRemove}
        className="absolute top-2 right-2 z-10 bg-white/90 rounded-full p-1 text-xs hover:bg-white dark:bg-gray-800/90 dark:hover:bg-gray-800"
        aria-label="Remove preview"
      >
        ✕
      </button>

      <a
        href={preview.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        {preview.image_url && (
          <img
            src={preview.image_url}
            alt=""
            className="w-20 h-20 object-cover rounded flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            {preview.site_name || preview.host}
          </div>
          <div className="font-semibold text-sm line-clamp-2">
            {preview.title || preview.url}
          </div>
          {preview.description && (
            <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
              {preview.description}
            </div>
          )}
        </div>
      </a>
    </div>
  );
}
