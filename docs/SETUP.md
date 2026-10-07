# BGPSC Students Community — Setup Guide

## Overview

**BGPSC Students Community** is the production community platform for **Shahid Olazar BGB Public School and College, Sylhet (BGPSC)**, Bangladesh.

- **Domain:** `https://bgpscian.bsdc.info.bd`
- **Developer:** Rizwan Rahim Chowdhury (Class 7, BGPSC)
- **Motto:** জ্ঞানই শক্তি, কর্মে মুক্তি (Knowledge is power, liberation in work)
- **Founded:** 1993

## Architecture

```
GitHub repo → GitHub Actions (CI/CD) → Cloudflare Pages + Worker + Supabase
```

### Stack (100% free tier)
- **Frontend:** Vite + React 18 + TypeScript (strict) + Tailwind CSS
- **Backend:** Supabase (Postgres + RLS + Auth + Realtime + Edge Functions + Storage)
- **Hosting:** Cloudflare Pages (static + Pages Functions)
- **Worker:** Cloudflare Workers (cron jobs, push dispatch)
- **Images:** ImgBB free API
- **Push:** Web Push (VAPID) + optional FCM

## Prerequisites

1. **GitHub account** with repo access
2. **Supabase project** (free tier)
3. **Cloudflare account** (free tier)
4. **ImgBB API key** (free)
5. **Domain** `bgpscian.bsdc.info.bd` configured

## Setup Steps

### 1. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run migrations in order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_rls_rpc.sql`
   - `supabase/migrations/0003_triggers_realtime.sql`
3. Enable **Realtime** for: messages, notifications, posts, comments, likes, follows
4. Note your **Project URL**, **anon key**, and **service_role key**

### 2. Cloudflare Setup

1. Create a **Pages** project connected to your GitHub repo
2. Create a **Worker** for push notifications
3. Add custom domain `bgpscian.bsdc.info.bd`
4. Configure environment variables (see below)

### 3. GitHub Secrets

Add these to your GitHub repo settings:

```
SUPABASE_ACCESS_TOKEN=<your-token>
SUPABASE_PROJECT_REF=<your-project-ref>
SUPABASE_DB_PASSWORD=<your-db-password>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
SUPABASE_ANON_KEY=<your-anon-key>
ADMIN_EMAIL=rrc@bsdc.info.bd
ADMIN_PASSWORD=<strong-password>
CLOUDFLARE_API_TOKEN=<your-token>
CLOUDFLARE_ACCOUNT_ID=<your-account-id>
CRON_SECRET=<random-string>
VAPID_PRIVATE_KEY=<generated>
VAPID_PUBLIC_KEY=<generated>
IMGBB_API_KEY=fdbfbcfd3bc5189e50a50c574515298d
```

### 4. Environment Variables

**Cloudflare Pages:**
```
VITE_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
VITE_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
VITE_PUBLIC_SITE_URL=https://bgpscian.bsdc.info.bd
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
IMGBB_API_KEY=fdbfbcfd3bc5189e50a50c574515298d
```

**Cloudflare Worker:**
```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
CRON_SECRET=<random-string>
VAPID_PRIVATE_KEY=<private-key>
VAPID_PUBLIC_KEY=<public-key>
VAPID_SUBJECT=mailto:rrc@bsdc.info.bd
```

### 5. Generate VAPID Keys

Use the repo-builder tool or run in Node:
```javascript
const webpush = require('web-push');
const vapidKeys = webpush.generateVAPIDKeys();
console.log(vapidKeys);
```

### 6. Deploy

1. Push to `main` branch
2. GitHub Actions will automatically:
   - Run migrations
   - Bootstrap admin user
   - Build and deploy to Cloudflare Pages
   - Deploy Worker
   - Deploy Edge Functions

### 7. Verify

1. Visit `https://bgpscian.bsdc.info.bd`
2. Login with admin credentials
3. Test registration flow
4. Test push notifications
5. Check admin panel

## Browser-Only Development

This project is designed for **browser-only development** on Android tablets:

1. Use **GitHub web UI** for code editing
2. Use **repo-builder tool** (`tools/repo-builder.html`) for bulk uploads
3. Use **Supabase dashboard** for database management
4. Use **Cloudflare dashboard** for deployment monitoring
5. All CLI operations happen in **GitHub Actions**

## Security

- **RLS** on every table
- **Secrets** never in client code
- **Magic byte** verification for uploads
- **Secure document vault** (SVG, immutable)
- **Privilege escalation guard** trigger
- **Secret scan** in CI

## Support

- **Developer:** Rizwan Rahim Chowdhury
- **Email:** rrc@bsdc.info.bd
- **Domain:** bgpscian.bsdc.info.bd

## License

Proprietary — BGPSC Students Community Platform
