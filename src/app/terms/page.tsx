import { Metadata } from 'next';
import FloatingCardsBackground from '../ui/FloatingCardsBackground';

export const metadata: Metadata = {
  title: 'Terms and Conditions',
  description: 'DCM Grading Terms and Conditions. Review our terms of service for using the AI-powered card grading platform.',
  robots: {
    index: true,
    follow: true,
  },
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 relative">
      <FloatingCardsBackground />
      <div className="max-w-4xl mx-auto bg-white shadow-md rounded-lg p-8 sm:p-12 relative z-10">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Terms and Conditions</h1>
        <p className="text-sm text-gray-600 mb-8">Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <div className="prose prose-lg max-w-none space-y-6 text-gray-700">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">1. Acceptance of Terms</h2>
            <p>
              Welcome to DCM Grading. By accessing or using our card grading service at dcmgrading.com (the "Service"),
              you agree to be bound by these Terms and Conditions ("Terms"). If you do not agree to these Terms, please do not use the Service.
            </p>
            <p>
              We reserve the right to modify these Terms at any time. We will notify you of any changes by posting the updated Terms
              on this page. Your continued use of the Service after such modifications constitutes your acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">2. Description of Service</h2>
            <p>
              DCM Grading provides an AI-powered pre-grading service for trading cards, including Pokémon, Magic: The Gathering,
              Lorcana, and other collectible card games. Our Service analyzes images of trading cards and provides estimated
              condition grades and valuations using advanced AI technology.
            </p>
            <p className="mt-4">
              <strong>IMPORTANT DISCLAIMER:</strong> The grading results provided by DCM Grading are estimates based on AI analysis
              and are not guaranteed to align with official third-party professional grading services such as PSA, BGS, CGC, or others.
              Our assessments should be used for informational and educational purposes only. <strong>DCM Grading is not responsible
              for any discrepancies between our AI grading results and those of professional grading companies.</strong>
            </p>
            <p className="mt-4">
              We do not guarantee the accuracy, completeness, or reliability of our grading assessments. Results should not be solely
              relied upon for buying, selling, insurance, or any financial decisions regarding trading cards.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">3. User Accounts</h2>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">3.1 Account Creation</h3>
            <p>To use our Service, you must create an account. You may register using:</p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Email and password</li>
              <li>Google authentication</li>
              <li>Other third-party authentication services we may offer</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">3.2 Account Security</h3>
            <p>You are responsible for:</p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of any unauthorized access or security breach</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">3.3 Account Eligibility</h3>
            <p>
              You must be at least 18 years old to use this Service. By creating an account, you represent and warrant that you are
              18 years of age or older and have the legal capacity to enter into these Terms. If you are under 18, you may not use
              the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">4. Acceptable Use</h2>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">4.1 Permitted Use</h3>
            <p>You may use the Service to:</p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Upload images of your trading cards for grading analysis</li>
              <li>View and manage your grading history</li>
              <li>Access features and functionality we provide</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">4.2 Prohibited Activities</h3>
            <p>You agree not to:</p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Upload images that violate intellectual property rights</li>
              <li>Upload inappropriate, offensive, or illegal content</li>
              <li>Use the Service for any fraudulent or deceptive purpose</li>
              <li>Attempt to gain unauthorized access to our systems or other users' accounts</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Use automated scripts, bots, or scrapers without permission</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
              <li>Resell or commercialize the Service without authorization</li>
              <li>Impersonate any person or entity</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">5. Intellectual Property</h2>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">5.1 Our Intellectual Property</h3>
            <p>
              The Service, including its design, functionality, text, graphics, logos, and software, is owned by DCM Grading and
              protected by copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, or
              create derivative works without our express written permission.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">5.2 Your Content and License Grant</h3>
            <p>
              You retain ownership of the images and content you upload to the Service. However, by uploading content, you grant
              DCM Grading a worldwide, non-exclusive, royalty-free, transferable license to use, store, process, reproduce, modify,
              and display your content for the following purposes:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2 mt-4">
              <li>Providing AI grading analysis and generating grading reports</li>
              <li>Improving and training our AI models and algorithms</li>
              <li>Operating, maintaining, and enhancing the Service</li>
              <li>Complying with legal obligations</li>
            </ul>
            <p className="mt-4">
              You represent and warrant that you have all necessary rights to upload the content and grant us this license, and that
              your content does not infringe any intellectual property rights, violate any laws, or contain offensive, inappropriate,
              or illegal material.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">5.3 Third-Party Trademarks and Copyrights</h3>
            <p>
              All trading card designs, artwork, logos, brand names, and associated intellectual property are the exclusive property
              of their respective manufacturers and licensors. This includes, but is not limited to:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2 mt-4">
              <li><strong>Pokémon:</strong> The Pokémon Company, Nintendo, Game Freak, Creatures Inc.</li>
              <li><strong>Magic: The Gathering:</strong> Wizards of the Coast, Hasbro</li>
              <li><strong>Yu-Gi-Oh!:</strong> Konami</li>
              <li><strong>Disney Lorcana:</strong> The Walt Disney Company, Ravensburger</li>
              <li><strong>Sports Cards:</strong> Panini, Topps, Upper Deck, Fanatics, Leaf, and respective leagues (NBA, NFL, MLB, NHL, etc.)</li>
              <li><strong>Other TCGs and CCGs:</strong> Their respective publishers and rights holders</li>
            </ul>
            <p className="mt-4">
              <strong>DCM Grading makes no claim of ownership</strong> over any card imagery, artwork, designs, or branding depicted
              in user-uploaded photographs. The display of trademarked card images on our platform is solely for the purpose of
              providing our grading analysis service. All trademarks and copyrights remain the property of their respective owners.
            </p>
            <p className="mt-4">
              Users are solely responsible for ensuring they have the legal right to photograph and upload images of cards they submit
              for grading. DCM Grading is not responsible for any intellectual property violations arising from user-uploaded content.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">5.4 DCM Grading Outputs and Ownership</h3>
            <p>
              <strong>All grading outputs, analyses, and assessments generated by DCM Grading are the exclusive intellectual property
              of DCM Grading.</strong> This includes, but is not limited to:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2 mt-4">
              <li>All grades, scores, and numerical assessments produced by our DCM Optic™ AI technology</li>
              <li>Condition labels, descriptions, and written analyses</li>
              <li>Digital certificates, labels, and grading reports</li>
              <li>Centering measurements, surface analyses, and defect assessments</li>
              <li>Card identification data and metadata extracted during analysis</li>
              <li>Any derivative works, compilations, or aggregated data derived from grading activities</li>
            </ul>
            <p className="mt-4">
              While you may view and share your grading results for personal, non-commercial purposes, you may not reproduce,
              distribute, modify, or create derivative works from DCM Grading outputs without our express written permission.
              The methodologies, algorithms, and processes used to generate grading results are proprietary trade secrets of
              DCM Grading.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">5.5 Use in Marketing and Promotional Materials</h3>
            <p>
              By using the Service and setting your graded cards to "Public" visibility, you grant DCM Grading the right to use,
              display, reproduce, and distribute images of your graded cards and associated grading results for marketing,
              promotional, educational, and demonstration purposes. This includes, but is not limited to:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2 mt-4">
              <li>Featuring graded cards on our website, including the homepage and gallery sections</li>
              <li>Social media posts and advertisements across all platforms</li>
              <li>Marketing emails, newsletters, and promotional campaigns</li>
              <li>Press releases, case studies, and media materials</li>
              <li>Trade show displays, presentations, and demonstrations</li>
              <li>Educational content showcasing grading examples and quality standards</li>
            </ul>
            <p className="mt-4">
              <strong>To opt out of marketing use:</strong> You may set your cards to "Private" visibility at any time through
              your account settings. Private cards will not be displayed publicly or used in marketing materials. However, DCM
              Grading retains the right to use anonymized or aggregated data from all grading activities for internal analytics,
              service improvement, and general statistical purposes.
            </p>
            <p className="mt-4">
              DCM Grading will not sell your uploaded card images to third parties. Marketing use is limited to promoting DCM
              Grading services and demonstrating our grading capabilities.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">6. Payment and Fees</h2>
            <p>
              DCM Grading operates on a pay-per-use and/or subscription-based model. Certain features may be offered free of charge,
              while premium features require payment.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">6.1 Pricing and Billing</h3>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>We will provide clear notice of pricing before you incur any charges</li>
              <li>You authorize us to charge your designated payment method for all applicable fees</li>
              <li>Subscription fees are billed in advance on a recurring basis (monthly, annually, or as otherwise specified)</li>
              <li>Pay-per-use fees are charged as services are consumed</li>
              <li>Prices are subject to change with reasonable advance notice</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">6.2 Refund Policy</h3>
            <p>
              <strong>All payments are nonrefundable,</strong> except where required by applicable law. We do not provide refunds
              or credits for:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2 mt-4">
              <li>Partial subscription periods</li>
              <li>Unused credits or grading quota</li>
              <li>Dissatisfaction with grading results</li>
              <li>Account termination or suspension</li>
            </ul>
            <p className="mt-4">
              If you experience technical issues or service disruptions, please contact us at admin@dcmgrading.com and we will work
              to resolve the issue. In exceptional circumstances, we may provide refunds or credits at our sole discretion.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">6.3 Payment Processing</h3>
            <p>
              Payments are processed through secure third-party payment processors. We do not store your complete credit card
              information on our servers.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">7. Disclaimers and Limitations of Liability</h2>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">7.1 "AS IS" Disclaimer</h3>
            <p>
              THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR
              IMPLIED, INCLUDING BUT NOT LIMITED TO:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2 mt-4">
              <li>IMPLIED WARRANTIES OF MERCHANTABILITY</li>
              <li>IMPLIED WARRANTIES OF FITNESS FOR A PARTICULAR PURPOSE</li>
              <li>WARRANTIES OF NON-INFRINGEMENT</li>
              <li>WARRANTIES THAT THE SERVICE WILL BE UNINTERRUPTED OR ERROR-FREE</li>
              <li>WARRANTIES REGARDING THE ACCURACY OR RELIABILITY OF GRADING RESULTS</li>
            </ul>
            <p className="mt-4">
              <strong>WE MAKE NO REPRESENTATIONS OR WARRANTIES ABOUT THE SUITABILITY, RELIABILITY, AVAILABILITY, TIMELINESS, OR
              ACCURACY OF THE SERVICE FOR ANY PURPOSE.</strong>
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">7.2 Accuracy of AI Grading</h3>
            <p>
              <strong>WE DO NOT GUARANTEE THE ACCURACY, COMPLETENESS, OR RELIABILITY OF OUR AI-POWERED CARD GRADING ASSESSMENTS.</strong>
              Our AI technology provides estimates that:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2 mt-4">
              <li>Are not guaranteed to match professional grading service results</li>
              <li>May vary from actual card condition or market value</li>
              <li>Should not be relied upon as the sole basis for financial decisions</li>
              <li>Are subject to limitations inherent in AI analysis and image quality</li>
            </ul>
            <p className="mt-4">
              YOU ASSUME ALL RISK ASSOCIATED WITH RELYING ON OUR GRADING ASSESSMENTS. WE ARE NOT LIABLE FOR ANY LOSSES OR DAMAGES
              RESULTING FROM DECISIONS MADE BASED ON OUR GRADING RESULTS.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">7.3 Limitation of Liability</h3>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, DCM GRADING SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
              CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY,
              OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Your use or inability to use the Service</li>
              <li>Reliance on any grading assessments provided by the Service</li>
              <li>Unauthorized access to your account or data</li>
              <li>Any third-party content or conduct on the Service</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">7.4 Service Availability</h3>
            <p>
              We do not guarantee that the Service will be available at all times without interruption. We may suspend or terminate
              the Service for maintenance, updates, or other reasons without liability.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">8. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless DCM Grading, its officers, directors, employees, and agents from and
              against any claims, liabilities, damages, losses, and expenses, including reasonable attorneys' fees, arising out of or
              in any way connected with:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Your use of the Service</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any rights of another party</li>
              <li>Content you upload to the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">9. Termination</h2>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">9.1 Termination by You</h3>
            <p>You may terminate your account at any time by contacting us or using the account deletion feature in the Service.</p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">9.2 Termination by Us</h3>
            <p>
              We reserve the right to suspend or terminate your access to the Service immediately, at any time, with or without
              notice, with or without cause, including but not limited to if:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>You violate these Terms or any applicable laws</li>
              <li>Your use of the Service poses a security, legal, or reputational risk</li>
              <li>You engage in fraudulent, abusive, or illegal activities</li>
              <li>Your payment method fails or your account becomes delinquent</li>
              <li>We discontinue the Service or specific features</li>
            </ul>
            <p className="mt-4">
              <strong>We may suspend or terminate accounts without prior notice</strong> when we determine, in our sole discretion,
              that such action is necessary to protect the Service, other users, or our business interests.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">9.3 Effect of Termination</h3>
            <p>
              Upon termination, your right to use the Service will immediately cease. We may delete your account and all associated
              data. Provisions of these Terms that by their nature should survive termination will survive.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">10. Privacy</h2>
            <p>
              Your use of the Service is also governed by our Privacy Policy, available at{' '}
              <a href="/privacy" className="text-blue-600 hover:underline">dcmgrading.com/privacy</a>.
              Please review the Privacy Policy to understand how we collect, use, and protect your information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">11. Dispute Resolution</h2>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">11.1 Governing Law</h3>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the State of Georgia, United States, without regard to
              its conflict of law provisions.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">11.2 Jurisdiction</h3>
            <p>
              Any legal action or proceeding arising out of or relating to these Terms or the Service shall be brought exclusively in the state or federal courts located in Georgia, United States, and you consent to the personal jurisdiction of such courts.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">11.3 Arbitration</h3>
            <p>
              Any dispute arising from these Terms or the Service shall be resolved through binding arbitration in accordance with
              the rules of the American Arbitration Association, conducted in Georgia, United States, except where prohibited by law.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">11.4 Class Action Waiver</h3>
            <p>
              You agree to resolve disputes with us on an individual basis and waive your right to participate in class actions or
              class-wide arbitration.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">12. Miscellaneous</h2>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">12.1 Entire Agreement</h3>
            <p>These Terms, together with our Privacy Policy, constitute the entire agreement between you and DCM Grading.</p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">12.2 Severability</h3>
            <p>
              If any provision of these Terms is found to be unenforceable, the remaining provisions will continue in full force and effect.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">12.3 Waiver</h3>
            <p>
              Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">12.4 Assignment</h3>
            <p>
              You may not assign or transfer these Terms without our prior written consent. We may assign our rights and obligations
              without restriction.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">12.5 Contact Information</h3>
            <p>For questions about these Terms, please contact us at:</p>
            <ul className="list-none ml-4 mt-4 space-y-2">
              <li>Email: admin@dcmgrading.com</li>
              <li>Website: https://dcmgrading.com</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">13. Updates to Service</h2>
            <p>
              We reserve the right to modify, suspend, or discontinue any part of the Service at any time without notice.
              We may also impose limits on certain features or restrict access to parts of the Service.
            </p>
          </section>

        </div>
      </div>
    </main>
  )
}
