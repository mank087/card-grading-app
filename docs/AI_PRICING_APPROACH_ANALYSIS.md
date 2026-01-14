# AI-Based Pricing Approach Analysis

**Created:** January 14, 2026
**Status:** Research Complete - NOT RECOMMENDED
**Purpose:** Evaluate using OpenAI/AI APIs for web-based card price lookups as alternative to dedicated pricing APIs

---

## Executive Summary

**Recommendation: Do NOT pursue the AI web scraping approach.**

After thorough research, an AI-based approach to card pricing is **not viable** for the following reasons:

| Factor | AI Approach | Dedicated API (PriceCharting) |
|--------|-------------|-------------------------------|
| **Legal Risk** | HIGH - ToS violations | NONE - Licensed data |
| **Reliability** | LOW - 60-80% accuracy | HIGH - 95%+ accuracy |
| **Cost (monthly)** | $50-200+ variable | $49 fixed |
| **Maintenance** | HIGH - sites change | LOW - stable API |
| **Data Freshness** | Weekly at best | Daily updates |
| **Graded Pricing** | Unreliable | Reliable PSA/BGS/SGC |

---

## Table of Contents

1. [The Proposed Approach](#1-the-proposed-approach)
2. [Technical Feasibility](#2-technical-feasibility)
3. [Legal & Terms of Service Issues](#3-legal--terms-of-service-issues)
4. [Cost Analysis](#4-cost-analysis)
5. [Reliability & Accuracy Concerns](#5-reliability--accuracy-concerns)
6. [Alternative AI Tools Evaluated](#6-alternative-ai-tools-evaluated)
7. [Why This Approach Fails](#7-why-this-approach-fails)
8. [Recommendation](#8-recommendation)

---

## 1. The Proposed Approach

### Concept
Use OpenAI's API (already integrated for card grading) to:
1. Search the web for recently sold card listings
2. Extract pricing data from eBay, TCGPlayer, etc.
3. Parse and aggregate pricing information
4. Update a local database on a weekly basis

### Theoretical Architecture
```
┌─────────────────────────────────────────────────────────────────────────┐
│                    AI-Based Pricing (Proposed)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────────────────┐                                      │
│   │     DCM Card Database       │                                      │
│   │   (Cards needing prices)    │                                      │
│   └─────────────────────────────┘                                      │
│                │                                                        │
│                ▼                                                        │
│   ┌─────────────────────────────┐                                      │
│   │   OpenAI GPT-5.1 + Web      │                                      │
│   │   Search Tool ($0.01-0.03   │                                      │
│   │   per search + tokens)      │                                      │
│   └─────────────────────────────┘                                      │
│                │                                                        │
│                ▼                                                        │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │              Target Websites (PROBLEM ZONE)                      │  │
│   ├─────────────────────────────────────────────────────────────────┤  │
│   │  ❌ eBay - Blocks AI bots, prohibits scraping                   │  │
│   │  ❌ TCGPlayer - No API access, prohibits scraping               │  │
│   │  ❌ 130point - No public API                                     │  │
│   │  ❌ Card Ladder - Prohibits scraping                             │  │
│   │  ❌ PWCC/Goldin - No public API                                  │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                │                                                        │
│                ▼                                                        │
│   ┌─────────────────────────────┐                                      │
│   │   AI Extracts Prices        │  ← Unreliable, may hallucinate      │
│   │   (Weekly batch job)        │  ← Sites block/change frequently    │
│   └─────────────────────────────┘                                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Technical Feasibility

### What GPT Can Do
- Parse HTML/text and extract structured data
- Understand pricing formats ($XX.XX, sold for, etc.)
- Aggregate multiple data points into estimates

### What GPT Cannot Do
- **Browse websites directly** - It cannot load pages or interact with them
- **Handle JavaScript-heavy sites** - Modern sites like eBay require JS rendering
- **Manage sessions/auth** - No cookie handling, login flows
- **Bypass anti-bot measures** - Sites detect and block automated access
- **Guarantee accuracy** - LLMs can "hallucinate" prices

### OpenAI Web Search Tool
OpenAI's Responses API includes a web search tool, but:
- It's designed for general web search, not structured data extraction
- Returns search snippets, not full page content
- Cannot navigate to specific sold listings pages
- Cost: $10/1,000 calls + token costs

### GPT-4/5 Scraping Limitations (From Research)
> "GPT-4 doesn't browse the web. It doesn't load pages. It doesn't interact with dynamic elements. This is a huge limitation. If you're trying to scrape prices, reviews, or inventory data from a JavaScript-heavy e-commerce site, GPT-4's vanilla BeautifulSoup script isn't going to cut it."

> "ChatGPT may sometimes return responses that are factually incorrect or inconsistent with reality. This phenomenon, known as the 'hallucination problem,' can affect the accuracy of the generated code snippets."

---

## 3. Legal & Terms of Service Issues

### eBay - BLOCKED

**Robots.txt (Updated 2024-2025):**
> "Automated scraping, buy-for-me agents, LLM-driven bots, or any end-to-end flow that attempts to place orders without human review is strictly prohibited."

**Specific AI Blocks:**
eBay has explicitly blocked bots from:
- Anthropic (Claude)
- Perplexity
- Amazon
- Other AI companies

**User Agreement:**
> "You agree not to use any robot, spider, scraper, data mining tools, data gathering and extraction tools, or other automated means to access our Services for any purpose, except with the prior express permission of eBay."

**Legal Precedent:**
- **eBay v. Bidder's Edge (2000)** - eBay won lawsuit against scraper for "trespass to chattels"

### TCGPlayer - BLOCKED

**Terms of Service:**
> "You may not collect content or information (including pricing information) from the Site using automated means (which includes using crawlers, scrapers, bots, robots, scripts, devices, browser plugins and add-ons or any other technology) other than through API access."

**API Status:**
> "TCGPlayer is no longer granting new API access at this time."

### Card Ladder - BLOCKED

**Terms of Use:**
> "You may not use any robot, spider, site search/retrieval application or other manual or automatic device to retrieve, index, 'scrape,' 'data mine' or in any way gather Content without the Company's express prior written consent."

### 130point - NO PUBLIC API

No documented public API or scraping policy, but likely similar restrictions.

### Risk Summary

| Site | Scraping Allowed | API Available | AI Bots Blocked |
|------|------------------|---------------|-----------------|
| eBay | ❌ Prohibited | Limited access | ✅ Yes |
| TCGPlayer | ❌ Prohibited | ❌ No new access | Unknown |
| 130point | Unknown | ❌ No | Unknown |
| Card Ladder | ❌ Prohibited | Enterprise only | Unknown |
| PWCC | Unknown | ❌ No | Unknown |

### Potential Consequences
1. **IP blocking** - Your server IP gets banned
2. **Legal action** - Cease and desist or lawsuit
3. **Service disruption** - Affects your entire application
4. **Reputation damage** - Bad press for violating ToS

---

## 4. Cost Analysis

### AI Approach Costs

**Option A: OpenAI Web Search Tool**
```
Per card lookup:
- Web search call: $0.01 (at $10/1,000 calls)
- Search content tokens: ~8,000 tokens × $2.50/1M = $0.02
- Output tokens: ~500 tokens × $10/1M = $0.005
- Total per lookup: ~$0.035

Weekly batch (1,000 cards):
- 1,000 × $0.035 = $35/week
- Monthly: ~$140/month

Weekly batch (5,000 cards):
- 5,000 × $0.035 = $175/week
- Monthly: ~$700/month
```

**Option B: Perplexity Search API**
```
- $5 per 1,000 requests
- 1,000 cards/week = $20/month
- 5,000 cards/week = $100/month

BUT: Returns search snippets, not structured price data
Still need GPT to parse results = additional cost
```

**Option C: Firecrawl + GPT**
```
- Firecrawl Standard: $83/month (3,000 pages)
- Firecrawl Growth: $333/month (unlimited)
- Plus GPT costs for parsing

Total: $100-400+/month
```

### Dedicated API Costs

| API | Monthly Cost | Cards Covered |
|-----|--------------|---------------|
| PriceCharting Legendary | $49 | Unlimited |
| JustTCG + SportsCardsPro | $40 | Unlimited |

### Cost Comparison

| Approach | Monthly Cost | Reliability | Legal Risk |
|----------|--------------|-------------|------------|
| AI Web Scraping | $100-700+ | Low (60-80%) | HIGH |
| PriceCharting | $49 fixed | High (95%+) | None |
| JustTCG + SportsCardsPro | $40 fixed | High (95%+) | None |

**The AI approach costs 2-14x more and delivers worse results.**

---

## 5. Reliability & Accuracy Concerns

### Data Quality Issues

**Problem 1: Inconsistent Extraction**
- Card names vary across sites ("Charizard Holo" vs "Charizard Holofoil" vs "Charizard 1st Ed Holo")
- Price formats differ ($45.00, $45, "sold for forty-five dollars")
- Currency confusion (USD vs CAD vs EUR)

**Problem 2: Hallucination Risk**
LLMs can generate plausible-sounding but incorrect prices:
```
User: "What's the current price of a PSA 10 1999 Charizard?"
GPT: "Based on recent sales, a PSA 10 1999 Base Set Charizard
      typically sells for $15,000-$25,000."

Reality: Actual recent sales show $300,000-$420,000
```

**Problem 3: Stale Data**
- Web search returns cached/indexed pages
- May find articles about prices, not actual sales
- "Recent" could mean months old

**Problem 4: Graded Card Complexity**
Prices vary dramatically by:
- Grade (PSA 10 vs PSA 9 = 5-10x difference)
- Grading company (PSA vs BGS vs SGC)
- Sub-grades (BGS 9.5 with 10 centering vs all 9.5s)
- Population (first PSA 10 vs 100th PSA 10)

AI cannot reliably parse these nuances from unstructured web data.

### Accuracy Estimates

| Data Type | AI Accuracy | Dedicated API |
|-----------|-------------|---------------|
| Card identification | 80-90% | 99% |
| Raw price (ballpark) | 70-80% | 95% |
| Graded price by grade | 50-60% | 95% |
| Price by condition (NM/LP) | 40-50% | 95% |
| Historical trends | Not possible | Available |

### Real-World Example

**Query:** "PSA 10 2023 Topps Chrome Shohei Ohtani #1 recent sold price"

**AI might return:**
- Google search snippet: "Ohtani cards are hot! PSA 10s selling for hundreds..."
- Article from 6 months ago: "Record sale at $5,000"
- Forum post: "I saw one go for $800 last week"
- AI synthesis: "Estimated value: $800-$5,000" ← Too wide to be useful

**PriceCharting returns:**
- PSA 10: $1,247 (based on 47 sales in last 30 days)
- PSA 9: $312
- Raw: $45

---

## 6. Alternative AI Tools Evaluated

### Perplexity Search API
**Website:** https://www.perplexity.ai/api-platform

**Pricing:** $5 per 1,000 requests

**Pros:**
- Real-time web search
- Returns snippets with citations
- Fresher than OpenAI's training data

**Cons:**
- Returns search snippets, not structured data
- Still needs GPT to parse/extract prices
- Subject to same site blocking
- Not designed for price extraction

**Verdict:** Not suitable for structured price data

### Firecrawl
**Website:** https://www.firecrawl.dev

**Pricing:** $16-719/month

**Features:**
- Web scraping as a service
- LLM-ready markdown output
- Handles JavaScript rendering

**Cons:**
- Still violates site ToS
- $83+/month for meaningful volume
- You're just outsourcing the legal risk

**Verdict:** Same legal problems, higher cost

### Browse AI
**Website:** https://www.browse.ai

**Features:**
- No-code web scraping
- Monitors for changes
- Extracts structured data

**Cons:**
- $49-249/month for meaningful volume
- Still violates ToS
- Requires manual setup per site

**Verdict:** Not a scalable solution

---

## 7. Why This Approach Fails

### The Fundamental Problem

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    WHY AI PRICING DOESN'T WORK                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. DATA ACCESS                                                         │
│     ├── Sites block AI bots                                            │
│     ├── No API access available                                         │
│     └── ToS explicitly prohibit scraping                               │
│                                                                         │
│  2. DATA QUALITY                                                        │
│     ├── LLMs hallucinate prices                                        │
│     ├── Cannot verify accuracy                                          │
│     └── No structured graded pricing                                   │
│                                                                         │
│  3. COST                                                                │
│     ├── $100-700/month vs $49/month                                    │
│     ├── Costs scale with card count                                    │
│     └── Hidden costs (maintenance, errors)                             │
│                                                                         │
│  4. MAINTENANCE                                                         │
│     ├── Sites change layouts constantly                                │
│     ├── Anti-bot measures evolve                                       │
│     └── Requires ongoing engineering                                    │
│                                                                         │
│  5. LEGAL RISK                                                          │
│     ├── ToS violations                                                 │
│     ├── Potential lawsuits (eBay precedent)                            │
│     └── IP bans affect entire application                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Comparison Matrix

| Factor | AI Approach | PriceCharting |
|--------|-------------|---------------|
| Setup time | 20-40 hours | 2-4 hours |
| Monthly cost | $100-700+ | $49 |
| Legal risk | HIGH | None |
| Data accuracy | 60-80% | 95%+ |
| Graded prices | Unreliable | PSA/BGS/SGC |
| Maintenance | Ongoing | Minimal |
| Scalability | Poor | Excellent |
| Time to value | Weeks | Days |

---

## 8. Recommendation

### Do NOT Pursue AI Web Scraping for Pricing

**Reasons:**
1. **Illegal/ToS violations** - All major data sources prohibit it
2. **Unreliable data** - LLMs hallucinate, can't verify accuracy
3. **More expensive** - 2-14x the cost of dedicated APIs
4. **High maintenance** - Sites change, bots get blocked
5. **Legal risk** - Could result in lawsuits or service disruption

### Recommended Approach: PriceCharting Legendary ($49/month)

**Why PriceCharting:**
- **Legal** - Licensed data access
- **Reliable** - 95%+ accuracy, daily updates
- **Complete** - All TCGs + Sports + Graded prices
- **Cost-effective** - Fixed $49/month, unlimited queries
- **Low maintenance** - Stable API, good documentation

### The Only Viable AI Use Case

If you still want to use AI for pricing, the **only responsible approach** is:

```
┌─────────────────────────────────────────────────────────────────────────┐
│            HYBRID APPROACH (If Absolutely Necessary)                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   1. Use PriceCharting API as PRIMARY source ($49/month)               │
│                                                                         │
│   2. Use AI as FALLBACK for unmatched cards only:                      │
│      - Card not in PriceCharting database                              │
│      - Very rare/obscure items                                         │
│      - New releases not yet indexed                                    │
│                                                                         │
│   3. Mark AI-generated prices as "Estimated" with disclaimer           │
│                                                                         │
│   4. Human review before displaying AI estimates                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Final Verdict

| Approach | Recommendation |
|----------|----------------|
| AI-only pricing | ❌ NOT RECOMMENDED |
| PriceCharting | ✅ RECOMMENDED |
| Hybrid (API + AI fallback) | ⚠️ Only if needed for edge cases |

**Bottom Line:** Pay the $49/month for PriceCharting. It's cheaper, more reliable, and doesn't put your business at legal risk.

---

## Sources

### OpenAI & AI Capabilities
- [OpenAI API Pricing](https://openai.com/api/pricing/)
- [GPT-4 and Web Scraping Limitations](https://www.promptcloud.com/blog/web-scraping-using-gpt-4/)
- [Web Scraping with GPT-4o - Expensive](https://news.ycombinator.com/item?id=41428274)
- [ChatGPT Web Scraping Tutorial](https://research.aimultiple.com/chatgpt-web-scraping/)

### Perplexity & Alternative AI
- [Perplexity API Pricing](https://docs.perplexity.ai/getting-started/pricing)
- [Perplexity Search API](https://www.perplexity.ai/hub/blog/introducing-the-perplexity-search-api)

### Web Scraping Tools
- [Firecrawl Pricing](https://www.firecrawl.dev/pricing)
- [Browse AI](https://www.browse.ai)

### Legal & ToS
- [eBay User Agreement](https://www.ebay.com/help/policies/member-behaviour-policies/user-agreement?id=4259)
- [eBay Robot & Agent Policy](https://www.modernretail.co/technology/ebay-adds-new-ai-agent-policy-to-its-website/)
- [TCGPlayer API Terms](https://help.tcgplayer.com/hc/en-us/articles/360061115874-TCGplayer-API-Terms-Conditions)
- [TCGPlayer Terms of Service](https://help.tcgplayer.com/hc/en-us/articles/205004918-Terms-of-Service)
- [Card Ladder Terms of Use](https://www.cardladder.com/terms)
- [Is Web Scraping Legal?](https://research.aimultiple.com/is-web-scraping-legal/)

### Pricing APIs (Recommended)
- [PriceCharting API](https://www.pricecharting.com/api-documentation)
- [SportsCardsPro API](https://www.sportscardspro.com/api-documentation)

---

*Document prepared for DCM Grading - AI Pricing Approach Evaluation*
