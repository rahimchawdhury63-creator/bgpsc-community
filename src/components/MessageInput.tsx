import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface MessageInputProps {
  onSend: (body: string, attachment?: any) => void;
  disabled?: boolean;
}

export default function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    
    onSend(text.trim());
    setText('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Only images are allowed');
      return;
    }

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File too large (max 5MB)');
      return;
    }

    try {
      // Upload to ImgBB
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: formData,
      });

      const data = await response.json();

      // Send as attachment
      onSend('', {
        type: 'image',
        url: data.url,
        width: data.width,
        height: data.height,
      });
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Failed to upload image');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const commonEmojis = ['😊', '😂', '❤️', '👍', '🎉', '🔥', '😍', '🤔', '😢', '👏', '🙏', '💯'];

  return (
    <div className="border-t border-gray-200 p-4 dark:border-gray-700">
      <form onSubmit={handleSubmit} className="flex gap-2">
        {/* Attachment Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="btn btn-outline flex-shrink-0"
          title="Attach image"
        >
          📎
        </button>

        {/* Emoji Button */}
        <button
          type="button"
          onClick={() => setShowEmoji(!showEmoji)}
          className="btn btn-outline flex-shrink-0"
          title="Emoji"
        >
          😊
        </button>

        {/* Text Input */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          className="input flex-1 resize-none"
          rows={1}
          disabled={disabled}
        />

        {/* Send Button */}
        <button
          type="submit"
          className="btn btn-primary flex-shrink-0"
          disabled={!text.trim() || disabled}
        >
          Send
        </button>
      </form>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Emoji Picker */}
      {showEmoji && (
        <div className="mt-2 flex flex-wrap gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          {commonEmojis.map(emoji => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                setText(prev => prev + emoji);
                setShowEmoji(false);
              }}
              className="text-2xl hover:scale-125 transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
