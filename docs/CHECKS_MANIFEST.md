# Checks Manifest

## TypeScript Lint (CHK-001 to CHK-006)
CHK-001: TypeScript strict mode enabled
CHK-002: No unused variables
CHK-003: No unused parameters
CHK-004: No implicit any
CHK-005: No fallthrough cases in switch
CHK-006: ESLint passes with zero warnings

## Unit Tests (CHK-007 to CHK-031)
CHK-007: Auth store unit tests
CHK-008: i18n store unit tests
CHK-009: Feed ranking unit tests
CHK-010: Post creation unit tests
CHK-011: Comment creation unit tests
CHK-012: Like/unlike unit tests
CHK-013: Follow/unfollow unit tests
CHK-014: Message sending unit tests
CHK-015: Notification creation unit tests
CHK-016: Search functionality unit tests
CHK-017: Handle validation unit tests
CHK-018: Password strength unit tests
CHK-019: Image upload validation unit tests
CHK-020: Document vault unit tests
CHK-021: Registration flow unit tests
CHK-022: Approval flow unit tests
CHK-023: Rejection flow unit tests
CHK-024: Academic year promotion unit tests
CHK-025: Push notification unit tests
CHK-026: Web Push encryption unit tests
CHK-027: Rate limiting unit tests
CHK-028: Block guard unit tests
CHK-029: Privilege escalation guard unit tests
CHK-030: Slug generation unit tests
CHK-031: Markdown stripping unit tests

## API Integration Tests (CHK-032 to CHK-046)
CHK-032: Supabase auth integration
CHK-033: Supabase realtime integration
CHK-034: ImgBB upload integration
CHK-035: Cloudflare Worker health check
CHK-036: Push outbox drain integration
CHK-037: Edge function FCM integration
CHK-038: URL unfurl integration
CHK-039: Client error reporting integration
CHK-040: Database connection integration
CHK-041: RPC function integration
CHK-042: Realtime subscriptions integration
CHK-043: File upload integration
CHK-044: Image processing integration
CHK-045: PDF generation integration
CHK-046: Email sending integration

## RLS Security Tests (CHK-047 to CHK-058)
CHK-047: Cross-user profile read blocked
CHK-048: Cross-user profile write blocked
CHK-049: Cross-user post edit blocked
CHK-050: Cross-user comment edit blocked
CHK-051: Cross-user message read blocked
CHK-052: Cross-user notification read blocked
CHK-053: Unauthenticated access blocked
CHK-054: Unapproved user write blocked
CHK-055: Role escalation blocked
CHK-056: Status change blocked for non-admin
CHK-057: Secure document access blocked
CHK-058: Push outbox access blocked

## E2E Journeys (CHK-059 to CHK-073)
CHK-059: Student registration journey
CHK-060: Teacher registration journey
CHK-061: Alumni registration journey
CHK-062: Guardian registration journey
CHK-063: Admin approval journey
CHK-064: Admin rejection journey
CHK-065: Login/logout journey
CHK-066: Post creation journey
CHK-067: Comment creation journey
CHK-068: Like/unlike journey
CHK-069: Follow/unfollow journey
CHK-070: Message sending journey
CHK-071: Notification receiving journey
CHK-072: Search journey
CHK-073: Settings update journey

## Responsive 15 Widths (CHK-074 to CHK-088)
CHK-074: 200px width renders correctly
CHK-075: 240px width renders correctly
CHK-076: 320px width renders correctly
CHK-077: 360px width renders correctly
CHK-078: 390px width renders correctly
CHK-079: 414px width renders correctly
CHK-080: 768px width renders correctly
CHK-081: 834px width renders correctly
CHK-082: 1024px width renders correctly
CHK-083: 1280px width renders correctly
CHK-084: 1440px width renders correctly
CHK-085: 1920px width renders correctly
CHK-086: 2560px width renders correctly
CHK-087: 3840px width renders correctly
CHK-088: 6000px width renders correctly

## Accessibility (CHK-089 to CHK-098)
CHK-089: WCAG 2.2 AA compliance
CHK-090: Axe accessibility scan passes
CHK-091: Skip link present and functional
CHK-092: Focus visible rings on all interactive elements
CHK-093: ARIA landmarks present
CHK-094: Alt text on all images
CHK-095: Touch targets ≥44px
CHK-096: Color contrast ratios meet AA
CHK-097: Reduced motion support
CHK-098: Screen reader friendly labels

## Lighthouse (CHK-099 to CHK-102)
CHK-099: Lighthouse Performance ≥95
CHK-100: Lighthouse Accessibility ≥95
CHK-101: Lighthouse Best Practices ≥95
CHK-102: Lighthouse SEO ≥95

## SEO Asserts (CHK-103 to CHK-114)
CHK-103: Title tag present on all pages
CHK-104: Meta description present on all pages
CHK-105: Canonical URL present on all pages
CHK-106: OG tags present on all pages
CHK-107: Twitter card tags present
CHK-108: JSON-LD structured data valid
CHK-109: Single h1 per page
CHK-110: Alt text coverage 100%
CHK-111: Sitemap accessible and valid
CHK-112: RSS feed accessible and valid
CHK-113: Robots.txt properly configured
CHK-114: Hreflang tags present

## Manifest Gates (CHK-115 to CHK-120)
CHK-115: POST- features ≥100
CHK-116: MSG- features ≥100
CHK-117: SEO- optimizations ≥1000
CHK-118: ADM- capabilities ≥1000
CHK-119: CHK- checks ≥100
CHK-120: Manifest checker script passes

## Bundle Budgets (CHK-121 to CHK-124)
CHK-121: Initial JS <180KB gzip
CHK-122: Route chunks <100KB each
CHK-123: Total bundle <500KB gzip
CHK-124: CSS <50KB gzip

## i18n (CHK-125 to CHK-127)
CHK-125: All UI strings i18n-keyed
CHK-126: Bangla translations complete
CHK-127: English translations complete

## Secret Scan (CHK-128 to CHK-129)
CHK-128: No secrets in source code
CHK-129: No API keys in client bundle

## Migration Lint (CHK-130 to CHK-132)
CHK-130: All migrations are additive
CHK-131: No destructive operations
CHK-132: Migrations apply cleanly

## Link Asset (CHK-133 to CHK-135)
CHK-133: No broken internal links
CHK-134: No broken image references
CHK-135: All assets accessible

## Console Zero (CHK-136 to CHK-137)
CHK-136: Zero console errors in production
CHK-137: Zero console warnings in production

## Uptime (CHK-138 to CHK-139)
CHK-138: Worker /healthz responds 200
CHK-139: Pages site responds 200

## Additional Checks (CHK-140 to CHK-150)
CHK-140: Service worker registers successfully
CHK-141: Push subscription works
CHK-142: Realtime subscriptions connect
CHK-143: Image lazy loading works
CHK-144: Infinite scroll pagination works
CHK-145: Form validation works
CHK-146: Error boundaries catch errors
CHK-147: 404 page renders correctly
CHK-148: Loading states display correctly
CHK-149: Empty states display correctly
CHK-150: Dark mode renders correctly
