import { notFound } from 'next/navigation'
import Link from 'next/link'
import CardAnalysisAnimation from '@/app/upload/sports/CardAnalysisAnimation'
import { getWelcomeEmailHtml } from '@/lib/welcomeEmailTemplate'
import { getFollowUp24hEmailHtml } from '@/lib/emailTemplates'
import { getFirstGradeEducationHtml, getSocialProofEmailHtml, getLastChanceEmailHtml, getWinbackEmailHtml } from '@/lib/postGradeEmailTemplates'

export default async function ExperienceReview({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const { email } = await searchParams
  const unsubscribe_url = 'https://dcmgrading.com/unsubscribe?preview=example'
  const sample = {
    card_name: 'Example card (preview data)', final_grade: 9,
    front_image_url: 'https://dcmgrading.com/DCM-Card-Lugia-217275-front.jpg',
    unsubscribe_url, category_slug: 'pokemon', card_id: 'preview-only',
    centering_score: 9, corners_score: 9, edges_score: 9, surface_score: 9, credits_remaining: 1,
  }
  const previews: Record<string, () => string> = {
    welcome: () => getWelcomeEmailHtml({ unsubscribeUrl: unsubscribe_url }),
    reminder: () => getFollowUp24hEmailHtml(unsubscribe_url),
    education: () => getFirstGradeEducationHtml(sample),
    showcase: () => getSocialProofEmailHtml({ unsubscribe_url }),
    offer: () => getLastChanceEmailHtml({ unsubscribe_url }),
    winback: () => getWinbackEmailHtml(sample),
  }
  if (email && !previews[email]) notFound()
  return <>
    <nav aria-label="Local experience previews" className="dcm-database-nav">
      <Link href="/dev/experience-review">Grading screen</Link>
      {Object.keys(previews).map(key => <Link key={key} href={`/dev/experience-review?email=${key}`}>{key}</Link>)}
    </nav>
    <p className="p-4 text-center">Local design preview. No card is submitted and no email is sent. Email links are disabled; personalized card data is illustrative.</p>
    {email ? <iframe title={`${email} email preview`} sandbox="" srcDoc={previews[email]()} style={{ width: '100%', height: '85vh', border: 0 }} /> : <CardAnalysisAnimation frontImageUrl="/DCM-Card-Lugia-217275-front.jpg" cardName="Your submitted card" allowNavigation={false} />}
  </>
}
