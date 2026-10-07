-- Migration: 0003_triggers_realtime.sql
-- BGPSC Students Community - Triggers, RPCs, and Realtime

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Updated at triggers
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER posts_updated_at BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER comments_updated_at BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER notification_prefs_updated_at BEFORE UPDATE ON notification_prefs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER admin_settings_updated_at BEFORE UPDATE ON admin_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER feature_flags_updated_at BEFORE UPDATE ON feature_flags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER algorithm_weights_updated_at BEFORE UPDATE ON algorithm_weights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- POST TRIGGERS
-- ============================================================================

-- Process post body (strip markdown, extract hashtags/mentions)
CREATE OR REPLACE FUNCTION process_post_body()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.body_md IS NOT NULL THEN
    NEW.body_text := strip_markdown(NEW.body_md);
    NEW.hashtags := extract_hashtags(NEW.body_md);
    NEW.mentions := extract_mentions(NEW.body_md);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_process_body BEFORE INSERT OR UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION process_post_body();

-- Auto-generate slug
CREATE OR REPLACE FUNCTION generate_post_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  IF NEW.slug IS NULL AND NEW.title IS NOT NULL THEN
    base_slug := lower(regexp_replace(
      regexp_replace(NEW.title, '[^a-zA-Z0-9\s-]', '', 'g'),
      '\s+', '-', 'g'
    ));
    base_slug := left(base_slug, 100);
    final_slug := base_slug;
    
    WHILE EXISTS (SELECT 1 FROM posts WHERE slug = final_slug) LOOP
      counter := counter + 1;
      final_slug := base_slug || '-' || counter;
    END LOOP;
    
    NEW.slug := final_slug;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_generate_slug BEFORE INSERT ON posts
  FOR EACH ROW EXECUTE FUNCTION generate_post_slug();

-- Update post counters
CREATE OR REPLACE FUNCTION update_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET likes_count = likes_count - 1 WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER likes_update_count AFTER INSERT OR DELETE ON likes
  FOR EACH ROW EXECUTE FUNCTION update_post_likes_count();

CREATE OR REPLACE FUNCTION update_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'published' THEN
    UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.status = 'published' AND NEW.status != 'published') THEN
    UPDATE posts SET comments_count = comments_count - 1 WHERE id = COALESCE(NEW.post_id, OLD.post_id);
    RETURN COALESCE(NEW, OLD);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comments_update_count AFTER INSERT OR UPDATE OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_post_comments_count();

CREATE OR REPLACE FUNCTION update_post_shares_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET shares_count = shares_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET shares_count = shares_count - 1 WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shares_update_count AFTER INSERT OR DELETE ON shares
  FOR EACH ROW EXECUTE FUNCTION update_post_shares_count();

-- ============================================================================
-- COMMENT TRIGGERS
-- ============================================================================

-- Process comment body
CREATE OR REPLACE FUNCTION process_comment_body()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.body_md IS NOT NULL THEN
    NEW.body_text := strip_markdown(NEW.body_md);
  END IF;
  
  -- Set depth and path
  IF NEW.parent_id IS NULL THEN
    NEW.depth := 0;
    NEW.path := '/' || NEW.id::text;
  ELSE
    SELECT depth + 1, path || '/' || NEW.id::text
    INTO NEW.depth, NEW.path
    FROM comments
    WHERE id = NEW.parent_id;
    
    IF NEW.depth > 9 THEN
      RAISE EXCEPTION 'Maximum nesting depth exceeded';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comments_process_body BEFORE INSERT ON comments
  FOR EACH ROW EXECUTE FUNCTION process_comment_body();

-- Update comment likes count
CREATE OR REPLACE FUNCTION update_comment_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE comments SET likes_count = likes_count + 1 WHERE id = NEW.comment_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE comments SET likes_count = likes_count - 1 WHERE id = OLD.comment_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comment_likes_update_count AFTER INSERT OR DELETE ON comment_likes
  FOR EACH ROW EXECUTE FUNCTION update_comment_likes_count();

-- ============================================================================
-- HANDLE TRIGGERS
-- ============================================================================

