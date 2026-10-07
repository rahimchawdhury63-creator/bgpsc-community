import type { Message, Profile } from './database';

/**
 * Application-level shapes that sit on top of the generated schema types.
 *
 * These describe what the UI actually receives from a PostgREST query — a row
 * plus the relations it embeds — which is not something the schema generator
 * can know about, so they live here rather than in database.ts.
 */

/** The JSONB blob stored in `messages.attachment`. */
export type MessageAttachment = {
  type?: string;
  url?: string;
  name?: string;
  size?: number;
  mime?: string;
};

/** A row of `message_reactions`, embedded on a message as `reactions`. */
export type MessageReaction = {
  emoji: string;
  user_id: string;
};

/** The subset of `profiles` the messenger queries embed as `sender`. */
export type MessageSender = Pick<Profile, 'id' | 'handle' | 'full_name' | 'avatar_url'>;

/**
 * A message with its embedded joins.
 *
 * `read_at` / `delivered_at` are not columns on `messages` today; the bubble
 * reads them defensively and falls back to a single tick when they are absent.
 * They are declared optional so that behaviour is explicit rather than a
 * silent type error.
 */
export type RichMessage = Omit<Message, 'attachment'> & {
  attachment?: MessageAttachment | null;
  sender?: MessageSender | null;
  reply_to?: RichMessage | null;
  reactions?: MessageReaction[];
  read_at?: string | null;
  delivered_at?: string | null;
};

/**
 * The JSONB blob in `registration_applications.payload`. The per-role fields
 * vary (student/teacher/alumni/guardian), so the known shared keys are typed
 * and the rest stays open.
 */
export type RegistrationPayload = {
  full_name?: string;
  email?: string;
  handle?: string;
  [key: string]: unknown;
};

/** One notification type's channel toggles, inside `notification_prefs.prefs`. */
export type ChannelPrefs = {
  in_app?: boolean;
  push?: boolean;
};

/** The JSONB map stored in `notification_prefs.prefs`, keyed by notification type. */
export type NotificationPrefsMap = Record<string, ChannelPrefs>;
