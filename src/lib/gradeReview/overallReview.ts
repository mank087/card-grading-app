import { CONDITION_RUBRIC } from './conditionRubric';
import { compareCentering } from './centeringReview';
import { ALL_CATEGORIES, type FullComparison, type PreparedFullReview } from './fullReview';

type Interval={lower:number;upper:number};
const unknownRange=():Interval=>({lower:1,upper:10});

/** Bounds are for explaining the retained grade, never for updating a subgrade. */
export function assessOverallGrade(prepared:PreparedFullReview,review:FullComparison) {
  const faces:Array<Interval&{category:typeof ALL_CATEGORIES[number];side:'front'|'back';exact:boolean}>=[];
  for(const finding of review.findings) {
    let range=unknownRange();
    if(finding.verdict==='confirmed') range={lower:finding.original_score,upper:finding.original_score};
    else if(finding.verdict==='correction_proposed'&&finding.candidate_score!==null) {
      // Until corroborated, a proposed replacement cannot establish a new limiting score.
      range={lower:Math.min(finding.original_score,finding.candidate_score),upper:Math.max(finding.original_score,finding.candidate_score)};
    } else if(finding.score_range&&finding.coverage_complete&&finding.confidence!=='low'&&
      new Set(finding.evidence.map(e=>e.location)).size===4&&
      !finding.original_findings.some(f=>f.verdict==='not_visible')&&
      !finding.limitations.some(t=>t.includes('structural')||t.includes('Border wear'))) {
      const low=CONDITION_RUBRIC[finding.score_range.lowest_row as keyof typeof CONDITION_RUBRIC];
      const high=CONDITION_RUBRIC[finding.score_range.highest_row as keyof typeof CONDITION_RUBRIC];
      if(high.score===10||finding.evidence.some(e=>e.kind!=='clean')) range={lower:low.score,upper:high.score};
    }
    faces.push({...range,category:finding.category,side:finding.side,exact:finding.verdict==='confirmed'});
  }
  for(const finding of review.centering.findings) {
    let range=unknownRange();
    const observed=review.observation.centering.faces.find(f=>f.side===finding.side)!;
    if(finding.verdict==='confirmed') range={lower:finding.original.score,upper:finding.original.score};
    else if(finding.verdict==='correction_proposed'&&finding.candidate_score!==null) {
      range={lower:Math.min(finding.original.score,finding.candidate_score),upper:Math.max(finding.original.score,finding.candidate_score)};
    } else if(observed.layout==='standard_bordered'&&observed.confidence!=='low'&&!observed.material_uncertainty&&observed.left_right&&observed.top_bottom) {
      const scores:number[]=[];
      // Enumerate the existing two-point measurement tolerance through the saved
      // policy, rather than accepting a model-supplied centering score range.
      for(let lr=-2;lr<=2;lr++) for(let tb=-2;tb<=2;tb++) {
        const left=observed.left_right[0]+lr,top=observed.top_bottom[0]+tb;
        if(left<0||left>100||top<0||top>100) continue;
        const checked=compareCentering({...prepared,sides:[finding.side]},{faces:[{
          side:finding.side,layout:observed.layout,left_right:[left,100-left],top_bottom:[top,100-top],
          confidence:'high',limitations:[],evidence:observed.evidence,
        }]},false,0).findings[0];
        if(checked.candidate_score===null) {scores.push(1,10);} else scores.push(checked.candidate_score);
      }
      if(scores.length) range={lower:Math.min(...scores),upper:Math.max(...scores)};
    }
    faces.push({...range,category:'centering',side:finding.side,exact:finding.verdict==='confirmed'});
  }
  const categories=ALL_CATEGORIES.map(category=>{
    const relevant=faces.filter(f=>f.category===category);
    return {category,lower:Math.min(...relevant.map(f=>f.lower)),upper:Math.min(...relevant.map(f=>f.upper)),exact:relevant.every(f=>f.exact)};
  });
  const basis=prepared.reviewContext.scoring_constraints as {full_review?:{version?:string;independent_cap?:number;original_scores?:Record<string,number>}}|null;
  const saved=basis?.full_review;
  const validBasis=saved?.version==='all-subgrades-v1'&&Number.isInteger(saved.independent_cap)&&saved.independent_cap!>=1&&saved.independent_cap!<=10&&
    ALL_CATEGORIES.every(c=>saved.original_scores?.[c]===prepared.reviewContext.category_scores[c]);
  // A legacy conservative correction ceiling is not evidence of a real grade cap.
  const cap=validBasis?saved!.independent_cap!:10;
  const lower=Math.min(cap,...categories.map(c=>c.lower)),upper=Math.min(cap,...categories.map(c=>c.upper));
  const supported=lower===prepared.saved.grade&&upper===prepared.saved.grade;
  const unresolved=categories.filter(c=>!c.exact).map(c=>c.category);
  const limiter=categories.filter(c=>c.upper===prepared.saved.grade).map(c=>c.category);
  const summary=supported
    ? `Your original grade of ${prepared.saved.grade} is supported${limiter.length?` by ${limiter.join(' and ')}`:' under the saved grading constraints'}.`+
      (unresolved.length?` Some ${unresolved.join(' and ')} details remain unresolved, but the supported range does not change the overall grade.`:'')
    : `Your original grade remains ${prepared.saved.grade}. The unresolved findings could affect the overall grade.`;
  return {supported,grade:prepared.saved.grade,lower,upper,categories,faces,unresolved,summary};
}
