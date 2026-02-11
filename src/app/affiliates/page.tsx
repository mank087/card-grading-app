import Link from 'next/link'

export const metadata = {
  title: 'Affiliate Program | DCM Grading',
  description: 'Partner with DCM Grading and earn commissions on every sale you refer. Join our affiliate program for card grading influencers and community figures.',
}

export default function AffiliatesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-block bg-indigo-100 text-indigo-700 text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
            Partner Program
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Earn With DCM Grading
          </h1>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Are you a card collecting influencer, YouTuber, or community figure?
            Partner with DCM Grading and earn commissions on every sale you refer.
            Your audience gets 10% off their first purchase.
          </p>
          <Link
            href="mailto:partners@dcmgrading.com?subject=Affiliate Program Interest"
            className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-4 rounded-xl transition-all shadow-lg hover:shadow-xl text-lg"
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
              <h3 className="font-semibold text-gray-900 mb-2">Fans Get 10% Off</h3>
              <p className="text-gray-600 text-sm">
                Anyone who uses your link or code gets 10% off their first DCM Grading purchase. Easy sell.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-indigo-600">3</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">You Earn Commission</h3>
              <p className="text-gray-600 text-sm">
                Earn a generous commission on every referred sale. Track your earnings and get paid on your schedule.
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
              { title: 'Generous Commissions', desc: 'Competitive rates on every sale your audience makes.' },
              { title: '30-Day Cookie Window', desc: 'Your referrals are tracked for 30 days, so you get credit even if they buy later.' },
              { title: 'Dual Attribution', desc: 'Referral links AND promo codes — your audience can use whichever is easier.' },
              { title: 'Real-Time Dashboard', desc: 'Track clicks, conversions, and earnings in your affiliate dashboard.' },
              { title: 'Growing Product', desc: 'DCM Grading is used by thousands of collectors for AI-powered card grading.' },
              { title: 'Flexible Payouts', desc: 'Get paid via PayPal, Venmo, or your preferred method.' },
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

      {/* CTA */}
      <section className="py-20 px-4 bg-gradient-to-br from-indigo-600 to-purple-700 text-white">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Interested in Partnering?</h2>
          <p className="text-indigo-200 mb-8">
            Reach out and we&apos;ll get you set up with your referral code, custom link,
            and everything you need to start earning.
          </p>
          <Link
            href="mailto:partners@dcmgrading.com?subject=Affiliate Program Interest"
            className="inline-block bg-white text-indigo-700 font-bold px-8 py-4 rounded-xl transition-all shadow-lg hover:shadow-xl text-lg hover:bg-gray-50"
          >
            Contact Us to Apply
          </Link>
        </div>
      </section>
    </div>
  )
}
