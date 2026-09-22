/**
 * Is the card in a rigid holder? Ask all three evaluations, not one.
 *
 * WHY. `case_detection` used to be read from a single completion, whichever one the
 * median pick chose as the base. Everywhere else in the grader a lone evaluation needs
 * corroboration (structural damage needs a majority; a dissenting score needs cited
 * evidence). The holder call did not, and a rigid holder blocks a 10.
 *
 * Found Sept 21 2026 on an owner-reported Toxtricity: a flatbed scan of a bare card,
 * all three evaluations 10/10/10, image confidence B. In one run of six the base
 * completion reported `case_type: "top_loader", impact_level: "minor"` and the gate held
 * the card at 9. There is no holder in a flatbed scan. The same photos graded 10 in the
 * other five runs, so the grade was being decided by which completion happened to be
 * picked. (An unexplained 10/10/10 -> 9 seen the day before on another card fits the
 * same pattern.)
 *
 * THE RULE. A rigid holder counts when a MAJORITY of the evaluations report one. The
 * stored `case_detection` is then taken from an evaluation on the winning side, so the
 * report never describes a holder the grade did not act on, or the reverse.
 */

export interface CaseDetection {
  case_type?: string | null;
  case_visibility?: string | null;
  impact_level?: string | null;
  adjusted_uncertainty?: string | null;
  notes?: string | null;
  [key: string]: unknown;
}

const RIGID_TYPES = new Set(['top_loader', 'semi_rigid', 'slab']);
const HEAVY_IMPACT = new Set(['moderate', 'high']);

/** The grader's long-standing definition of a holder that blocks a 10. */
export function isRigidCase(detection: CaseDetection | null | undefined): boolean {
  if (!detection || typeof detection !== 'object') return false;
  return RIGID_TYPES.has(String(detection.case_type ?? '').toLowerCase())
    || HEAVY_IMPACT.has(String(detection.impact_level ?? '').toLowerCase());
}

export interface CaseConsensus {
  rigid: boolean;
  /** How many evaluations reported a rigid holder, out of how many. */
  votes: number;
  total: number;
  /** The case_detection to store: from an evaluation that agrees with the decision. */
  detection: CaseDetection | null;
  /** True when the base evaluation was on the losing side and was replaced. */
  overruledBase: boolean;
}

export function caseConsensus(
  completions: Array<CaseDetection | null | undefined>,
  base: CaseDetection | null | undefined,
): CaseConsensus {
  const seen = completions.filter((c): c is CaseDetection => !!c && typeof c === 'object');
  // Nothing to vote with (older payloads, a missing block): fall back to the base, as before.
  if (seen.length === 0) return { rigid: isRigidCase(base), votes: isRigidCase(base) ? 1 : 0, total: 0, detection: base ?? null, overruledBase: false };

  const votes = seen.filter(isRigidCase).length;
  const rigid = votes * 2 > seen.length; // strict majority: 2 of 3, 2 of 2, never 1 of 2
  const baseAgrees = !!base && isRigidCase(base) === rigid;
  const detection = baseAgrees ? base! : (seen.find(c => isRigidCase(c) === rigid) ?? base ?? null);
  return { rigid, votes, total: seen.length, detection, overruledBase: !baseAgrees && !!base };
}
