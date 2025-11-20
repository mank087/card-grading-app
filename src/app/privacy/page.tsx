export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white shadow-md rounded-lg p-8 sm:p-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-600 mb-8">Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <div className="prose prose-lg max-w-none space-y-6 text-gray-700">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">1. Introduction</h2>
            <p>
              Welcome to DCM Grading ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy.
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered card grading
              service available at dcmgrading.com (the "Service").
            </p>
            <p>
              Our Service uses advanced AI technology to analyze and grade trading cards, providing estimated condition assessments and valuations.
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
              <li><strong>Platform metrics:</strong> Analytics data to improve our AI models and Service performance</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">2.3 Third-Party Authentication</h3>
            <p>
              When you sign in using Google or other third-party authentication services, we receive basic profile information
              (name, email, profile picture) from these providers in accordance with their privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">3. How We Use Your Information</h2>
            <p>We use the information we collect for the following purposes:</p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li><strong>AI Grading Services:</strong> Process and analyze uploaded card images using our AI technology to generate grading reports and condition assessments</li>
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
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">4. How We Share Your Information</h2>
            <p>We may share your information in the following circumstances:</p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">4.1 Service Providers</h3>
            <p>We share your information with trusted third-party service providers who assist us in operating the Service. These providers are bound by confidentiality agreements and include:</p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li><strong>Cloud Hosting:</strong> Supabase, Vercel for data storage and application hosting</li>
              <li><strong>AI Processing:</strong> OpenAI for AI-powered card grading analysis</li>
              <li><strong>Payment Processing:</strong> Secure third-party payment processors for subscription and payment handling</li>
              <li><strong>Authentication:</strong> Google OAuth and other identity providers</li>
              <li><strong>Analytics:</strong> Service usage and performance analytics providers</li>
            </ul>
            <p className="mt-4">
              These service providers only have access to your information as necessary to perform their functions and are obligated to maintain confidentiality.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">4.2 Legal Compliance</h3>
            <p>We may disclose your information if required to do so by law or in response to valid requests by public authorities.</p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">4.3 Business Transfers</h3>
            <p>
              If we are involved in a merger, acquisition, or sale of assets, your information may be transferred.
              We will provide notice before your information is transferred and becomes subject to a different privacy policy.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">4.4 With Your Consent</h3>
            <p>We may share your information for any other purpose with your explicit consent.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">5. Data Retention</h2>
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
              except where we are required to retain it by law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">6. Your Privacy Rights</h2>
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
              To exercise any of these rights, please contact us at the email address provided below. We will respond to your
              request within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">7. Data Security</h2>
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
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">8. Cookies and Tracking Technologies</h2>
            <p>
              We use cookies and similar tracking technologies to track activity on our Service and store certain information.
              You can instruct your browser to refuse all cookies or indicate when a cookie is being sent. However, if you do not
              accept cookies, you may not be able to use some portions of our Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">9. Children's Privacy</h2>
            <p>
              Our Service is not intended for children under the age of 13. We do not knowingly collect personal information from
              children under 13. If you become aware that a child has provided us with personal information, please contact us, and
              we will take steps to delete such information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">10. International Data Transfers</h2>
            <p>
              Your information may be transferred to and maintained on computers located outside of your state, province, country,
              or other governmental jurisdiction where data protection laws may differ. By using our Service, you consent to such transfers.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">11. Changes to This Privacy Policy</h2>
            <p>
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy
              on this page and updating the "Last Updated" date. You are advised to review this Privacy Policy periodically for any changes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">12. Contact Us</h2>
            <p>If you have any questions about this Privacy Policy, please contact us:</p>
            <ul className="list-none ml-4 mt-4 space-y-2">
              <li>Email: admin@dcmgrading.com</li>
              <li>Website: https://dcmgrading.com</li>
            </ul>
          </section>

          <section className="mt-12 pt-8 border-t border-gray-200">
            <p className="text-sm text-gray-500 italic">
              <strong>Note:</strong> This privacy policy is provided as a template and should be reviewed by a qualified attorney
              to ensure compliance with applicable laws and regulations in your jurisdiction.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
