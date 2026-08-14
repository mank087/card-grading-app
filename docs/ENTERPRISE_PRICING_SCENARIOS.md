# DCM Enterprise — Pricing Scenario Models

*Prepared Aug 5, 2026 · Internal — pricing not yet published anywhere*

## The anchors that constrain enterprise pricing

**Cost side.** COGS per grade is ~$0.18 on GPT-5.1 (≈$0.04 if the Luna canary
is adopted). Gross margin is excellent at any plausible price point — this is
a value-pricing decision, not a cost-plus one.

**Retail ladder (cannibalization floor).** DCM already sells grades at:

| Product | Effective $/grade |
|---|---|
| Basic pack | $2.99 |
| Pro pack | $2.00 |
| Elite pack | $1.00 |
| Card Lovers monthly | $0.71 |
| VIP package | $0.66 |
| Card Lovers annual | $0.50 |

Enterprise per-grade rates that dip below VIP/Card Lovers invite heavy retail
users to masquerade as "stores." Enterprise doesn't need to compete on
per-grade price: the store is buying a grading *business* — branding, staff
seats, shared rolling pool, white-label pages — not a bag of credits.

**The store's resale math (the sales pitch).** A shop charging walk-ins even
$8–10 per in-house grade keeps $7–9 of margin per card. At every tier modeled
below, the subscription pays for itself around card 15–20 of the month;
everything after is store profit. Traditional grading runs $15–25/card with
weeks of turnaround — the store undercuts it massively and keeps the customer
in the building.

## Typical volumes by segment (estimates — validate with Steven/Andy)

| Segment | Profile | Monthly grades |
|---|---|---|
| Small LCS | counter grading for walk-ins, weekend events | 50–150 |
| Established LCS | submissions + showcase inventory | 200–400 |
| Dealer / breaker / online seller | grades inventory before listing | 300–1,000 (spiky) |
| Grading-first business (e.g. Apex) | grading is the product | 500–2,000 |

---

## Scenario A — Premium capability pricing ★ RECOMMENDED

| Tier | Monthly | Grades | $/grade | Overage/grade |
|---|---|---|---|---|
| Shop | $149 | 100 | $1.49 | $1.25 |
| Dealer | $399 | 300 | $1.33 | $1.10 |
| Enterprise | $999 | 1,000 | $1.00 | $0.85 |

- Sits above the entire retail ladder (matches Elite only at the top) → zero
  cannibalization risk.
- Shop reselling at $10/card nets ~$850/mo profit on 100 cards — easy yes.
- Illustrative book of 10 Shop + 4 Dealer + 2 Enterprise =
  **~$5,100/mo (~$61k/yr)** at 90%+ gross margin.
- Weakness: $149 can be a hesitation point for an LCS that has never sold
  grading (mitigated by the unpublished pilot tier below).

## Scenario B — Volume-led land grab

| Tier | Monthly | Grades | $/grade | Overage/grade |
|---|---|---|---|---|
| Shop | $99 | 100 | $0.99 | $0.85 |
| Dealer | $299 | 400 | $0.75 | $0.65 |
| Enterprise | $749 | 1,250 | $0.60 | $0.50 |

- Prices below VIP at upper tiers to make the switch from PSA-submission
  economics a no-brainer and grab the channel early.
- Same illustrative book = ~$3,700/mo.
- Risks: undercuts VIP/Card Lovers per-grade (a 400/mo "dealer" could be a
  power collector); raising prices later is much harder than raising
  allotments later.

## Scenario C — Low entry, monetize growth

| Tier | Monthly | Grades | $/grade | Overage/grade |
|---|---|---|---|---|
| Starter | $79 | 50 | $1.58 | $1.25 |
| Dealer | $249 | 200 | $1.25 | $1.00 |
| Enterprise | $599 | 600 | $1.00 | $0.80 |

