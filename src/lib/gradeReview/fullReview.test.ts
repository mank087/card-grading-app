import { describe, expect, it, vi } from 'vitest';
import { processOneGradeReview } from './processor';
import type { supabaseServer } from '@/lib/supabaseServer';
import { ALL_CONCERNS, prepareFullReview, compareFullReview, fullReviewsAgree, buildFullCorrection, fullReviewSummary, type FullObservation, type FullComparison } from './fullReview';
import { assessOverallGrade } from './overallReview';
import { correctionTargets, compareFocusedReview } from './focusedReview';
import { captureCorrectionBasis, CORRECTION_FIELDS } from './correction';
import { fullResponseFormat, decodeFullObservation, fullInspectionInput, type FullInspect } from './fullProcessor';

export function fullFixture(originalCorners=10) {
  const grades={centering:10,corners:originalCorners,edges:10,surface:10};
  const raw=Object.fromEntries(['centering','corners','edges','surface'].flatMap(cat=>['front','back'].map(side=>[`${cat}_${side}`,cat==='corners'&&side==='front'?originalCorners:10])));
  const report={centering:{front:{left_right:'50/50',top_bottom:'50/50',score:10},back:{left_right:'50/50',top_bottom:'50/50',score:10}},
    corners:{front:{summary:originalCorners===10?'All corners look clean.':'A small white spot is reported at the top left tip.'},back:{summary:'All corners look clean.'}},
    edges:{front:{summary:'All edges look clean.'},back:{summary:'All edges look clean.'}},surface:{front:{summary:'The surface looks clean.'},back:{summary:'The surface looks clean.'}},
    raw_sub_scores:raw,grading_passes:{pass_1:{...grades},averaged_rounded:{...grades,final:originalCorners}},final_grade:{whole_grade:originalCorners},
    grade_review_scoring_context:captureCorrectionBasis(originalCorners,grades,[originalCorners,originalCorners,originalCorners],false)};
  const snapshot={grade:originalCorners,report,rubric_version:'DCM_Grading_v9.23',front_path:'front.jpg',back_path:'back.jpg',policy_context:{version:'centering-v9.23',centering:'shadow',r0:'enforce',cv:'shadow'}};
  const prepared=prepareFullReview(snapshot);
  const condition:FullObservation['condition']=(['corners','edges','surface'] as const).flatMap(category=>(['front','back'] as const).map(side=>({category,side,assessment:originalCorners<10&&category==='corners'&&side==='front'?'correction_needed' as const:'supported' as const,assessment_reason:'The visible border and corner tips support this assessment.',material_uncertainty:false,row:`${category}_10`,confidence:'high' as const,coverage_complete:true,score_range:null,limitations:[],
    evidence:(category==='corners'?['top_left','top_right','bottom_left','bottom_right'] as const:category==='edges'?['top','bottom','left','right'] as const:['upper_left','upper_right','lower_left','lower_right'] as const).map(location=>({location,region:[0,0,1,1] as [number,number,number,number],kind:'clean' as const,description:'This area is clearly visible without confirmed damage.'})),
    original_findings:prepared.claims.filter(c=>c.category===category&&c.side===side).map(c=>({id:c.id,verdict:originalCorners<10&&category==='corners'&&side==='front'?'contradicted' as const:'supported' as const,reason:'The reported bright spot follows the printed border rather than exposed stock.'}))
  })));
  const observation:FullObservation={centering:{faces:(['front','back'] as const).map(side=>({side,assessment:'supported',assessment_reason:'The visible borders match the recorded centering.',material_uncertainty:false,layout:'standard_bordered',left_right:[50,50],top_bottom:[50,50],confidence:'high',evidence:[{region:[0,0,1,1],description:'The borders are visible and evenly spaced.'}],limitations:[]}))},condition};
  const card={...Object.fromEntries(CORRECTION_FIELDS.map(k=>[k,null])),conversational_grading:JSON.stringify(report),conversational_whole_grade:originalCorners};
  return {report,snapshot,prepared,observation,card,concerns:ALL_CONCERNS};
}
function targetedResponse(observation:FullObservation,initial:FullComparison) {
  const targets=correctionTargets(initial);
  return {centering:{faces:observation.centering.faces.filter(f=>targets.some(t=>t.category==='centering'&&t.side===f.side))},
    condition:observation.condition.filter(f=>targets.some(t=>t.category===f.category&&t.side===f.side))};
}

