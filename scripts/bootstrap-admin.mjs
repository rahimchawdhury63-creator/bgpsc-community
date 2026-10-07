#!/usr/bin/env node
// Bootstrap admin user - idempotent
// Creates the owner admin account if it doesn't exist

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'rrc@bsdc.info.bd';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ADMIN_PASSWORD) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function bootstrap() {
  console.log(`Bootstrapping admin: ${ADMIN_EMAIL}`);

  // Check if user exists
  const { data: users } = await supabase.auth.admin.listUsers();
  const existingUser = users?.users?.find(u => u.email === ADMIN_EMAIL);

  let userId;

  if (existingUser) {
    userId = existingUser.id;
    console.log(`Admin user already exists: ${userId}`);
  } else {
    // Create auth user
    const { data, error } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: 'Rizwan Rahim Chowdhury',
        handle: 'rrc'
      }
    });

    if (error) {
      console.error('Failed to create admin user:', error.message);
      process.exit(1);
    }

    userId = data.user.id;
    console.log(`Created admin user: ${userId}`);
  }

  // Upsert admin profile
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: userId,
    handle: 'rrc',
    full_name: 'Rizwan Rahim Chowdhury',
    email: ADMIN_EMAIL,
    role: 'admin',
    status: 'approved',
    verified: true,
    onboarded: true,
    locale: 'bn',
    bio: 'BGPSC Students Community platform developer. Class 7 student at Shahid Olazar BGB Public School and College, Sylhet.'
  });

  if (profileError) {
    console.error('Failed to upsert admin profile:', profileError.message);
    process.exit(1);
  }

  // Upsert academics for admin (Class 7)
  const { error: academicsError } = await supabase.from('academics').upsert({
    user_id: userId,
    current_class: 7,
    section: 'A',
    roll: 1,
    academic_year: new Date().getFullYear(),
  });

  if (academicsError) {
    console.error('Failed to upsert admin academics:', academicsError.message);
  }

  // Grant founder badge
  const { error: badgeError } = await supabase.from('user_badges').upsert({
    user_id: userId,
    badge_key: 'founder'
  });

  if (badgeError) {
    console.error('Failed to grant founder badge:', badgeError.message);
  }

  // Grant verified badge
  await supabase.from('user_badges').upsert({
    user_id: userId,
    badge_key: 'verified'
  });

  console.log('Admin bootstrap complete');
}

bootstrap().catch(e => {
  console.error(e);
  process.exit(1);
});
