import { Metadata } from 'next';
import FloatingCardsBackground from '../ui/FloatingCardsBackground';

export const metadata: Metadata = {
  title: 'About Us - Our Story & Mission',
  description: 'DCM Grading is built by collectors, for collectors. Learn about our AI-powered card grading service using DCM Optic™ technology for fast, accurate, and affordable trading card assessments.',
  keywords: 'about DCM, card grading company, AI grading, DCM Optic, card collectors, trading card grading service, who is DCM',
  openGraph: {
    title: 'About DCM Grading - Our Story & Mission',
    description: 'Built by collectors, for collectors. Fast, accurate AI card grading with DCM Optic™ technology.',
    type: 'website',
    siteName: 'DCM Grading',
  },
  twitter: {
    card: 'summary',
    title: 'About DCM Grading',
    description: 'Built by collectors, for collectors. AI-powered card grading with DCM Optic™.',
  },
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white relative">
      <FloatingCardsBackground />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            About DCM
          </h1>
          <p className="text-xl text-gray-600">
            Built by collectors, for collectors
          </p>
        </div>

        {/* Story Section */}
        <div className="prose prose-lg max-w-none">
          <div className="bg-white rounded-2xl shadow-md p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Story</h2>
            <p className="text-gray-700 mb-4">
              We're a team of lifelong card collectors and hobbyists who've spent countless hours organizing, cataloging, and yes, obsessing over the condition of our cards. Whether it's a vintage Mickey Mantle, a first edition Charizard, or a shiny new rookie auto, we know that moment when you pull a card from a pack and immediately wonder: "What would this grade?"
            </p>
            <p className="text-gray-700 mb-4">
              Like many of you, we've been frustrated by the limitations of online marketplaces. eBay, TCGPlayer, and similar platforms rely on self-reported condition descriptions that can be... let's just say, optimistic. "Near Mint" can mean anything from pristine to pretty rough, depending on who's selling.
            </p>
            <p className="text-gray-700 mb-4">
              Traditional grading services like PSA, BGS, and CGC exist, but they want your cards in a box for weeks (sometimes months). Costs add up fast if you're grading more than one. And after all the waiting, you might get back a grade that's lower than you hoped and wonder if it was worth it.
            </p>
            <p className="text-gray-700 mb-4">
              We thought: there has to be a better way.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">The Solution</h2>
            <p className="text-gray-700 mb-4">
              That's why we built DCM. We wanted a tool that could grade our cards in seconds, not months, with the same rigor a human grader would apply. Something we could use to:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4 ml-4">
              <li>Get a grade on any card instantly, without mailing it anywhere</li>
              <li>Know the real condition of a card before listing it for sale</li>
              <li>Organize a collection with consistent, objective grades across every card</li>
              <li>Settle the "what would this grade?" question the moment you pull the card</li>
            </ul>
            <p className="text-gray-700 mb-4">
              DCM Optic™ is the system we built to do it. It evaluates centering, corners, edges, and surface condition the same way human graders do, then averages three independent passes for consistency. Results take under two minutes.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">For Hobbyists, By Hobbyists</h2>
            <p className="text-gray-700 mb-4">
              We built DCM for ourselves first. If you're cracking packs at your local card shop on the weekend, or you've got thousands of cards from the last 30 years stacked in binders, or you just dug out your childhood collection and want to know what's actually in there, DCM works the same way for all of it.
            </p>
            <p className="text-gray-700 mb-4">
              Our grading runs on DCM Optic™, our own AI built specifically for trading cards. Use it to manage a collection, price out a sale, or just answer the question that started this whole thing for us: what would this grade?
            </p>
          </div>

          <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl shadow-xl p-8 text-white text-center">
            <h2 className="text-2xl font-bold mb-4">Join Our Community</h2>
            <p className="text-lg mb-6">
              We're constantly improving DCM based on feedback from collectors like you. Have ideas? Questions? Just want to share your latest pull? We'd love to hear from you.
            </p>
            <a
              href="/contact"
              className="inline-block bg-white text-purple-600 px-8 py-3 rounded-lg font-bold text-lg hover:bg-gray-100 transition-colors shadow-lg"
            >
              Get in Touch
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