-- Validate handle not reserved
CREATE OR REPLACE FUNCTION validate_handle_not_reserved()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM reserved_handles WHERE handle = NEW.handle) THEN
    RAISE EXCEPTION 'Handle is reserved';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_validate_handle BEFORE INSERT OR UPDATE OF handle ON profiles
  FOR EACH ROW EXECUTE FUNCTION validate_handle_not_reserved();

-- ============================================================================
-- PRIVILEGE ESCALATION GUARD
-- ============================================================================

CREATE OR REPLACE FUNCTION guard_privilege_escalation()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent non-admins from changing role, status, or verified
  IF NOT is_admin() THEN
    IF (OLD.role IS DISTINCT FROM NEW.role) OR
       (OLD.status IS DISTINCT FROM NEW.status) OR
       (OLD.verified IS DISTINCT FROM NEW.verified) THEN
      RAISE EXCEPTION 'Cannot modify role, status, or verified field';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_guard_privilege BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION guard_privilege_escalation();

-- ============================================================================
-- SECURE DOCUMENTS IMMUTABILITY
-- ============================================================================

CREATE OR REPLACE FUNCTION guard_secure_documents_immutability()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Secure documents are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER secure_documents_no_update BEFORE UPDATE ON secure_documents
  FOR EACH ROW EXECUTE FUNCTION guard_secure_documents_immutability();

CREATE TRIGGER secure_documents_no_delete BEFORE DELETE ON secure_documents
  FOR EACH ROW EXECUTE FUNCTION guard_secure_documents_immutability();

-- ============================================================================
-- FOLLOWS BLOCK GUARD
-- ============================================================================

CREATE OR REPLACE FUNCTION guard_follow_block()
RETURNS TRIGGER AS $$
BEGIN
  -- Cannot follow if blocked or blocking
  IF EXISTS (
    SELECT 1 FROM blocks 
    WHERE (blocker_id = NEW.follower_id AND blocked_id = NEW.following_id)
       OR (blocker_id = NEW.following_id AND blocked_id = NEW.follower_id)
  ) THEN
    RAISE EXCEPTION 'Cannot follow blocked user';
  END IF;
  
  -- Cannot follow self
  IF NEW.follower_id = NEW.following_id THEN
    RAISE EXCEPTION 'Cannot follow yourself';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER follows_guard_block BEFORE INSERT ON follows
  FOR EACH ROW EXECUTE FUNCTION guard_follow_block();

-- ============================================================================
-- NOTIFICATION TRIGGERS
-- ============================================================================

