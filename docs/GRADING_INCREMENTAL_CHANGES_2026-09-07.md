# Grading isolation and incremental changes

The replacement candidate remains local under grading-work, with original snapshots under grading-backups. Neither folder is tracked or staged. They are now excluded by Git and Vercel upload rules. The grading-isolation script checks the Git index and production source for experiment paths and candidate markers; npm build, npm build:turbo and CI invoke it. In a build without Git metadata, experiment folders in the build input cause failure. Tests exercise a normal local experiment, a force-staged experiment in a temporary repository, and experimental code referenced by production source. Three tests passed. These protections prevent ordinary accidental inclusion; they are not a substitute for reviewing a release diff or protection against deliberately removing/bypassing the checks.

At inspection, there were no Git changes to the active master prompt, category delta prompts, crop grader or grading policy directory. The six added lines in visionGrader.ts import and save the review scoring context when enabled. They do not replace grade calculation. Other uncommitted review/API/UI changes remain in the workspace and must not be mistaken for the experimental engine. Nothing was staged, committed, pushed or deployed during this isolation work.

## First: preserve grading behavior and improve provenance

- Record the actual number of usable main completions. Current pass padding repeats the base completion when fewer than three parse. Distinguish real samples from compatibility placeholders in reports and consistency metrics. Initially preserve existing scoring arithmetic; any later fallback-score change is a separate experiment.
- Record omitted, unparseable and obscured crop regions as unassessed in telemetry, not independently inspected clean regions. Decide how to recover missing evidence after measuring its prevalence. Do not repeat the candidate's mistake of making every uncertainty block all useful inspection.
- Retain raw observations and pre-reconciliation scores separately from final display fields. Log failures and preserve model/prompt/policy versions so a grade can be explained later.

## Second: small prompt corrections, individually tested

- Corner 8 says TWO OR MORE corners, then parenthetically says one or two. Remove the contradictory parenthetical while preserving the adjacent corner-9 single-minor-flaw rule. Update copied representations together.
- Remove wording implying the reviewer physically changed lighting angles when only two still photos were supplied. Describe visible reflections or request another view where necessary.
- Reconcile competing output-order instructions while retaining the full per-region inspection checklist and existing schema. Do not wholesale shorten the rubric or remove the current ensemble/crop passes.

These edits are small in source size, but a prompt edit can still change grades. Freeze each version and compare outputs rather than labeling a wording change automatically harmless.

## Third: explicit scoring-policy decisions

- Align the master ladder and crop scorer. For example, master edge 7 covers noticeable wear on one edge, while a moderate crop finding caps at 8. Identical evidence should not receive a different severity rule simply because a different stage noticed it. This is a substantive scoring change, not a typo fix.
- Reconcile sports borderless/die-cut instructions with the current centering policy and published standard. Resolve intended border applicability before changing numeric rules; avoid inventing 50/50 or rejecting every asymmetric design.
- Clarify physical damage versus image-confidence/holder restrictions and manufacturing defects versus permitted manufacturing variance. Decide the standard first, then align prompt, server policy and documentation.

Keep the current engine architecture and weakest-link policy as the control. Implement one bounded change per candidate, run deterministic fixtures first, then compare original-photo calibration outputs. Use the manual review process to build independent references for disagreements. Do not certify an improvement merely because it gives more confirmations or higher grades. The previous 66-run study demonstrated insufficient coverage from the replacement and variation in the original, not physical accuracy for either.

No incremental grading-policy or prompt changes were applied in this task. Only experiment isolation and release checks were added.
