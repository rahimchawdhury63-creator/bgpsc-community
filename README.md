# BGPSC Students Community

**শহীদ ওলাজার বিজিবি পাবলিক স্কুল এন্ড কলেজ, সিলেট**  
*Shahid Olazar BGB Public School and College, Sylhet*

**জ্ঞানই শক্তি, কর্মে মুক্তি**  
*Knowledge is power, liberation in work*

---

## Overview

BGPSC Students Community is the official community platform for students, teachers, alumni, and guardians of BGPSC. Built with modern web technologies and designed for browser-only development on Android tablets.

**Live Site:** https://bgpscian.bsdc.info.bd  
**Founded:** 1993  
**Developer:** Rizwan Rahim Chowdhury (Class 7, BGPSC)

## Features

### Core Functionality
- 🎓 **Multi-role Registration** - Students (Class 3-12), Teachers, Alumni, Guardians
- ✅ **Admin Approval Workflow** - Secure registration with document verification
- 📝 **Rich Post System** - Markdown, images, polls, events, notices
- 💬 **Real-time Messenger** - Direct messages, group chats, reactions
- 🔔 **Push Notifications** - Web Push + FCM with quiet hours
- 🔍 **Smart Search** - Full-text search across posts, users, and content
- 📊 **Analytics Dashboard** - Engagement metrics and insights
- 🛡️ **Admin Panel** - Complete moderation and management tools

### Technical Highlights
- 🚀 **Performance** - LCP <2s, CLS <0.05, INP <150ms
- 🔒 **Security** - Row Level Security, privilege escalation guards
- 🌍 **i18n** - Bangla (default) + English with runtime switching
- 📱 **Responsive** - 200px to 6000px fluid design
- ♿ **Accessible** - WCAG 2.2 AA compliant
- 🎨 **Design System** - Based on official school logo colors

## Tech Stack

### Frontend
- **React 18** + **TypeScript** (strict mode)
- **Vite** for fast builds
- **Tailwind CSS** for styling
- **Zustand** for state management
- **React Query** for data fetching
- **Supabase JS Client** for backend integration

### Backend
- **Supabase** (Postgres + Auth + Realtime + Storage)
- **Cloudflare Pages** for hosting
- **Cloudflare Workers** for cron jobs
- **ImgBB** for image hosting
- **Web Push** + **FCM** for notifications

### Infrastructure
- **GitHub Actions** for CI/CD
- **Cloudflare** for CDN and edge functions
- **100% Free Tier** - No paid services

## Architecture

```
GitHub Repo
├─ .github/workflows/     CI/CD pipelines
├─ supabase/migrations/   Database schema + RLS
├─ supabase/functions/    Edge functions (FCM relay)
├─ functions/api/         Cloudflare Pages Functions
├─ worker/                Cloudflare Worker (cron + push)
├─ src/                   React application
├─ public/                Static assets + service worker
├─ scripts/               Build + validation scripts
├─ docs/                  Manifests + documentation
└─ tools/                 Browser-based utilities
```

## Getting Started

### Prerequisites
1. GitHub account with repo access
2. Supabase project (free tier)
3. Cloudflare account (free tier)
4. ImgBB API key (free)
5. Domain: `bgpscian.bsdc.info.bd`

### Setup

See [docs/SETUP.md](docs/SETUP.md) for complete setup instructions.

**Quick Start:**
1. Clone repository
2. Create Supabase project
3. Run migrations in SQL Editor
4. Configure Cloudflare Pages
5. Add GitHub secrets
6. Push to `main` - CI/CD handles the rest!

### Browser-Only Development

This project is designed for **Android tablet development**:
- Use GitHub web UI for code editing
- Use `tools/repo-builder.html` for bulk uploads
- Use Supabase dashboard for database management
- All CLI operations run in GitHub Actions

## Documentation

- [Setup Guide](docs/SETUP.md) - Complete setup instructions
- [Features Manifest](docs/FEATURES_MANIFEST.md) - 110 POST + 108 MSG features
- [SEO Manifest](docs/SEO_MANIFEST.md) - 1300 SEO optimizations
- [Admin Manifest](docs/ADMIN_MANIFEST.md) - 1000 admin capabilities
- [Checks Manifest](docs/CHECKS_MANIFEST.md) - 150 quality checks

## Key Features

### Registration System
- **4 Role Types:** Student, Teacher, Alumni, Guardian
- **Multi-step Wizard:** Personal info → Role-specific → Documents → Password
- **Secure Document Vault:** SVG-based immutable storage
- **Admin Approval:** Real-time queue with editable payloads
- **PDF Receipts:** Print-optimized registration confirmations

### Feed & Ranking
- **Simple Ranking:** Class/section affinity + location + interactions + interests
- **Advanced Pipeline:** Embeddings → Light ranking → Heavy ranking → Diversity
- **SimClusters-lite:** Topic-based clustering
- **ε-greedy Exploration:** 7% exploration slots
- **Real-time Updates:** Supabase Realtime integration

