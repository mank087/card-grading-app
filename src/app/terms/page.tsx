export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white shadow-md rounded-lg p-8 sm:p-12">
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
              DCM Grading provides an AI-powered card grading service that analyzes images of trading cards (including Pokémon,
              Magic: The Gathering, Lorcana, and other collectible card games) and provides estimated condition grades and valuations.
            </p>
            <p className="mt-4">
              <strong>Important Disclaimer:</strong> Our grading service provides estimates based on AI analysis and should be used
              for informational purposes only. Actual professional grading results may vary. We do not guarantee the accuracy of our
              assessments, and they should not be solely relied upon for buying, selling, or insurance purposes.
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
              You must be at least 13 years old to use this Service. By creating an account, you represent and warrant that you meet
              this age requirement and have the legal capacity to enter into these Terms.
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

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">5.2 Your Content</h3>
            <p>
              You retain ownership of the images and content you upload to the Service. By uploading content, you grant us a
              worldwide, non-exclusive, royalty-free license to use, store, process, and display your content solely for the
              purpose of providing and improving the Service.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">5.3 Third-Party Intellectual Property</h3>
            <p>
              Trading card brands, names, and images are trademarks or copyrights of their respective owners (e.g., Pokémon, Wizards
              of the Coast, Disney). We claim no ownership over these properties. Users are responsible for ensuring they have the
              right to upload images of cards.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">6. Payment and Fees</h2>
            <p>
              Currently, certain features of the Service may be offered free of charge. We reserve the right to introduce paid
              subscriptions, premium features, or usage-based fees in the future. If we introduce paid services:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>We will provide clear notice of pricing before you incur any charges</li>
              <li>All fees are non-refundable unless otherwise stated</li>
              <li>You authorize us to charge your payment method for applicable fees</li>
              <li>Prices are subject to change with reasonable notice</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">7. Disclaimers and Limitations of Liability</h2>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">7.1 No Warranty</h3>
            <p>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
              INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">7.2 Accuracy of Grading</h3>
            <p>
              WE DO NOT GUARANTEE THE ACCURACY, COMPLETENESS, OR RELIABILITY OF OUR AI-POWERED CARD GRADING ASSESSMENTS.
              GRADES AND VALUATIONS ARE ESTIMATES ONLY AND SHOULD NOT BE SOLELY RELIED UPON FOR FINANCIAL DECISIONS.
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
            <p>We reserve the right to suspend or terminate your access to the Service at any time, with or without cause, including if:</p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>You violate these Terms</li>
              <li>Your use of the Service poses a security or legal risk</li>
              <li>You engage in fraudulent or illegal activities</li>
            </ul>

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
              These Terms shall be governed by and construed in accordance with the laws of [Your State/Country], without regard to
              its conflict of law provisions.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">11.2 Arbitration</h3>
            <p>
              Any dispute arising from these Terms or the Service shall be resolved through binding arbitration in accordance with
              the rules of the American Arbitration Association, except where prohibited by law.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">11.3 Class Action Waiver</h3>
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
              <li>Email: legal@dcmgrading.com</li>
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

          <section className="mt-12 pt-8 border-t border-gray-200">
            <p className="text-sm text-gray-500 italic">
              <strong>Note:</strong> These Terms and Conditions are provided as a template and should be reviewed by a qualified attorney
              to ensure compliance with applicable laws and regulations in your jurisdiction. The arbitration and governing law provisions
              should be customized based on your location and business structure.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
