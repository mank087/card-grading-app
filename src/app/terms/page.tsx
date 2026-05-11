import { Metadata } from 'next';
import FloatingCardsBackground from '../ui/FloatingCardsBackground';

export const metadata: Metadata = {
  title: 'Terms and Conditions',
  description: 'DCM Terms and Conditions. Review our terms of service for using the AI-powered card grading platform.',
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
              These Terms and Conditions (&quot;Terms&quot;) constitute a binding agreement between you and
              Dynamic Collectibles Management LLC (&quot;DCM,&quot; &quot;we,&quot; &quot;our,&quot; or &quot;us&quot;).
              By accessing or using our card grading service at dcmgrading.com or through our iOS and Android mobile applications
              (the &quot;Service&quot;), you agree to be bound by these Terms. If you do not agree to these Terms, please do not use the Service.
            </p>
            <p>
              We reserve the right to modify these Terms at any time. We will notify you of any changes by posting the updated Terms
              on this page. Your continued use of the Service after such modifications constitutes your acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">2. Description of Service</h2>
            <p>
              DCM Grading provides AI-powered visual condition analysis of trading cards through our proprietary DCM Optic™
              technology, including Pokémon, Magic: The Gathering, Yu-Gi-Oh!, Lorcana, One Piece, Star Wars, sports cards, and other
              collectible card categories. The Services are designed as a fast, accessible, and unbiased way to evaluate the visible
              condition of a trading card — you submit photographs through the website or mobile app and receive a grade and
              sub-grades in minutes.
            </p>
            <p className="mt-4">By using the Service, you understand and agree that:</p>
            <ul className="list-disc list-inside ml-4 space-y-2 mt-4">
              <li><strong>DCM grades are based on photographic analysis.</strong> Our AI evaluates the centering, corners, edges, and surface condition visible in the images you submit. We do not perform physical inspection of cards.</li>
              <li><strong>Image quality affects accuracy.</strong> Lighting, focus, angle, glare, and camera capability influence what the AI can detect. We provide a confidence score (A–D) with every grade so you understand the level of certainty for a particular evaluation.</li>
              <li><strong>DCM grades are independent.</strong> They are produced by our DCM Optic™ system and reflect our published grading methodology. They are not issued by, affiliated with, or endorsed by any other grading service.</li>
              <li><strong>DCM does not authenticate cards.</strong> The Services evaluate visible condition only. We do not verify whether a card is genuine, counterfeit, altered, reprinted, restored, or otherwise tampered with. You should not rely on the Services to determine authenticity.</li>
              <li><strong>Market value estimates are informational.</strong> Where shown, estimated values are derived from third-party sales data and reflect general market signals at the time of lookup. They are not appraisals and do not guarantee resale price.</li>
              <li><strong>Grading methodologies vary across providers.</strong> Because every grading service uses its own methodology and standards, a DCM grade may differ from a grade you would receive from another provider. This is true of any independent grading evaluation.</li>
              <li><strong>Describe DCM grades accurately when sharing them.</strong> When you share or list a card with a DCM grade — for example in a marketplace listing or social post — you agree to describe it accurately as a &quot;DCM Optic™ AI grade&quot; (or substantially similar language) so others understand which service produced the evaluation.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">3. Verification and Customizable Holders</h2>
            <p>
              DCM Grading is a digital-first grading service. When a card is graded, we generate a unique certificate number
              (&quot;Cert ID&quot;), a permanent digital record that includes the front and back photographs of the card at the time
              of submission, the assigned grade, the sub-grades, and other metadata. Every record is publicly verifiable by scanning
              the QR code on a DCM label or by entering the Cert ID at <strong>dcmgrading.com/search</strong>.
            </p>
            <p className="mt-4">
              We do not produce or supply a physical slab or sealed holder as part of our grading service. Instead, you choose your
              own holder — a magnetic one-touch, toploader, or other protective case — and apply a DCM label that you design and
              print yourself. This DIY approach is intentional: it lets you customize how you display, store, and share your graded
              cards without the cost, wait time, and one-size-fits-all limitations of mail-in grading. We believe collectors should
              own the experience end to end.
            </p>
            <p className="mt-4">
              Because DCM does not provide a tamper-evident physical slab, you and any party you transact with should understand the following:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2 mt-4">
              <li><strong>The Cert ID identifies a specific card at the time of grading.</strong> It is permanently linked to the photographs we captured. Anyone can scan the QR code on the label or look up the Cert ID at <strong>dcmgrading.com/search</strong> to see what the card looked like when it was graded.</li>
              <li><strong>The physical holder is user-supplied and user-sealed.</strong> DCM cannot certify that a specific physical holder, at a specific point in time after grading, contains the same card that received the original DCM grade. Responsibility for the integrity of the holder rests with the user.</li>
              <li><strong>Buyers should verify before transacting.</strong> When considering the purchase of a DCM-graded card, you should scan the QR code on the label or search the Cert ID at <strong>dcmgrading.com/search</strong> and compare the photographs on file to the physical card in the holder. Differences in appearance, serial numbering, foil pattern, surface defects, or back image may indicate the card in the holder is not the one DCM graded.</li>
              <li><strong>You assume the risk of customization, modification, and reuse.</strong> Users who customize, modify, reuse, transfer, or share holders bearing DCM labels acknowledge this risk and assume full responsibility for any misrepresentation, fraud, or loss arising from doing so. DCM is not a party to such transactions and is not liable for any loss resulting from the substitution of cards within user-supplied holders or from any user&apos;s misrepresentation of a card&apos;s grading status.</li>
              <li><strong>Fraudulent representation is misuse of the Services.</strong> Knowingly misrepresenting a card as having been graded by DCM (when it has not been), knowingly presenting a card in a DCM-labeled holder as the card associated with a Cert ID (when it is not), or otherwise misusing DCM grading records to deceive third parties is a violation of these Terms and may also violate consumer protection, fraud, and intellectual property laws. We may cooperate with law enforcement, affected parties, and platform operators (such as marketplaces) in investigating and responding to misuse.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">4. User Accounts</h2>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">4.1 Account Creation</h3>
            <p>To use our Service, you must create an account. You may register using:</p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Email and password</li>
              <li>Apple Sign In, Google authentication, or other third-party authentication services we may offer</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">4.2 Account Security</h3>
            <p>You are responsible for:</p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of any unauthorized access or security breach</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">4.3 Account Eligibility</h3>
            <p>
              You must be at least 18 years old to use this Service. By creating an account, you represent and warrant that you are
              18 years of age or older and have the legal capacity to enter into these Terms. If you are under 18, you may not use
              the Service.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">4.4 Account Deletion</h3>
            <p>You may delete your account at any time through one of these methods:</p>
            <ul className="list-disc list-inside ml-4 space-y-2 mt-4">
              <li><strong>In the mobile app:</strong> Open the Account tab and tap <em>Delete My Account</em>, then confirm.</li>
              <li><strong>On the website:</strong> Visit <a href="/my-account" className="text-blue-600 hover:underline">dcmgrading.com/my-account</a> and use the account-deletion option.</li>
              <li><strong>By email:</strong> Send a deletion request to admin@dcmgrading.com from the email address associated with your account.</li>
            </ul>
            <p className="mt-4">
              Account deletion is permanent. We delete your cards, card images, account information, and unused credits.
              Transaction records may be retained in anonymized form to comply with tax and financial recordkeeping requirements.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">5. Acceptable Use</h2>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">5.1 Permitted Use</h3>
            <p>You may use the Service to:</p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Upload images of your trading cards for grading analysis</li>
              <li>View and manage your grading history</li>
              <li>Access features and functionality we provide</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">5.2 Prohibited Activities</h3>
            <p>You agree not to:</p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Upload images that violate intellectual property rights</li>
              <li>Upload inappropriate, offensive, or illegal content</li>
              <li>Use the Service for any fraudulent or deceptive purpose</li>
              <li>Attempt to gain unauthorized access to our systems or other users&apos; accounts</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Use automated scripts, bots, or scrapers without permission</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
              <li>Resell or commercialize the Service without authorization</li>
              <li>Impersonate any person or entity</li>
              <li>Attempt to manipulate or game the grading system through misleading photographs, false condition reports, or repeated re-submissions</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">6. Intellectual Property</h2>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">6.1 Our Intellectual Property</h3>
            <p>
              The Service, including its design, functionality, text, graphics, logos, and software, is owned by DCM and
              protected by copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, or
              create derivative works without our express written permission.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">6.2 Your Content and License Grant</h3>
            <p>
              You retain ownership of the images and content you upload to the Service. However, by uploading content, you grant
              DCM a worldwide, non-exclusive, royalty-free, transferable license to use, store, process, reproduce, modify,
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

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">6.3 Third-Party Trademarks and Copyrights</h3>
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
              <strong>DCM makes no claim of ownership</strong> over any card imagery, artwork, designs, or branding depicted
              in user-uploaded photographs. The display of trademarked card images on our platform is solely for the purpose of
              providing our grading analysis service. All trademarks and copyrights remain the property of their respective owners.
            </p>
            <p className="mt-4">
              Users are solely responsible for ensuring they have the legal right to photograph and upload images of cards they submit
              for grading. DCM is not responsible for any intellectual property violations arising from user-uploaded content.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">6.4 DCM Outputs and Ownership</h3>
            <p>
              <strong>All grading outputs, analyses, and assessments generated by DCM are the exclusive intellectual property
              of DCM.</strong> This includes, but is not limited to:
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
              distribute, modify, or create derivative works from DCM outputs without our express written permission.
              The methodologies, algorithms, and processes used to generate grading results are proprietary trade secrets of
              DCM.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">6.5 Use in Marketing and Promotional Materials</h3>
            <p>
              By using the Service and setting your graded cards to &quot;Public&quot; visibility, you grant DCM the right to use,
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
              <strong>To opt out of marketing use:</strong> You may set your cards to &quot;Private&quot; visibility at any time through
              your account settings. Private cards will not be displayed publicly or used in marketing materials. However, DCM
              Grading retains the right to use anonymized or aggregated data from all grading activities for internal analytics,
              service improvement, and general statistical purposes.
            </p>
            <p className="mt-4">
              DCM will not sell your uploaded card images to third parties. Marketing use is limited to promoting DCM
              Grading services and demonstrating our grading capabilities.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">7. Payment and Fees</h2>
            <p>
              DCM operates on a pay-per-use and/or subscription-based model. Certain features may be offered free of charge,
              while premium features require payment.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">7.1 Pricing and Billing</h3>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>We will provide clear notice of pricing before you incur any charges</li>
              <li>You authorize us to charge your designated payment method for all applicable fees</li>
              <li>Subscription fees are billed in advance on a recurring basis (monthly, annually, or as otherwise specified)</li>
              <li>Pay-per-use fees are charged as services are consumed</li>
              <li>Prices are subject to change with reasonable advance notice</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">7.2 Refund Policy</h3>
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

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">7.3 Payment Processing</h3>
            <p>
              Payments are processed through Stripe, our secure third-party payment processor. We do not store your complete credit
              card information on our servers.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">8. Disclaimers and Limitations of Liability</h2>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">8.1 &quot;AS IS&quot; Disclaimer</h3>
            <p>
              THE SERVICE IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR
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

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">8.2 Accuracy of AI Grading</h3>
            <p>
              <strong>CARD GRADING INVOLVES PROFESSIONAL JUDGMENT AND NO GRADING SERVICE — WHETHER AI-POWERED OR MANUAL — CAN
              GUARANTEE ABSOLUTE ACCURACY OR CONSISTENCY.</strong> Our assessments:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2 mt-4">
              <li>Represent DCM&apos;s independent assessment based on our proprietary methodology and standards</li>
              <li>May differ from grades issued by other grading providers, as each service applies its own criteria</li>
              <li>Are based on analysis of user-submitted images and may be affected by image quality, lighting, or obstructions</li>
              <li>Should be considered alongside other factors when making financial decisions regarding trading cards</li>
            </ul>
            <p className="mt-4">
              YOU ASSUME ALL RISK ASSOCIATED WITH RELYING ON OUR GRADING ASSESSMENTS. WE ARE NOT LIABLE FOR ANY LOSSES OR DAMAGES
              RESULTING FROM DECISIONS MADE BASED ON OUR GRADING RESULTS.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">8.3 Limitation of Liability</h3>
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

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">8.4 Service Availability</h3>
            <p>
              We do not guarantee that the Service will be available at all times without interruption. We may suspend or terminate
              the Service for maintenance, updates, or other reasons without liability.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">9. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless DCM, its officers, directors, employees, and agents from and
              against any claims, liabilities, damages, losses, and expenses, including reasonable attorneys&apos; fees, arising out of or
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
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">10. Termination</h2>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">10.1 Termination by You</h3>
            <p>You may terminate your account at any time by contacting us or using the account deletion feature in the Service (see Section 4.4).</p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">10.2 Termination by Us</h3>
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

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">10.3 Effect of Termination</h3>
            <p>
              Upon termination, your right to use the Service will immediately cease. We may delete your account and all associated
              data. Provisions of these Terms that by their nature should survive termination will survive.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">11. Privacy</h2>
            <p>
              Your use of the Service is also governed by our Privacy Policy, available at{' '}
              <a href="/privacy" className="text-blue-600 hover:underline">dcmgrading.com/privacy</a>.
              Please review the Privacy Policy to understand how we collect, use, and protect your information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">12. Dispute Resolution</h2>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">12.1 Governing Law</h3>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the State of Georgia, United States, without regard to
              its conflict of law provisions.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">12.2 Jurisdiction</h3>
            <p>
              Any legal action or proceeding arising out of or relating to these Terms or the Service shall be brought exclusively in the state or federal courts located in Georgia, United States, and you consent to the personal jurisdiction of such courts.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">12.3 Arbitration</h3>
            <p>
              Any dispute arising from these Terms or the Service shall be resolved through binding arbitration in accordance with
              the rules of the American Arbitration Association, conducted in Georgia, United States, except where prohibited by law.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">12.4 Class Action Waiver</h3>
            <p>
              You agree to resolve disputes with us on an individual basis and waive your right to participate in class actions or
              class-wide arbitration.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">13. Miscellaneous</h2>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">13.1 Entire Agreement</h3>
            <p>These Terms, together with our Privacy Policy, constitute the entire agreement between you and DCM.</p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">13.2 Severability</h3>
            <p>
              If any provision of these Terms is found to be unenforceable, the remaining provisions will continue in full force and effect.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">13.3 Waiver</h3>
            <p>
              Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">13.4 Assignment</h3>
            <p>
              You may not assign or transfer these Terms without our prior written consent. We may assign our rights and obligations
              without restriction.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">13.5 Contact Information</h3>
            <p>For questions about these Terms, please contact us at:</p>
            <ul className="list-none ml-4 mt-4 space-y-2">
              <li>Dynamic Collectibles Management LLC</li>
              <li>Email: admin@dcmgrading.com</li>
              <li>Website: https://dcmgrading.com</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">14. Updates to Service</h2>
            <p>
              We reserve the right to modify, suspend, or discontinue any part of the Service at any time without notice.
              We may also impose limits on certain features or restrict access to parts of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">15. Third-Party Marketplace Integrations</h2>
            <p>
              DCM may offer features that allow you to list your DCM-graded cards on third-party marketplaces such as eBay.
              By using these integration features, you agree to the following additional terms:
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">15.1 DCM Is Not a Party to Marketplace Transactions</h3>
            <p>
              DCM provides marketplace listing tools solely as a convenience feature to help you list your DCM-graded cards.
              <strong> DCM is not a party to any transaction that occurs on third-party marketplaces.</strong> All sales,
              purchases, and related activities are conducted exclusively between you and the buyer through the respective marketplace
              platform. DCM does not participate in, facilitate, mediate, or guarantee any aspect of these transactions.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">15.2 No Liability for Marketplace Transactions</h3>
            <p>
              <strong>DCM GRADING SHALL NOT BE HELD LIABLE FOR ANY DISPUTES, CLAIMS, DAMAGES, LOSSES, OR ISSUES ARISING FROM YOUR
              MARKETPLACE LISTINGS OR SALES.</strong> This includes, but is not limited to:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2 mt-4">
              <li>Buyer complaints, disputes, or negative feedback</li>
              <li>Return requests, refund demands, or chargebacks</li>
              <li>Shipping delays, damage, or lost packages</li>
              <li>Payment processing issues or fund holds</li>
              <li>Listing violations, policy infractions, or account actions taken by the marketplace</li>
              <li>Marketplace fees, taxes, or other financial obligations</li>
              <li>Claims of item not as described, authenticity disputes, or condition disagreements</li>
              <li>Any other matters related to your marketplace activity</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">15.3 Grading Opinions in the Context of Sales</h3>
            <p>
              DCM grades represent our independent visual condition assessment at the time of grading based on DCM&apos;s
              proprietary standards and methodology. <strong>Grades are assessments and are not guarantees of market value,
              future market performance, or buyer satisfaction.</strong> Card condition may change after grading due to handling, storage,
              or environmental factors. Buyers may have different assessments regarding condition, and you are solely responsible for
              handling any disputes that may arise from differences in condition perception. DCM will not intervene in
              buyer-seller disputes regarding grading accuracy.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">15.4 Your Responsibilities When Using Marketplace Integrations</h3>
            <p>When using DCM&apos;s marketplace integration features, you are solely responsible for:</p>
            <ul className="list-disc list-inside ml-4 space-y-2 mt-4">
              <li><strong>Listing Accuracy:</strong> The accuracy of all listing information, including titles, descriptions, prices,
                images, condition descriptions, and shipping terms</li>
              <li><strong>Platform Compliance:</strong> Compliance with all marketplace terms of service, listing policies, seller
                standards, and applicable laws and regulations</li>
              <li><strong>Customer Service:</strong> Handling all buyer communications, inquiries, and customer service matters</li>
              <li><strong>Fulfillment:</strong> Packaging, shipping, delivery, and any shipping-related issues</li>
              <li><strong>Returns and Refunds:</strong> Processing returns, issuing refunds, and handling post-sale disputes</li>
              <li><strong>Financial Obligations:</strong> All marketplace fees, payment processing fees, taxes, duties, and any other
                costs associated with your sales</li>
              <li><strong>Legal Compliance:</strong> Ensuring you have the legal right to sell the items you list and that your sales
                comply with all applicable consumer protection laws</li>
              <li><strong>Account Standing:</strong> Maintaining your marketplace account in good standing</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">15.5 Indemnification for Marketplace Activities</h3>
            <p>
              In addition to the general indemnification provisions in Section 9, you specifically agree to indemnify, defend, and
              hold harmless DCM, its officers, directors, employees, and agents from and against any claims, liabilities,
              damages, losses, costs, or expenses (including reasonable attorneys&apos; fees) arising from or related to:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2 mt-4">
              <li>Your use of marketplace integration features</li>
              <li>Any transactions conducted through third-party marketplaces</li>
              <li>Disputes with buyers, marketplaces, or payment processors</li>
              <li>Claims that items sold did not match their described condition</li>
              <li>Any violation of marketplace policies or applicable laws</li>
              <li>Intellectual property claims related to your listings</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">15.6 Marketplace Account Responsibility</h3>
            <p>
              You are responsible for maintaining your marketplace accounts (such as eBay) in good standing. DCM is not
              responsible for any actions the marketplace may take against your account, including but not limited to listing removals,
              selling restrictions, fee assessments, fund holds, or account suspensions. Any consequences resulting from your use of
              marketplace integration features are your sole responsibility.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">15.7 Integration Service Availability</h3>
            <p>
              DCM provides marketplace integration features &quot;as is&quot; and makes no guarantees regarding their availability,
              accuracy, or functionality. We may modify, suspend, or discontinue marketplace integration features at any time without
              notice. We are not responsible for any losses resulting from integration service interruptions, errors, or discontinuation.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">15.8 Third-Party Platform Terms</h3>
            <p>
              Your use of third-party marketplaces is also subject to those platforms&apos; terms of service, policies, and user agreements.
              It is your responsibility to review and comply with all applicable third-party terms. In the event of any conflict between
              these Terms and third-party marketplace terms, the more restrictive provision shall apply to your use of DCM&apos;s
              integration features.
            </p>
          </section>

        </div>
      </div>
    </main>
  )
}
