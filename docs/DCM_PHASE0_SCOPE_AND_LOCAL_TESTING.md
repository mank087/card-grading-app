# DCM accuracy work: Phase 0 scope and local testing

Started September 16, 2026. Local changes only; no commit, push, deployment, paid grading run or database write performed for this work.

## Objective and boundary

Establish which code/settings produced an observation and make orientation failures reproducible before changing capture, identification, scoring or prompts. The broader sequence remains: inspection completeness; identity confirmation and pricing; capture improvements; matching; prompt/scoring ablations. See [the full review](DCM_ACCURACY_REVIEW_AND_PLAN_2026-09-16.md).

This first Phase 0 increment implements an offline source/config baseline, freezes the existing synthetic failure observations, and adds opt-in browser camera geometry traces. It does **not** complete production verification or establish a measured accuracy rate.

| Work item | Status | Acceptance evidence |
|---|---|---|
| Local code and prompt provenance | Implemented | SHA-256 for audited files, HEAD, scoped working state, declared prompt version |
| Local model settings | Implemented | Actual router and compatibility helpers evaluated offline; allowlisted config only |
| Synthetic failure baseline | Implemented | Current helpers compared with frozen audit output; differences exit with code 2 |
| Web shutter/crop diagnostics | Implemented; device validation pending | Local trace links shutter, frame, crop/fallback, acceptance or retake |
| Native camera diagnostics | Pending | Native geometry source is hashed and synthetic overflow fixture exists; no device capture trace yet |
| Real failing photo corpus | Pending | Original image pair, capture trace where available, reviewed identity and defect labels |
| Deployed model/request provenance | Pending | Actual deployment version and redacted request metadata, separate from local defaults |
| Repeatability and accuracy metrics | Pending | Run manifest linked to each corpus item, adjudicated labels and held-out evaluation |

## Generate an offline baseline

From the project directory:

```powershell
node scripts/accuracy-phase0.cjs --local-env --output docs/phase0-local-run-02.json
```

Use a new output filename for each snapshot: the command refuses overwriting. `--local-env` loads Next's development environment using its normal precedence. Without it, the command uses only the current shell environment. Only explicitly allowlisted grading flags/model names are serialized. Credentials, photo URLs, user IDs and full environment files are not included. Review this allowlist before adding settings.

The baseline invokes the repository's pure model router and compatibility functions; it never imports the grader, invokes OpenAI, or connects to Supabase. It also runs the existing offline geometry/name probes. The ensemble request is an **audited template**, not an intercepted API request. Per-call overrides, retries and other passes require future runtime evidence. Hashes identify the listed audited sources, not a complete build dependency manifest.

The initial local snapshot resolves Luna with low reasoning effort, high grading image detail, three ensemble completions, and sampling parameters stripped. These are local results, not evidence of deployed settings. No recommendation to change those defaults has been implemented.

Initial artifact: [local baseline JSON](DCM_PHASE0_LOCAL_BASELINE_2026-09-16-final.json).

The frozen probes intentionally preserve known problems: Japanese-name collisions, Mew/Mewtwo agreement, missing evidence receiving high confidence, Mega form conflation, and the short native viewport overflowing its guide. A matching baseline means reproducibility, **not correctness**. When fixing a defect later, keep the old observation and introduce a versioned expected-correct fixture; do not silently regenerate the reference JSON.

## Test browser capture locally

1. Run the existing development server with `npm run dev`. Open its upload camera on a supported browser. A physical phone requires a reachable secure development origin for camera access; localhost on the desktop does not test phone camera behavior.
2. In that tab's developer console, enable the recorder:

```javascript
sessionStorage.setItem('dcm.captureAudit.enabled', '1');
sessionStorage.removeItem('dcm.captureAudit.v1');
```

3. Capture a portrait card front and back; inspect the preview and use Retake. Repeat with an intentionally landscape card, device rotation before shutter, rotation during capture, and a short/wide viewport. Compare what the guide enclosed with the resulting image.
4. Export the trace using the browser developer console's `copy` helper:

