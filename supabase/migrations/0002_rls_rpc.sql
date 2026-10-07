-- Migration: 0002_rls_rpc.sql
-- BGPSC Students Community - RLS Policies and RPCs

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reserved_handles ENABLE ROW LEVEL SECURITY;
ALTER TABLE academics ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE alumni_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_children ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE secure_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE muted_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE hidden_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmark_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE algorithm_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE banned_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE redirects ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE cluster_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_year_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE i18n_strings ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin' 
    AND status = 'approved'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is approved
CREATE OR REPLACE FUNCTION is_approved()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND status = 'approved'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PROFILES RLS
-- ============================================================================

CREATE POLICY "profiles_select_public" ON profiles
  FOR SELECT USING (TRUE);

CREATE POLICY "profiles_update_self" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_admin" ON profiles
  FOR UPDATE USING (is_admin());

-- ============================================================================
-- RESERVED HANDLES RLS
-- ============================================================================

CREATE POLICY "reserved_handles_select" ON reserved_handles
  FOR SELECT USING (TRUE);

-- ============================================================================
-- ACADEMICS RLS
-- ============================================================================

CREATE POLICY "academics_select_owner_admin" ON academics
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "academics_insert_owner" ON academics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "academics_update_owner" ON academics
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "academics_update_admin" ON academics
  FOR UPDATE USING (is_admin());

-- Public academics view
CREATE POLICY "public_academics_select" ON public_academics
  FOR SELECT USING (TRUE);

-- ============================================================================
-- TEACHER/ALUMNI/GUARDIAN INFO RLS
-- ============================================================================

CREATE POLICY "teacher_info_select_owner_admin" ON teacher_info
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "teacher_info_insert_owner" ON teacher_info
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "teacher_info_update_owner" ON teacher_info
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "teacher_info_update_admin" ON teacher_info
  FOR UPDATE USING (is_admin());

CREATE POLICY "alumni_info_select_owner_admin" ON alumni_info
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "alumni_info_insert_owner" ON alumni_info
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "alumni_info_update_owner" ON alumni_info
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "alumni_info_update_admin" ON alumni_info
  FOR UPDATE USING (is_admin());

CREATE POLICY "guardian_info_select_owner_admin" ON guardian_info
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "guardian_info_insert_owner" ON guardian_info
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "guardian_info_update_owner" ON guardian_info
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "guardian_info_update_admin" ON guardian_info
  FOR UPDATE USING (is_admin());

CREATE POLICY "guardian_children_select" ON guardian_children
  FOR SELECT USING (
    auth.uid() = guardian_id OR 
    auth.uid() = child_id OR 
    is_admin()
  );

CREATE POLICY "guardian_children_insert" ON guardian_children
  FOR INSERT WITH CHECK (auth.uid() = guardian_id OR is_admin());

CREATE POLICY "guardian_children_update" ON guardian_children
  FOR UPDATE USING (auth.uid() = child_id OR is_admin());

-- ============================================================================
-- CLASS SECTIONS RLS
-- ============================================================================

CREATE POLICY "class_sections_select" ON class_sections
  FOR SELECT USING (TRUE);

CREATE POLICY "class_sections_insert_admin" ON class_sections
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "class_sections_update_admin" ON class_sections
  FOR UPDATE USING (is_admin());

CREATE POLICY "class_sections_delete_admin" ON class_sections
  FOR DELETE USING (is_admin());

-- ============================================================================
-- REGISTRATION APPLICATIONS RLS
-- ============================================================================

CREATE POLICY "registration_applications_select_owner_admin" ON registration_applications
  FOR SELECT USING (applicant_id = auth.uid() OR is_admin());

CREATE POLICY "registration_applications_insert" ON registration_applications
  FOR INSERT WITH CHECK (applicant_id = auth.uid());

CREATE POLICY "registration_applications_update_admin" ON registration_applications
  FOR UPDATE USING (is_admin());

-- ============================================================================
-- APPROVAL EVENTS RLS
-- ============================================================================

