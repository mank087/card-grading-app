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
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our card grading service
              available at dcmgrading.com (the "Service").
            </p>
            <p>
              By using the Service, you agree to the collection and use of information in accordance with this policy. If you do not agree with
              our policies and practices, please do not use our Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">2. Information We Collect</h2>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">2.1 Personal Information You Provide</h3>
            <p>We collect information that you voluntarily provide to us when you:</p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Register for an account</li>
              <li>Upload images of trading cards for grading</li>
              <li>Contact us for support or inquiries</li>
              <li>Sign up for our newsletter or communications</li>
            </ul>
            <p className="mt-4">This information may include:</p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Email address</li>
              <li>Name</li>
              <li>Account credentials</li>
              <li>Images of trading cards</li>
              <li>Communication preferences</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">2.2 Information Automatically Collected</h3>
            <p>When you access our Service, we may automatically collect certain information, including:</p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Device information (browser type, operating system)</li>
              <li>IP address and general location</li>
              <li>Usage data (pages visited, time spent, features used)</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">2.3 Third-Party Authentication</h3>
            <p>
              When you sign in using Google or other third-party authentication services, we receive basic profile information
              (name, email, profile picture) from these providers in accordance with their privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Provide, maintain, and improve our card grading Service</li>
              <li>Process and analyze uploaded card images using AI technology</li>
              <li>Create and manage your user account</li>
              <li>Send you technical notices, updates, and support messages</li>
              <li>Respond to your comments, questions, and customer service requests</li>
              <li>Monitor and analyze usage patterns and trends</li>
              <li>Detect, prevent, and address technical issues and security threats</li>
              <li>Comply with legal obligations and enforce our terms</li>
              <li>Send marketing communications (with your consent)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">4. How We Share Your Information</h2>
            <p>We may share your information in the following circumstances:</p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">4.1 Service Providers</h3>
            <p>We may share your information with third-party service providers who perform services on our behalf, including:</p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Cloud hosting and storage (Supabase, Vercel)</li>
              <li>AI and image processing services (OpenAI)</li>
              <li>Authentication services (Google OAuth)</li>
              <li>Analytics providers</li>
            </ul>

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
              We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy Policy,
              unless a longer retention period is required or permitted by law. When you delete your account, we will delete or
              anonymize your personal information within 30 days.
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
              We implement appropriate technical and organizational security measures to protect your personal information against
              unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet or
              electronic storage is 100% secure, and we cannot guarantee absolute security.
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
              <li>Email: privacy@dcmgrading.com</li>
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
