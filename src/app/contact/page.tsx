export default function ContactPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Contact Us
          </h1>
          <p className="text-xl text-gray-600">
            We'd love to hear from you
          </p>
        </div>

        {/* Contact Content */}
        <div className="bg-white rounded-2xl shadow-md p-8 sm:p-12">
          <div className="max-w-2xl mx-auto">
            <p className="text-gray-700 text-lg mb-8 text-center">
              Have questions, feedback, or just want to share your latest pull?
              Reach out to our team and we'll get back to you as soon as possible.
            </p>

            {/* Email Section */}
            <div className="mb-10">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Get in Touch</h2>
              <div className="flex items-center justify-center space-x-4 p-6 bg-gray-50 rounded-lg border border-gray-200">
                <svg
                  className="w-8 h-8 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                <a
                  href="mailto:admin@dcmgrading.com"
                  className="text-xl text-purple-600 hover:text-purple-700 font-semibold transition-colors"
                >
                  admin@dcmgrading.com
                </a>
              </div>
            </div>

            {/* Social Media Section */}
            <div className="mb-10">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Follow Us</h2>
              <div className="flex items-center justify-center space-x-8">
                {/* Facebook */}
                <a
                  href="#"
                  className="flex flex-col items-center space-y-2 text-gray-600 hover:text-blue-600 transition-colors group"
                  aria-label="Facebook"
                >
                  <div className="w-14 h-14 bg-gray-100 group-hover:bg-blue-50 rounded-full flex items-center justify-center transition-colors">
                    <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </div>
                  <span className="text-sm font-medium">Facebook</span>
                </a>

                {/* X (Twitter) */}
                <a
                  href="#"
                  className="flex flex-col items-center space-y-2 text-gray-600 hover:text-gray-900 transition-colors group"
                  aria-label="X (Twitter)"
                >
                  <div className="w-14 h-14 bg-gray-100 group-hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </div>
                  <span className="text-sm font-medium">X</span>
                </a>

                {/* Email Icon */}
                <a
                  href="mailto:admin@dcmgrading.com"
                  className="flex flex-col items-center space-y-2 text-gray-600 hover:text-purple-600 transition-colors group"
                  aria-label="Email"
                >
                  <div className="w-14 h-14 bg-gray-100 group-hover:bg-purple-50 rounded-full flex items-center justify-center transition-colors">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <span className="text-sm font-medium">Email</span>
                </a>
              </div>
            </div>

            {/* Additional Info */}
            <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
              <h3 className="font-bold text-blue-900 mb-2 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Response Time
              </h3>
              <p className="text-sm text-blue-800">
                We typically respond to all inquiries within 24-48 hours. For technical support questions,
                please include as much detail as possible about the issue you're experiencing.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
