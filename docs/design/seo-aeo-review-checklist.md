# DCM local review checklist and SEO / answer-engine audit

September 8, 2026. Local changes only; nothing committed or deployed.

## Start here: your review checklist

### 1. Homepage and visual presentation

- [ ] Open http://127.0.0.1:3000/ and watch a full rotation. Check card framing, scan animation, subgrades, the condition caption, and the rainbow outline for Gem Mint 10.
- [ ] Check the page on your phone and at 200% browser zoom. Confirm text reflows, no controls overlap, and the chat launcher does not cover offer text.
- [ ] On /why-dcm, confirm the Jordan Heritage card looks right and the portfolio, InstaList, label types, reports and other capabilities accurately represent DCM. The screenshot retry succeeded and the Jordan visual is present.
- [ ] Review /get-started and /instalist-marketplace for the clearer headings and initial content. Check /labels while it loads and after the designer opens.
- [ ] Check /vip and /card-lovers sliders, /credits FAQ alignment, and blog image framing on desktop and mobile.

### 2. Pricing and business facts

- [ ] On /credits, verify Basic $2.99 / 1 credit, Pro $9.99 / 5, Elite $19.99 / 20, and VIP $99 / 150. Check first-purchase bonuses against an eligible account.
- [ ] Confirm Card Lovers Monthly $49.99 / 70 credits and Annual $449 / 900 total credits, including its 60-credit annual bonus. Confirm that leading with the annual charge is intentional; $37.42 is the monthly equivalent, not monthly billing.
- [ ] Confirm free signup credits, membership perks, credit-expiry language, support details, legal company name, and social profile links.
- [ ] Read /ai-card-grading, /ai-card-grading-accuracy and /grading-standard together. Confirm the published method and limitations accurately describe the grading service. Review competitor prices and turnaround claims against their linked sources; their existing August 24 review date was preserved, not advanced without rechecking the facts.

### 3. Account and grading workflows

- [ ] Test existing-account login, new-account signup, password reset, and the signed-in versus signed-out CTAs. Sign-in intentionally accepts existing passwords; signup retains its minimum length.
- [ ] Test a card upload and grading result, then revisit it from My Collection. Confirm its grade, subgrades, condition text, front/back images and serial agree across screens.
- [ ] Download a report and each label format you use. Check Heritage, Modern and Traditional designs and print sizing.
- [ ] Check public and private card sharing. A private report's HTML/social metadata should not disclose the card name or photo.
- [ ] Walk through portfolio, Label Studio and InstaList while signed in. Check card selection and listing preview; publish only a listing you intentionally want live.

### 4. Search and sharing acceptance

- [ ] Open /ai-card-grading and follow its report, rubric, accuracy and comparison links. Confirm the explanatory body is present.
- [ ] Browse /blog and /blog?page=2; check categories, article titles, bylines, dates, related reading and image captions. Page two now has its own canonical; empty later pages return 404.
- [ ] Check a public Gengar report and its /verify/475225 link. Check a nonexistent card URL returns a not-found page.
- [ ] Review social share previews for the homepage, a blog post, a public card report and a private card report. Local previews cannot validate the live social platforms' caches.

### 5. Required before production

- [ ] Resolve the production dependency advisories from the prior review. npm audit reported critical findings in Next.js, jsPDF and transitive fast-xml-parser. Dependency upgrades and their regression testing were not folded into this SEO pass.
- [ ] Recheck the population report under realistic load. It returned a database statement timeout during the first crawl and succeeded on retry. Do not treat the successful retry as a load-test pass.
- [ ] Confirm database ownership/deletion schema compatibility. The sitemap supports the existing pre-migration fallback; verify the deletion migration before relying on soft-deleted-card exclusion in production.
- [ ] Run a final production build after the dependency and release changes. The design pass's clean build passed; this SEO pass was checked with TypeScript, route crawls and focused tests, not another final release build.
- [ ] Review the local changes and approve the release scope before any commit or deployment.

### 6. After an approved deployment

