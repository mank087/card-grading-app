# Static pages and blog design review

Local review only. Nothing committed or deployed.

This pass updates 23 static pages and all three public blog templates. The shared system uses navy feature panels, purple primary actions, white reading surfaces, consistent heading fonts, lighter borders, and reduced decorative gradients. Existing article content, comparison sources, policy text, SEO metadata, form handlers, and pricing sources remain in place.

The category landing headers now use reviewed public card records and the same Heritage renderer as the other redesigned pages. Blog cards allow full titles, the featured image fits without cropping, and category/pagination controls expose their current selection. The blog signup callout accurately describes account creation. The first-card guide now describes the new-account credit offer without claiming it is the viewer's current balance.

## Review links

| Page | Local preview |
| --- | --- |
| About DCM | [Open](http://127.0.0.1:3000/about) |
| Affiliate Program | [Open](http://127.0.0.1:3000/affiliates) |
| AI Card Grading Accuracy | [Open](http://127.0.0.1:3000/ai-card-grading-accuracy) |
| Card Grading Companies | [Open](http://127.0.0.1:3000/card-grading-companies) |
| Cheapest Card Grading | [Open](http://127.0.0.1:3000/cheapest-card-grading) |
| Fastest Card Grading | [Open](http://127.0.0.1:3000/fastest-card-grading) |
| Contact | [Open](http://127.0.0.1:3000/contact) |
| FAQ | [Open](http://127.0.0.1:3000/faq) |
| Recommended Products | [Open](http://127.0.0.1:3000/shop) |
| Grading Rubric | [Open](http://127.0.0.1:3000/grading-rubric) |
| Grading Limitations | [Open](http://127.0.0.1:3000/grading-limitations) |
| PSA Alternative | [Open](http://127.0.0.1:3000/psa-alternative) |
| Privacy Policy | [Open](http://127.0.0.1:3000/privacy) |
| Terms and Conditions | [Open](http://127.0.0.1:3000/terms) |
| Enterprise | [Open](http://127.0.0.1:3000/enterprise) |
| Enterprise Terms | [Open](http://127.0.0.1:3000/enterprise/terms) |
| Enterprise Application | [Open](http://127.0.0.1:3000/enterprise/apply) |
| Enterprise Launch Kit | [Open](http://127.0.0.1:3000/enterprise/launch-kit) |
| Grade Your First Card | [Open](http://127.0.0.1:3000/grade-your-first-card) |
| Card Grading | [Open](http://127.0.0.1:3000/card-grading) |
| Pokémon Card Grading | [Open](http://127.0.0.1:3000/pokemon-grading) |
| Sports Card Grading | [Open](http://127.0.0.1:3000/sports-grading) |
| Card Shows | [Open](http://127.0.0.1:3000/card-shows) |
| Blog | [Open](http://127.0.0.1:3000/blog) |
| Blog article template | [Open](http://127.0.0.1:3000/blog/card-centering-explained) |
| Blog category template | [Open](http://127.0.0.1:3000/blog/category/grading-guides) |

“How DCM Optic Works” links to [/ai-card-grading](http://127.0.0.1:3000/ai-card-grading), which was redesigned in the earlier pass. The Founders route continues to redirect to Card Lovers.

## Verification

- All 26 routes/templates returned HTTP 200 and the shared editorial styling marker.
- Desktop browser inspection covered the blog index, category, article, PSA comparison, first-card guide, and sports landing page; checked pages had no horizontal page overflow.
- Syntax checks passed for all 31 changed TypeScript/TSX files in this pass.
- Full TypeScript check reports the seven pre-existing Recharts formatter errors in admin analytics/costs/revenue; no new errors in this pass.
- No accounts, applications, purchases, contact messages, or card grades were submitted during review.
- Dedicated mobile-device and signed-in form submission testing remain for local acceptance review.

This is a public content-page styling pass. Administrative pages, searchable card databases, and organization-owned storefront designs are not included.
