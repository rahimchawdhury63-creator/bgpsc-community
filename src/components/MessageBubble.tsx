import { useState } from 'react';
import { format } from 'date-fns';
import type { Message, Profile } from '../types/database';
import { useAuthStore } from '../lib/stores/auth';
import { supabase } from '../lib/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface MessageBubbleProps {
  message: Message & { sender: Profile; reply_to?: Message };
  isOwn: boolean;
  showAvatar: boolean;
  onReply: () => void;
}

export default function MessageBubble({ message, isOwn, showAvatar, onReply }: MessageBubbleProps) {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [showActions, setShowActions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);

  // React to message
  const reactMutation = useMutation({
    mutationFn: async (emoji: string) => {
      await supabase.rpc('react_to_message', {
        p_message_id: message.id,
        p_emoji: emoji,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      setShowReactions(false);
    },
  });

  // Delete message (unsend)
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await supabase
        .from('messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', message.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });

  const quickReactions = ['❤️', '😂', '😮', '😢', '👍', '🎉'];

  if (message.deleted_at) {
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
        <div className="max-w-[70%] rounded-lg bg-gray-100 px-4 py-2 italic text-gray-500 dark:bg-gray-700">
          Message deleted
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      {showAvatar && !isOwn ? (
        <img
          src={message.sender.avatar_url || '/brand/logo.png'}
          alt={message.sender.full_name}
          className="h-8 w-8 rounded-full flex-shrink-0"
        />
      ) : (
        <div className="w-8 flex-shrink-0" />
      )}

      {/* Message Content */}
      <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Sender Name (for groups) */}
        {showAvatar && !isOwn && (
          <div className="text-xs text-gray-500 mb-1">{message.sender.full_name}</div>
        )}

        {/* Reply Quote */}
        {message.reply_to && (
          <div className="mb-1 rounded-lg border-l-4 border-brand-400 bg-gray-50 px-3 py-1 text-xs dark:bg-gray-700">
            <div className="font-semibold">{message.reply_to.sender?.full_name || 'Unknown'}</div>
            <div className="text-gray-500 truncate">{message.reply_to.body_text}</div>
          </div>
        )}

        {/* Message Bubble */}
        <div
          className={`relative group rounded-2xl px-4 py-2 ${
            isOwn
              ? 'bg-brand-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700'
          }`}
          onMouseEnter={() => setShowActions(true)}
          onMouseLeave={() => setShowActions(false)}
        >
          {/* Attachment */}
          {message.attachment?.type === 'image' && (
            <img
              src={message.attachment.url}
              alt=""
              className="mb-2 max-w-full rounded-lg"
              style={{ maxHeight: '300px' }}
            />
          )}

          {/* Text */}
          {message.body_md && (
            <div className="whitespace-pre-wrap break-words">{message.body_md}</div>
          )}

          {/* Timestamp & Status */}
          <div className={`mt-1 flex items-center gap-1 text-xs ${isOwn ? 'text-brand-100' : 'text-gray-500'}`}>
            <span>{format(new Date(message.created_at), 'h:mm a')}</span>
            {isOwn && (
              <span>
                {message.read_at ? '✓✓' : message.delivered_at ? '✓✓' : '✓'}
              </span>
            )}
            {message.edited_at && <span>(edited)</span>}
          </div>

          {/* Quick Actions */}
          {showActions && (
            <div className={`absolute ${isOwn ? 'left-0 -translate-x-full' : 'right-0 translate-x-full'} top-0 flex gap-1 px-2`}>
              <button
                onClick={() => setShowReactions(!showReactions)}
                className="rounded-full bg-white p-1 shadow hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700"
                title="React"
              >
                😊
              </button>
              <button
                onClick={onReply}
                className="rounded-full bg-white p-1 shadow hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700"
                title="Reply"
              >
                ↩️
              </button>
              {isOwn && (
                <button
                  onClick={() => {
                    if (confirm('Delete this message for everyone?')) {
                      deleteMutation.mutate();
                    }
                  }}
                  className="rounded-full bg-white p-1 shadow hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700"
                  title="Delete"
                >
                  🗑️
                </button>
              )}
            </div>
          )}

          {/* Reaction Picker */}
          {showReactions && (
            <div className={`absolute ${isOwn ? 'right-0' : 'left-0'} -top-12 flex gap-1 rounded-full bg-white p-2 shadow-lg dark:bg-gray-800`}>
              {quickReactions.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => reactMutation.mutate(emoji)}
                  className="text-xl hover:scale-125 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reactions Display */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="mt-1 flex gap-1">
            {Object.entries(
              message.reactions.reduce((acc: any, r: any) => {
                acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                return acc;
              }, {})
            ).map(([emoji, count]: [string, any]) => (
              <span
                key={emoji}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-700"
              >
                {emoji} {count}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