- [ ] In Google Search Console and Bing Webmaster Tools, submit/check https://dcmgrading.com/sitemap.xml and inspect the homepage, AI grading, Get Started, pricing, Why DCM, InstaList and one blog article.
- [ ] Confirm the selected canonical is the intended production URL, public pages are indexable, utility/private pages are excluded, and the preview query parameter is not being selected as canonical.
- [ ] Check Google's Search generative AI inclusion control if available for the property. This audit did not change account-level settings.
- [ ] Validate representative structured data with Google's Rich Results Test / Schema.org validator. FAQ markup is not a promise of a rich result or AI citation.
- [ ] Check Core Web Vitals with real production traffic and a phone. Local development timings include compilation and are not production performance measurements.
- [ ] Monitor impressions, indexed-page counts, crawl errors, conversions and actual answer-engine referrals/citations over time. Do not expect code changes to guarantee rankings or citations.

## What changed in the SEO pass

- Added route-specific canonicals to public pages that lacked them, removed duplicated brand suffixes, and completed missing social preview metadata.
- Added indexing exclusions for authentication, checkout-success, internal tools, account workflows, exports, store management and internal serial search. Public shared-collection URLs retain their explicit indexing policy and now have canonicals; the private collection dashboard remains excluded.
- Added metadata for the Sports and Star Wars databases. Application and personalized launch-kit pages use utility-page indexing rules.
- Updated Get Started, Why DCM and InstaList headings to identify their purpose plainly. InstaList and Label Studio now expose useful initial HTML instead of only a loading message.
- Corrected blog pagination canonical URLs and invalid page-number handling. Category-filter aliases redirect to the category route; empty later pages return 404.
- Expanded the sitemap to missing commercial/database pages and paginated its public-card query beyond the default 1,000-row limit. Removed /verify redirect aliases and Star Wars aliases in favor of destination routes. Added an hourly regeneration window and a 50,000-URL guard.
- Removed fabricated per-request last-modified dates. Blog and show records retain actual stored update timestamps; pages without a reliable content-update date omit it.
- Kept membership offer schema tied to the same pricing module as checkout. Corrected the existing llms.txt fact sheet and added current product-guide links. Removed the misleading authentication keyword from homepage metadata.
- Private and unknown-visibility card reports now return generic metadata before identity, grade or signed-image processing. Seven active templates are covered; Star Wars redirects to Other. Invalid and missing cards are validated in the server page and return HTTP 404. Page rendering and metadata share one request-scoped card lookup; public Gengar still returns HTTP 200.

## Verification and scope

- Inventoried 123 page route files, including dynamic, authenticated and internal routes; reviewed their metadata/indexing policies and shared templates.
- Crawled 59 concrete static public/utility URLs and sampled blog/category/pagination and public card routes. All 59 returned 200 after retrying one transient local /psa-alternative 404 and the population-report timeout. This is not a crawl of all 33,000-plus individual card reports.
- Validated 78 FAQ questions in the inspected page HTML against visible text; no missing questions or malformed JSON-LD were found in the crawl.
- Production-host canonicals, public indexing, utility exclusions, initial headings and duplicate title suffixes were checked from returned HTML. Hidden React streaming containers were excluded when counting initial visible headings.
- TypeScript passed. 25 focused tests passed: seven templates' private metadata and missing-card behavior, blog pagination, utility metadata, sitemap pagination/filtering, and the featured-card API.
- The sitemap returned 33,778 URLs in final verification; the exact total changes with public cards and posts. Internal serial search and redirect aliases are excluded.
- Remaining enhancement: most full card-report analysis is still rendered by the client. Metadata is server-rendered, but a future shared server-rendered public report summary would improve access for systems that do not execute JavaScript. Private analysis must stay behind authorization.
- Remaining enhancement: public card OG images use expiring signed URLs. A stable, privacy-checked social image endpoint would improve long-lived share previews; validate current previews before release.

## Why this approach

Google's current guidance treats generative-AI visibility as an extension of sound SEO: useful original content, crawlable pages, clear site structure and accurate information. There is no special schema or required llms.txt file for Google AI visibility. The existing fact sheet was made consistent, but it is not being treated as a ranking mechanism.

Sources: [Google's generative AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide), [Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

Detailed crawl artifacts: `tmp/design-audit/seo-pages-final.json`, `seo-visible-content.json`, `seo-dynamic.json`, and `seo-sitemap.xml`. The page review matrix is in `docs/design/seo-page-review.csv`.
