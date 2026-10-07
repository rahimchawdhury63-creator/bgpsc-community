import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/stores/auth';
import { setConversationPasscode, removeConversationPasscode } from './PasscodeLock';

interface GroupChatSettingsProps {
  conversation: any;
  onClose: () => void;
}

export default function GroupChatSettings({ conversation, onClose }: GroupChatSettingsProps) {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'info' | 'members' | 'security'>('info');
  const [groupName, setGroupName] = useState(conversation.title || '');
  const [showPasscodeSetup, setShowPasscodeSetup] = useState(false);
  const [passcode, setPasscode] = useState('');

  const membership = conversation.members?.find((m: any) => m.user_id === profile?.id);
  const isOwner = membership?.role === 'owner';
  const isAdmin = membership?.role === 'admin' || isOwner;

  // Update group name
  const updateNameMutation = useMutation({
    mutationFn: async () => {
      if (!groupName.trim()) throw new Error('Group name required');
      
      await supabase
        .from('conversations')
        .update({ title: groupName })
        .eq('id', conversation.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  // Add member
  const addMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      await supabase.from('conversation_members').insert({
        conversation_id: conversation.id,
        user_id: userId,
        role: 'member',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  // Remove member
  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      await supabase
        .from('conversation_members')
        .delete()
        .eq('conversation_id', conversation.id)
        .eq('user_id', userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  // Leave group
  const leaveMutation = useMutation({
    mutationFn: async () => {
      await supabase
        .from('conversation_members')
        .delete()
        .eq('conversation_id', conversation.id)
        .eq('user_id', profile!.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      onClose();
    },
  });

  // Set passcode
  const setPasscodeMutation = useMutation({
    mutationFn: async () => {
      if (passcode.length < 4) throw new Error('Passcode must be at least 4 digits');
      await setConversationPasscode(conversation.id, passcode);
    },
    onSuccess: () => {
      setShowPasscodeSetup(false);
      setPasscode('');
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  // Remove passcode
  const removePasscodeMutation = useMutation({
    mutationFn: async () => {
      await removeConversationPasscode(conversation.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold">Group Settings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {['info', 'members', 'security'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`flex-1 px-4 py-3 font-medium transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-brand-600 text-brand-600'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Info Tab */}
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div>
                <label className="label">Group Name</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="input mt-1"
                  disabled={!isAdmin}
                />
              </div>

              {isAdmin && (
                <button
                  onClick={() => updateNameMutation.mutate()}
                  className="btn btn-primary"
                  disabled={updateNameMutation.isPending}
                >
                  {updateNameMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              )}

              <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
                <h3 className="font-semibold mb-2">Group Info</h3>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div>Created: {new Date(conversation.created_at).toLocaleDateString()}</div>
                  <div>Members: {conversation.members?.length || 0}</div>
                  <div>Type: {conversation.kind}</div>
                </div>
              </div>
            </div>
          )}

          {/* Members Tab */}
          {activeTab === 'members' && (
            <div className="space-y-4">
              <h3 className="font-semibold">Members ({conversation.members?.length || 0})</h3>
              
              <div className="space-y-2">
                {conversation.members?.map((member: any) => (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={member.profiles?.avatar_url || '/brand/logo.png'}
                        alt=""
                        className="h-10 w-10 rounded-full"
                      />
                      <div>
                        <div className="font-semibold">{member.profiles?.full_name}</div>
                        <div className="text-sm text-gray-500">
                          @{member.profiles?.handle} · {member.role}
                        </div>
                      </div>
                    </div>

                    {isAdmin && member.user_id !== profile?.id && member.role === 'member' && (
                      <button
                        onClick={() => {
                          if (confirm('Remove this member?')) {
                            removeMemberMutation.mutate(member.user_id);
                          }
                        }}
                        className="btn btn-outline text-red-600 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {isAdmin && (
                <button className="btn btn-outline w-full">
                  + Add Members
                </button>
              )}

              <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
                <button
                  onClick={() => {
                    if (confirm('Leave this group?')) {
                      leaveMutation.mutate();
                    }
                  }}
                  className="btn btn-secondary w-full text-red-600"
                >
                  Leave Group
                </button>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              <h3 className="font-semibold">Passcode Lock</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Protect this conversation with a passcode. You'll need to enter it each time you open the chat.
              </p>

              {membership?.lock_hash ? (
                <div className="space-y-2">
                  <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400">
                    ✓ Passcode is set
                  </div>
                  <button
                    onClick={() => removePasscodeMutation.mutate()}
                    className="btn btn-outline w-full"
                  >
                    Remove Passcode
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={() => setShowPasscodeSetup(true)}
                    className="btn btn-primary w-full"
                  >
                    Set Passcode
                  </button>
                </div>
              )}

              {showPasscodeSetup && (
                <div className="rounded-lg border border-gray-200 p-4 space-y-3 dark:border-gray-700">
                  <div>
                    <label className="label">Enter Passcode (4-6 digits)</label>
                    <input
                      type="password"
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="input mt-1 text-center text-2xl tracking-widest"
                      placeholder="••••"
                      maxLength={6}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPasscodeMutation.mutate()}
                      className="btn btn-primary flex-1"
                      disabled={passcode.length < 4}
                    >
                      Set Passcode
                    </button>
                    <button
                      onClick={() => {
                        setShowPasscodeSetup(false);
                        setPasscode('');
                      }}
                      className="btn btn-outline"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
                <h3 className="font-semibold mb-2">Other Security Options</h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" />
                    <span className="text-sm">Disappearing messages (24h)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" />
                    <span className="text-sm">Disable screenshots</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