CREATE POLICY "approval_events_select" ON approval_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM registration_applications 
      WHERE id = application_id 
      AND (applicant_id = auth.uid() OR is_admin())
    )
  );

CREATE POLICY "approval_events_insert_admin" ON approval_events
  FOR INSERT WITH CHECK (is_admin());

-- ============================================================================
-- SECURE DOCUMENTS RLS
-- ============================================================================

CREATE POLICY "secure_documents_select_owner_admin" ON secure_documents
  FOR SELECT USING (owner_id = auth.uid() OR is_admin());

CREATE POLICY "secure_documents_insert_owner" ON secure_documents
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- No UPDATE/DELETE - immutable vault

-- ============================================================================
-- FOLLOWS/BLOCKS/MUTED/HIDDEN RLS
-- ============================================================================

CREATE POLICY "follows_select" ON follows
  FOR SELECT USING (TRUE);

CREATE POLICY "follows_insert" ON follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "follows_delete" ON follows
  FOR DELETE USING (auth.uid() = follower_id);

CREATE POLICY "blocks_select_self" ON blocks
  FOR SELECT USING (auth.uid() = blocker_id OR is_admin());

CREATE POLICY "blocks_insert" ON blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "blocks_delete" ON blocks
  FOR DELETE USING (auth.uid() = blocker_id);

CREATE POLICY "muted_users_select_self" ON muted_users
  FOR SELECT USING (auth.uid() = muter_id);

CREATE POLICY "muted_users_insert" ON muted_users
  FOR INSERT WITH CHECK (auth.uid() = muter_id);

CREATE POLICY "muted_users_delete" ON muted_users
  FOR DELETE USING (auth.uid() = muter_id);

CREATE POLICY "hidden_posts_select_self" ON hidden_posts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "hidden_posts_insert" ON hidden_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "hidden_posts_delete" ON hidden_posts
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- POSTS RLS
-- ============================================================================

CREATE POLICY "posts_select_published" ON posts
  FOR SELECT USING (status = 'published' OR author_id = auth.uid() OR is_admin());

CREATE POLICY "posts_insert_approved" ON posts
  FOR INSERT WITH CHECK (auth.uid() = author_id AND is_approved());

CREATE POLICY "posts_update_author" ON posts
  FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "posts_update_admin" ON posts
  FOR UPDATE USING (is_admin());

CREATE POLICY "post_images_select" ON post_images
  FOR SELECT USING (TRUE);

CREATE POLICY "post_images_insert" ON post_images
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM posts WHERE id = post_id AND author_id = auth.uid())
  );

CREATE POLICY "post_images_delete" ON post_images
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM posts WHERE id = post_id AND author_id = auth.uid())
  );

CREATE POLICY "post_links_select" ON post_links
  FOR SELECT USING (TRUE);

CREATE POLICY "post_links_insert" ON post_links
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM posts WHERE id = post_id AND author_id = auth.uid())
  );

CREATE POLICY "post_links_delete" ON post_links
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM posts WHERE id = post_id AND author_id = auth.uid())
  );

-- ============================================================================
-- LIKES/BOOKMARKS/SHARES RLS
-- ============================================================================

CREATE POLICY "likes_select" ON likes
  FOR SELECT USING (TRUE);

CREATE POLICY "likes_insert" ON likes
  FOR INSERT WITH CHECK (auth.uid() = user_id AND is_approved());

CREATE POLICY "likes_delete" ON likes
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "bookmark_folders_select_self" ON bookmark_folders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "bookmark_folders_insert" ON bookmark_folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bookmark_folders_update" ON bookmark_folders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "bookmark_folders_delete" ON bookmark_folders
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "bookmarks_select_self" ON bookmarks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "bookmarks_insert" ON bookmarks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bookmarks_delete" ON bookmarks
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "shares_select" ON shares
  FOR SELECT USING (TRUE);

CREATE POLICY "shares_insert" ON shares
  FOR INSERT WITH CHECK (auth.uid() = user_id AND is_approved());

