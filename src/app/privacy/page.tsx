import { Metadata } from 'next';
import FloatingCardsBackground from '../ui/FloatingCardsBackground';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'DCM Privacy Policy. Learn how we collect, use, and protect your personal information when using our AI card grading service.',
  robots: {
    index: true,
    follow: true,
  },
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 relative">
      <FloatingCardsBackground />
      <div className="max-w-4xl mx-auto bg-white shadow-md rounded-lg p-8 sm:p-12 relative z-10">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-600 mb-8">Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <div className="prose prose-lg max-w-none space-y-6 text-gray-700">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">1. Introduction</h2>
            <p>
              This Privacy Policy describes how Dynamic Collectibles Management LLC (&quot;DCM,&quot; &quot;we,&quot; &quot;our,&quot;
              or &quot;us&quot;) collects, uses, discloses, and safeguards your information when you use our AI-powered card grading
              service available at dcmgrading.com and through our iOS and Android mobile applications (collectively, the &quot;Service&quot;).
              We are committed to protecting your personal information and your right to privacy.
            </p>
            <p>
              Our Service uses proprietary AI technology to analyze and grade trading cards, providing professional condition assessments and market valuations.
              By using the Service, you agree to the collection and use of information in accordance with this policy. If you do not agree with
              our policies and practices, please do not use our Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">2. Information We Collect</h2>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">2.1 Personal Data</h3>
            <p>We collect personal information that you voluntarily provide when you:</p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Register for an account (name, email address, password)</li>
              <li>Subscribe to a paid plan (payment information processed through secure third-party payment processors)</li>
              <li>Contact us for support or inquiries</li>
              <li>Update your account preferences</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">2.2 Non-Personal Data</h3>
            <p>We automatically collect certain non-personal information, including:</p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li><strong>Trading card images:</strong> Images you upload for AI grading analysis. These images are retained as long as your account remains active or until you request deletion.</li>
              <li><strong>Usage data:</strong> Information about how you interact with the Service, including features used and grading history</li>
              <li><strong>Device information:</strong> Browser type, operating system, device specifications, and IP address</li>
              <li><strong>Mobile device identifiers:</strong> On mobile, the Identifier for Advertisers (IDFA) on iOS and the Android Advertising ID (AAID), subject to your consent (see Section 6).</li>
              <li><strong>Platform metrics:</strong> Analytics data to improve our AI models and Service performance</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">2.3 Third-Party Authentication</h3>
            <p>
              When you sign in using Apple, Google, or other third-party authentication services, we receive basic profile information
              (name, email, profile picture) from these providers in accordance with their privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">3. How We Use Your Information</h2>
            <p>We use the information we collect for the following purposes:</p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li><strong>AI Grading Services:</strong> Process and analyze uploaded card images using our proprietary DCM Optic™ AI technology to generate professional grading reports and condition assessments</li>
              <li><strong>Account Management:</strong> Create, maintain, and secure your user account</li>
              <li><strong>Payment Processing:</strong> Process subscription payments and manage billing through secure third-party payment processors</li>
              <li><strong>Service Improvement:</strong> Analyze usage patterns to enhance our AI models and improve grading accuracy</li>
              <li><strong>Communication:</strong> Send you technical notices, updates, support messages, and respond to inquiries</li>
              <li><strong>Security:</strong> Detect, prevent, and address technical issues, fraud, and security threats</li>
              <li><strong>Legal Compliance:</strong> Comply with applicable laws and enforce our Terms and Conditions</li>
              <li><strong>Marketing:</strong> Send promotional communications about new features or services (with your consent, and you may opt out at any time)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">4. AI Grading and Your Card Images</h2>
            <p>
              When you submit cards for grading, the images you upload are processed by our proprietary DCM Optic™ AI technology
              and by third-party AI services we rely on to deliver the Service. This section explains how those images are handled.
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2 mt-4">
              <li>
                <strong>Third-party AI processing:</strong> Card images you submit are sent to OpenAI&apos;s API for visual
                analysis used as part of the DCM Optic™ grading pipeline. Per OpenAI&apos;s published API data policies, content
                submitted through the API is not used to train OpenAI&apos;s models.
              </li>
              <li>
                <strong>Use to improve DCM&apos;s own AI models:</strong> DCM reserves the right to use the images and content you
                submit to improve, refine, and train DCM&apos;s own AI grading models, methodologies, and algorithms. This use is
                covered by the license you grant under our Terms and Conditions.
              </li>
              <li>
                <strong>Card images and your account:</strong> Card images remain associated with your DCM account and the
                generated certificate (Cert ID) for as long as your account is active. When you delete your account, the linked
                images are removed in accordance with Section 7 (Data Retention) and Section 8 (Account Deletion).
              </li>
              <li>
                <strong>Public visibility:</strong> If you mark a graded card as &quot;Public,&quot; the card image and grading
                results may appear on public pages of the Service (such as the Featured Cards and verification pages) and may be
                used in marketing materials per our Terms and Conditions. You can change a card&apos;s visibility to &quot;Private&quot;
                in your account settings at any time.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">5. How We Share Your Information</h2>
            <p>We may share your information in the following circumstances:</p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">5.1 Service Providers</h3>
            <p>We share your information with trusted third-party service providers who assist us in operating the Service. These providers are bound by confidentiality agreements and include:</p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li><strong>Cloud Hosting and Data Storage:</strong> Supabase, Vercel</li>
              <li><strong>AI Processing:</strong> OpenAI (see Section 4 for details)</li>
              <li><strong>Payment Processing:</strong> Stripe</li>
              <li><strong>Authentication:</strong> Apple Sign In, Google, and other OAuth identity providers</li>
              <li><strong>Mobile Analytics and Performance:</strong> Google Firebase / Google Analytics, Sentry (crash and error reporting)</li>
              <li><strong>Advertising Attribution:</strong> Meta (Facebook) — app install and event attribution for advertising campaigns we may run</li>
              <li><strong>Marketplace Integration:</strong> eBay — only when you use our Insta-List to eBay feature</li>
              <li><strong>Market Pricing:</strong> PriceCharting and similar pricing-data providers — for market value lookups (no personal information is sent)</li>
              <li><strong>Transactional Email:</strong> Resend</li>
            </ul>
            <p className="mt-4">
              These service providers only have access to your information as necessary to perform their functions and are obligated to maintain confidentiality.
              We do not sell your personal information.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">5.2 Legal Compliance</h3>
            <p>We may disclose your information if required to do so by law or in response to valid requests by public authorities.</p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">5.3 Business Transfers</h3>
            <p>
              If we are involved in a merger, acquisition, or sale of assets, your information may be transferred.
              We will provide notice before your information is transferred and becomes subject to a different privacy policy.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">5.4 With Your Consent</h3>
            <p>We may share your information for any other purpose with your explicit consent.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">6. Mobile Applications</h2>
            <p>
              The DCM iOS and Android mobile applications collect and use information specific to mobile devices. This section
              applies in addition to the rest of this Privacy Policy.
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2 mt-4">
              <li>
                <strong>Camera access:</strong> Required to capture photos of trading cards. Photos are only used when you
                initiate a grading or label-design workflow.
              </li>
              <li>
                <strong>Photo library access:</strong> Required to select existing card photos when you use the gallery upload
                option instead of the camera.
              </li>
              <li>
                <strong>Mobile device identifiers (IDFA / AAID):</strong> Used for analytics and ad attribution where you have
                consented.
              </li>
              <li>
                <strong>App Tracking Transparency (iOS):</strong> On first launch we will request permission before using the
                IDFA to track activity across other apps and websites for advertising attribution. You can change this anytime
                under iOS Settings → Privacy &amp; Security → Tracking.
              </li>
              <li>
                <strong>Push notifications:</strong> If you grant permission, we may send transactional push notifications such
                as grading completion or account events. You can disable push notifications in your device settings at any time.
              </li>
              <li>
                <strong>App diagnostics:</strong> Crash reports and performance diagnostics are sent to our crash-reporting
                provider (Sentry) to help us identify and fix issues. Crash reports may include the user ID and device state
                relevant to the crash but do not include card images or payment details.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">7. Data Retention</h2>
            <p>
              We retain your personal information for as long as necessary to provide the Service and fulfill the purposes outlined in this Privacy Policy:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2 mt-4">
              <li><strong>Account Information:</strong> Retained as long as your account remains active</li>
              <li><strong>Card Images:</strong> Retained as long as your account remains active or until you request deletion</li>
              <li><strong>Payment Records:</strong> Retained as required by law for tax and accounting purposes</li>
              <li><strong>Usage Data:</strong> Aggregated and anonymized data may be retained indefinitely for analytics</li>
            </ul>
            <p className="mt-4">
              When you delete your account or request data deletion, we will permanently delete your personal information within 30 days,
              except where we are required to retain it by law (for example, anonymized transaction records retained for tax and
              accounting purposes).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">8. Account Deletion</h2>
            <p>You can delete your DCM account at any time through one of these methods:</p>
            <ul className="list-disc list-inside ml-4 space-y-2 mt-4">
              <li><strong>In the mobile app:</strong> Go to <em>Account → Delete My Account</em>, then confirm.</li>
              <li><strong>On the website:</strong> Visit <a href="https://www.dcmgrading.com/account" className="text-blue-600 hover:underline">dcmgrading.com/account</a> and use the account-deletion option.</li>
              <li><strong>By email:</strong> Send a deletion request to admin@dcmgrading.com from the email address associated with your account.</li>
            </ul>
            <p className="mt-4">
              Account deletion is permanent. We delete your cards, card images, account information, and unused credits. Transaction
              records may be retained in anonymized form to comply with tax and financial recordkeeping requirements.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">9. Your Privacy Rights</h2>
            <p>Depending on your location, you may have the following rights:</p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
              <li><strong>Correction:</strong> Request correction of inaccurate or incomplete information</li>
              <li><strong>Deletion:</strong> Request deletion of your personal information</li>
              <li><strong>Portability:</strong> Request transfer of your data to another service</li>
              <li><strong>Opt-out:</strong> Unsubscribe from marketing communications</li>
              <li><strong>Withdrawal of consent:</strong> Withdraw consent where we rely on it</li>
            </ul>
            <p className="mt-4">
              <strong>California residents (CCPA / CPRA)</strong> have the right to know what personal information we collect, request
              deletion, request correction, and opt out of any &quot;sale&quot; or &quot;sharing&quot; of personal information. We do not sell personal
              information.
            </p>
            <p className="mt-4">
              <strong>Residents of the European Economic Area and United Kingdom (GDPR / UK GDPR)</strong> have rights of access,
              rectification, erasure, restriction of processing, data portability, and the right to object to processing. You may
              also lodge a complaint with your local data protection authority.
            </p>
            <p className="mt-4">
              <strong>Residents of other U.S. states</strong> with comparable privacy laws (such as Virginia, Colorado, Connecticut,
              Utah, and Texas) have similar rights where applicable.
            </p>
            <p className="mt-4">
              To exercise any of these rights, please contact us at admin@dcmgrading.com. We will respond to your
              request within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">10. Data Security</h2>
            <p>
              We take the security of your personal information seriously and implement industry-standard security measures, including:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2 mt-4">
              <li><strong>Encryption:</strong> SSL/TLS encryption for data transmission</li>
              <li><strong>Access Controls:</strong> Restricted access to personal information on a need-to-know basis</li>
              <li><strong>Security Audits:</strong> Regular security assessments and monitoring</li>
              <li><strong>Secure Infrastructure:</strong> Industry-leading cloud hosting with built-in security features</li>
            </ul>
            <p className="mt-4">
              However, no online service is 100% secure. While we strive to protect your personal information, we cannot guarantee
              absolute security. You are responsible for maintaining the confidentiality of your account credentials.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">11. Cookies and Tracking Technologies</h2>
            <p>
              On the website, we use cookies and similar tracking technologies to track activity on our Service and store certain
              information. You can instruct your browser to refuse all cookies or indicate when a cookie is being sent. However, if
              you do not accept cookies, you may not be able to use some portions of our Service.
            </p>
            <p className="mt-4">
              The mobile app does not use browser cookies but uses similar device-level identifiers (IDFA on iOS, AAID on Android)
              for analytics and ad attribution as described in Section 6.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">12. Children&apos;s Privacy</h2>
            <p>
              Our Service is not intended for children under the age of 13. We do not knowingly collect personal information from
              children under 13. If you become aware that a child has provided us with personal information, please contact us at
              admin@dcmgrading.com, and we will take steps to delete such information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">13. International Data Transfers</h2>
            <p>
              DCM is based in Georgia, United States. Your information may be transferred to and maintained on computers located outside of your state, province, country,
              or other governmental jurisdiction where data protection laws may differ. By using our Service, you consent to such transfers to Georgia, United States and other locations where our service providers operate.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">14. Governing Law</h2>
            <p>
              This Privacy Policy and any disputes arising from it shall be governed by and construed in accordance with the laws of the State of Georgia, United States, without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">15. Affiliate Links and Advertising Disclosure</h2>
            <p>
              DCM participates in the Amazon Services LLC Associates Program, an affiliate advertising program
              designed to provide a means for sites to earn advertising fees by advertising and linking to Amazon.com.
              As an Amazon Associate, DCM earns from qualifying purchases.
            </p>
            <p className="mt-4">
              Our Service may contain links to third-party products, services, or websites (&quot;affiliate links&quot;). When you
              click on an affiliate link and make a purchase, DCM may receive a commission from the third-party
              retailer at no additional cost to you. These commissions help support the operation and improvement of our Service.
            </p>
            <p className="mt-4">
              We only recommend products and services that we believe may be useful to our users. However, DCM does
              not control third-party websites and is not responsible for their content, privacy practices, or the transactions
              conducted through them. We encourage you to review the privacy policies of any third-party sites you visit through
              our affiliate links.
            </p>
            <p className="mt-4">
              We may use cookies and tracking technologies provided by affiliate networks to track clicks and commissions.
              These cookies may collect information about your activity on third-party sites after clicking our affiliate links.
              Please refer to the privacy policies of those affiliate networks for more information on their data practices.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">16. Changes to This Privacy Policy</h2>
            <p>
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy
              on this page and updating the &quot;Last Updated&quot; date. You are advised to review this Privacy Policy periodically for any changes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">17. Contact Us</h2>
            <p>If you have any questions about this Privacy Policy, please contact us:</p>
            <ul className="list-none ml-4 mt-4 space-y-2">
              <li>Dynamic Collectibles Management LLC</li>
              <li>Email: admin@dcmgrading.com</li>
              <li>Website: https://dcmgrading.com</li>
            </ul>
          </section>

        </div>
      </div>
    </main>
  )
}
