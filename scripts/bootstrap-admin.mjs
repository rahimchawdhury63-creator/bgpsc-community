#!/usr/bin/env node
// Bootstrap admin user - idempotent
// Creates the owner admin account if it doesn't exist

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'rrc@bsdc.info.bd';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Name every missing variable: an opaque "missing environment variables" from a
// CI job tells the operator nothing about which secret to add.
const required = {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  ADMIN_PASSWORD,
};
const missing = Object.entries(required)
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missing.length > 0) {
  console.error(`Missing required environment variable(s): ${missing.join(', ')}`);
  console.error(
    'These come from GitHub repository secrets — see .github/workflows/deploy.yml ' +
      '(bootstrap-admin job).',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/** Page through every auth user rather than trusting the first 50. */
async function findUserByEmail(email) {
  const perPage = 1000;
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const users = data?.users ?? [];
    const match = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (users.length < perPage) return null;
  }
  return null;
}

async function bootstrap() {
  console.log(`Bootstrapping admin: ${ADMIN_EMAIL}`);

  const existingUser = await findUserByEmail(ADMIN_EMAIL);

  let userId;

  if (existingUser) {
    userId = existingUser.id;
    console.log(`Admin user already exists: ${userId}`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: 'Rizwan Rahim Chowdhury',
        handle: 'rrc',
      },
    });

    if (error) {
      console.error('Failed to create admin user:', error.message);
      process.exit(1);
    }

    userId = data.user.id;
    console.log(`Created admin user: ${userId}`);
  }

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
    bio: 'BGPSC Students Community platform developer. Class 7 student at Shahid Olazar BGB Public School and College, Sylhet.',
  });

  if (profileError) {
    console.error('Failed to upsert admin profile:', profileError.message);
    process.exit(1);
  }

  // Everything below is best-effort: a missing optional table should not stop
  // the admin account itself from existing.
  const { error: academicsError } = await supabase.from('academics').upsert({
    user_id: userId,
    current_class: 7,
    section: 'A',
    roll: 1,
    academic_year: new Date().getFullYear(),
  });

  if (academicsError) {
    console.warn('Skipped admin academics:', academicsError.message);
  }

  for (const badgeKey of ['founder', 'verified']) {
    const { error: badgeError } = await supabase.from('user_badges').upsert({
      user_id: userId,
      badge_key: badgeKey,
    });
    if (badgeError) {
      console.warn(`Skipped '${badgeKey}' badge:`, badgeError.message);
    }
  }

  console.log('Admin bootstrap complete');
}

bootstrap().catch((e) => {
  console.error(e);
  process.exit(1);
});