```javascript
copy(sessionStorage.getItem('dcm.captureAudit.v1'));
```

Paste it into a local JSON file with a unique sample label. If the console lacks `copy`, evaluate the expression and copy its string value. The ring buffer retains the latest 100 events in this tab only. Export before closing the tab.

5. Disable and clear after testing:

```javascript
sessionStorage.removeItem('dcm.captureAudit.enabled');
sessionStorage.removeItem('dcm.captureAudit.v1');
```

The recorder is disabled in production and does not send network requests. **The existing app can still use configured remote services.** Preview/Retake is sufficient for initial geometry testing; test acceptance, uploads or grading only with an isolated local/test backend. The recorder's `accepted` event means the camera confirmation callback ran, not that upload or grading succeeded.

### Interpret the trace

Each random local `captureId` connects stages. `shutter.viewport` is measured before awaiting camera acquisition; `crop.viewport` is measured afterward, matching the existing crop implementation. Differences reveal layout changes during acquisition. Frame events contain stream dimensions, acquired canvas dimensions, source (`photo` versus `frame`), and the transform assumed by the cropper. Crop events contain guide geometry, pixel crop rectangle and encoded output dimensions. `fallback` means the crop threw and the existing full-frame fallback was used. No error strings, image pixels or device identifiers are stored.

Record the following axes separately for each real sample:

| Axis | Allowed labels |
|---|---|
| Intended card layout | portrait / landscape / unknown |
| Image dimensions | width and height, independently of card layout |
| Visible card rotation | upright / clockwise / counterclockwise / upside-down / unknown |
| Rendering discrepancy | same in preview and saved image / differs / not checked |
| Capture path | web still / web frame / native / gallery / unknown |
| Quality | blur, glare, clipping, skew, holder interference; each present / absent / unknown |

Do not infer that a landscape image contains a sideways card. EXIF, decoded pixels and the detail-page display must be compared independently. The current recorder covers web camera capture only; gallery normalization and downstream rendering remain follow-up evidence.

## Corpus and evaluation scope

Start with reproducible known failures plus correctly handled controls across all eight categories. Proposed pilot: 40–60 distinct physical cards covering ordinary and difficult variants; expand based on observed gaps. This pilot is for debugging, not a statistically established accuracy claim. Keep repeated captures of the same card in the same split and hold out cards before tuning.

Each corpus item needs a pseudonymous sample ID; front/back original file hashes; the baseline snapshot filename; category; acquisition path/device/browser versions; intended layout and observed rotation; verified name, set, card number, year and parallel with supporting catalog reference; defect region/type/severity with reviewer confidence; and an explicit unknown value where evidence is inadequate. Keep pricing product IDs separate from card identity. Never label a model prediction as ground truth.

Later run records should add actual model/effort/detail, assembled prompt hash, pipeline flags, request/response status and finish reason, token usage, pass completeness, identity candidates, grade before/after deterministic rules, and latency/cost. The current offline manifest does not claim to capture those runtime facts.

Measure orientation errors by acquisition path, unusable-photo rate, exact identity and per-field accuracy, confident wrong matches, variant accuracy, defect precision/recall by region, grading error against reviewed labels, repeated-run variation, and incomplete-inspection rate. Missing evidence is its own outcome rather than a correct match or clean card.

## Local automated checks

```powershell
node node_modules/vitest/vitest.mjs run src/lib/localCaptureAudit.test.ts tests/accuracyPhase0.test.ts
node scripts/check-grading-isolation.cjs
```

Phase 0 exit requires the local tooling plus actual device evidence, reviewed failure fixtures, and an explicit deployed-versus-local configuration comparison. Native recording and per-request grading manifests are the next instrumentation increments; prompt and grading behavior changes stay outside this Phase 0 increment.

Validation on September 16: five targeted tests passed, application TypeScript check (`tsc --noEmit`) passed, grading isolation passed, and tracked diff whitespace check passed. No physical-device camera validation has been performed. Vitest required execution outside the filesystem sandbox to load its configuration; the tests themselves remain offline.
