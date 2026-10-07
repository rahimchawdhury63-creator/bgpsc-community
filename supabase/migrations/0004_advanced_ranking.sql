-- Migration: 0004_advanced_ranking.sql
-- BGPSC Students Community - Advanced Ranking & Analytics

-- ============================================================================
-- POST EMBEDDINGS (for ANN retrieval)
-- ============================================================================

-- Ensure post_embeddings table exists (from 0001_init)
-- Add additional columns if needed
ALTER TABLE post_embeddings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for fast ANN search (HNSW)
-- Note: This requires pgvector extension which should be enabled in 0001_init
-- CREATE INDEX IF NOT EXISTS idx_post_embeddings_hnsw ON post_embeddings 
--   USING hnsw (vec vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- USER EMBEDDINGS (for personalization)
-- ============================================================================

ALTER TABLE user_embeddings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for fast ANN search
-- CREATE INDEX IF NOT EXISTS idx_user_embeddings_hnsw ON user_embeddings 
--   USING hnsw (vec vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- CLUSTERS (SimClusters-lite)
-- ============================================================================

-- Ensure clusters table exists
ALTER TABLE clusters ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE clusters ADD COLUMN IF NOT EXISTS trending_posts UUID[] DEFAULT '{}';
ALTER TABLE clusters ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Cluster members with scores
ALTER TABLE cluster_members ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- POST ANALYTICS
-- ============================================================================

-- Add analytics columns to posts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS images_count INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS links_count INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS location_lat DECIMAL(10, 8);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS location_lng DECIMAL(11, 8);

-- Create index for analytics queries
CREATE INDEX IF NOT EXISTS idx_posts_analytics ON posts(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_class_section ON posts(class_tag, section_tag) 
  WHERE class_tag IS NOT NULL;

-- ============================================================================
-- USER EVENTS (for ranking signals)
-- ============================================================================

-- Ensure user_events table has proper indexes
CREATE INDEX IF NOT EXISTS idx_user_events_user_type ON user_events(user_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_target ON user_events(target_type, target_id, created_at DESC);

-- Create view for user interaction history
CREATE OR REPLACE VIEW user_interaction_summary AS
SELECT 
  user_id,
  target_id as author_id,
  COUNT(*) as interaction_count,
  SUM(weight) as affinity_score,
  MAX(created_at) as last_interaction
FROM user_events
WHERE event_type IN ('like', 'comment', 'share', 'profile_view', 'dwell')
  AND target_type = 'post'
GROUP BY user_id, target_id;

-- ============================================================================
-- ALGORITHM WEIGHTS
-- ============================================================================

-- Ensure algorithm_weights has all necessary fields
ALTER TABLE algorithm_weights ADD COLUMN IF NOT EXISTS simple_class_section DECIMAL(5, 2) DEFAULT 3.0;
ALTER TABLE algorithm_weights ADD COLUMN IF NOT EXISTS simple_class DECIMAL(5, 2) DEFAULT 2.0;
ALTER TABLE algorithm_weights ADD COLUMN IF NOT EXISTS simple_section DECIMAL(5, 2) DEFAULT 1.5;
ALTER TABLE algorithm_weights ADD COLUMN IF NOT EXISTS simple_location DECIMAL(5, 2) DEFAULT 1.2;
ALTER TABLE algorithm_weights ADD COLUMN IF NOT EXISTS simple_interaction DECIMAL(5, 2) DEFAULT 2.0;
ALTER TABLE algorithm_weights ADD COLUMN IF NOT EXISTS simple_interest DECIMAL(5, 2) DEFAULT 1.6;

-- Update default weights
UPDATE algorithm_weights 
SET simple_weights = jsonb_build_object(
  'class_section', simple_class_section,
  'class', simple_class,
  'section', simple_section,
  'location', simple_location,
  'interaction', simple_interaction,
  'interest', simple_interest
)
WHERE id = 1 AND simple_weights = '{}';

-- ============================================================================
-- RPCs FOR RANKING
-- ============================================================================

-- Get user interaction history
CREATE OR REPLACE FUNCTION get_user_interaction_history(p_user_id UUID)
RETURNS TABLE(author_id UUID, affinity_score DECIMAL) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.author_id,
    SUM(ue.weight * exp(-EXTRACT(EPOCH FROM (NOW() - ue.created_at)) / (30 * 24 * 3600))) as affinity
  FROM user_events ue
  JOIN posts p ON p.id = ue.target_id
  WHERE ue.user_id = p_user_id
    AND ue.event_type IN ('like', 'comment', 'share', 'profile_view', 'dwell')
    AND ue.target_type = 'post'
    AND ue.created_at > NOW() - INTERVAL '30 days'
  GROUP BY p.author_id
  ORDER BY affinity DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get trending posts in cluster
CREATE OR REPLACE FUNCTION get_trending_in_cluster(p_cluster_id UUID, p_limit INTEGER DEFAULT 10)
RETURNS TABLE(post_id UUID, score DECIMAL) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    (p.likes_count + p.comments_count * 2 + p.shares_count * 3) * 
    exp(-EXTRACT(EPOCH FROM (NOW() - p.created_at)) / (24 * 3600)) as trending_score
  FROM posts p
  JOIN cluster_members cm ON cm.user_id = p.author_id
  WHERE cm.cluster_id = p_cluster_id
    AND p.status = 'published'
    AND p.created_at > NOW() - INTERVAL '7 days'
  ORDER BY trending_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update cluster trending posts (called by cron)
CREATE OR REPLACE FUNCTION update_cluster_trending()
RETURNS INTEGER AS $$
DECLARE
  v_cluster RECORD;
  v_trending UUID[];
  v_count INTEGER := 0;
BEGIN
  FOR v_cluster IN SELECT id FROM clusters LOOP
    SELECT ARRAY_AGG(post_id) INTO v_trending
    FROM get_trending_in_cluster(v_cluster.id, 20);
    
    UPDATE clusters 
    SET trending_posts = COALESCE(v_trending, '{}'),
        updated_at = NOW()
    WHERE id = v_cluster.id;
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get cold-start posts (for exploration)
CREATE OR REPLACE FUNCTION get_cold_start_posts(p_limit INTEGER DEFAULT 50)
RETURNS TABLE(post_id UUID, author_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.author_id
  FROM posts p
  WHERE p.status = 'published'
    AND p.created_at > NOW() - INTERVAL '24 hours'
    AND p.impressions_count < 50
  ORDER BY p.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log dwell time
CREATE OR REPLACE FUNCTION log_dwell_time(
  p_post_id UUID,
  p_dwell_ms INTEGER
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_events (user_id, event_type, target_type, target_id, dwell_ms)
  VALUES (auth.uid(), 'dwell', 'post', p_post_id, p_dwell_ms);
  
  -- Update post impressions
  UPDATE posts 
  SET impressions_count = impressions_count + 1
  WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS FOR ANALYTICS
-- ============================================================================

-- Update post images count
CREATE OR REPLACE FUNCTION update_post_images_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET images_count = images_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET images_count = images_count - 1 WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER post_images_update_count AFTER INSERT OR DELETE ON post_images
  FOR EACH ROW EXECUTE FUNCTION update_post_images_count();

-- Update post links count
CREATE OR REPLACE FUNCTION update_post_links_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET links_count = links_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET links_count = links_count - 1 WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER post_links_update_count AFTER INSERT OR DELETE ON post_links
  FOR EACH ROW EXECUTE FUNCTION update_post_links_count();

-- ============================================================================
-- CLEANUP FUNCTIONS
-- ============================================================================

-- Purge old user events (30 days raw, keep aggregates)
CREATE OR REPLACE FUNCTION purge_old_events()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM user_events 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update cluster memberships (weekly label propagation)
CREATE OR REPLACE FUNCTION update_cluster_memberships()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_user RECORD;
  v_cluster UUID;
BEGIN
  -- Simple label propagation based on interests
  FOR v_user IN 
    SELECT id, interests FROM profiles WHERE status = 'approved'
  LOOP
    -- Find best matching cluster based on interests
    SELECT c.id INTO v_cluster
    FROM clusters c
    JOIN cluster_members cm ON cm.cluster_id = c.id
    JOIN profiles p ON p.id = cm.user_id
    WHERE p.interests && v_user.interests
    GROUP BY c.id
    ORDER BY COUNT(*) DESC
    LIMIT 1;
    
    IF v_cluster IS NOT NULL THEN
      INSERT INTO cluster_members (cluster_id, user_id, score)
      VALUES (v_cluster, v_user.id, 1.0)
      ON CONFLICT (cluster_id, user_id) DO UPDATE SET score = 1.0;
      
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VIEWS FOR ANALYTICS
-- ============================================================================

-- Post performance view
CREATE OR REPLACE VIEW post_performance AS
SELECT 
  p.id,
  p.author_id,
  p.title,
  p.created_at,
  p.likes_count,
  p.comments_count,
  p.shares_count,
  p.views_count,
  p.impressions_count,
  COALESCE(SUM(pds.views), 0) as total_views_30d,
  COALESCE(SUM(pds.impressions), 0) as total_impressions_30d,
  COALESCE(AVG(pds.dwell_ms), 0) as avg_dwell_ms,
  CASE 
    WHEN p.impressions_count > 0 
    THEN (p.likes_count + p.comments_count + p.shares_count)::DECIMAL / p.impressions_count
    ELSE 0 
  END as engagement_rate
FROM posts p
LEFT JOIN post_daily_stats pds ON pds.post_id = p.id 
  AND pds.day > CURRENT_DATE - INTERVAL '30 days'
WHERE p.status = 'published'
GROUP BY p.id;

-- Author stats view
CREATE OR REPLACE VIEW author_stats AS
SELECT 
  p.author_id,
  COUNT(*) as total_posts,
  SUM(p.likes_count) as total_likes,
  SUM(p.comments_count) as total_comments,
  SUM(p.shares_count) as total_shares,
  SUM(p.views_count) as total_views,
  AVG(p.likes_count) as avg_likes_per_post,
  AVG(p.comments_count) as avg_comments_per_post,
  MAX(p.created_at) as last_post_date
FROM posts p
WHERE p.status = 'published'
GROUP BY p.author_id;
