import { completeMetadata } from '@/lib/seo/completeMetadata'
import Link from 'next/link'
import AffiliateApplicationForm from '@/components/affiliates/AffiliateApplicationForm'

export const metadata = completeMetadata({
  alternates: { canonical: 'https://dcmgrading.com/affiliates' },
  title: { absolute: 'Affiliate Program | DCM Grading' },
  description: 'Partner with DCM Grading and earn 20 grading credits for every new customer you refer. Your audience gets 15% off their first purchase.',
})

export default function AffiliatesPage() {
  return (
    <div className="dcm-brand dcm-editorial min-h-screen dcm-editorial-soft">
      {/* Hero */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center dcm-editorial-heading">
          <div className="inline-block bg-indigo-100 text-indigo-700 text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
            Partner Program
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Partner With DCM Grading
          </h1>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Are you a card collecting influencer, YouTuber, or community figure?
            Share DCM Grading with your audience. They get 15% off their first purchase,
            and you earn 20 grading credits every time one of them becomes a paying customer.
          </p>
          <Link
            href="#apply"
            className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-4 rounded-xl transition-all shadow-lg hover:shadow-xl text-lg dcm-editorial-primary"
          >
            Apply to Partner
          </Link>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-12">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-indigo-600">1</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Get Your Link</h3>
              <p className="text-gray-600 text-sm">
                We set you up with a unique referral code and link. Share it with your audience however you want.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-indigo-600">2</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Fans Get 15% Off</h3>
              <p className="text-gray-600 text-sm">
                Anyone who uses your link or code gets 15% off their first DCM Grading purchase. Easy sell.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-indigo-600">3</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">You Earn 20 Credits</h3>
              <p className="text-gray-600 text-sm">
                You earn 20 grading credits for every new customer who buys. Credits land in your account automatically.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-12">Why Partner With Us</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { title: '20 Grading Credits Per Customer', desc: 'Every new customer who buys through your link earns you 20 grading credits.' },
              { title: '30-Day Tracking', desc: 'Your referrals are tracked for 30 days, so you get credit even if they buy later.' },
              { title: 'Dual Attribution', desc: 'Referral links AND promo codes. Your audience can use whichever is easier.' },
              { title: 'Referral Stats On Your Account Page', desc: 'See clicks, referrals, and credits earned right on your DCM Grading account page.' },
              { title: 'Growing Product', desc: 'DCM Grading is used by thousands of collectors for card grading powered by DCM Optic™.' },
              { title: 'A Real Discount For Your Audience', desc: '15% off the first purchase is a genuine reason for your followers to try it.' },
            ].map((benefit) => (
              <div key={benefit.title} className="flex gap-3 p-4 bg-white rounded-xl border border-gray-100">
                <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                  <svg className="w-3.5 h-3.5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{benefit.title}</h3>
                  <p className="text-gray-600 text-sm">{benefit.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Program terms */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-6">Program Terms</h2>
          <ul className="space-y-3 text-sm text-gray-600">
            {[
              'A new customer is someone making their first paid purchase on dcmgrading.com. Free grades do not count, and purchases made inside the iOS app cannot use codes or be tracked.',
              'The 15% discount applies to a first purchase at list price. It cannot be combined with Card Lovers or Founder member pricing.',
              'You earn 20 grading credits once per new customer, credited to the DCM Grading account that matches the email on your application. Credits never expire.',
              'If a referred purchase is refunded, the credits for that referral are removed.',
              'Referring yourself, your own accounts, or accounts you control is not rewarded. Codes may be paused for misuse.',
              'When you share your link or code, disclose that you are a DCM Grading partner as required by the FTC and your platform.',
            ].map((line) => (
              <li key={line} className="flex gap-3">
                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2" aria-hidden="true" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Application form */}
      <section id="apply" className="py-16 px-4 scroll-mt-20">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Apply to Partner</h2>
            <p className="text-gray-600">
              Tell us about your audience. Approved partners get a referral code, a tracked link,
              and 20 grading credits for every new customer who buys.
            </p>
          </div>
          <AffiliateApplicationForm />
        </div>
      </section>
    </div>
  )
}
