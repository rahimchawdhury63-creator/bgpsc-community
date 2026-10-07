// Database types generated from schema
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at' | 'fts'>;
        Update: Partial<Profile>;
      };
      posts: {
        Row: Post;
        Insert: Omit<Post, 'id' | 'created_at' | 'updated_at' | 'fts' | 'likes_count' | 'comments_count' | 'shares_count' | 'views_count' | 'impressions_count'>;
        Update: Partial<Post>;
      };
      comments: {
        Row: Comment;
        Insert: Omit<Comment, 'id' | 'created_at' | 'updated_at' | 'fts' | 'likes_count' | 'depth' | 'path'>;
        Update: Partial<Comment>;
      };
      likes: {
        Row: Like;
        Insert: Omit<Like, 'created_at'>;
        Update: Partial<Like>;
      };
      follows: {
        Row: Follow;
        Insert: Omit<Follow, 'created_at'>;
        Update: Partial<Follow>;
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, 'id' | 'created_at'>;
        Update: Partial<Notification>;
      };
      conversations: {
        Row: Conversation;
        Insert: Omit<Conversation, 'id' | 'created_at'>;
        Update: Partial<Conversation>;
      };
      messages: {
        Row: Message;
        Insert: Omit<Message, 'id' | 'created_at'>;
        Update: Partial<Message>;
      };
      registration_applications: {
        Row: RegistrationApplication;
        Insert: Omit<RegistrationApplication, 'id' | 'submitted_at' | 'decided_at' | 'decided_by'>;
        Update: Partial<RegistrationApplication>;
      };
      [key: string]: any;
    };
    Views: {
      public_academics: {
        Row: PublicAcademics;
      };
    };
    Functions: {
      follow_user: { Args: { p_following_id: string }; Returns: void };
      unfollow_user: { Args: { p_following_id: string }; Returns: void };
      like_post: { Args: { p_post_id: string }; Returns: void };
      unlike_post: { Args: { p_post_id: string }; Returns: void };
      add_comment: { Args: { p_post_id: string; p_parent_id?: string; p_body: string; p_images?: any }; Returns: string };
      send_message: { Args: { p_conv_id: string; p_body: string; p_reply_to_id?: string; p_attachment?: any }; Returns: string };
      get_or_create_dm: { Args: { p_other_user_id: string }; Returns: string };
      search_all: { Args: { p_query: string; p_limit?: number }; Returns: SearchResult[] };
      feed_simple: { Args: { p_viewer: string; p_limit?: number; p_offset?: number; p_lat?: number; p_lng?: number }; Returns: { post_id: string }[] };
      submit_application: { Args: { p_role: UserRole; p_payload: any }; Returns: string };
      decide_application: { Args: { p_app_id: string; p_approve: boolean; p_reason?: string; p_edits?: any }; Returns: void };
    };
    Enums: {
      user_role: UserRole;
      app_status: AppStatus;
      post_type: PostType;
      post_status: PostStatus;
      notification_type: NotificationType;
    };
  };
}

export type UserRole = 'student' | 'teacher' | 'alumni' | 'guardian' | 'admin';
export type AppStatus = 'pending' | 'under_review' | 'approved' | 'rejected';
export type PostType = 'post' | 'notice' | 'question' | 'event' | 'achievement' | 'resource';
export type PostStatus = 'published' | 'hidden' | 'deleted';
export type NotificationType = 'approval_update' | 'new_follower' | 'like' | 'comment' | 'reply' | 'mention' | 'message' | 'message_request' | 'notice' | 'system' | 'promotion' | 'report_update' | 'badge' | 'year_update';

export interface Profile {
  id: string;
  handle: string;
  full_name: string;
  email: string;
  role: UserRole;
  status: AppStatus;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  website_url: string | null;
  location_text: string | null;
  lat: number | null;
  lng: number | null;
  location_consent: boolean;
  notif_consent: boolean;
  theme_accent: string;
  pronouns: string | null;
  verified: boolean;
  onboarded: boolean;
  interests: string[];
  show_dwell: boolean;
  locale: string;
  created_at: string;
  updated_at: string;
  fts: any;
}

export interface Post {
  id: string;
  author_id: string;
  type: PostType;
  title: string | null;
  body_md: string | null;
  body_text: string | null;
  slug: string;
  class_tag: number | null;
  section_tag: string | null;
  location: string | null;
  language: string;
  comments_enabled: boolean;
  sensitive: boolean;
  pinned: boolean;
  status: PostStatus;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  views_count: number;
  impressions_count: number;
  hashtags: string[];
  mentions: string[];
  created_at: string;
  updated_at: string;
  published_at: string;
  fts: any;
}

export interface Comment {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_id: string;
  depth: number;
  path: string;
  body_md: string;
  body_text: string | null;
  images: any;
  likes_count: number;
  status: PostStatus;
  created_at: string;
  updated_at: string;
  fts: any;
}

export interface Like {
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface Follow {
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  actor_id: string | null;
  body_text: string;
  link: string | null;
  payload: any;
  read_at: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  kind: 'dm' | 'group';
  title: string | null;
  avatar: string | null;
  last_message_at: string | null;
  preview: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body_md: string | null;
  body_text: string | null;
  reply_to_id: string | null;
  attachment: any;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
}

export interface RegistrationApplication {
  id: string;
  applicant_id: string;
  role: UserRole;
  payload: any;
  status: AppStatus;
  attempt: number;
  submitted_at: string;
  decided_at: string | null;
  decided_by: string | null;
  reason: string | null;
}

export interface PublicAcademics {
  user_id: string;
  current_class: number;
  section: string | null;
  roll: number | null;
  academic_year: number;
  graduated: boolean;
}

export interface SearchResult {
  result_type: string;
  id: string;
  title: string;
  subtitle: string;
  url: string;
  rank: number;
}

export interface PostWithAuthor extends Post {
  author: Profile;
  images?: PostImage[];
  links?: PostLink[];
}

export interface PostImage {
  id: string;
  post_id: string;
  url: string;
  width: number | null;
  height: number | null;
  alt: string | null;
  caption: string | null;
  position: number;
  sha256: string | null;
}

export interface PostLink {
  id: string;
  post_id: string;
  url: string;
  host: string | null;
  kind: string | null;
  title: string | null;
  description: string | null;
  image_url: string | null;
  site_name: string | null;
}

export interface CommentWithAuthor extends Comment {
  author: Profile;
  replies?: CommentWithAuthor[];
}
