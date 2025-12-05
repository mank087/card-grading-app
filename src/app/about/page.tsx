import FloatingCardsBackground from '../ui/FloatingCardsBackground';

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
              Sure, professional grading services like PSA, BGS, and CGC exist, and they're great! But they come with some serious drawbacks. The cost adds up quickly, especially if you're grading multiple cards. The turnaround time can stretch from weeks to months. And sometimes, after all that waiting and expense, the grade comes back lower than you hoped, leaving you wondering if it was worth it.
            </p>
            <p className="text-gray-700 mb-4">
              We thought: there has to be a better way.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">The Solution</h2>
            <p className="text-gray-700 mb-4">
              That's why we built DCM. We wanted a tool that could give us quick, accurate, detailed assessments of our cards without the wait, the cost, or the commitment of professional grading. Something we could use to:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4 ml-4">
              <li>Decide which cards are worth sending to PSA, BGS, or CGC</li>
              <li>Get a realistic sense of condition before listing cards for sale</li>
              <li>Organize our collections with consistent, objective grades</li>
              <li>Satisfy our curiosity about that card we just pulled</li>
            </ul>
            <p className="text-gray-700 mb-4">
              Using DCM Optic™ technology, we built a system that evaluates cards the same way the pros do, examining centering, corners, edges, and surface condition with meticulous detail. The difference? You get your results in under 2 minutes, not 2 months.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">For Hobbyists, By Hobbyists</h2>
            <p className="text-gray-700 mb-4">
              We built DCM for ourselves first, and we think you'll love it too. Whether you're a weekend warrior cracking packs at your local card shop, a seasoned collector with thousands of cards to organize, or someone who just wants to know if that childhood collection is worth anything, DCM is here to help.
            </p>
            <p className="text-gray-700 mb-4">
              Our grading assessments are meant for informational and hobby purposes. They're a tool to help you make better decisions about your collection, not a replacement for professional grading when you need official certification. Think of us as your personal grading assistant: fast, accurate, and always available.
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
