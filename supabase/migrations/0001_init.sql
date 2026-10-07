-- Migration: 0001_init.sql
-- BGPSC Students Community - Initial Schema
-- Created: 2026-10-07

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE user_role AS ENUM ('student', 'teacher', 'alumni', 'guardian', 'admin');
CREATE TYPE app_status AS ENUM ('pending', 'under_review', 'approved', 'rejected');
CREATE TYPE post_type AS ENUM ('post', 'notice', 'question', 'event', 'achievement', 'resource');
CREATE TYPE post_status AS ENUM ('published', 'hidden', 'deleted');
CREATE TYPE notification_type AS ENUM (
  'approval_update', 'new_follower', 'like', 'comment', 'reply', 'mention',
  'message', 'message_request', 'notice', 'system', 'promotion',
  'report_update', 'badge', 'year_update'
);
CREATE TYPE report_status AS ENUM ('open', 'reviewing', 'resolved', 'dismissed');
CREATE TYPE conv_kind AS ENUM ('dm', 'group');
CREATE TYPE member_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE outbox_status AS ENUM ('pending', 'sent', 'failed');
CREATE TYPE child_link_status AS ENUM ('pending', 'approved', 'rejected');

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle CITEXT UNIQUE NOT NULL CHECK (handle ~ '^[a-z0-9_]{3,20}$'),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  status app_status NOT NULL DEFAULT 'pending',
  avatar_url TEXT,
  banner_url TEXT,
  bio TEXT CHECK (char_length(bio) <= 500),
  website_url TEXT,
  location_text TEXT,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  location_consent BOOLEAN DEFAULT FALSE,
  notif_consent BOOLEAN DEFAULT TRUE,
  theme_accent TEXT DEFAULT '#800060',
  pronouns TEXT,
  verified BOOLEAN DEFAULT FALSE,
  onboarded BOOLEAN DEFAULT FALSE,
  interests TEXT[] DEFAULT '{}',
  show_dwell BOOLEAN DEFAULT TRUE,
  locale TEXT DEFAULT 'bn',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  fts TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(full_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(handle, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(bio, '')), 'B')
  ) STORED
);

CREATE INDEX idx_profiles_fts ON profiles USING GIN(fts);
CREATE INDEX idx_profiles_handle_trgm ON profiles USING GIN(handle gin_trgm_ops);
CREATE INDEX idx_profiles_status ON profiles(status) WHERE status = 'approved';
CREATE INDEX idx_profiles_role ON profiles(role);

-- Reserved handles
CREATE TABLE reserved_handles (
  handle CITEXT PRIMARY KEY
);

INSERT INTO reserved_handles (handle) VALUES
  ('admin'), ('api'), ('assets'), ('brand'), ('login'), ('register'), ('logout'),
  ('messages'), ('m'), ('notifications'), ('settings'), ('search'), ('s'), ('post'),
  ('p'), ('c'), ('about'), ('help'), ('privacy'), ('terms'), ('sitemap'), ('rss'),
  ('feed'), ('trending'), ('u'), ('profile'), ('me'), ('new'), ('edit'), ('delete'),
  ('official'), ('bgpsc'), ('support'), ('mod'), ('moderator'), ('teacher'),
  ('student'), ('guardian'), ('alumni'), ('system'), ('null'), ('undefined'),
  ('www'), ('mail'), ('email'), ('security');

-- Academics (student-specific)
CREATE TABLE academics (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  current_class INTEGER NOT NULL CHECK (current_class BETWEEN 1 AND 12),
  section TEXT,
  roll INTEGER,
  academic_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
  nid_or_brc TEXT CHECK (nid_or_brc ~ '^[0-9]{10,17}$'),
  dob DATE,
  needs_year_update BOOLEAN DEFAULT FALSE,
  graduated BOOLEAN DEFAULT FALSE,
  history JSONB DEFAULT '[]'
);

CREATE INDEX idx_academics_class ON academics(current_class, section);
CREATE INDEX idx_academics_year ON academics(academic_year);

-- Public academics view
CREATE VIEW public_academics AS
SELECT 
  user_id,
  current_class,
  section,
  roll,
  academic_year,
  graduated
FROM academics;

