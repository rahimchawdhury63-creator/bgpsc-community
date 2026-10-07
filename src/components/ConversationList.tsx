import { format, isToday, isYesterday } from 'date-fns';
import { useAuthStore } from '../lib/stores/auth';

interface ConversationListProps {
  conversations: any[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
  const { profile } = useAuthStore();

  const getConversationTitle = (conv: any) => {
    if (conv.title) return conv.title;
    
    if (conv.kind === 'dm') {
      const otherMember = conv.members?.find((m: any) => m.user_id !== profile?.id);
      return otherMember?.profiles?.full_name || 'Unknown';
    }
    
    return 'Group Chat';
  };

  const getConversationAvatar = (conv: any) => {
    if (conv.avatar) return conv.avatar;
    
    if (conv.kind === 'dm') {
      const otherMember = conv.members?.find((m: any) => m.user_id !== profile?.id);
      return otherMember?.profiles?.avatar_url || '/brand/logo.png';
    }
    
    return '/brand/logo.png';
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'h:mm a');
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMM d');
  };

  return (
    <div className="overflow-y-auto h-[calc(100%-5rem)]">
      {conversations.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <div className="text-4xl mb-2">💬</div>
          <p className="text-sm">No conversations yet</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`w-full p-4 text-left transition-colors ${
                selectedId === conv.id
                  ? 'bg-brand-50 dark:bg-brand-900/20'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  {conv.kind === 'group' ? (
                    <div className="h-12 w-12 rounded-full bg-brand-100 flex items-center justify-center text-xl">
                      👥
                    </div>
                  ) : (
                    <img
                      src={getConversationAvatar(conv)}
                      alt=""
                      className="h-12 w-12 rounded-full"
                    />
                  )}
                  {conv.membership?.pinned && (
                    <span className="absolute -top-1 -right-1 text-xs">📌</span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold truncate">
                      {getConversationTitle(conv)}
                      {conv.kind === 'group' && (
                        <span className="ml-1 text-xs text-gray-500">
                          ({conv.members?.length || 0})
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 flex-shrink-0">
                      {formatTime(conv.last_message_at)}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                      {conv.preview || 'No messages yet'}
                    </div>
                    {conv.membership?.unread_count > 0 && (
                      <span className="flex-shrink-0 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-bold text-white">
                        {conv.membership.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
