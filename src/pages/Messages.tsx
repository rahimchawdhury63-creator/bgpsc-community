import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/stores/auth';
import { useI18nStore } from '../lib/stores/i18n';
import type { Conversation, Message, Profile } from '../types/database';
import { format, isToday, isYesterday } from 'date-fns';
import { bn, enUS } from 'date-fns/locale';
import MessageBubble from '../components/MessageBubble';
import MessageInput from '../components/MessageInput';
import ConversationList from '../components/ConversationList';
import PasscodeLock from '../components/PasscodeLock';
import GroupChatSettings from '../components/GroupChatSettings';

export default function Messages() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();
  const { t, locale } = useI18nStore();
  
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);

  // Fetch conversations
  const { data: conversations } = useQuery({
    queryKey: ['conversations', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      
      const { data: memberships } = await supabase
        .from('conversation_members')
        .select(`
          *,
          conversations (
            *,
            members:conversation_members (
              user_id,
              role,
              profiles (id, handle, full_name, avatar_url)
            )
          )
        `)
        .eq('user_id', profile.id)
        .order('conversations(last_message_at)', { ascending: false });

      return memberships?.map(m => ({
        ...m.conversations,
        membership: m,
      })) || [];
    },
    enabled: !!profile,
  });

  // Fetch messages for selected conversation
  const { data: messages } = useQuery({
    queryKey: ['messages', selectedConvId],
    queryFn: async () => {
      if (!selectedConvId) return [];
      
      const { data } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!sender_id (id, handle, full_name, avatar_url),
          reply_to:messages!reply_to_id (*)
        `)
        .eq('conversation_id', selectedConvId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(100);

      return data as (Message & { sender: Profile; reply_to?: Message })[];
    },
    enabled: !!selectedConvId,
  });

  // Real-time message subscription
  useEffect(() => {
    if (!selectedConvId) return;

    const channel = supabase
      .channel(`messages:${selectedConvId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConvId}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['messages', selectedConvId] });
          
          // Auto-scroll to bottom if not scrolled up
          if (!isScrolledUp) {
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConvId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['messages', selectedConvId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConvId, isScrolledUp, queryClient]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages && !isScrolledUp) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isScrolledUp]);

  // Track scroll position
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setIsScrolledUp(!isNearBottom);
  };

  // Send message
  const sendMessageMutation = useMutation({
    mutationFn: async ({ body, attachment }: { body: string; attachment?: any }) => {
      if (!selectedConvId || !profile) throw new Error('No conversation selected');

      const { data, error } = await supabase.rpc('send_message', {
        p_conv_id: selectedConvId,
        p_body: body,
        p_reply_to_id: replyTo?.id || null,
        p_attachment: attachment || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setReplyTo(null);
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConvId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  // Mark conversation as read
  const markReadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedConvId) return;
      await supabase.rpc('mark_conversation_read', { p_conv_id: selectedConvId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  // Mark as read when conversation is selected
  useEffect(() => {
    if (selectedConvId) {
      markReadMutation.mutate();
    }
  }, [selectedConvId]);

  // Filter messages by search
  const filteredMessages = messages?.filter(msg => {
    if (!searchQuery) return true;
    return msg.body_text?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Group messages by date
  const groupedMessages = filteredMessages?.reduce((groups: any[], msg) => {
    const date = new Date(msg.created_at);
    const dateKey = format(date, 'yyyy-MM-dd');
    
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.date === dateKey) {
      lastGroup.messages.push(msg);
    } else {
      groups.push({ date: dateKey, messages: [msg] });
    }
    
    return groups;
  }, []);

  const selectedConv = conversations?.find(c => c.id === selectedConvId);
  const isLocked = selectedConv?.membership?.lock_hash != null;

  if (!profile) return null;

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Conversation List */}
      <div className="w-80 flex-shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 p-4 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">{t('messages.title')}</h2>
            <button
              onClick={() => setShowNewChat(true)}
              className="btn btn-primary text-sm"
            >
              + New
            </button>
          </div>
          <input
            type="search"
            placeholder="Search conversations..."
            className="input text-sm"
          />
        </div>
        
        <ConversationList
          conversations={conversations || []}
          selectedId={selectedConvId}
          onSelect={setSelectedConvId}
        />
      </div>

      {/* Message Area */}
      <div className="flex flex-1 flex-col rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {selectedConv ? (
          <>
            {/* Header */}
            <div className="border-b border-gray-200 p-4 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {selectedConv.kind === 'group' ? (
                    <div className="h-10 w-10 rounded-full bg-brand-100 flex items-center justify-center">
                      👥
                    </div>
                  ) : (
                    <img
                      src={selectedConv.members?.[1]?.profiles?.avatar_url || '/brand/logo.png'}
                      alt=""
                      className="h-10 w-10 rounded-full"
                    />
                  )}
                  <div>
                    <div className="font-semibold">
                      {selectedConv.title || selectedConv.members?.[1]?.profiles?.full_name || 'Conversation'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {selectedConv.kind === 'group' 
                        ? `${selectedConv.members?.length || 0} members`
                        : 'Direct message'
                      }
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setSearchQuery(searchQuery ? '' : 'search')}
                    className="btn btn-outline text-sm"
                  >
                    🔍
                  </button>
                  {selectedConv.kind === 'group' && (
                    <button
                      onClick={() => setShowGroupSettings(true)}
                      className="btn btn-outline text-sm"
                    >
                      ⚙️
                    </button>
                  )}
                </div>
              </div>
              
              {searchQuery && (
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search in conversation..."
                  className="input mt-3 text-sm"
                  autoFocus
                />
              )}
            </div>

            {/* Passcode Lock Check */}
            {isLocked ? (
              <PasscodeLock
                conversationId={selectedConvId}
                lockHash={selectedConv.membership.lock_hash}
                onUnlock={() => {
                  // Unlock logic handled by PasscodeLock component
                }}
              />
            ) : (
              <>
                {/* Messages */}
                <div
                  ref={scrollContainerRef}
                  onScroll={handleScroll}
                  className="flex-1 overflow-y-auto p-4 space-y-4"
                >
                  {groupedMessages?.map((group) => (
                    <div key={group.date}>
                      {/* Date Separator */}
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                        <span className="text-xs text-gray-500">
                          {isToday(new Date(group.date))
                            ? 'Today'
                            : isYesterday(new Date(group.date))
                            ? 'Yesterday'
                            : format(new Date(group.date), 'MMM d, yyyy', { locale: locale === 'bn' ? bn : enUS })}
                        </span>
                        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                      </div>

                      {/* Messages */}
                      {group.messages.map((msg, idx) => (
                        <MessageBubble
                          key={msg.id}
                          message={msg}
                          isOwn={msg.sender_id === profile.id}
                          showAvatar={idx === 0 || group.messages[idx - 1].sender_id !== msg.sender_id}
                          onReply={() => setReplyTo(msg)}
                        />
                      ))}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* New Messages Pill */}
                {isScrolledUp && (
                  <div className="absolute bottom-24 left-1/2 -translate-x-1/2">
                    <button
                      onClick={() => {
                        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                        setIsScrolledUp(false);
                      }}
                      className="btn btn-primary text-sm shadow-lg"
                    >
                      ↓ New messages
                    </button>
                  </div>
                )}

                {/* Reply Preview */}
                {replyTo && (
                  <div className="border-t border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
                    <div className="flex items-center justify-between">
                      <div className="text-sm">
                        <span className="font-semibold">Replying to {replyTo.sender?.full_name}</span>
                        <div className="text-gray-500 truncate max-w-md">{replyTo.body_text}</div>
                      </div>
                      <button
                        onClick={() => setReplyTo(null)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}

                {/* Message Input */}
                <MessageInput
                  onSend={(body, attachment) => sendMessageMutation.mutate({ body, attachment })}
                  disabled={sendMessageMutation.isPending}
                />
              </>
            )}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="text-6xl mb-4">💬</div>
              <p>Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onCreate={(convId) => {
            setShowNewChat(false);
            setSelectedConvId(convId);
          }}
        />
      )}

      {/* Group Settings Modal */}
      {showGroupSettings && selectedConv && (
        <GroupChatSettings
          conversation={selectedConv}
          onClose={() => setShowGroupSettings(false)}
        />
      )}
    </div>
  );
}

// New Chat Modal
function NewChatModal({ onClose, onCreate }: { onClose: () => void; onCreate: (convId: string) => void }) {
  const { profile } = useAuthStore();
  const [mode, setMode] = useState<'dm' | 'group'>('dm');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');

  const { data: users } = useQuery({
    queryKey: ['users-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      
      const { data } = await supabase
        .from('profiles')
        .select('id, handle, full_name, avatar_url')
        .eq('status', 'approved')
        .neq('id', profile?.id)
        .ilike('full_name', `%${searchQuery}%`)
        .limit(10);

      return data || [];
    },
  });

  const createDMMutation = useMutation({
    mutationFn: async () => {
      if (selectedUsers.length !== 1) throw new Error('Select exactly one user');
      
      const { data, error } = await supabase.rpc('get_or_create_dm', {
        p_other_user_id: selectedUsers[0],
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (convId) => {
      onCreate(convId);
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async () => {
      if (selectedUsers.length < 2) throw new Error('Select at least 2 users');
      if (!groupName.trim()) throw new Error('Group name required');

      // Create conversation
      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .insert({
          kind: 'group',
          title: groupName,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add members
      const members = [
        { conversation_id: conv.id, user_id: profile!.id, role: 'owner' as const },
        ...selectedUsers.map(uid => ({
          conversation_id: conv.id,
          user_id: uid,
          role: 'member' as const,
        })),
      ];

      const { error: membersError } = await supabase.from('conversation_members').insert(members);
      if (membersError) throw membersError;

      return conv.id;
    },
    onSuccess: (convId) => {
      onCreate(convId);
    },
  });

  const toggleUser = (userId: string) => {
    if (mode === 'dm') {
      setSelectedUsers([userId]);
    } else {
      setSelectedUsers(prev =>
        prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card max-w-md w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">New Conversation</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('dm')}
            className={`flex-1 btn ${mode === 'dm' ? 'btn-primary' : 'btn-outline'}`}
          >
            Direct Message
          </button>
          <button
            onClick={() => setMode('group')}
            className={`flex-1 btn ${mode === 'group' ? 'btn-primary' : 'btn-outline'}`}
          >
            Group Chat
          </button>
        </div>

        {/* Group Name */}
        {mode === 'group' && (
          <div className="mb-4">
            <label className="label">Group Name</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="input mt-1"
              placeholder="Enter group name"
            />
          </div>
        )}

        {/* Search Users */}
        <div className="mb-4">
          <label className="label">Search Users</label>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input mt-1"
            placeholder="Search by name..."
          />
        </div>

        {/* User List */}
        <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
          {users?.map(user => (
            <button
              key={user.id}
              onClick={() => toggleUser(user.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                selectedUsers.includes(user.id)
                  ? 'bg-brand-50 dark:bg-brand-900/20'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <img
                src={user.avatar_url || '/brand/logo.png'}
                alt=""
                className="h-10 w-10 rounded-full"
              />
              <div className="flex-1 text-left">
                <div className="font-semibold">{user.full_name}</div>
                <div className="text-sm text-gray-500">@{user.handle}</div>
              </div>
              {selectedUsers.includes(user.id) && (
                <span className="text-brand-600">✓</span>
              )}
            </button>
          ))}
        </div>

        {/* Selected Count */}
        {mode === 'group' && (
          <div className="text-sm text-gray-500 mb-4">
            {selectedUsers.length} users selected (min 2)
          </div>
        )}

        {/* Create Button */}
        <button
          onClick={() => (mode === 'dm' ? createDMMutation.mutate() : createGroupMutation.mutate())}
          className="btn btn-primary w-full"
          disabled={
            (mode === 'dm' && selectedUsers.length !== 1) ||
            (mode === 'group' && (selectedUsers.length < 2 || !groupName.trim())) ||
            createDMMutation.isPending ||
            createGroupMutation.isPending
          }
        >
          {mode === 'dm' ? 'Start Conversation' : 'Create Group'}
        </button>
      </div>
    </div>
  );
}
