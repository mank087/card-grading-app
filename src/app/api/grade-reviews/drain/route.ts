import { NextRequest, NextResponse } from 'next/server';
import { requireCron } from '@/lib/cronAuth';
import { deliverReviewNotifications } from '@/lib/gradeReview/notifications';
export const maxDuration=180;
export async function POST(request:NextRequest){
  if(!process.env.CRON_SECRET)return NextResponse.json({error:'Worker authentication is not configured.'},{status:503});
  const auth=requireCron(request,'grade-review-notifications');if(!auth.ok)return auth.response;
  try{return NextResponse.json(await deliverReviewNotifications());}
  catch{return NextResponse.json({error:'Review email delivery is temporarily unavailable.'},{status:503});}
}
export const GET=POST;