describe('all-subgrade review',()=>{
  function harness(original=10) {
    const f=fullFixture(original);
    const rpc=vi.fn().mockResolvedValueOnce({data:{id:'review',card_id:'card',lease_token:'token',snapshot:f.snapshot,card:f.card,concerns:ALL_CONCERNS},error:null}).mockResolvedValue({data:true,error:null});
    const inspectFull=vi.fn().mockImplementation(async (...args:Parameters<FullInspect>)=>({observation:args[3]==='confirmation'?targetedResponse(f.observation,args[4]!):f.observation,model:'test',promptTokens:100,completionTokens:100}));
    const loadImage=vi.fn().mockImplementation(async (_db,_path,side)=>({side,dataUrl:'data:image/jpeg;base64,test',sha256:side,width:1000,height:1400}));
    return {...f,rpc,inspectFull,loadImage,db:{rpc} as unknown as ReturnType<typeof supabaseServer>};
  }
  it('checks all categories in one inspection for a confirmed review',async()=>{
    const h=harness();
    expect(await processOneGradeReview(h)).toMatchObject({outcome:'grade_confirmed',awaitingOwner:false,correctedCardId:null});
    expect(h.inspectFull).toHaveBeenCalledTimes(1);expect(h.loadImage).toHaveBeenCalledTimes(2);
    expect(h.rpc).toHaveBeenLastCalledWith('finish_grade_review',expect.objectContaining({p_patch:{},p_result:expect.stringContaining('Surface: Supported.')}));
  });
  function supportCorners(f:ReturnType<typeof fullFixture>) {
    const corner=f.observation.condition[0];
    corner.assessment='supported';corner.row=`corners_${f.snapshot.grade}`;corner.evidence[0].kind='whitening';
    corner.original_findings.forEach(c=>{c.verdict='supported';});
  }
  function uncertainSurface(f:ReturnType<typeof fullFixture>,low=9,high=10) {
    const surface=f.observation.condition[4];surface.assessment='unresolved';surface.row=null;
    surface.material_uncertainty=true;surface.confidence='medium';
    surface.score_range={lowest_row:`surface_${low}`,highest_row:`surface_${high}`,reason:'A small possible scuff limits the uncertainty to these adjacent rubric rows.'};
    surface.original_findings.forEach(c=>{c.verdict='unclear';});
    return surface;
  }
  it('supports an overall 8 while a surface detail remains between 9 and 10',async()=>{
    const h=harness(8);supportCorners(h);uncertainSurface(h);
    expect(await processOneGradeReview(h)).toMatchObject({outcome:'grade_confirmed',awaitingOwner:false});
    expect(h.inspectFull).toHaveBeenCalledTimes(1);
    expect(h.rpc).toHaveBeenLastCalledWith('finish_grade_review',expect.objectContaining({p_patch:{},p_proposal:expect.objectContaining({overall_assessment:expect.objectContaining({supported:true,lower:8,upper:8,unresolved:['surface']})}),p_result:expect.stringContaining('Some surface details remain unresolved')}));
  });
  it('keeps the overall grade unresolved when an uncertain area could lower it',()=>{
    const f=fullFixture(8);supportCorners(f);const surface=uncertainSurface(f,7,9);surface.evidence[0].kind='scuff';
    expect(assessOverallGrade(f.prepared,compareFullReview(f.prepared,f.observation))).toMatchObject({supported:false,lower:7,upper:8});
  });
  it('does not accept a bounded range for a hidden area or low-confidence inspection',()=>{
    const f=fullFixture(8);supportCorners(f);const surface=uncertainSurface(f);
    surface.coverage_complete=false;
    expect(assessOverallGrade(f.prepared,compareFullReview(f.prepared,f.observation)).supported).toBe(false);
    surface.coverage_complete=true;surface.confidence='low';
    expect(assessOverallGrade(f.prepared,compareFullReview(f.prepared,f.observation)).supported).toBe(false);
  });
  it('does not use an unbounded original defect to confirm the grade',()=>{
    const f=fullFixture(8);supportCorners(f);const surface=uncertainSurface(f);
    surface.original_findings[0].verdict='not_visible';
    expect(assessOverallGrade(f.prepared,compareFullReview(f.prepared,f.observation)).supported).toBe(false);
  });
  it('requires a supported limiting score instead of assuming the original grade is correct',()=>{
    const f=fullFixture(8);const corner=f.observation.condition[0];
    corner.assessment='unresolved';corner.row=null;corner.evidence[0].kind='whitening';
    corner.score_range={lowest_row:'corners_8',highest_row:'corners_9',reason:'The visible whitening may fit either adjacent severity level.'};
    expect(assessOverallGrade(f.prepared,compareFullReview(f.prepared,f.observation))).toMatchObject({supported:false,lower:8,upper:9});
  });
  it('rejects reversed and cross-category ranges',()=>{
    const f=fullFixture(8);const face=uncertainSurface(f);
    face.score_range!.lowest_row='surface_10';face.score_range!.highest_row='surface_9';
    expect(()=>compareFullReview(f.prepared,f.observation)).toThrow('invalid_review_range');
    face.score_range!.lowest_row='corners_8';
    expect(()=>compareFullReview(f.prepared,f.observation)).toThrow('invalid_review_range');
  });
  it('never uses an uncertain range to authorize a precise score correction',()=>{
    const f=fullFixture(9);
    f.observation.condition[0].score_range={lowest_row:'corners_9',highest_row:'corners_10',reason:'The small mark could be one minor flaw or printed artwork.'};
    expect(compareFullReview(f.prepared,f.observation).findings[0].candidate_score).toBeNull();
  });
  it('bounds non-limiting centering uncertainty without changing its saved ratios',()=>{
    const f=fullFixture(8);supportCorners(f);
    f.observation.centering.faces[0].assessment='unresolved';f.observation.centering.faces[0].left_right=[55,45];
    f.observation.centering.faces[0].confidence='medium';
    const overall=assessOverallGrade(f.prepared,compareFullReview(f.prepared,f.observation));
    expect(overall).toMatchObject({supported:true,lower:8,upper:8});
    expect(overall.faces.find(f=>f.category==='centering'&&f.side==='front')).toMatchObject({lower:9,upper:10,exact:false});
    expect(f.report.centering.front.left_right).toBe('50/50');
  });
  it('rejects a focused response with a missing or duplicate target',()=>{
    const f=fullFixture(9),initial=compareFullReview(f.prepared,f.observation);
    expect(()=>compareFocusedReview(f.prepared,initial,{centering:{faces:[]},condition:[]})).toThrow('unexpected_confirmation_scope');
    const response=targetedResponse(f.observation,initial);response.condition.push(response.condition[0]);
    expect(()=>compareFocusedReview(f.prepared,initial,response)).toThrow('unexpected_confirmation_scope');
  });
  it('does not preserve overall support when confirmation reveals a potentially limiting issue',async()=>{
    const h=harness(8);supportCorners(h);
    const face=h.observation.condition[4];face.assessment='correction_needed';face.row='surface_9';face.evidence[0].kind='scuff';face.original_findings[0].verdict='contradicted';
    const second=structuredClone(h.observation);second.condition[4].row='surface_7';
    h.inspectFull.mockResolvedValueOnce({observation:h.observation,model:'test',promptTokens:1,completionTokens:1});
    h.inspectFull.mockImplementationOnce(async (...args:Parameters<FullInspect>)=>({observation:targetedResponse(second,args[4]!),model:'test',promptTokens:1,completionTokens:1}));
    expect(await processOneGradeReview(h)).toMatchObject({outcome:'unable_to_verify',awaitingOwner:false});
    expect(h.rpc).toHaveBeenLastCalledWith('finish_grade_review',expect.objectContaining({p_patch:{},p_proposal:expect.objectContaining({reason:'disagreement'})}));
  });
  it('sends only the disputed category, original claims and relevant face for confirmation',()=>{
    const f=fullFixture(9),review=compareFullReview(f.prepared,f.observation);
    const images=(['front','back'] as const).map(side=>({side,dataUrl:`data:image/jpeg;base64,${side}`,sha256:side,width:1000,height:1400}));
    const input=fullInspectionInput(images,f.prepared,'confirmation',review);
    const serialized=JSON.stringify(input.messages[1]);
    expect(serialized).toContain('corners_front_0');expect(serialized).not.toContain('surface_front_0');
    expect(serialized).not.toContain('base64,back');expect(serialized).not.toContain('candidate_score');
    expect(serialized).not.toContain('corners_10');expect(serialized).not.toContain('original_result');
    expect(correctionTargets(review)).toEqual([{category:'corners',side:'front'}]);
  });
  it('accepts targeted confirmation without requesting other categories again',()=>{
    const f=fullFixture(9),initial=compareFullReview(f.prepared,f.observation);
    const focused=targetedResponse(f.observation,initial);
    expect(focused.condition).toHaveLength(1);expect(focused.centering.faces).toHaveLength(0);
    expect(fullReviewsAgree(initial,compareFocusedReview(f.prepared,initial,focused))).toBe(true);
    focused.condition.push(f.observation.condition[4]);
    expect(()=>compareFocusedReview(f.prepared,initial,focused)).toThrow('unexpected_confirmation_scope');
  });
  it('retains overall support when an unverified proposed change cannot affect the grade',async()=>{
    const h=harness(8);supportCorners(h);
    const surface=h.observation.condition[4];surface.assessment='correction_needed';surface.row='surface_9';surface.evidence[0].kind='scuff';surface.original_findings[0].verdict='contradicted';
    const second=structuredClone(h.observation);second.condition[4].assessment='supported';second.condition[4].row='surface_10';second.condition[4].evidence[0].kind='clean';second.condition[4].original_findings[0].verdict='supported';
    h.inspectFull.mockResolvedValueOnce({observation:h.observation,model:'test',promptTokens:1,completionTokens:1});
    h.inspectFull.mockImplementationOnce(async (...args:Parameters<FullInspect>)=>({observation:targetedResponse(second,args[4]!),model:'test',promptTokens:1,completionTokens:1}));
    expect(await processOneGradeReview(h)).toMatchObject({outcome:'grade_confirmed',awaitingOwner:false});
    expect(h.rpc).toHaveBeenLastCalledWith('finish_grade_review',expect.objectContaining({p_patch:{},p_result:expect.stringContaining('The proposed correction was not verified.')}));
  });
  it('supports an unchanged score with ordinary photographic limitations',async()=>{
    const h=harness();
    h.observation.condition.forEach(f=>{f.confidence='medium';f.limitations=['Microscopic wear cannot be excluded.'];});
    h.observation.centering.faces.forEach(f=>{f.confidence='medium';f.limitations=['Precision is limited to the photograph.'];});
    expect(await processOneGradeReview(h)).toMatchObject({outcome:'grade_confirmed'});
    expect(h.inspectFull.mock.calls[0][1].reviewContext).toMatchObject({overall_grade:10,category_scores:{corners:10}});
  });
  it('does not turn material uncertainty into a supported grade',async()=>{
    const h=harness();h.observation.condition[0].material_uncertainty=true;
    expect(await processOneGradeReview(h)).toMatchObject({outcome:'unable_to_verify'});
    expect(h.inspectFull).toHaveBeenCalledTimes(1);
  });
  it('does not propose a change with only medium confidence',()=>{
    const f=fullFixture(9);f.observation.condition[0].confidence='medium';
    expect(compareFullReview(f.prepared,f.observation).findings[0].candidate_score).toBeNull();
  });
  it('does not accept a claim of support when the rubric score disagrees',()=>{
    const f=fullFixture(9);f.observation.condition[0].assessment='supported';
    expect(compareFullReview(f.prepared,f.observation).findings[0].verdict).toBe('unable_to_verify');
  });
  it('can support existing centering within boundary tolerance without publishing a new measurement',()=>{
    const f=fullFixture();f.report.centering.front.left_right='55/45';f.observation.centering.faces[0].left_right=[55,45];
    f.observation.centering.faces[0].confidence='medium';
    expect(compareFullReview(prepareFullReview(f.snapshot),f.observation).centering.findings[0]).toMatchObject({verdict:'confirmed',candidate_score:10});
    f.observation.centering.faces[0].assessment='correction_needed';
    f.observation.centering.faces[0].confidence='high';
    expect(compareFullReview(prepareFullReview(f.snapshot),f.observation).centering.findings[0].candidate_score).toBeNull();
  });
  it('does not confirm an inconsistent score merely because the ratios match',()=>{
    const f=fullFixture();f.report.raw_sub_scores.centering_front=9;
    expect(compareFullReview(prepareFullReview(f.snapshot),f.observation).centering.findings[0].verdict).toBe('unable_to_verify');
  });
  it('retains unrelated unresolved fields in a partial correction',()=>{
    const f=fullFixture(9);f.observation.condition[5].material_uncertainty=true;
    const review=compareFullReview(f.prepared,f.observation);
    const correction=buildFullCorrection(f.card,f.snapshot,review,'review');
    const report=JSON.parse(String(correction.patch.conversational_grading));
    expect(report.surface).toEqual(f.report.surface);
    expect(report.raw_sub_scores.surface_back).toBe(10);
    expect(correction.afterGrade).toBe(10);
  });
  it('can correct one centering face without rewriting an unresolved opposite face',()=>{
    const f=fullFixture();f.report.centering.front.left_right='70/30';
    f.observation.centering.faces[0].assessment='correction_needed';
    f.observation.centering.faces[1].material_uncertainty=true;
    const review=compareFullReview(prepareFullReview(f.snapshot),f.observation);
    const correction=buildFullCorrection(f.card,f.snapshot,review,'review');
    const report=JSON.parse(String(correction.patch.conversational_grading));
    expect(report.centering.front.left_right).toBe('50/50');
    expect(report.centering.back).toEqual(f.report.centering.back);
    expect(correction.afterGrade).toBe(10);
  });
  it('accepts unknown identity metadata without inventing a year',()=>{
    const f=fullFixture();
    const prepared=prepareFullReview({...f.snapshot,report:{...f.report,card_info:{year:null}}});
    expect(prepared.report.card_info?.year).toBeNull();
  });
  it('keeps defect location and severity together without dropping a long defect list',()=>{
    const f=fullFixture();
    const defects=Array.from({length:12},(_,i)=>({type:'whitening',severity:'minor',location:`back top edge ${i}`,description:`A white fleck is visible at position ${i}.`,source:'zoom-inspection'}));
    const prepared=prepareFullReview({...f.snapshot,report:{...f.report,edges:{...f.report.edges,back:{summary:'Multiple flecks are visible.',defects}}}});
    const claims=prepared.claims.filter(c=>c.category==='edges'&&c.side==='back');
    expect(claims).toHaveLength(13);
    expect(claims[1].text).toContain('location: back top edge 0; type: whitening; severity: minor; description:');
  });
  it('records validation paths for malformed review responses',async()=>{
    const h=harness();h.inspectFull.mockResolvedValue({observation:{},model:'test',promptTokens:1,completionTokens:1});
    await processOneGradeReview(h);
    expect(h.rpc).toHaveBeenLastCalledWith('finish_grade_review',expect.objectContaining({p_proposal:expect.objectContaining({reason:'invalid_observation',validation_error:expect.arrayContaining([expect.objectContaining({path:['centering']})])})}));
  });
  it('sends a strict schema with homogeneous coordinate arrays',()=>{
    const format=fullResponseFormat();
    expect(format.type).toBe('json_schema');expect(format.json_schema.strict).toBe(true);
    const walk=(v:unknown)=>{if(v&&typeof v==='object'){const node=v as Record<string,unknown>;expect(Array.isArray(node.items)).toBe(false);Object.values(node).forEach(walk);}};
    walk(format.json_schema.schema);
  });
  it('decodes named image boxes without guessing or clipping invalid coordinates',()=>{
    const f=fullFixture();
    const wire=JSON.parse(JSON.stringify(f.observation, (key,value)=>key==='region'?{x:value[0],y:value[1],width:value[2],height:value[3]}:value));
    expect(compareFullReview(f.prepared,decodeFullObservation(wire)).findings[0].verdict).toBe('confirmed');
    wire.condition[0].evidence[0].region.width=2;
    expect(()=>compareFullReview(f.prepared,decodeFullObservation(wire))).toThrow();
    const schema=JSON.stringify(fullResponseFormat().json_schema.schema);
    expect(schema).toContain('"required":["x","y","width","height"]');
  });
  it('routes a corroborated corner correction to owner approval',async()=>{
    const h=harness(9);
    expect(await processOneGradeReview(h)).toMatchObject({outcome:'grade_corrected',awaitingOwner:true,correctedCardId:null});
    expect(h.inspectFull).toHaveBeenCalledTimes(2);
    expect(h.rpc).toHaveBeenLastCalledWith('finish_grade_review',expect.objectContaining({p_patch:expect.objectContaining({conversational_whole_grade:10}),p_proposal:expect.objectContaining({verification:{agreed:true}})}));
  });
  it('preserves an unclear area while staging an independently verified correction',async()=>{
    const h=harness(9);h.observation.condition[5].coverage_complete=false;
    expect(await processOneGradeReview(h)).toMatchObject({outcome:'grade_corrected',awaitingOwner:true});
    expect(h.inspectFull).toHaveBeenCalledTimes(2);
    expect(h.rpc).toHaveBeenLastCalledWith('finish_grade_review',expect.objectContaining({p_patch:expect.objectContaining({conversational_whole_grade:10}),p_error:null,p_result:expect.stringContaining('Surface: Not fully verified.')}));
  });
  it('does not apply or reroll disagreeing condition findings',async()=>{
    const h=harness(9),second=structuredClone(h.observation);
    second.condition[0].original_findings[0].verdict='supported';
    h.inspectFull.mockResolvedValueOnce({observation:h.observation,model:'test',promptTokens:1,completionTokens:1}).mockResolvedValueOnce({observation:second,model:'test',promptTokens:1,completionTokens:1});
    expect(await processOneGradeReview(h)).toMatchObject({outcome:'unable_to_verify'});
    expect(h.inspectFull).toHaveBeenCalledTimes(2);
    expect(h.rpc).toHaveBeenLastCalledWith('finish_grade_review',expect.objectContaining({p_patch:{},p_error:null}));
  });
  it('does not silently fall back to centering when full original scores are missing',async()=>{
    const h=harness();delete h.report.raw_sub_scores.surface_back;
    expect(await processOneGradeReview(h)).toMatchObject({outcome:'unable_to_verify'});
    expect(h.inspectFull).not.toHaveBeenCalled();
  });
  it('requires all six condition faces and both centering faces',()=>{
    const f=fullFixture();f.observation.condition[5]=f.observation.condition[0];
    expect(()=>compareFullReview(f.prepared,f.observation)).toThrow('duplicate_condition_face');
  });
  it('confirms all four categories without forcing a correction',()=>{
    const f=fullFixture(),review=compareFullReview(f.prepared,f.observation);
    expect(review.findings.every(v=>v.verdict==='confirmed')).toBe(true);
    for(const category of ['Centering','Corners','Edges','Surface']) expect(fullReviewSummary(review)).toContain(`${category}: Supported.`);
  });
  it('rejects arbitrary scores and rows from another category',()=>{
    const f=fullFixture();f.observation.condition[0].row='edges_9';
    expect(()=>compareFullReview(f.prepared,f.observation)).toThrow('invalid_rubric_row');
    expect(()=>compareFullReview(f.prepared,{...f.observation,grade:10})).toThrow();
  });
  it('does not erase a deduction merely because the old mark is not visible',()=>{
    const f=fullFixture(9);f.observation.condition[0].original_findings[0].verdict='not_visible';
    expect(compareFullReview(f.prepared,f.observation).findings[0].candidate_score).toBeNull();
  });
  it('requires every original claim to be addressed',()=>{
    const f=fullFixture();f.observation.condition[0].original_findings=[];
    expect(()=>compareFullReview(f.prepared,f.observation)).toThrow('unaddressed_original_findings');
  });
  it('does not treat partial coverage or defects as a clean 10',()=>{
    const f=fullFixture();f.observation.condition[0].coverage_complete=false;
    f.observation.condition[2].evidence[0].kind='whitening';
    const r=compareFullReview(f.prepared,f.observation);
    expect(r.findings[0].candidate_score).toBeNull();expect(r.findings[2].candidate_score).toBeNull();
  });
  it('does not count border wear as surface damage or decide a structural cap',()=>{
    const f=fullFixture();f.observation.condition[4].row='surface_8';f.observation.condition[4].evidence[0].kind='whitening';
    f.observation.condition[1].evidence[0].kind='structural';
    const r=compareFullReview(f.prepared,f.observation);
    expect(r.findings[4].candidate_score).toBeNull();expect(r.findings[1].candidate_score).toBeNull();
  });
  it('requires agreeing defect locations and prior-claim verdicts',()=>{
    const f=fullFixture(9),a=compareFullReview(f.prepared,f.observation);
    expect(fullReviewsAgree(a,a)).toBe(true);
    f.observation.condition[0].original_findings[0].verdict='supported';
    expect(fullReviewsAgree(a,compareFullReview(f.prepared,f.observation))).toBe(false);
  });
  it('updates corners and the overall grade while preserving the original passes',()=>{
    const f=fullFixture(9),before=JSON.stringify(f);
    const r=buildFullCorrection(f.card,f.snapshot,compareFullReview(f.prepared,f.observation),'review');
    expect(r.afterGrade).toBe(10);
    const report=JSON.parse(String(r.patch.conversational_grading));
    expect(report.grading_passes.pass_1).toEqual(f.report.grading_passes.pass_1);
    expect(report.raw_sub_scores.corners_front).toBe(10);
    expect(report.edges).toEqual(f.report.edges);
    expect(JSON.stringify(f)).toBe(before);
  });
  it('preserves independently captured grade caps',()=>{
    const f=fullFixture(9);f.report.grade_review_scoring_context.full_review.independent_cap=9;
    expect(buildFullCorrection(f.card,f.snapshot,compareFullReview(f.prepared,f.observation),'review').afterGrade).toBe(9);
  });
  it('does not rescore a structural card as ordinary wear even when the model mislabels damage',()=>{
    const f=fullFixture(9);f.report.grade_review_scoring_context.full_review.structural_confirmed=true;
    const prepared=prepareFullReview(f.snapshot);
    expect(compareFullReview(prepared,f.observation).findings[0].candidate_score).toBeNull();
  });
  it('blocks a newly described crease even if it is labeled as a dent',()=>{
    const f=fullFixture();const face=f.observation.condition[4];
    face.assessment='correction_needed';face.row='surface_7';face.evidence[0].kind='dent';face.evidence[0].description='A structural crease crosses the upper-left printed frame.';
    expect(compareFullReview(f.prepared,f.observation).findings[4].candidate_score).toBeNull();
  });
  it('does not describe an unconfirmed suggestion as a verified correction',()=>{
    const f=fullFixture(9),review=compareFullReview(f.prepared,f.observation);
    expect(fullReviewSummary(review)).toContain('A possible difference remains unverified.');
    expect(fullReviewSummary(review)).not.toContain('Correction verified.');
  });
  it.each(['edges','surface'] as const)('can correct %s and propagate its score to the report',category=>{
    const f=fullFixture(),face=f.observation.condition.find(v=>v.category===category&&v.side==='back')!;
    face.assessment='correction_needed';face.row=`${category}_9`;face.evidence[0].kind=category==='edges'?'whitening':'scratch';
    face.original_findings[0].verdict='contradicted';
    const review=compareFullReview(f.prepared,f.observation),r=buildFullCorrection(f.card,f.snapshot,review,'review');
    expect(r.afterGrade).toBe(9);
    const report=JSON.parse(String(r.patch.conversational_grading));
    expect(report.raw_sub_scores[`${category}_back`]).toBe(9);
    expect(report.grading_passes.averaged_rounded[category]).toBe(9);
    expect(report[category].back.defects[0].type).toBe(category==='edges'?'whitening':'scratch');
  });
});
