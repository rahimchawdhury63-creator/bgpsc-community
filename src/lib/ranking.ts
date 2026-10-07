import { supabase } from '../supabase';
import type { Post, Profile } from '../../types/database';

// Advanced 4-stage ranking pipeline

interface RankingContext {
  viewer: Profile;
  viewerAcademics?: { current_class: number; section: string };
  viewerEmbedding?: number[];
  followedIds: string[];
  blockedIds: string[];
  mutedIds: string[];
  hiddenPostIds: string[];
  interactionHistory: Map<string, number>; // post_id -> affinity score
  location?: { lat: number; lng: number };
}

interface RankedPost extends Post {
  score: number;
  scoreBreakdown: {
    retrieval: number;
    lightRank: number;
    heavyRank: number;
    diversity: number;
    exploration: number;
  };
}

// Stage 1: Candidate Generation (Retrieval)
export async function retrieveCandidates(
  context: RankingContext,
  limit: number = 300
): Promise<Post[]> {
  const { viewer, followedIds, blockedIds, mutedIds, hiddenPostIds } = context;

  // Get in-network posts (from followed users)
  const { data: inNetworkPosts } = await supabase
    .from('posts')
    .select('*')
    .eq('status', 'published')
    .in('author_id', followedIds)
    .not('id', 'in', `(${[...blockedIds, ...mutedIds, ...hiddenPostIds].join(',')})`)
    .order('created_at', { ascending: false })
    .limit(limit / 2);

  // Get out-of-network posts (from clusters, trending, etc.)
  const { data: outNetworkPosts } = await supabase
    .from('posts')
    .select('*')
    .eq('status', 'published')
    .not('author_id', 'in', `(${[...followedIds, ...blockedIds, ...mutedIds].join(',')})`)
    .not('id', 'in', `(${hiddenPostIds.join(',')})`)
    .order('created_at', { ascending: false })
    .limit(limit / 2);

  // Combine and deduplicate
  const allPosts = [...(inNetworkPosts || []), ...(outNetworkPosts || [])];
  const uniquePosts = Array.from(new Map(allPosts.map(p => [p.id, p])).values());

  return uniquePosts.slice(0, limit);
}

