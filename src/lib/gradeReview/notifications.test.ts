import { beforeEach,afterEach,it,expect,vi } from 'vitest';
const mocks=vi.hoisted(()=>({send:vi.fn(),rpc:vi.fn(),from:vi.fn(),user:vi.fn()}));
vi.mock('resend',()=>({Resend:class{emails={send:mocks.send};}}));
vi.mock('@/lib/supabaseServer',()=>({supabaseServer:()=>({rpc:mocks.rpc,from:mocks.from,auth:{admin:{getUserById:mocks.user}}})}));
import { deliverReviewNotifications,reviewEmail } from './notifications';
const notice={id:'notice-id',review_id:'review-id',kind:'customer_reviewed' as const,lease_token:'lease',attempt_count:1,payload:{requester_id:'owner',card_id:'card',category:'sports',card_name:'Test Card',notes:'Back edge wear limits the grade.',verdict:'propose_change',original_grade:8,proposed_grade:7,awaiting_owner:true}};
let updates:Record<string,unknown>[];
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('GRADE_REVIEW_EMAILS_ENABLED','true');vi.stubEnv('RESEND_API_KEY','fake-test-key');updates=[];
  mocks.rpc.mockResolvedValueOnce({data:notice,error:null}).mockResolvedValue({data:null,error:null});
  mocks.user.mockResolvedValue({data:{user:{email:'owner@example.test'}},error:null});
  mocks.send.mockResolvedValue({data:{id:'provider-id'},error:null});
  mocks.from.mockImplementation(()=>({update:(value:Record<string,unknown>)=>{updates.push(value);const chain={eq:vi.fn(),select:vi.fn(),single:vi.fn(),then:(resolve:(v:unknown)=>unknown)=>Promise.resolve({error:null}).then(resolve)};chain.eq.mockReturnValue(chain);chain.select.mockReturnValue(chain);chain.single.mockResolvedValue({data:value,error:null});return chain;}}));
});
afterEach(()=>vi.unstubAllEnvs());
it('emails the requester with verdict and notes, preserving owner approval and recording receipt',async()=>{
  expect(await deliverReviewNotifications()).toEqual({sent:1,failed:0});
  expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({to:'owner@example.test',text:expect.stringContaining('Your original grade remains in place until you accept.')}),{idempotencyKey:'grade-review-notice-id'});
  expect(mocks.send.mock.calls[0][0].text).toContain(notice.payload.notes);
  expect(updates[0]).toHaveProperty('delivery_message');expect(updates.some(u=>u.provider_id==='provider-id')).toBe(true);
});
it('routes request alerts only to the specified admin mailbox',async()=>{
  mocks.rpc.mockReset().mockResolvedValueOnce({data:{...notice,kind:'admin_requested'},error:null}).mockResolvedValue({data:null,error:null});
  await deliverReviewNotifications();expect(mocks.user).not.toHaveBeenCalled();expect(mocks.send.mock.calls[0][0].to).toBe('admin@dcmgrading.com');expect(mocks.send.mock.calls[0][0].text).toContain('/admin/grade-reviews/review-id');
});
it('retries provider failures with the same key and saved recipient/message',async()=>{
  mocks.send.mockResolvedValueOnce({error:{message:'failed'}});expect(await deliverReviewNotifications()).toEqual({sent:0,failed:1});
  expect(updates.some(u=>u.last_error==='provider_send_failed'&&!u.sent_at)).toBe(true);
  mocks.rpc.mockReset().mockResolvedValueOnce({data:{...notice,recipient_email:'owner@example.test',delivery_message:reviewEmail(notice)},error:null}).mockResolvedValue({data:null,error:null});
  await deliverReviewNotifications();expect(mocks.send.mock.calls[0]).toEqual(mocks.send.mock.calls[1]);expect(mocks.user).toHaveBeenCalledOnce();
});
it('does not send or consume queue attempts while disabled',async()=>{vi.stubEnv('GRADE_REVIEW_EMAILS_ENABLED','');expect(await deliverReviewNotifications()).toEqual({paused:true,sent:0});expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.send).not.toHaveBeenCalled();});
it('escapes notes in the HTML body and keeps them verbatim in text',()=>{const email=reviewEmail({...notice,payload:{...notice.payload,notes:'<script>alert(1)</script>'}});expect(email.html).not.toContain('<script>');expect(email.html).toContain('&lt;script&gt;');expect(email.text).toContain('<script>');});
it('links the customer to the card page and brands the email',()=>{const email=reviewEmail({...notice,payload:{...notice.payload,category:'Lorcana'}});expect(email.text).toContain('https://dcmgrading.com/lorcana/card');expect(email.html).toContain('href="https://dcmgrading.com/lorcana/card"');expect(email.html).toContain('DCM%20Logo%20white.png');expect(email.html).toContain('8 &rarr; 7');});