-- Create in-app notification
CREATE OR REPLACE FUNCTION notify_user(
  p_user_id UUID,
  p_type notification_type,
  p_actor_id UUID,
  p_body_text TEXT,
  p_link TEXT,
  p_payload JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- Don't notify self
  IF p_user_id = p_actor_id THEN
    RETURN;
  END IF;
  
  -- Check if blocked
  IF EXISTS (
    SELECT 1 FROM blocks 
    WHERE (blocker_id = p_user_id AND blocked_id = p_actor_id)
       OR (blocker_id = p_actor_id AND blocked_id = p_user_id)
  ) THEN
    RETURN;
  END IF;
  
  INSERT INTO notifications (user_id, type, actor_id, body_text, link, payload)
  VALUES (p_user_id, p_type, p_actor_id, p_body_text, p_link, p_payload);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Push notification trigger
CREATE OR REPLACE FUNCTION enqueue_push_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_prefs JSONB;
  v_quiet_start TIME;
  v_quiet_end TIME;
  v_now_time TIME;
  v_template RECORD;
  v_actor RECORD;
  v_title TEXT;
  v_body TEXT;
BEGIN
  -- Get user preferences
  SELECT prefs, quiet_start, quiet_end 
  INTO v_prefs, v_quiet_start, v_quiet_end
  FROM notification_prefs 
  WHERE user_id = NEW.user_id;
  
  -- Check if notifications are enabled
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = NEW.user_id AND notif_consent = TRUE) THEN
    RETURN NEW;
  END IF;
  
  -- Check type-specific preference
  IF v_prefs IS NOT NULL AND v_prefs->>(NEW.type::text) = 'false' THEN
    RETURN NEW;
  END IF;
  
  -- Check quiet hours (Asia/Dhaka)
  v_now_time := (NOW() AT TIME ZONE 'Asia/Dhaka')::TIME;
  IF v_quiet_start IS NOT NULL AND v_quiet_end IS NOT NULL THEN
    IF v_quiet_start < v_quiet_end THEN
      IF v_now_time BETWEEN v_quiet_start AND v_quiet_end THEN
        RETURN NEW;
      END IF;
    ELSE
      IF v_now_time >= v_quiet_start OR v_now_time <= v_quiet_end THEN
        RETURN NEW;
      END IF;
    END IF;
  END IF;
  
  -- Get template
  SELECT * INTO v_template FROM push_templates WHERE key = NEW.type::text;
  IF v_template IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get actor info
  IF NEW.actor_id IS NOT NULL THEN
    SELECT handle, full_name INTO v_actor FROM profiles WHERE id = NEW.actor_id;
  END IF;
  
  -- Build title and body
  v_title := v_template.title_bn;
  v_body := v_template.body_bn;
  
  IF v_actor IS NOT NULL THEN
    v_body := replace(v_body, '{{actor}}', v_actor.full_name);
    v_body := replace(v_body, '{{actor_handle}}', v_actor.handle);
  END IF;
  
  IF NEW.payload IS NOT NULL THEN
    v_body := replace(v_body, '{{status}}', NEW.payload->>'status');
    v_body := replace(v_body, '{{slug}}', NEW.payload->>'slug');
    v_body := replace(v_body, '{{conversation_id}}', NEW.payload->>'conversation_id');
    v_body := replace(v_body, '{{message}}', NEW.payload->>'message');
    v_body := replace(v_body, '{{badge}}', NEW.payload->>'badge');
    v_body := replace(v_body, '{{handle}}', NEW.payload->>'handle');
  END IF;
  
  -- Enqueue push
  INSERT INTO push_outbox (user_id, title, body, link, tag)
  VALUES (NEW.user_id, v_title, v_body, NEW.link, NEW.type::text);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER notifications_push AFTER INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION enqueue_push_notification();

-- ============================================================================
-- MESSAGE TRIGGERS
-- ============================================================================

-- Process message body
CREATE OR REPLACE FUNCTION process_message_body()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.body_md IS NOT NULL THEN
    NEW.body_text := strip_markdown(NEW.body_md);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_process_body BEFORE INSERT OR UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION process_message_body();

-- Update conversation preview and timestamp
CREATE OR REPLACE FUNCTION update_conversation_preview()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations 
  SET 
    last_message_at = NEW.created_at,
    preview = left(NEW.body_text, 100)
  WHERE id = NEW.conversation_id;
  
  -- Increment unread count for other members
  UPDATE conversation_members
  SET unread_count = unread_count + 1
  WHERE conversation_id = NEW.conversation_id AND user_id != NEW.sender_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_update_preview AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_preview();

-- ============================================================================
-- RPCs (SECURITY DEFINER with pinned search_path)
-- ============================================================================

-- Submit registration application
CREATE OR REPLACE FUNCTION submit_application(
  p_role user_role,
  p_payload JSONB
)
RETURNS UUID AS $$
DECLARE
  v_app_id UUID;
BEGIN
  INSERT INTO registration_applications (applicant_id, role, payload)
  VALUES (auth.uid(), p_role, p_payload)
  RETURNING id INTO v_app_id;
  
  RETURN v_app_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Decide application (approve/reject)