// Stage 2: Light Ranking (Coarse Scoring)
export async function lightRank(
  candidates: Post[],
  context: RankingContext,
  limit: number = 120
): Promise<RankedPost[]> {
  const now = Date.now();
  const tau = 36 * 3600 * 1000; // 36 hours in ms

  const scored = candidates.map(post => {
    // Recency score (exponential decay)
    const age = now - new Date(post.created_at).getTime();
    const recencyScore = Math.exp(-age / tau);

    // Author affinity
    const authorAffinity = context.followedIds.includes(post.author_id) ? 2.0 : 1.0;

    // Language match
    const languageMatch = post.language === context.viewer.locale ? 1.2 : 1.0;

    // Media presence boost
    const mediaBoost = post.images_count > 0 ? 1.1 : 1.0;

    // Engagement velocity (likes/comments/shares per hour)
    const hoursSincePublish = Math.max(1, age / (3600 * 1000));
    const engagementVelocity =
      (post.likes_count + post.comments_count * 2 + post.shares_count * 3) / hoursSincePublish;

    // Light score
    const score = recencyScore * authorAffinity * languageMatch * mediaBoost * (1 + engagementVelocity * 0.1);

    return {
      ...post,
      score,
      scoreBreakdown: {
        retrieval: 1.0,
        lightRank: score,
        heavyRank: 0,
        diversity: 1.0,
        exploration: 0,
      },
    };
  });

  // Sort by score and take top N
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

// Stage 3: Heavy Ranking (Multi-task Scoring)
export async function heavyRank(
  candidates: RankedPost[],
  context: RankingContext
): Promise<RankedPost[]> {
  // Get algorithm weights
  const { data: weights } = await supabase
    .from('algorithm_weights')
    .select('*')
    .eq('id', 1)
    .single();

  const w = weights || {
    w_dwell: 0.35,
    w_comment: 0.20,
    w_share: 0.30,
    w_hide: 0.10,
    w_report: 0.05,
  };

  const scored = candidates.map(post => {
    // Feature vector (simplified - in production would use actual ML model)
    const features = {
      // User-post affinity
      authorAffinity: context.followedIds.includes(post.author_id) ? 1.0 : 0.3,
      interactionAffinity: context.interactionHistory.get(post.author_id) || 0.1,

      // Content features
      hasMedia: post.images_count > 0 ? 1.0 : 0.0,
      textLength: Math.min(1.0, (post.body_text?.length || 0) / 1000),
      hasLinks: post.links_count > 0 ? 1.0 : 0.0,

      // Engagement features
      likeRate: post.likes_count / Math.max(1, post.impressions_count),
      commentRate: post.comments_count / Math.max(1, post.impressions_count),
      shareRate: post.shares_count / Math.max(1, post.impressions_count),
      hideRate: 0.01, // Would track actual hide rate
      reportRate: 0.005, // Would track actual report rate

      // Context features
      classMatch: context.viewerAcademics?.current_class === post.class_tag ? 1.0 : 0.5,
      sectionMatch: context.viewerAcademics?.section === post.section_tag ? 1.0 : 0.5,
      languageMatch: post.language === context.viewer.locale ? 1.0 : 0.7,

      // Recency
      ageHours: (Date.now() - new Date(post.created_at).getTime()) / (3600 * 1000),
    };

    // Multi-task logistic heads (simplified)
    const p_dwell = sigmoid(features.authorAffinity * 2 + features.hasMedia + features.textLength);
    const p_comment = sigmoid(features.interactionAffinity + features.commentRate * 10);
    const p_share = sigmoid(features.shareRate * 15 + features.hasLinks);
    const p_hide = sigmoid(features.hideRate * 20 - features.authorAffinity);
    const p_report = sigmoid(features.reportRate * 30 - features.authorAffinity * 2);

    // Combined score
    const heavyScore =
      p_dwell * w.w_dwell +
      p_comment * w.w_comment +
      p_share * w.w_share -
      p_hide * w.w_hide -
      p_report * w.w_report;

    return {
      ...post,
      score: heavyScore,
      scoreBreakdown: {
        ...post.scoreBreakdown,
        heavyRank: heavyScore,
      },
    };
  });

  // Sort by heavy score
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

// Stage 4: Re-ranking & Diversity
export async function reRank(
  candidates: RankedPost[],
  context: RankingContext,
  finalLimit: number = 20
): Promise<RankedPost[]> {
  const epsilon = 0.07; // 7% exploration
  const results: RankedPost[] = [];
  const seenAuthors = new Map<string, number>();
  const seenTopics = new Map<string, number>();

  for (const post of candidates) {
    if (results.length >= finalLimit) break;

    // Diversity penalties
    const authorCount = seenAuthors.get(post.author_id) || 0;
    const authorPenalty = authorCount >= 2 ? 0.5 : 1.0; // Never 3+ consecutive from same author

    const topic = post.class_tag?.toString() || 'general';
    const topicCount = seenTopics.get(topic) || 0;
    const topicPenalty = topicCount / results.length > 0.4 ? 0.7 : 1.0; // Topic cap 40%

    // Apply diversity
    const diversityScore = authorPenalty * topicPenalty;

    // Exploration boost for new posts with low impressions
    const ageHours = (Date.now() - new Date(post.created_at).getTime()) / (3600 * 1000);
    const explorationBoost =
      ageHours < 24 && post.impressions_count < 50 ? 1.5 : 1.0;

    // Final score
    const finalScore = post.score * diversityScore * explorationBoost;

    // ε-greedy: randomly explore with probability epsilon
    const shouldExplore = Math.random() < epsilon;
    const exploreBoost = shouldExplore && ageHours < 24 ? 2.0 : 1.0;

    const rankedPost: RankedPost = {
      ...post,
      score: finalScore * exploreBoost,
      scoreBreakdown: {
        ...post.scoreBreakdown,
        diversity: diversityScore,
        exploration: exploreBoost,
      },
    };

    results.push(rankedPost);

    // Update tracking
    seenAuthors.set(post.author_id, authorCount + 1);
    seenTopics.set(topic, topicCount + 1);
  }

  // Sort by final score
  results.sort((a, b) => b.score - a.score);
  return results;
}

// Helper: Sigmoid function
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

// Main ranking pipeline
export async function rankFeed(
  context: RankingContext,
  limit: number = 20
): Promise<RankedPost[]> {
  // Stage 1: Retrieve candidates
  const candidates = await retrieveCandidates(context, 300);

  // Stage 2: Light ranking
  const lightRanked = await lightRank(candidates, context, 120);

  // Stage 3: Heavy ranking
  const heavyRanked = await heavyRank(lightRanked, context);

  // Stage 4: Re-ranking with diversity
  const finalRanked = await reRank(heavyRanked, context, limit);

  return finalRanked;
}

// Simple 4-step ranking (for new accounts with <30 interactions)
export async function simpleRank(
  posts: Post[],
  context: RankingContext,
  limit: number = 20
): Promise<RankedPost[]> {
  const { viewer, viewerAcademics, followedIds, location } = context;
  const tau = 36 * 3600 * 1000; // 36 hours

  const scored = posts.map(post => {
    // Step 1: Class/section affinity
    let classAffinity = 1.0;
    if (viewerAcademics && post.class_tag === viewerAcademics.current_class) {
      classAffinity = post.section_tag === viewerAcademics.section ? 3.0 : 2.0;
    } else if (post.section_tag === viewerAcademics?.section) {
      classAffinity = 1.5;
    }

    // Step 2: Location proximity (if available)
    let locationBoost = 1.0;
    if (location && post.location_lat && post.location_lng) {
      const distance = haversineDistance(
        location.lat,
        location.lng,
        post.location_lat,
        post.location_lng
      );
      if (distance < 10) {
        locationBoost = 1.2;
      }
    }

    // Step 3: Interactions (with decay)
    const interactionAffinity = Math.min(2.0, context.interactionHistory.get(post.author_id) || 1.0);

    // Step 4: Onboarding interests
    const interestOverlap = post.hashtags?.filter(tag => viewer.interests?.includes(tag)).length || 0;
    const interestBoost = interestOverlap > 0 ? 1.6 : 1.0;

    // Time decay
    const age = Date.now() - new Date(post.created_at).getTime();
    const timeDecay = Math.exp(-age / tau);

    // Following boost
    const followingBoost = followedIds.includes(post.author_id) ? 2.0 : 1.0;

    // Final score
    const score = classAffinity * locationBoost * interactionAffinity * interestBoost * timeDecay * followingBoost;

    return {
      ...post,
      score,
      scoreBreakdown: {
        retrieval: 1.0,
        lightRank: score,
        heavyRank: 0,
        diversity: 1.0,
        exploration: 0,
      },
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

// Helper: Haversine distance
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
