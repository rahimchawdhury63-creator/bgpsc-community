import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/stores/auth';
import { useI18nStore } from '../lib/stores/i18n';
import type { PostType } from '../types/database';
import MarkdownToolbar from '../components/MarkdownToolbar';
import ImageUploader from '../components/ImageUploader';
import LinkPreview from '../components/LinkPreview';
import PollCreator from '../components/PollCreator';

export default function CreatePost() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();
  const { t } = useI18nStore();
  
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [postType, setPostType] = useState<PostType>('post');
  const [images, setImages] = useState<any[]>([]);
  const [linkPreviews, setLinkPreviews] = useState<any[]>([]);
  const [classTag, setClassTag] = useState<number | null>(null);
  const [sectionTag, setSectionTag] = useState<string>('');
  const [sensitive, setSensitive] = useState(false);
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [language, setLanguage] = useState('bn');
  const [poll, setPoll] = useState<any>(null);
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [isDraft, setIsDraft] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-detect links
  useEffect(() => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = body.match(urlRegex) || [];
    
    // Fetch previews for new URLs
    urls.forEach(async (url) => {
      if (!linkPreviews.find(lp => lp.url === url)) {
        try {
          const response = await fetch('/api/unfurl', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
          });
          const data = await response.json();
          setLinkPreviews(prev => [...prev, data]);
        } catch (err) {
          console.error('Failed to unfurl URL:', err);
        }
      }
    });
  }, [body]);

  // Auto-save draft
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (body || title) {
        localStorage.setItem('draft', JSON.stringify({ title, body, images, postType }));
      }
    }, 2000);
    return () => clearTimeout(timeout);
  }, [title, body, images, postType]);

  // Load draft on mount
  useEffect(() => {
    const draft = localStorage.getItem('draft');
    if (draft) {
      const parsed = JSON.parse(draft);
      setTitle(parsed.title || '');
      setBody(parsed.body || '');
      setImages(parsed.images || []);
      setPostType(parsed.postType || 'post');
    }
  }, []);

  const createPostMutation = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error('Not authenticated');

      // Create post
      const { data: post, error: postError } = await supabase
        .from('posts')
        .insert({
          author_id: profile.id,
          type: postType,
          title: title || null,
          body_md: body,
          class_tag: classTag,
          section_tag: sectionTag || null,
          sensitive,
          comments_enabled: commentsEnabled,
          language,
          status: isDraft ? 'hidden' : 'published',
          published_at: scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString(),
        })
        .select()
        .single();

      if (postError) throw postError;

      // Add images
      if (images.length > 0) {
        const imageInserts = images.map((img, idx) => ({
          post_id: post.id,
          url: img.url,
          width: img.width,
          height: img.height,
          alt: img.alt || null,
          caption: img.caption || null,
          position: idx,
          sha256: img.sha256,
        }));

        const { error: imgError } = await supabase.from('post_images').insert(imageInserts);
        if (imgError) throw imgError;
      }

      // Add link previews
      if (linkPreviews.length > 0) {
        const linkInserts = linkPreviews.map(lp => ({
          post_id: post.id,
          url: lp.url,
          host: lp.host,
          kind: lp.kind,
          title: lp.title,
          description: lp.description,
          image_url: lp.image_url,
          site_name: lp.site_name,
        }));

        const { error: linkError } = await supabase.from('post_links').insert(linkInserts);
        if (linkError) throw linkError;
      }

      // Add poll if present
      if (poll) {
        // Poll would be stored in a separate table or as JSON in post
        // For now, we'll skip poll implementation
      }

      // Clear draft
      localStorage.removeItem('draft');

      return post;
    },
    onSuccess: (post) => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['user-posts'] });
      navigate(`/post/${post.slug}`);
    },
  });

  const insertMarkdown = (before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = body.substring(start, end);
    const newText = body.substring(0, start) + before + selectedText + after + body.substring(end);
    
    setBody(newText);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    }, 0);
  };

  if (!profile || profile.status !== 'approved') {
    return <div className="card text-center py-12">You need an approved account to create posts</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="card">
        <h1 className="text-2xl font-bold mb-4">Create Post</h1>

        {/* Post Type Selector */}
        <div className="mb-4">
          <label className="label">Post Type</label>
          <div className="flex gap-2 mt-2">
            {(['post', 'notice', 'question', 'event', 'achievement', 'resource'] as PostType[]).map(type => (
              <button
                key={type}
                onClick={() => setPostType(type)}
                className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
                  postType === type
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div className="mb-4">
          <label className="label">Title (optional)</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input mt-1"
            placeholder="Add a title..."
          />
        </div>

        {/* Markdown Toolbar */}
        <MarkdownToolbar onInsert={insertMarkdown} />

        {/* Body */}
        <div className="mb-4">
          <label className="label">Content</label>
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="input mt-1 min-h-[300px] font-mono"
            placeholder="Write your post in Markdown..."
          />
          <div className="flex justify-between mt-1 text-sm text-gray-500">
            <span>{body.length} characters</span>
            <span>~{Math.ceil(body.split(/\s+/).length / 200)} min read</span>
          </div>
        </div>

        {/* Preview Toggle */}
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="btn btn-outline mb-4"
        >
          {showPreview ? 'Hide Preview' : 'Show Preview'}
        </button>

        {showPreview && (
          <div className="mb-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
            <h3 className="font-bold mb-2">Preview</h3>
            <div className="prose dark:prose-invert max-w-none">
              {body || <p className="text-gray-500">Nothing to preview</p>}
            </div>
          </div>
        )}

        {/* Image Uploader */}
        <div className="mb-4">
          <label className="label">Images (up to 10)</label>
          <ImageUploader images={images} onChange={setImages} maxImages={10} />
        </div>

        {/* Link Previews */}
        {linkPreviews.length > 0 && (
          <div className="mb-4 space-y-2">
            <label className="label">Link Previews</label>
            {linkPreviews.map((lp, idx) => (
              <LinkPreview
                key={idx}
                preview={lp}
                onRemove={() => setLinkPreviews(prev => prev.filter((_, i) => i !== idx))}
              />
            ))}
          </div>
        )}

        {/* Poll Creator (for post type) */}
        {postType === 'post' && (
          <div className="mb-4">
            <label className="label">Poll (optional)</label>
            <PollCreator poll={poll} onChange={setPoll} />
          </div>
        )}

        {/* Class/Section Tags */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Class Tag (optional)</label>
            <select
              value={classTag || ''}
              onChange={(e) => setClassTag(e.target.value ? parseInt(e.target.value) : null)}
              className="input mt-1"
            >
              <option value="">None</option>
              {Array.from({ length: 10 }, (_, i) => i + 3).map(c => (
                <option key={c} value={c}>Class {c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Section Tag (optional)</label>
            <select
              value={sectionTag}
              onChange={(e) => setSectionTag(e.target.value)}
              className="input mt-1"
              disabled={!classTag}
            >
              <option value="">None</option>
              {['A', 'B', 'C', 'D'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Language Selector */}
        <div className="mb-4">
          <label className="label">Language</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="input mt-1"
          >
            <option value="bn">বাংলা</option>
            <option value="en">English</option>
          </select>
        </div>

        {/* Sensitive Content */}
        <div className="mb-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={sensitive}
              onChange={(e) => setSensitive(e.target.checked)}
              className="rounded"
            />
            <span>Sensitive content (will be blurred)</span>
          </label>
        </div>

        {/* Comments Toggle */}
        <div className="mb-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={commentsEnabled}
              onChange={(e) => setCommentsEnabled(e.target.checked)}
              className="rounded"
            />
            <span>Allow comments</span>
          </label>
        </div>

        {/* Schedule */}
        <div className="mb-4">
          <label className="label">Schedule (optional)</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="input mt-1"
            min={new Date().toISOString().slice(0, 16)}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setIsDraft(false);
              createPostMutation.mutate();
            }}
            className="btn btn-primary flex-1"
            disabled={createPostMutation.isPending || !body.trim()}
          >
            {createPostMutation.isPending ? 'Publishing...' : 'Publish'}
          </button>
          <button
            onClick={() => {
              setIsDraft(true);
              createPostMutation.mutate();
            }}
            className="btn btn-outline"
            disabled={createPostMutation.isPending}
          >
            Save Draft
          </button>
        </div>

        {createPostMutation.isError && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            Error: {createPostMutation.error.message}
          </div>
        )}
      </div>
    </div>
  );
}