CREATE OR REPLACE FUNCTION decide_application(
  p_app_id UUID,
  p_approve BOOLEAN,
  p_reason TEXT DEFAULT NULL,
  p_edits JSONB DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_app RECORD;
  v_user_id UUID;
  v_status app_status;
  v_payload JSONB;
BEGIN
  -- Verify admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  -- Get application
  SELECT * INTO v_app FROM registration_applications WHERE id = p_app_id;
  IF v_app IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;
  
  IF v_app.status = 'approved' THEN
    RAISE EXCEPTION 'Application already approved';
  END IF;
  
  -- Merge edits if provided
  v_payload := v_app.payload;
  IF p_edits IS NOT NULL THEN
    v_payload := v_payload || p_edits;
  END IF;
  
  IF p_approve THEN
    v_status := 'approved';
    
    -- Create user profile
    INSERT INTO profiles (
      id, handle, full_name, email, role, status, 
      avatar_url, bio, location_text, lat, lng, location_consent,
      interests, locale
    )
    SELECT 
      v_app.applicant_id,
      v_payload->>'handle',
      v_payload->>'full_name',
      v_payload->>'email',
      v_app.role,
      'approved',
      v_payload->>'avatar_url',
      v_payload->>'bio',
      v_payload->>'location_text',
      (v_payload->>'lat')::decimal,
      (v_payload->>'lng')::decimal,
      (v_payload->>'location_consent')::boolean,
      ARRAY(SELECT jsonb_array_elements_text(v_payload->'interests')),
      COALESCE(v_payload->>'locale', 'bn')
    WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_app.applicant_id)
    RETURNING id INTO v_user_id;
    
    IF v_user_id IS NULL THEN
      v_user_id := v_app.applicant_id;
    END IF;
    
    -- Create role-specific records
    IF v_app.role = 'student' THEN
      INSERT INTO academics (user_id, current_class, section, roll, nid_or_brc, dob)
      VALUES (
        v_user_id,
        (v_payload->>'current_class')::integer,
        v_payload->>'section',
        (v_payload->>'roll')::integer,
        v_payload->>'nid_or_brc',
        (v_payload->>'dob')::date
      )
      ON CONFLICT (user_id) DO UPDATE SET
        current_class = EXCLUDED.current_class,
        section = EXCLUDED.section,
        roll = EXCLUDED.roll;
    ELSIF v_app.role = 'teacher' THEN
      INSERT INTO teacher_info (user_id, experience_years, teaches, department)
      VALUES (
        v_user_id,
        (v_payload->>'experience_years')::integer,
        v_payload->'teaches',
        v_payload->>'department'
      )
      ON CONFLICT (user_id) DO UPDATE SET
        experience_years = EXCLUDED.experience_years,
        teaches = EXCLUDED.teaches,
        department = EXCLUDED.department;
    ELSIF v_app.role = 'alumni' THEN
      INSERT INTO alumni_info (
        user_id, current_institution, current_class, 
        old_class, old_section, old_roll, passing_year, notes
      )
      VALUES (
        v_user_id,
        v_payload->>'current_institution',
        v_payload->>'current_class',
        (v_payload->>'old_class')::integer,
        v_payload->>'old_section',
        (v_payload->>'old_roll')::integer,
        (v_payload->>'passing_year')::integer,
        v_payload->>'notes'
      )
      ON CONFLICT (user_id) DO UPDATE SET
        current_institution = EXCLUDED.current_institution,
        current_class = EXCLUDED.current_class;
    ELSIF v_app.role = 'guardian' THEN
      INSERT INTO guardian_info (user_id, phone, relationship, occupation)
      VALUES (
        v_user_id,
        v_payload->>'phone',
        v_payload->>'relationship',
        v_payload->>'occupation'
      )
      ON CONFLICT (user_id) DO UPDATE SET
        phone = EXCLUDED.phone,
        relationship = EXCLUDED.relationship,
        occupation = EXCLUDED.occupation;
    END IF;
    
  ELSE
    v_status := 'rejected';
    
    IF p_reason IS NULL OR char_length(p_reason) < 10 THEN
      RAISE EXCEPTION 'Rejection reason must be at least 10 characters';
    END IF;
  END IF;
  
  -- Update application
  UPDATE registration_applications
  SET 
    status = v_status,
    decided_at = NOW(),
    decided_by = auth.uid(),
    reason = p_reason,
    payload = v_payload
  WHERE id = p_app_id;
  
  -- Log event
  INSERT INTO approval_events (application_id, actor_id, action, note)
  VALUES (p_app_id, auth.uid(), CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END, p_reason);
  
  -- Audit log
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, before, after)
  VALUES (
    auth.uid(),
    CASE WHEN p_approve THEN 'approve_application' ELSE 'reject_application' END,
    'registration_application',
    p_app_id,
    jsonb_build_object('status', v_app.status),
    jsonb_build_object('status', v_status, 'reason', p_reason)
  );
  
  -- Notify applicant
  PERFORM notify_user(
    v_app.applicant_id,
    'approval_update',
    auth.uid(),
    CASE WHEN p_approve THEN 'আপনার আবেদন অনুমোদিত হয়েছে' ELSE 'আপনার আবেদন প্রত্যাখ্যাত হয়েছে' END,
    '/status',
    jsonb_build_object('status', v_status::text, 'reason', p_reason)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Follow user
CREATE OR REPLACE FUNCTION follow_user(p_following_id UUID)
RETURNS VOID AS $$
DECLARE
  v_follower RECORD;
BEGIN
  INSERT INTO follows (follower_id, following_id)
  VALUES (auth.uid(), p_following_id)
  ON CONFLICT DO NOTHING;
  
  -- Get follower info
  SELECT handle, full_name INTO v_follower FROM profiles WHERE id = auth.uid();
  
  -- Notify
  PERFORM notify_user(
    p_following_id,
    'new_follower',
    auth.uid(),
    v_follower.full_name || ' আপনাকে অনুসরণ করছেন',
    '/@' || v_follower.handle,
    jsonb_build_object('actor_handle', v_follower.handle)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Unfollow user
CREATE OR REPLACE FUNCTION unfollow_user(p_following_id UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM follows 
  WHERE follower_id = auth.uid() AND following_id = p_following_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Like post
CREATE OR REPLACE FUNCTION like_post(p_post_id UUID)
RETURNS VOID AS $$
DECLARE
  v_post RECORD;
  v_liker RECORD;
BEGIN
  INSERT INTO likes (post_id, user_id)
  VALUES (p_post_id, auth.uid())
  ON CONFLICT DO NOTHING;
  
  -- Get post and liker info
  SELECT author_id, slug INTO v_post FROM posts WHERE id = p_post_id;
  SELECT handle, full_name INTO v_liker FROM profiles WHERE id = auth.uid();
  
  -- Notify
  PERFORM notify_user(
    v_post.author_id,
    'like',
    auth.uid(),
    v_liker.full_name || ' আপনার পোস্ট পছন্দ করেছেন',
    '/post/' || v_post.slug,
    jsonb_build_object('slug', v_post.slug)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Unlike post
CREATE OR REPLACE FUNCTION unlike_post(p_post_id UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM likes WHERE post_id = p_post_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add comment
CREATE OR REPLACE FUNCTION add_comment(
  p_post_id UUID,
  p_parent_id UUID,
  p_body TEXT,
  p_images JSONB DEFAULT '[]'
)
RETURNS UUID AS $$
DECLARE
  v_comment_id UUID;
  v_post RECORD;
  v_parent RECORD;
  v_commenter RECORD;
  v_rate_count INTEGER;
BEGIN
  -- Rate limit: 10 comments per minute
  SELECT COUNT(*) INTO v_rate_count
  FROM comments
  WHERE author_id = auth.uid() AND created_at > NOW() - INTERVAL '1 minute';
  
  IF v_rate_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded';
  END IF;
  
  -- Get post info
  SELECT author_id, slug INTO v_post FROM posts WHERE id = p_post_id;
  IF v_post IS NULL THEN
    RAISE EXCEPTION 'Post not found';
  END IF;
  
  -- Get commenter info
  SELECT handle, full_name INTO v_commenter FROM profiles WHERE id = auth.uid();
  
  -- Insert comment
  INSERT INTO comments (post_id, parent_id, author_id, body_md, images)
  VALUES (p_post_id, p_parent_id, auth.uid(), p_body, p_images)
  RETURNING id INTO v_comment_id;
  
  -- Notify post author
  PERFORM notify_user(
    v_post.author_id,
    'comment',
    auth.uid(),
    v_commenter.full_name || ' আপনার পোস্টে মন্তব্য করেছেন',
    '/post/' || v_post.slug,
    jsonb_build_object('slug', v_post.slug)
  );
  
  -- Notify parent comment author if reply
  IF p_parent_id IS NOT NULL THEN
    SELECT author_id INTO v_parent FROM comments WHERE id = p_parent_id;
    
    PERFORM notify_user(
      v_parent.author_id,
      'reply',
      auth.uid(),
      v_commenter.full_name || ' আপনার মন্তব্যের উত্তর দিয়েছেন',
      '/post/' || v_post.slug,
      jsonb_build_object('slug', v_post.slug)
    );
  END IF;
  
  -- Notify mentions
  FOR v_parent IN 
    SELECT id FROM profiles 
    WHERE id = ANY(extract_mentions(p_body)) 
    AND id != auth.uid()
  LOOP
    PERFORM notify_user(
      v_parent.id,
      'mention',
      auth.uid(),
      v_commenter.full_name || ' আপনাকে উল্লেখ করেছেন',
      '/post/' || v_post.slug,
      jsonb_build_object('slug', v_post.slug)
    );
  END LOOP;
  
  RETURN v_comment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Increment post stats
CREATE OR REPLACE FUNCTION increment_post_stats(
  p_post_id UUID,
  p_views INTEGER DEFAULT 0,
  p_impressions INTEGER DEFAULT 0,
  p_dwell_ms BIGINT DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO post_daily_stats (post_id, day, views, impressions, dwell_ms)
  VALUES (p_post_id, CURRENT_DATE, p_views, p_impressions, p_dwell_ms)
  ON CONFLICT (post_id, day) DO UPDATE SET
    views = post_daily_stats.views + p_views,
    impressions = post_daily_stats.impressions + p_impressions,
    dwell_ms = post_daily_stats.dwell_ms + p_dwell_ms;
  
  -- Update post counters
  UPDATE posts SET
    views_count = views_count + p_views,
    impressions_count = impressions_count + p_impressions
  WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Log user event
CREATE OR REPLACE FUNCTION log_event(
  p_event_type TEXT,
  p_target_type TEXT DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_weight DECIMAL DEFAULT 1.0,
  p_dwell_ms INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_events (user_id, event_type, target_type, target_id, weight, dwell_ms)
  VALUES (auth.uid(), p_event_type, p_target_type, p_target_id, p_weight, p_dwell_ms);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Get or create DM conversation
CREATE OR REPLACE FUNCTION get_or_create_dm(p_other_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_conv_id UUID;
BEGIN
  -- Find existing DM
  SELECT c.id INTO v_conv_id
  FROM conversations c
  JOIN conversation_members cm1 ON c.id = cm1.conversation_id
  JOIN conversation_members cm2 ON c.id = cm2.conversation_id
  WHERE c.kind = 'dm'
    AND cm1.user_id = auth.uid()
    AND cm2.user_id = p_other_user_id;
  
  IF v_conv_id IS NULL THEN
    -- Create new DM
    INSERT INTO conversations (kind) VALUES ('dm') RETURNING id INTO v_conv_id;
    
    INSERT INTO conversation_members (conversation_id, user_id) VALUES
      (v_conv_id, auth.uid()),
      (v_conv_id, p_other_user_id);
  END IF;
  
  RETURN v_conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Send message
CREATE OR REPLACE FUNCTION send_message(
  p_conv_id UUID,
  p_body TEXT,
  p_reply_to_id UUID DEFAULT NULL,
  p_attachment JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_message_id UUID;
  v_rate_count INTEGER;
  v_member RECORD;
  v_sender RECORD;
BEGIN
  -- Verify membership
  IF NOT EXISTS (
    SELECT 1 FROM conversation_members 
    WHERE conversation_id = p_conv_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a member of this conversation';
  END IF;
  
  -- Rate limit: 30 messages per minute
  SELECT COUNT(*) INTO v_rate_count
  FROM messages
  WHERE sender_id = auth.uid() AND created_at > NOW() - INTERVAL '1 minute';
  
  IF v_rate_count >= 30 THEN
    RAISE EXCEPTION 'Rate limit exceeded';
  END IF;
  
  -- Insert message
  INSERT INTO messages (conversation_id, sender_id, body_md, reply_to_id, attachment)
  VALUES (p_conv_id, auth.uid(), p_body, p_reply_to_id, p_attachment)
  RETURNING id INTO v_message_id;
  
  -- Get sender info
  SELECT handle, full_name INTO v_sender FROM profiles WHERE id = auth.uid();
  
  -- Notify other members
  FOR v_member IN 
    SELECT user_id FROM conversation_members 
    WHERE conversation_id = p_conv_id AND user_id != auth.uid()
  LOOP
    PERFORM notify_user(
      v_member.user_id,
      'message',
      auth.uid(),
      v_sender.full_name || ' আপনাকে বার্তা পাঠিয়েছেন',
      '/messages/' || p_conv_id::text,
      jsonb_build_object('conversation_id', p_conv_id::text)
    );
  END LOOP;
  
  RETURN v_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Mark conversation as read
CREATE OR REPLACE FUNCTION mark_conversation_read(p_conv_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE conversation_members
  SET unread_count = 0, last_read_at = NOW()
  WHERE conversation_id = p_conv_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- React to message
CREATE OR REPLACE FUNCTION react_to_message(
  p_message_id UUID,
  p_emoji TEXT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO message_reactions (message_id, user_id, emoji)
  VALUES (p_message_id, auth.uid(), p_emoji)
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Register push subscription
CREATE OR REPLACE FUNCTION register_push_subscription(
  p_endpoint TEXT,
  p_p256dh TEXT,
  p_auth TEXT,
  p_ua TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, ua)
  VALUES (auth.uid(), p_endpoint, p_p256dh, p_auth, p_ua)
  ON CONFLICT (endpoint) DO UPDATE SET
    user_id = auth.uid(),
    p256dh = EXCLUDED.p256dh,
    auth = EXCLUDED.auth,
    ua = EXCLUDED.ua;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Remove push subscription
CREATE OR REPLACE FUNCTION remove_push_subscription(p_endpoint TEXT)
RETURNS VOID AS $$
BEGIN
  DELETE FROM push_subscriptions 
  WHERE endpoint = p_endpoint AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enqueue push (service role only)
CREATE OR REPLACE FUNCTION enqueue_push(
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_link TEXT DEFAULT NULL,
  p_tag TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO push_outbox (user_id, title, body, link, tag)
  VALUES (p_user_id, p_title, p_body, p_link, p_tag);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Promote academic year (service role/admin only)
CREATE OR REPLACE FUNCTION promote_academic_year(p_year INTEGER)
RETURNS VOID AS $$
DECLARE
  v_job_id UUID;
  v_affected INTEGER := 0;
  v_student RECORD;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  -- Create job record
  INSERT INTO academic_year_jobs (year, status)
  VALUES (p_year, 'running')
  RETURNING id INTO v_job_id;
  
  -- Promote each student
  FOR v_student IN 
    SELECT a.user_id, a.current_class, a.section, a.roll
    FROM academics a
    JOIN profiles p ON a.user_id = p.id
    WHERE p.status = 'approved' AND NOT a.graduated
  LOOP
    IF v_student.current_class = 12 THEN
      -- Graduate
      UPDATE academics SET
        graduated = TRUE,
        needs_year_update = TRUE,
        history = history || jsonb_build_array(jsonb_build_object(
          'year', p_year - 1,
          'class', v_student.current_class,
          'section', v_student.section,
          'roll', v_student.roll
        ))
      WHERE user_id = v_student.user_id;
    ELSE
      -- Promote
      UPDATE academics SET
        current_class = v_student.current_class + 1,
        academic_year = p_year,
        needs_year_update = TRUE,
        history = history || jsonb_build_array(jsonb_build_object(
          'year', p_year - 1,
          'class', v_student.current_class,
          'section', v_student.section,
          'roll', v_student.roll
        ))
      WHERE user_id = v_student.user_id;
    END IF;
    
    v_affected := v_affected + 1;
    
    -- Notify student
    PERFORM notify_user(
      v_student.user_id,
      'promotion',
      NULL,
      'নতুন বছরে আপনার শ্রেণী আপডেট হয়েছে',
      '/settings',
      NULL
    );
  END LOOP;
  
  -- Update job
  UPDATE academic_year_jobs
  SET status = 'completed', affected = v_affected, completed_at = NOW()
  WHERE id = v_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Confirm year update
CREATE OR REPLACE FUNCTION confirm_year_update(
  p_class INTEGER,
  p_section TEXT,
  p_roll INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE academics SET
    current_class = p_class,
    section = p_section,
    roll = p_roll,
    needs_year_update = FALSE
  WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Record profile view
CREATE OR REPLACE FUNCTION record_profile_view(p_viewed_user_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_events (user_id, event_type, target_type, target_id)
  VALUES (auth.uid(), 'profile_view', 'user', p_viewed_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Search all
CREATE OR REPLACE FUNCTION search_all(p_query TEXT, p_limit INTEGER DEFAULT 20)
RETURNS TABLE(
  result_type TEXT,
  id UUID,
  title TEXT,
  subtitle TEXT,
  url TEXT,
  rank REAL
) AS $$
BEGIN
  -- Log search
  INSERT INTO search_logs (user_id, query) VALUES (auth.uid(), p_query);
  
  RETURN QUERY
  -- Posts
  SELECT 
    'post'::TEXT,
    p.id,
    p.title,
    left(p.body_text, 100),
    '/post/' || p.slug,
    (ts_rank(p.fts, query) * 2 + similarity(p.title, p_query))::REAL
  FROM posts p, plainto_tsquery('simple', p_query) query
  WHERE p.status = 'published' AND p.fts @@ query
  UNION ALL
  -- Users
  SELECT 
    'user'::TEXT,
    pr.id,
    pr.full_name,
    '@' || pr.handle,
    '/@' || pr.handle,
    (ts_rank(pr.fts, query) * 2 + similarity(pr.full_name, p_query))::REAL
  FROM profiles pr, plainto_tsquery('simple', p_query) query
  WHERE pr.status = 'approved' AND pr.fts @@ query
  ORDER BY rank DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Simple feed
CREATE OR REPLACE FUNCTION feed_simple(
  p_viewer UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_lat DECIMAL DEFAULT NULL,
  p_lng DECIMAL DEFAULT NULL
)
RETURNS TABLE(post_id UUID) AS $$
DECLARE
  v_viewer_class INTEGER;
  v_viewer_section TEXT;
  v_weights JSONB;
  v_tau DECIMAL;
BEGIN
  -- Get viewer info
  SELECT a.current_class, a.section 
  INTO v_viewer_class, v_viewer_section
  FROM academics a WHERE a.user_id = p_viewer;
  
  -- Get algorithm weights
  SELECT simple_weights, decay_tau_hours 
  INTO v_weights, v_tau
  FROM algorithm_weights WHERE id = 1;
  
  RETURN QUERY
  SELECT p.id
  FROM posts p
  LEFT JOIN follows f ON f.following_id = p.author_id AND f.follower_id = p_viewer
  LEFT JOIN blocks b1 ON b1.blocker_id = p_viewer AND b1.blocked_id = p.author_id
  LEFT JOIN blocks b2 ON b2.blocker_id = p.author_id AND b2.blocked_id = p_viewer
  LEFT JOIN muted_users m ON m.muter_id = p_viewer AND m.muted_id = p.author_id
  LEFT JOIN hidden_posts h ON h.user_id = p_viewer AND h.post_id = p.id
  LEFT JOIN academics a ON a.user_id = p.author_id
  WHERE p.status = 'published'
    AND b1.blocker_id IS NULL
    AND b2.blocker_id IS NULL
    AND m.muter_id IS NULL
    AND h.user_id IS NULL
  ORDER BY (
    -- Class/section affinity
    CASE 
      WHEN a.current_class = v_viewer_class AND a.section = v_viewer_section 
      THEN (v_weights->>'class_section')::DECIMAL
      WHEN a.current_class = v_viewer_class 
      THEN (v_weights->>'class')::DECIMAL
      WHEN a.section = v_viewer_section 
      THEN (v_weights->>'section')::DECIMAL
      ELSE 1.0
    END *
    -- Following boost
    CASE WHEN f.follower_id IS NOT NULL THEN 2.0 ELSE 1.0 END *
    -- Time decay
    exp(-EXTRACT(EPOCH FROM (NOW() - p.created_at)) / (v_tau * 3600)) *
    -- Engagement
    (1 + p.likes_count * 0.1 + p.comments_count * 0.2 + p.shares_count * 0.3)
  ) DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- REALTIME PUBLICATION
-- ============================================================================

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_members;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE posts;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE likes;
ALTER PUBLICATION supabase_realtime ADD TABLE follows;

-- ============================================================================
-- CLEANUP FUNCTIONS
-- ============================================================================

-- Purge old user events (30 days)
CREATE OR REPLACE FUNCTION purge_old_user_events()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM user_events WHERE created_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
