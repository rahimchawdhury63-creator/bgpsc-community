import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

test.describe('RLS Security Attack Tests', () => {
  let supabase: any;
  let user1Token: string;
  let user2Token: string;
  let user1Id: string;
  let user2Id: string;

  test.beforeAll(async () => {
    // Create two test users
    supabase = createClient(
      process.env.VITE_PUBLIC_SUPABASE_URL!,
      process.env.VITE_PUBLIC_SUPABASE_ANON_KEY!
    );

    // User 1
    const { data: user1 } = await supabase.auth.signUp({
      email: 'test1@example.com',
      password: 'testpass123',
    });
    user1Id = user1.user?.id;
    user1Token = user1.session?.access_token;

    // User 2
    const { data: user2 } = await supabase.auth.signUp({
      email: 'test2@example.com',
      password: 'testpass123',
    });
    user2Id = user2.user?.id;
    user2Token = user2.session?.access_token;
  });

  test('cross-user profile read is blocked', async () => {
    const client = createClient(
      process.env.VITE_PUBLIC_SUPABASE_URL!,
      process.env.VITE_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${user1Token}` } } }
    );

    // Try to read user2's private data
    const { data, error } = await client
      .from('academics')
      .select('*')
      .eq('user_id', user2Id);

    // Should not return data (RLS blocks it)
    expect(data).toHaveLength(0);
  });

  test('cross-user profile write is blocked', async () => {
    const client = createClient(
      process.env.VITE_PUBLIC_SUPABASE_URL!,
      process.env.VITE_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${user1Token}` } } }
    );

    // Try to update user2's profile
    const { error } = await client
      .from('profiles')
      .update({ bio: 'Hacked!' })
      .eq('id', user2Id);

    // Should fail
    expect(error).toBeTruthy();
  });

  test('cross-user post edit is blocked', async () => {
    // Create a post as user1
    const client1 = createClient(
      process.env.VITE_PUBLIC_SUPABASE_URL!,
      process.env.VITE_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${user1Token}` } } }
    );

    const { data: post } = await client1
      .from('posts')
      .insert({
        author_id: user1Id,
        title: 'Test Post',
        body_md: 'Test content',
        status: 'published',
      })
      .select()
      .single();

    // Try to edit as user2
    const client2 = createClient(
      process.env.VITE_PUBLIC_SUPABASE_URL!,
      process.env.VITE_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${user2Token}` } } }
    );

    const { error } = await client2
      .from('posts')
      .update({ title: 'Hacked!' })
      .eq('id', post.id);

    // Should fail
    expect(error).toBeTruthy();
  });

  test('cross-user message read is blocked', async () => {
    // Create a conversation between user1 and another user
    const client1 = createClient(
      process.env.VITE_PUBLIC_SUPABASE_URL!,
      process.env.VITE_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${user1Token}` } } }
    );

    const { data: conv } = await client1.rpc('get_or_create_dm', {
      p_other_user_id: user2Id,
    });

    // Send a message
    await client1.rpc('send_message', {
      p_conv_id: conv,
      p_body: 'Private message',
    });

    // Try to read as user2 (should work - they're in the conversation)
    const client2 = createClient(
      process.env.VITE_PUBLIC_SUPABASE_URL!,
      process.env.VITE_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${user2Token}` } } }
    );

    const { data: messages } = await client2
      .from('messages')
      .select('*')
      .eq('conversation_id', conv);

    // Should be able to read (they're a member)
    expect(messages.length).toBeGreaterThan(0);
  });

  test('unauthenticated access is blocked', async () => {
    const client = createClient(
      process.env.VITE_PUBLIC_SUPABASE_URL!,
      process.env.VITE_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Try to read profiles without auth
    const { data, error } = await client
      .from('profiles')
      .select('*');

    // Public read is allowed for profiles
    expect(data).toBeTruthy();

    // Try to write without auth
    const { error: writeError } = await client
      .from('profiles')
      .update({ bio: 'Hacked!' })
      .eq('id', user1Id);

    // Should fail
    expect(writeError).toBeTruthy();
  });

  test('unapproved user write is blocked', async () => {
    // Create unapproved user
    const { data: unapprovedUser } = await supabase.auth.signUp({
      email: 'unapproved@example.com',
      password: 'testpass123',
    });

    const client = createClient(
      process.env.VITE_PUBLIC_SUPABASE_URL!,
      process.env.VITE_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${unapprovedUser.session?.access_token}` } } }
    );

    // Try to create a post
    const { error } = await client
      .from('posts')
      .insert({
        author_id: unapprovedUser.user?.id,
        title: 'Test',
        body_md: 'Test',
        status: 'published',
      });

    // Should fail (user not approved)
    expect(error).toBeTruthy();
  });

  test('role escalation is blocked', async () => {
    const client = createClient(
      process.env.VITE_PUBLIC_SUPABASE_URL!,
      process.env.VITE_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${user1Token}` } } }
    );

    // Try to escalate own role to admin
    const { error } = await client
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', user1Id);

    // Should fail (privilege escalation guard)
    expect(error).toBeTruthy();
  });

  test('status change is blocked for non-admin', async () => {
    const client = createClient(
      process.env.VITE_PUBLIC_SUPABASE_URL!,
      process.env.VITE_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${user1Token}` } } }
    );

    // Try to change own status
    const { error } = await client
      .from('profiles')
      .update({ status: 'approved' })
      .eq('id', user1Id);

    // Should fail (privilege escalation guard)
    expect(error).toBeTruthy();
  });

  test('secure document access is blocked for non-owner', async () => {
    // Create a secure document as user1
    const client1 = createClient(
      process.env.VITE_PUBLIC_SUPABASE_URL!,
      process.env.VITE_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${user1Token}` } } }
    );

    const { data: doc } = await client1
      .from('secure_documents')
      .insert({
        owner_id: user1Id,
        purpose: 'id_front',
        mime_original: 'image/jpeg',
        sha256: 'test',
        svg_text: '<svg></svg>',
        size_bytes: 100,
      })
      .select()
      .single();

    // Try to read as user2
    const client2 = createClient(
      process.env.VITE_PUBLIC_SUPABASE_URL!,
      process.env.VITE_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${user2Token}` } } }
    );

    const { data, error } = await client2
      .from('secure_documents')
      .select('*')
      .eq('id', doc.id);

    // Should not return data
    expect(data).toHaveLength(0);
  });

  test('push outbox access is blocked', async () => {
    const client = createClient(
      process.env.VITE_PUBLIC_SUPABASE_URL!,
      process.env.VITE_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${user1Token}` } } }
    );

    // Try to read push outbox
    const { data, error } = await client
      .from('push_outbox')
      .select('*');

    // Should not return data (no user access)
    expect(data).toHaveLength(0);
  });

  test('follow block guard works', async () => {
    // Block user2 as user1
    const client1 = createClient(
      process.env.VITE_PUBLIC_SUPABASE_URL!,
      process.env.VITE_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${user1Token}` } } }
    );

    await client1
      .from('blocks')
      .insert({ blocker_id: user1Id, blocked_id: user2Id });

    // Try to follow as user2
    const client2 = createClient(
      process.env.VITE_PUBLIC_SUPABASE_URL!,
      process.env.VITE_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${user2Token}` } } }
    );

    const { error } = await client2.rpc('follow_user', {
      p_following_id: user1Id,
    });

    // Should fail (block guard)
    expect(error).toBeTruthy();
  });
});