-- Teacher info
CREATE TABLE teacher_info (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  experience_years INTEGER DEFAULT 0,
  teaches JSONB DEFAULT '[]',
  department TEXT
);

-- Alumni info
CREATE TABLE alumni_info (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  current_institution TEXT,
  current_class TEXT,
  old_class INTEGER,
  old_section TEXT,
  old_roll INTEGER,
  passing_year INTEGER CHECK (passing_year >= 1993),
  notes TEXT
);

-- Guardian info
CREATE TABLE guardian_info (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  phone TEXT CHECK (phone ~ '^\+8801[3-9][0-9]{8}$'),
  relationship TEXT NOT NULL,
  occupation TEXT
);

-- Guardian children links
CREATE TABLE guardian_children (
  guardian_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  child_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status child_link_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (guardian_id, child_id)
);

CREATE INDEX idx_guardian_children_child ON guardian_children(child_id);

-- Class sections
CREATE TABLE class_sections (
  academic_year INTEGER NOT NULL,
  class_no INTEGER NOT NULL CHECK (class_no BETWEEN 3 AND 12),
  section TEXT NOT NULL,
  PRIMARY KEY (academic_year, class_no, section)
);

-- Seed 2026 class sections
INSERT INTO class_sections (academic_year, class_no, section)
SELECT 2026, class_no, section
FROM generate_series(3, 12) AS class_no
CROSS JOIN unnest(ARRAY['A', 'B', 'C', 'D']) AS section;

-- Registration applications
CREATE TABLE registration_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role user_role NOT NULL,
  payload JSONB NOT NULL,
  status app_status NOT NULL DEFAULT 'pending',
  attempt INTEGER DEFAULT 1,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason TEXT CHECK (status != 'rejected' OR char_length(reason) >= 10)
);

CREATE INDEX idx_applications_status ON registration_applications(status);
CREATE INDEX idx_applications_submitted ON registration_applications(submitted_at DESC);

-- Approval events
CREATE TABLE approval_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES registration_applications(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  note TEXT,
  ts TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_approval_events_app ON approval_events(application_id);

-- Secure documents (immutable vault)
CREATE TABLE secure_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('id_front', 'id_back', 'teacher_id', 'nid', 'birth_cert', 'other')),
  mime_original TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  svg_text TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_secure_documents_owner ON secure_documents(owner_id);

-- Follows
CREATE TABLE follows (
  follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);

CREATE INDEX idx_follows_following ON follows(following_id);

-- Blocks
CREATE TABLE blocks (
  blocker_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);

-- Muted users
CREATE TABLE muted_users (
  muter_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  muted_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (muter_id, muted_id)
);

-- Hidden posts
CREATE TABLE hidden_posts (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

-- Posts
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type post_type NOT NULL DEFAULT 'post',
  title TEXT,
  body_md TEXT,
  body_text TEXT,
  slug TEXT UNIQUE CHECK (slug ~ '^[a-z0-9-]{3,120}$'),
  class_tag INTEGER,
  section_tag TEXT,
  location TEXT,
  language TEXT DEFAULT 'bn',
  comments_enabled BOOLEAN DEFAULT TRUE,
  sensitive BOOLEAN DEFAULT FALSE,
  pinned BOOLEAN DEFAULT FALSE,
  status post_status NOT NULL DEFAULT 'published',
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  impressions_count INTEGER DEFAULT 0,
  hashtags TEXT[] DEFAULT '{}',
  mentions UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ DEFAULT NOW(),
  fts TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(body_text, '')), 'B')
  ) STORED
);

CREATE INDEX idx_posts_fts ON posts USING GIN(fts);
CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_status_published ON posts(created_at DESC) WHERE status = 'published';
CREATE INDEX idx_posts_class ON posts(class_tag) WHERE class_tag IS NOT NULL;
CREATE INDEX idx_posts_type ON posts(type);
CREATE INDEX idx_posts_slug ON posts(slug);

-- Post images
CREATE TABLE post_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  alt TEXT,
  caption TEXT,
  position INTEGER DEFAULT 0,
  sha256 TEXT
);

CREATE INDEX idx_post_images_post ON post_images(post_id);