CREATE POLICY "post_daily_stats_select" ON post_daily_stats
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM posts WHERE id = post_id AND author_id = auth.uid()) 
    OR is_admin()
  );

-- ============================================================================
-- COMMENTS RLS
-- ============================================================================

CREATE POLICY "comments_select_published" ON comments
  FOR SELECT USING (status = 'published' OR author_id = auth.uid() OR is_admin());

CREATE POLICY "comments_insert_approved" ON comments
  FOR INSERT WITH CHECK (auth.uid() = author_id AND is_approved());

CREATE POLICY "comments_update_author" ON comments
  FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "comments_update_admin" ON comments
  FOR UPDATE USING (is_admin());

CREATE POLICY "comment_likes_select" ON comment_likes
  FOR SELECT USING (TRUE);

CREATE POLICY "comment_likes_insert" ON comment_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id AND is_approved());

CREATE POLICY "comment_likes_delete" ON comment_likes
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- USER EVENTS RLS
-- ============================================================================

CREATE POLICY "user_events_insert_self" ON user_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- MESSENGER RLS
-- ============================================================================

CREATE POLICY "conversations_select_member" ON conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversation_members 
      WHERE conversation_id = id AND user_id = auth.uid()
    ) OR is_admin()
  );

CREATE POLICY "conversations_insert" ON conversations
  FOR INSERT WITH CHECK (is_approved());

CREATE POLICY "conversations_update_admin" ON conversations
  FOR UPDATE USING (is_admin());

CREATE POLICY "conversation_members_select" ON conversation_members
  FOR SELECT USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM conversation_members cm2 
      WHERE cm2.conversation_id = conversation_id AND cm2.user_id = auth.uid()
    ) OR is_admin()
  );

CREATE POLICY "conversation_members_insert" ON conversation_members
  FOR INSERT WITH CHECK (is_approved());

CREATE POLICY "conversation_members_update_self" ON conversation_members
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "conversation_members_delete" ON conversation_members
  FOR DELETE USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "messages_select_member" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversation_members 
      WHERE conversation_id = conversation_id AND user_id = auth.uid()
    ) OR is_admin()
  );

