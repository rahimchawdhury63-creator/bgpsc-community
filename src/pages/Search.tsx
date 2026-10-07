import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useI18nStore } from '../lib/stores/i18n';
import type { SearchResult } from '../types/database';

export default function Search() {
  const { t } = useI18nStore();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filters, setFilters] = useState({
    type: '',
    class: '',
    author: '',
    dateFrom: '',
    dateTo: '',
  });

  // Debounce query
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(query);
    }, 220);
    return () => clearTimeout(timeout);
  }, [query]);

  // Search with filters
  const { data: results, isLoading } = useQuery({
    queryKey: ['search', debouncedQuery, filters],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];

      // Parse search operators
      const parsed = parseSearchQuery(debouncedQuery);
      
      const { data } = await supabase.rpc('search_all', {
        p_query: parsed.query,
        p_limit: 50,
      });

      let filtered = data as SearchResult[];

      // Apply filters
      if (filters.type) {
        filtered = filtered.filter(r => r.result_type === filters.type);
      }
      if (parsed.class) {
        filtered = filtered.filter(r => r.subtitle?.includes(`Class ${parsed.class}`));
      }
      if (parsed.author) {
        filtered = filtered.filter(r => r.subtitle?.toLowerCase().includes(parsed.author.toLowerCase()));
      }

      return filtered;
    },
    enabled: debouncedQuery.length >= 2,
  });

  // Log search for trending
  useEffect(() => {
    if (debouncedQuery && results) {
      supabase.from('search_logs').insert({
        query: debouncedQuery,
        results_count: results.length,
      });
    }
  }, [debouncedQuery, results]);

  const parseSearchQuery = (q: string) => {
    let query = q;
    let classFilter = '';
    let authorFilter = '';
    let tagFilter = '';

    // Extract operators
    const classMatch = query.match(/class:(\d+)/i);
    if (classMatch) {
      classFilter = classMatch[1];
      query = query.replace(classMatch[0], '').trim();
    }

    const authorMatch = query.match(/@([a-z0-9_]+)/i);
    if (authorMatch) {
      authorFilter = authorMatch[1];
      query = query.replace(authorMatch[0], '').trim();
    }

    const tagMatch = query.match(/#([a-z0-9_\u0980-\u09FF]+)/i);
    if (tagMatch) {
      tagFilter = tagMatch[1];
      query = query.replace(tagMatch[0], '').trim();
    }

    return { query, class: classFilter, author: authorFilter, tag: tagFilter };
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <h1 className="text-2xl font-bold">{t('search.title') || 'Search'}</h1>

      {/* Search Input */}
      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search posts, people, tags... (try: class:7 @user #tag)"
          className="input text-lg"
          autoFocus
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          </div>
        )}
      </div>

      {/* Search Tips */}
      <div className="card text-sm">
        <h3 className="font-semibold mb-2">Search Operators</h3>
        <div className="grid grid-cols-2 gap-2 text-gray-600 dark:text-gray-400">
          <div><code>class:7</code> - Filter by class</div>
          <div><code>@username</code> - Search by author</div>
          <div><code>#tag</code> - Search by hashtag</div>
          <div><code>"exact phrase"</code> - Exact match</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <h3 className="font-semibold mb-3">Filters</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            className="input text-sm"
          >
            <option value="">All Types</option>
            <option value="post">Posts</option>
            <option value="user">People</option>
            <option value="tag">Tags</option>
          </select>

          <select
            value={filters.class}
            onChange={(e) => setFilters({ ...filters, class: e.target.value })}
            className="input text-sm"
          >
            <option value="">All Classes</option>
            {Array.from({ length: 10 }, (_, i) => i + 3).map(c => (
              <option key={c} value={c}>Class {c}</option>
            ))}
          </select>

          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
            placeholder="From"
            className="input text-sm"
          />

          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
            placeholder="To"
            className="input text-sm"
          />
        </div>
      </div>

      {/* Results */}
      <div className="space-y-3">
        {results?.length === 0 && debouncedQuery.length >= 2 && (
          <div className="card text-center py-8">
            <div className="text-4xl mb-2">🔍</div>
            <p className="text-gray-600 dark:text-gray-400">
              No results found for "{debouncedQuery}"
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Try different keywords or remove filters
            </p>
          </div>
        )}

        {results?.map(result => (
          <Link
            key={`${result.result_type}-${result.id}`}
            to={result.url}
            className="card block hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="text-2xl flex-shrink-0">
                {result.result_type === 'user' && '👤'}
                {result.result_type === 'post' && '📝'}
                {result.result_type === 'tag' && '🏷️'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{result.title}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {result.subtitle}
                </div>
                {result.result_type === 'post' && (
                  <div className="text-xs text-gray-500 mt-1">
                    Rank: {result.rank.toFixed(2)}
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Trending Searches */}
      {!debouncedQuery && (
        <div className="card">
          <h3 className="font-semibold mb-3">Trending Searches</h3>
          <div className="flex flex-wrap gap-2">
            {['exams', 'sports', 'events', 'notices', 'class 10'].map(term => (
              <button
                key={term}
                onClick={() => setQuery(term)}
                className="rounded-full bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