-- Post links
CREATE TABLE post_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  host TEXT,
  kind TEXT,
  title TEXT,
  description TEXT,
  image_url TEXT,
  site_name TEXT
);

CREATE INDEX idx_post_links_post ON post_links(post_id);

-- Likes
CREATE TABLE likes (
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX idx_likes_user ON likes(user_id);

-- Bookmarks
CREATE TABLE bookmark_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bookmarks (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES bookmark_folders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX idx_bookmarks_user ON bookmarks(user_id);

-- Shares
CREATE TABLE shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  channel TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Post daily stats
CREATE TABLE post_daily_stats (
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  views INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  dwell_ms BIGINT DEFAULT 0,
  PRIMARY KEY (post_id, day)
);

-- Comments (10 levels of nesting)
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  depth INTEGER NOT NULL CHECK (depth BETWEEN 0 AND 9),
  path TEXT NOT NULL,
  body_md TEXT NOT NULL,
  body_text TEXT,
  images JSONB DEFAULT '[]',
  likes_count INTEGER DEFAULT 0,
  status post_status NOT NULL DEFAULT 'published',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  fts TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(body_text, ''))
  ) STORED
);

CREATE INDEX idx_comments_fts ON comments USING GIN(fts);
CREATE INDEX idx_comments_post ON comments(post_id, created_at);
CREATE INDEX idx_comments_parent ON comments(parent_id);
CREATE INDEX idx_comments_author ON comments(author_id);
CREATE INDEX idx_comments_path ON comments(path);

-- Comment likes
CREATE TABLE comment_likes (
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (comment_id, user_id)
);

-- User events (for ranking)
CREATE TABLE user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  weight DECIMAL(5, 2) DEFAULT 1.0,
  dwell_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_events_user ON user_events(user_id, created_at DESC);
CREATE INDEX idx_user_events_target ON user_events(target_type, target_id);

-- Messenger: Conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind conv_kind NOT NULL DEFAULT 'dm',
  title TEXT,
  avatar TEXT,
  last_message_at TIMESTAMPTZ,
  preview TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_last ON conversations(last_message_at DESC);

-- Conversation members
CREATE TABLE conversation_members (
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role member_role NOT NULL DEFAULT 'member',
  muted_until TIMESTAMPTZ,
  archived BOOLEAN DEFAULT FALSE,
  pinned BOOLEAN DEFAULT FALSE,
  lock_hash TEXT,
  wallpaper TEXT,
  unread_count INTEGER DEFAULT 0,
  last_read_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX idx_conv_members_user ON conversation_members(user_id);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  body_md TEXT,
  body_text TEXT,
  reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  attachment JSONB,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);

-- Message reactions
CREATE TABLE message_reactions (
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id, emoji)
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  body_text TEXT NOT NULL,
  link TEXT,
  payload JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;

-- Notification preferences
CREATE TABLE notification_prefs (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  prefs JSONB DEFAULT '{}',
  quiet_start TIME,
  quiet_end TIME,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Push subscriptions
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  ua TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);

-- FCM tokens
CREATE TABLE fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fcm_tokens_user ON fcm_tokens(user_id);

-- Push outbox
CREATE TABLE push_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  tag TEXT,
  status outbox_status NOT NULL DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX idx_push_outbox_pending ON push_outbox(status, created_at) WHERE status = 'pending';

-- Reports
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status report_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX idx_reports_status ON reports(status);

-- Moderation actions
CREATE TABLE moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  before JSONB,
  after JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- Admin settings
