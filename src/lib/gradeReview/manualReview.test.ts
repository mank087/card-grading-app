import { expect,it } from 'vitest';
import { hasManualReviewAccess,manualVerdictSchema,buildManualResult } from './manualReview';
it('accepts VIP or unexpired membership and rejects invalid and expired dates',()=>{
  expect(hasManualReviewAccess({is_vip:true})).toBe(true);
  expect(hasManualReviewAccess({is_card_lover:true,card_lover_current_period_end:'2030-01-01'},Date.parse('2026-01-01'))).toBe(true);
  expect(hasManualReviewAccess({is_card_lover:true,card_lover_current_period_end:'invalid'})).toBe(false);
  expect(hasManualReviewAccess(null)).toBe(false);
});
it('requires complete subgrades and constraint review for a proposal',()=>{
  expect(manualVerdictSchema.safeParse({verdict:'propose_change',notes:'A supported explanation.'}).success).toBe(false);
  expect(manualVerdictSchema.safeParse({verdict:'confirm',notes:'A supported explanation.',admin_id:'forged'}).success).toBe(false);
});
it('clarifies the report without changing its grade or consuming a new run',()=>{
  const card={conversational_grading:'{}',conversational_whole_grade:8};
  const result=buildManualResult(card,{report:'{}',grade:8},'review',{verdict:'clarify',notes:'Back corner wear limits the grade.'});
  expect(result.patch).not.toHaveProperty('conversational_whole_grade');
  expect(JSON.parse(String(result.patch.conversational_grading)).final_grade.summary).toBe('Manually reviewed by the DCM team. Back corner wear limits the grade. The grade of 8 stands.');
  expect(()=>buildManualResult(card,{report:'changed',grade:8},'review',{verdict:'confirm',notes:'Back corner wear limits the grade.'})).toThrow('stale_review');
});
it('keeps the legacy ai_grading blob on a proposed change so the detail routes do not regrade the card',()=>{
  const scores={centering_front:10,centering_back:10,corners_front:10,corners_back:10,edges_front:9,edges_back:10,surface_front:10,surface_back:10};
  const report={raw_sub_scores:scores,edges:{front:{score:9}},grading_passes:{averaged_rounded:{centering:10,corners:10,edges:9,surface:10,final:9}},final_grade:{whole_grade:9,grade_range:'±1',summary:'Old summary'}};
  const card={conversational_grading:JSON.stringify(report),conversational_whole_grade:9,conversational_final_grade_summary:'Old summary',conversational_sub_scores:{edges:{front:9,back:10,weighted:9}},
    ai_grading:{'Card Information':{name:'Keep me'},'Grading (DCM Master Scale)':{'DCM Grade (Final Whole Number)':9,'Raw Decimal Grade (Before Rounding)':9}},label_data:{grade:9}};
  const result=buildManualResult(card,{report:JSON.stringify(report),grade:9},'review',{verdict:'propose_change',notes:'Edge scratch was a photo artifact.',scores:{...scores,edges_front:10},cap:10,structuralConfirmed:false});
  expect(result.proposedGrade).toBe(10);
  const ai=result.patch.ai_grading as Record<string,Record<string,unknown>>;
  expect(ai['Card Information']).toEqual({name:'Keep me'});
  expect(ai['Grading (DCM Master Scale)']['DCM Grade (Final Whole Number)']).toBe(10);
  expect(result.patch.conversational_final_grade_summary).toBe('Manually reviewed by the DCM team. Edge scratch was a photo artifact. Grade updated from 9 to 10.');
  expect((result.patch.conversational_sub_scores as Record<string,Record<string,number>>).edges.front).toBe(10);
});
it('does not populate legacy weighted/preliminary columns the grading routes leave null',()=>{
  const scores={centering_front:10,centering_back:10,corners_front:10,corners_back:10,edges_front:9,edges_back:10,surface_front:10,surface_back:10};
  const report={raw_sub_scores:scores,edges:{front:{score:9}},grading_passes:{averaged_rounded:{centering:10,corners:10,edges:9,surface:10,final:9}},final_grade:{whole_grade:9,grade_range:'±1',summary:'Old'}};
  const base={conversational_grading:JSON.stringify(report),conversational_whole_grade:9,conversational_sub_scores:{edges:{front:9,back:10,weighted:9}},conversational_weighted_sub_scores:null,conversational_preliminary_grade:null};
  const input={verdict:'propose_change' as const,notes:'Edge mark is a photo artifact.',scores:{...scores,edges_front:10},cap:10,structuralConfirmed:false};
  const fresh=buildManualResult(base,{report:JSON.stringify(report),grade:9},'r',input);
  expect(fresh.patch.conversational_weighted_sub_scores).toBeNull();expect(fresh.patch.conversational_preliminary_grade).toBeNull();
  const legacy=buildManualResult({...base,conversational_weighted_sub_scores:{edges:9},conversational_preliminary_grade:9},{report:JSON.stringify(report),grade:9},'r',input);
  expect(legacy.patch.conversational_weighted_sub_scores).toEqual({centering:10,corners:10,edges:10,surface:10});expect(legacy.patch.conversational_preliminary_grade).toBe(10);
});

it('rewrites only the changed face narrative and settles the uncertainty range on a proposed change',()=>{
  const scores={centering_front:10,centering_back:10,corners_front:10,corners_back:10,edges_front:9,edges_back:10,surface_front:10,surface_back:10};
  const report={raw_sub_scores:scores,edges:{front:{score:9}},grading_passes:{averaged_rounded:{centering:10,corners:10,edges:9,surface:10,final:9}},final_grade:{whole_grade:9,grade_range:'±1',summary:'Old'}};
  const narrative={front_edges:{top:'clean',summary:'Faint scratch on the right edge.',defects:['scratch'],sub_score:9},back_edges:{summary:'Clean.',defects:[],sub_score:10}};
  const card={conversational_grading:JSON.stringify(report),conversational_whole_grade:9,conversational_sub_scores:{edges:{front:9,back:10,weighted:9}},conversational_corners_edges_surface:narrative,conversational_grade_uncertainty:'±1'};
  const result=buildManualResult(card,{report:JSON.stringify(report),grade:9},'r',{verdict:'propose_change',notes:'Edge mark is a photo artifact.',scores:{...scores,edges_front:10},cap:10,structuralConfirmed:false});
  const next=result.patch.conversational_corners_edges_surface as Record<string,Record<string,unknown>>;
  expect(next.front_edges).toMatchObject({top:'clean',sub_score:10,defects:[],manual_review:true,summary:'Manually reviewed by the DCM team: Edge mark is a photo artifact.'});
  expect(next.back_edges).toEqual(narrative.back_edges);
  expect(result.expected.conversational_corners_edges_surface).toBe(narrative);
  expect(result.patch.conversational_grade_uncertainty).toBe('±0');
  expect(JSON.parse(String(result.patch.conversational_grading)).final_grade.grade_range).toBe('±0');
  const bare=buildManualResult({conversational_grading:JSON.stringify(report),conversational_whole_grade:9},{report:JSON.stringify(report),grade:9},'r',{verdict:'propose_change',notes:'Edge mark is a photo artifact.',scores:{...scores,edges_front:10},cap:10,structuralConfirmed:false});
  expect(bare.patch).not.toHaveProperty('conversational_corners_edges_surface');expect(bare.patch).not.toHaveProperty('conversational_grade_uncertainty');
});
