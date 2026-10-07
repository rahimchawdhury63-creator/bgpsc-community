module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:5173/',
        'http://localhost:5173/post/test-post',
        'http://localhost:5173/@testuser',
        'http://localhost:5173/search',
      ],
      startServerCommand: 'npm run preview',
      startServerReadyPattern: 'Local:',
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        // Performance budgets
        'categories:performance': ['error', { minScore: 0.95 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:seo': ['error', { minScore: 0.95 }],
        
        // Core Web Vitals
        'largest-contentful-paint': ['error', { maxNumericValue: 2000 }], // LCP < 2.0s
        'first-input-delay': ['error', { maxNumericValue: 100 }], // FID < 100ms
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.05 }], // CLS < 0.05
        'interactive': ['error', { maxNumericValue: 3800 }], // TTI < 3.8s
        'first-contentful-paint': ['error', { maxNumericValue: 1800 }], // FCP < 1.8s
        'speed-index': ['error', { maxNumericValue: 3400 }], // SI < 3.4s
        'total-blocking-time': ['error', { maxNumericValue: 200 }], // TBT < 200ms
        'max-potential-fid': ['error', { maxNumericValue: 150 }], // INP < 150ms
        
        // Resource budgets
        'total-byte-weight': ['error', { maxNumericValue: 500000 }], // < 500KB
        'resource-summary:document:size': ['error', { maxNumericValue: 50000 }], // HTML < 50KB
        'resource-summary:script:size': ['error', { maxNumericValue: 180000 }], // JS < 180KB
        'resource-summary:stylesheet:size': ['error', { maxNumericValue: 50000 }], // CSS < 50KB
        'resource-summary:image:size': ['error', { maxNumericValue: 200000 }], // Images < 200KB
        'resource-summary:font:size': ['error', { maxNumericValue: 100000 }], // Fonts < 100KB
        
        // Best practices
        'errors-in-console': ['error', { maxLength: 0 }], // Zero console errors
        'no-document-write': 'error',
        'uses-http2': 'error',
        'uses-long-cache-ttl': 'warn',
        'uses-text-compression': 'error',
        'uses-responsive-images': 'warn',
        'offscreen-images': 'warn',
        'render-blocking-resources': 'error',
        'unminified-css': 'error',
        'unminified-javascript': 'error',
        'unused-css-rules': 'warn',
        'unused-javascript': 'warn',
        'modern-image-formats': 'warn',
        'uses-optimized-images': 'warn',
        'uses-webp-images': 'warn',
        'uses-efficient-animated-images': 'warn',
        'font-display': 'error',
        'third-party-summary': 'warn',
        'uses-passive-event-listeners': 'error',
        'dom-size': ['warn', { maxLength: 1500 }],
        'critical-request-chains': 'warn',
        'user-timings': 'warn',
        'bootup-time': ['warn', { maxNumericValue: 3000 }],
        'mainthread-work-breakdown': 'warn',
        'font-display': 'error',
        'network-requests': 'warn',
        'network-rtt': ['warn', { maxNumericValue: 150 }],
        'network-server-latency': ['warn', { maxNumericValue: 500 }],
        'main-thread-tasks': 'warn',
        'metrics': 'warn',
        'screenshot-thumbnails': 'warn',
        'final-screenshot': 'warn',
        
        // SEO
        'viewport': 'error',
        'document-title': 'error',
        'meta-description': 'error',
        'http-status-code': 'error',
        'link-text': 'warn',
        'crawlable-anchors': 'error',
        'is-crawlable': 'error',
        'robots-txt': 'error',
        'hreflang': 'error',
        'canonical': 'error',
        'font-size': 'error',
        'plugins': 'error',
        'tap-targets': 'error',
        'structured-data': 'warn',
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
