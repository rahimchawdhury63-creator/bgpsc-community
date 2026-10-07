import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface PasscodeLockProps {
  conversationId: string;
  lockHash: string;
  onUnlock: () => void;
}

export default function PasscodeLock({ conversationId, lockHash, onUnlock }: PasscodeLockProps) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  // Derive key from passcode using PBKDF2
  const deriveKey = async (passcode: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(passcode);
    
    // Import as raw key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      data,
      'PBKDF2',
      false,
      ['deriveBits']
    );

    // Derive bits using PBKDF2
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: encoder.encode(conversationId), // Use conversation ID as salt
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );

    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(derivedBits));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUnlocking(true);

    try {
      const derivedHash = await deriveKey(passcode);
      
      if (derivedHash === lockHash) {
        onUnlock();
      } else {
        setError('Incorrect passcode');
        setPasscode('');
      }
    } catch (err) {
      setError('Failed to unlock');
      console.error(err);
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="card max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-xl font-bold">Locked Conversation</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Enter passcode to unlock
          </p>
        </div>

        <form onSubmit={handleUnlock} className="space-y-4">
          <div>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter passcode"
              className="input text-center text-2xl tracking-widest"
              maxLength={6}
              autoFocus
            />
          </div>

          {error && (
            <div className="text-center text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={!passcode || unlocking}
          >
            {unlocking ? 'Unlocking...' : 'Unlock'}
          </button>
        </form>

        <p className="text-xs text-center text-gray-500 mt-4">
          Passcode is stored securely using PBKDF2 encryption
        </p>
      </div>
    </div>
  );
}

// Helper function to set passcode for a conversation
export async function setConversationPasscode(
  conversationId: string,
  passcode: string
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(passcode);
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    data,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(conversationId),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const hashArray = Array.from(new Uint8Array(derivedBits));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Update conversation member with lock hash
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) throw new Error('Not authenticated');

  await supabase
    .from('conversation_members')
    .update({ lock_hash: hash })
    .eq('conversation_id', conversationId)
    .eq('user_id', session.session.user.id);

  return hash;
}

// Helper function to remove passcode
export async function removeConversationPasscode(conversationId: string): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) throw new Error('Not authenticated');

  await supabase
    .from('conversation_members')
    .update({ lock_hash: null })
    .eq('conversation_id', conversationId)
    .eq('user_id', session.session.user.id);
}