- Lowest commitment for hesitant stores; upside comes from overage as they
  grow (rollover keeps overage from feeling punitive).
- Same book = ~$3,000/mo base, but overage compounds: a Starter shop doing
  120 cards pays $79 + 70 × $1.25 = **$166.50** — more than Scenario A's Shop
  tier.

---

## Recommendation

**Publish Scenario A's structure; keep Scenario C's $79/50 tier as an
unpublished "pilot" offer** for closing hesitant small shops. Checkout links
are generated per-org with arbitrary amounts from the admin console, so
custom deals need no code or Stripe product changes, and the /enterprise page
deliberately publishes no dollar amounts.

### Watch items (any scenario)

1. **Rollover liability** — banked credits are deferred cost. If stores
   overbuy and bank many months of allotment, consider capping the bank at
   ~3× monthly allotment (not built; easy to add).
2. **Apex** — grading-first launch, likely 300–800/mo. Quote Dealer with a
   pre-agreed bridge to Enterprise pricing at ~600/mo so growth reads as a
   reward, not a penalty.
3. **Annual prepay** — a 2-months-free annual option (e.g. Shop $1,490/yr)
   is worth adding once monthly tiers prove out; improves cash flow and
   retention but magnifies the rollover-liability question.

---

## Scenario D — Reset capacity, wholesale framing ★ CHOSEN (Aug 12 v3)

Philosophy flip from Scenarios A/v2: enterprise is priced BELOW retail as a
volume commitment ("wholesale") — the retail ladder is protected by GATING
(admin onboarding, monthly commitment), not by a price floor. A collector
willing to pay $199/mo is functionally a business customer.

Credits **reset** each month (no rollover); overage sold as **$12.50 packs
of 25 grades ($0.50/grade) that DO roll over** (decided Aug 12, closing the
Dealer-undercuts-Pro wrinkle). Admin-onboarded only. Modeled on the measured
Luna rate ($0.0405/grade full-pipeline, Aug 10 canary read; Stripe 2.9% +
$0.30):

| Tier | Monthly | Grades/mo (reset) | Headline $/card | Overage |
|---|---|---|---|---|
| Dealer | $199 | 400 | $0.50 | $12.50 / 25-pack, rolls over |
| Pro | $399 | 1,000 | $0.40 | $12.50 / 25-pack, rolls over |

**Pro at 200 / 500 / 750 / 1,000 cards:** $2.00 / $0.80 / $0.53 / $0.40
effective per card; net margin $379 / $367 / $357 / $347 (95.0% → 86.9%).
**Dealer at 100 / 200 / 300 / 400:** $1.99 / $1.00 / $0.66 / $0.50; net
$189 / $185 / $181 / $177 (94.9% → 88.8%). Overage pack nets $10.83 (86.6%).
Worst case (GPT-5.1 revert, maxed Pro): 60.6% margin.

Positioning notes: Dealer's floor and the pack rate land exactly on Card
Lovers annual ($0.50); Pro's floor ($0.40) is deliberate wholesale
territory. The sales line is "40 cents a card at volume vs $15–25
traditional grading." Pack rate = Dealer headline rate, so overage never
undercuts a subscription; Dealer+packs stays cheaper than Pro up to 800
cards/mo ($199 + 16 packs = $399), then Pro wins — pack friction in the
500–800 band makes the upgrade feel like relief, and interim packs are 87%
margin.

Build deltas vs the shipped webhook (which implements rollover): invoice.paid
SETS the subscription balance instead of incrementing; overage packs get
their own bucket (deduct monthly first, packs never wiped by reset; org_topup
checkout path exists — set $12.50/25 metadata); /enterprise page + plan §4
swap "unused grades roll over" for "monthly allotment + rollover overage
packs" and lead with the wholesale per-card framing. Unpublished $79/50
pilot (Scenario C) stays available. Full memo: claude.ai artifact
"Reset-Capacity Pricing Model" (v4 final, Aug 12).