### Messenger
- **Real-time Delivery:** No polling, instant updates
- **Rich Features:** Reactions, replies, forwarding, stars, pins
- **Group Chats:** Roles, permissions, media galleries
- **Passcode Lock:** WebCrypto AES-GCM encryption
- **Smart Scrolling:** Auto-pause when scrolled up

### Push Notifications
- **Web Push:** VAPID ES256 + RFC 8291
- **FCM Support:** Optional Firebase integration
- **Quiet Hours:** Asia/Dhaka timezone support
- **Per-type Controls:** Granular notification preferences
- **Offline Queue:** Background sync support

### Admin Panel
- **Approval Queue:** Real-time with document viewer
- **User Management:** Edit any field, role changes, badges
- **Content Moderation:** Reports, appeals, bulk actions
- **Analytics:** Growth, engagement, retention metrics
- **SEO Console:** Overrides, redirects, sitemap status
- **Algorithm Tuning:** Weight sliders, exploration rate

## Security

### Database Security
- **Row Level Security** on every table
- **Security Definer RPCs** with pinned search_path
- **Privilege Escalation Guard** trigger
- **Secure Document Vault** (immutable, audit-logged)
- **Magic Byte Verification** for uploads

### Application Security
- **Secrets** never in client code
- **JWT Authentication** for all API calls
- **Rate Limiting** on sensitive operations
- **Input Validation** on all forms
- **XSS Prevention** with sanitization

## Performance

### Core Web Vitals
- **LCP:** <2.0s on 4G
- **FID:** <100ms
- **CLS:** <0.05
- **INP:** <150ms

### Optimizations
- Route-level code splitting
- Immutable hashed assets
- Critical CSS inline
- Lazy loading images
- Preload critical resources
- Brotli compression

## Accessibility

- **WCAG 2.2 AA** compliant
- **Skip links** for keyboard navigation
- **Focus visible** rings on all interactive elements
- **ARIA landmarks** and roles
- **Alt text** on all images
- **Touch targets** ≥44px
- **Reduced motion** support
- **Screen reader** friendly labels

## Internationalization

- **Bangla (বাংলা)** - Default language
- **English** - Full translation
- **Runtime switching** - No page reload
- **Admin-editable** strings
- **i18n-keyed** UI components

## Design System

### Colors (from school logo)
- **Brand-700:** #800060 (Magenta ring)
- **Brand-400:** #D04090 (Pink shield)
- **Gold-500:** #D0A040 (Gold accents)
- **Cyan-500:** #00A0F0 (Cyan book)
- **Paper:** #F0F0F0 (Background)

### Typography
- **Bangla:** Hind Siliguri / Noto Sans Bengali
- **English:** System font stack
- **Fluid scale:** clamp() for responsive sizing

## Testing

### Automated Tests
- **TypeScript:** Strict type checking
- **Unit Tests:** Vitest for core logic
- **E2E Tests:** Playwright for user journeys
- **Accessibility:** Axe scans
- **Performance:** Lighthouse CI
- **Security:** RLS attack tests

### Quality Gates
- Zero console errors
- Manifest thresholds enforced
- Secret scan clean
- Bundle size budgets
- Migration lint

## Deployment

### CI/CD Pipeline
1. **Type Check** - TypeScript strict mode
2. **Build** - Production bundle
3. **Manifest Check** - Feature counts
4. **Secret Scan** - No leaked credentials
5. **Migration** - Apply to Supabase
6. **Bootstrap Admin** - Create owner account
7. **Deploy Pages** - Cloudflare Pages
8. **Deploy Worker** - Cloudflare Worker
9. **Deploy Functions** - Edge functions

### Environments
- **Production:** `main` branch → bgpscian.bsdc.info.bd
- **Preview:** PR branches → preview URLs

## Monitoring

### Observability
- **Error Monitoring** - Client error beacon
- **Performance Monitoring** - Web Vitals
- **Uptime Monitoring** - Worker health checks
- **Audit Logs** - All admin actions
- **Heartbeats** - Cron job status

## Support

**Developer:** Rizwan Rahim Chowdhury  
**Email:** rrc@bsdc.info.bd  
**School:** Shahid Olazar BGB Public School and College, Sylhet  
**Domain:** bgpscian.bsdc.info.bd

## License

Proprietary - BGPSC Students Community Platform

## Acknowledgments

- **BGPSC Administration** for support and guidance
- **Students and Teachers** for feedback and testing
- **Open Source Community** for amazing tools and libraries
- **Supabase, Cloudflare, and GitHub** for free tier services

---

**জ্ঞানই শক্তি, কর্মে মুক্তি**  
*Built with ❤️ by a Class 7 student for the BGPSC community*