CREATE POLICY "messages_insert_member" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND 
    EXISTS (
      SELECT 1 FROM conversation_members 
      WHERE conversation_id = conversation_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "messages_update_sender" ON messages
  FOR UPDATE USING (auth.uid() = sender_id);

CREATE POLICY "message_reactions_select" ON message_reactions
  FOR SELECT USING (TRUE);

CREATE POLICY "message_reactions_insert" ON message_reactions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND 
    EXISTS (
      SELECT 1 FROM messages m 
      JOIN conversation_members cm ON m.conversation_id = cm.conversation_id
      WHERE m.id = message_id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "message_reactions_delete" ON message_reactions
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- NOTIFICATIONS RLS
-- ============================================================================

CREATE POLICY "notifications_select_self" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications_update_self" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "notification_prefs_select_self" ON notification_prefs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notification_prefs_insert" ON notification_prefs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notification_prefs_update" ON notification_prefs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_select_self" ON push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_insert" ON push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_delete" ON push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "fcm_tokens_select_self" ON fcm_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "fcm_tokens_insert" ON fcm_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fcm_tokens_delete" ON fcm_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- Push outbox - no user access
CREATE POLICY "push_outbox_no_access" ON push_outbox
  FOR ALL USING (FALSE);

-- ============================================================================
-- REPORTS/MODERATION RLS
-- ============================================================================

CREATE POLICY "reports_select_self_admin" ON reports
  FOR SELECT USING (reporter_id = auth.uid() OR is_admin());

CREATE POLICY "reports_insert" ON reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "reports_update_admin" ON reports
  FOR UPDATE USING (is_admin());

CREATE POLICY "moderation_actions_select_admin" ON moderation_actions
  FOR SELECT USING (is_admin());

CREATE POLICY "moderation_actions_insert_admin" ON moderation_actions
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "audit_logs_select_admin" ON audit_logs
  FOR SELECT USING (is_admin());

-- ============================================================================
-- ADMIN TABLES RLS
-- ============================================================================

CREATE POLICY "admin_settings_select" ON admin_settings
  FOR SELECT USING (TRUE);

CREATE POLICY "admin_settings_update_admin" ON admin_settings
  FOR UPDATE USING (is_admin());

CREATE POLICY "feature_flags_select" ON feature_flags
  FOR SELECT USING (TRUE);

CREATE POLICY "feature_flags_update_admin" ON feature_flags
  FOR UPDATE USING (is_admin());

CREATE POLICY "algorithm_weights_select" ON algorithm_weights
  FOR SELECT USING (TRUE);

CREATE POLICY "algorithm_weights_update_admin" ON algorithm_weights
  FOR UPDATE USING (is_admin());

CREATE POLICY "banned_words_select" ON banned_words
  FOR SELECT USING (TRUE);

CREATE POLICY "banned_words_insert_admin" ON banned_words
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "banned_words_delete_admin" ON banned_words
  FOR DELETE USING (is_admin());

CREATE POLICY "link_rules_select" ON link_rules
  FOR SELECT USING (TRUE);

CREATE POLICY "link_rules_insert_admin" ON link_rules
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "link_rules_update_admin" ON link_rules
  FOR UPDATE USING (is_admin());

CREATE POLICY "link_rules_delete_admin" ON link_rules
  FOR DELETE USING (is_admin());

CREATE POLICY "redirects_select" ON redirects
  FOR SELECT USING (TRUE);

CREATE POLICY "redirects_insert_admin" ON redirects
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "redirects_update_admin" ON redirects
  FOR UPDATE USING (is_admin());

CREATE POLICY "redirects_delete_admin" ON redirects
  FOR DELETE USING (is_admin());

CREATE POLICY "seo_overrides_select" ON seo_overrides
  FOR SELECT USING (TRUE);

CREATE POLICY "seo_overrides_insert_admin" ON seo_overrides
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "seo_overrides_update_admin" ON seo_overrides
  FOR UPDATE USING (is_admin());

CREATE POLICY "seo_overrides_delete_admin" ON seo_overrides
  FOR DELETE USING (is_admin());

-- Embeddings and clusters
CREATE POLICY "post_embeddings_select" ON post_embeddings
  FOR SELECT USING (TRUE);

CREATE POLICY "user_embeddings_select_self" ON user_embeddings
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "clusters_select" ON clusters
  FOR SELECT USING (TRUE);

CREATE POLICY "cluster_members_select" ON cluster_members
  FOR SELECT USING (TRUE);

-- Ops tables
CREATE POLICY "academic_year_jobs_select_admin" ON academic_year_jobs
  FOR SELECT USING (is_admin());

CREATE POLICY "search_logs_select_admin" ON search_logs
  FOR SELECT USING (is_admin());

CREATE POLICY "page_stats_select_admin" ON page_stats
  FOR SELECT USING (is_admin());

CREATE POLICY "error_events_select_admin" ON error_events
  FOR SELECT USING (is_admin());

CREATE POLICY "heartbeats_select" ON heartbeats
  FOR SELECT USING (TRUE);

CREATE POLICY "i18n_strings_select" ON i18n_strings
  FOR SELECT USING (TRUE);

CREATE POLICY "i18n_strings_update_admin" ON i18n_strings
  FOR UPDATE USING (is_admin());

CREATE POLICY "push_templates_select" ON push_templates
  FOR SELECT USING (TRUE);

CREATE POLICY "push_templates_update_admin" ON push_templates
  FOR UPDATE USING (is_admin());

CREATE POLICY "badges_select" ON badges
  FOR SELECT USING (TRUE);

CREATE POLICY "badges_update_admin" ON badges
  FOR UPDATE USING (is_admin());

CREATE POLICY "user_badges_select" ON user_badges
  FOR SELECT USING (TRUE);

CREATE POLICY "user_badges_insert_admin" ON user_badges
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "user_badges_delete_admin" ON user_badges
  FOR DELETE USING (is_admin());