CREATE TABLE admin_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feature flags
CREATE TABLE feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Algorithm weights
CREATE TABLE algorithm_weights (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  w_dwell DECIMAL(5, 3) DEFAULT 0.350,
  w_comment DECIMAL(5, 3) DEFAULT 0.200,
  w_share DECIMAL(5, 3) DEFAULT 0.300,
  w_hide DECIMAL(5, 3) DEFAULT 0.100,
  w_report DECIMAL(5, 3) DEFAULT 0.050,
  simple_weights JSONB DEFAULT '{}',
  exploration_rate DECIMAL(5, 3) DEFAULT 0.070,
  decay_tau_hours DECIMAL(5, 1) DEFAULT 36.0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO algorithm_weights (id, simple_weights) VALUES (1, '{
  "class_section": 3.0,
  "class": 2.0,
  "section": 1.5,
  "location": 1.2,
  "interaction": 2.0,
  "interest": 1.6
}');

-- Banned words
CREATE TABLE banned_words (
  word TEXT PRIMARY KEY,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link rules
CREATE TABLE link_rules (
  host TEXT PRIMARY KEY,
  rule TEXT NOT NULL CHECK (rule IN ('allow', 'block')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Redirects
CREATE TABLE redirects (
  from_path TEXT PRIMARY KEY,
  to_path TEXT NOT NULL,
  code INTEGER NOT NULL DEFAULT 301 CHECK (code IN (301, 302))
);

-- SEO overrides
CREATE TABLE seo_overrides (
  path TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  canonical TEXT,
  noindex BOOLEAN DEFAULT FALSE,
  jsonld JSONB
);

-- Post embeddings (for advanced ranking)
CREATE TABLE post_embeddings (
  post_id UUID PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  vec vector(256)
);

CREATE INDEX idx_post_embeddings_vec ON post_embeddings USING hnsw (vec vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- User embeddings
CREATE TABLE user_embeddings (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  vec vector(256)
);

CREATE INDEX idx_user_embeddings_vec ON user_embeddings USING hnsw (vec vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- Clusters (SimClusters-lite)
CREATE TABLE clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  centroid vector(256),
  member_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cluster members
CREATE TABLE cluster_members (
  cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  score DECIMAL(5, 3),
  PRIMARY KEY (cluster_id, user_id)
);

-- Academic year jobs
CREATE TABLE academic_year_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  status TEXT NOT NULL,
  affected INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Search logs
CREATE TABLE search_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  results_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_search_logs_query ON search_logs USING GIN(query gin_trgm_ops);

-- Page stats
CREATE TABLE page_stats (
  day DATE NOT NULL,
  path TEXT NOT NULL,
  views INTEGER DEFAULT 0,
  PRIMARY KEY (day, path)
);

-- Error events
CREATE TABLE error_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  stack TEXT,
  url TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_error_events_created ON error_events(created_at DESC);

-- Heartbeats
CREATE TABLE heartbeats (
  key TEXT PRIMARY KEY,
  at TIMESTAMPTZ DEFAULT NOW(),
  meta JSONB
);

-- i18n strings
CREATE TABLE i18n_strings (
  key TEXT PRIMARY KEY,
  bn TEXT NOT NULL,
  en TEXT NOT NULL
);

-- Push templates
CREATE TABLE push_templates (
  key TEXT PRIMARY KEY,
  title_bn TEXT NOT NULL,
  title_en TEXT NOT NULL,
  body_bn TEXT NOT NULL,
  body_en TEXT NOT NULL,
  link_pattern TEXT
);

-- Seed push templates for all notification types
INSERT INTO push_templates (key, title_bn, title_en, body_bn, body_en, link_pattern) VALUES
  ('approval_update', 'আবেদন আপডেট', 'Application Update', 'আপনার আবেদন {{status}} হয়েছে', 'Your application has been {{status}}', '/status'),
  ('new_follower', 'নতুন অনুসরণকারী', 'New Follower', '{{actor}} আপনাকে অনুসরণ করছেন', '{{actor}} started following you', '/@{{actor_handle}}'),
  ('like', 'নতুন লাইক', 'New Like', '{{actor}} আপনার পোস্ট পছন্দ করেছেন', '{{actor}} liked your post', '/post/{{slug}}'),
  ('comment', 'নতুন মন্তব্য', 'New Comment', '{{actor}} আপনার পোস্টে মন্তব্য করেছেন', '{{actor}} commented on your post', '/post/{{slug}}'),
  ('reply', 'নতুন উত্তর', 'New Reply', '{{actor}} আপনার মন্তব্যের উত্তর দিয়েছেন', '{{actor}} replied to your comment', '/post/{{slug}}'),
  ('mention', 'উল্লেখ', 'Mention', '{{actor}} আপনাকে উল্লেখ করেছেন', '{{actor}} mentioned you', '/post/{{slug}}'),
  ('message', 'নতুন বার্তা', 'New Message', '{{actor}} আপনাকে বার্তা পাঠিয়েছেন', '{{actor}} sent you a message', '/messages/{{conversation_id}}'),
  ('message_request', 'বার্তা অনুরোধ', 'Message Request', 'আপনার একটি নতুন বার্তা অনুরোধ আছে', 'You have a new message request', '/messages/requests'),
  ('notice', 'বিজ্ঞপ্তি', 'Notice', 'নতুন বিজ্ঞপ্তি প্রকাশিত হয়েছে', 'New notice published', '/post/{{slug}}'),
  ('system', 'সিস্টেম', 'System', '{{message}}', '{{message}}', '{{link}}'),
  ('promotion', 'শ্রেণী উন্নয়ন', 'Class Promotion', 'নতুন বছরে আপনার শ্রেণী আপডেট হয়েছে', 'Your class has been updated for the new year', '/settings'),
  ('report_update', 'রিপোর্ট আপডেট', 'Report Update', 'আপনার রিপোর্ট {{status}} হয়েছে', 'Your report has been {{status}}', '/settings'),
  ('badge', 'ব্যাজ অর্জন', 'Badge Earned', 'আপনি {{badge}} ব্যাজ অর্জন করেছেন', 'You earned the {{badge}} badge', '/@{{handle}}'),
  ('year_update', 'বছর আপডেট', 'Year Update', 'অনুগ্রহ করে আপনার নতুন শ্রেণী ও রোল নিশ্চিত করুন', 'Please confirm your new class and roll', '/settings');

-- Badges
CREATE TABLE badges (
  key TEXT PRIMARY KEY,
  name_bn TEXT NOT NULL,
  name_en TEXT NOT NULL,
  icon TEXT,
  description_bn TEXT,
  description_en TEXT
);

INSERT INTO badges (key, name_bn, name_en, icon, description_bn, description_en) VALUES
  ('verified', 'যাচাইকৃত', 'Verified', '✓', 'যাচাইকৃত অ্যাকাউন্ট', 'Verified account'),
  ('founder', 'প্রতিষ্ঠাতা', 'Founder', '★', 'প্ল্যাটফর্ম প্রতিষ্ঠাতা', 'Platform founder'),
  ('teacher', 'শিক্ষক', 'Teacher', '📚', 'বিজিপিএসসি শিক্ষক', 'BGPSC teacher'),
  ('alumni', 'প্রাক্তন শিক্ষার্থী', 'Alumni', '🎓', 'প্রাক্তন শিক্ষার্থী', 'Alumni'),
  ('guardian', 'অভিভাবক', 'Guardian', '👨‍👩‍👧', 'অভিভাবক', 'Guardian');

-- User badges
CREATE TABLE user_badges (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  badge_key TEXT REFERENCES badges(key) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_key)
);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Strip markdown to plain text
CREATE OR REPLACE FUNCTION strip_markdown(md TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(md, '[*_~`#>\[\]\(\)!]', '', 'g'),
        '\n+', ' ', 'g'
      ),
      '\s+', ' ', 'g'
    ),
    '^\s+|\s+$', '', 'g'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Extract hashtags (Bangla-aware)
CREATE OR REPLACE FUNCTION extract_hashtags(text_input TEXT)
RETURNS TEXT[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT DISTINCT lower(match[1])
    FROM regexp_matches(text_input, '#([A-Za-z0-9_\u0980-\u09FF]{2,40})', 'g') AS match
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Extract mentions
CREATE OR REPLACE FUNCTION extract_mentions(text_input TEXT)
RETURNS UUID[] AS $$
DECLARE
  handles TEXT[];
  user_ids UUID[];
BEGIN
  handles := ARRAY(
    SELECT DISTINCT lower(match[1])
    FROM regexp_matches(text_input, '@([a-z0-9_]{3,20})', 'g') AS match
  );
  
  SELECT ARRAY_AGG(id) INTO user_ids
  FROM profiles
  WHERE handle = ANY(handles) AND status = 'approved';
  
  RETURN COALESCE(user_ids, '{}');
END;
$$ LANGUAGE plpgsql STABLE;
