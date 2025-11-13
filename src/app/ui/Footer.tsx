"use client";

import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">

          {/* Company Info & Logo */}
          <div className="lg:col-span-1">
            <div className="flex items-center space-x-3 mb-4">
              <Image
                src="/DCM-logo.png"
                alt="DCM Logo"
                width={48}
                height={48}
                className="object-contain"
              />
              <div>
                <h3 className="text-lg font-bold">DCM</h3>
                <p className="text-sm text-gray-400">Dynamic Collectibles Management</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Professional AI-powered card grading and authentication service. Get accurate, detailed assessments of your trading card collection with our advanced grading technology.
            </p>
            <div className="flex space-x-4">
              {/* Social Media Links */}
              <a href="#" className="text-gray-400 hover:text-white transition-colors" aria-label="Facebook">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors" aria-label="Twitter">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors" aria-label="Instagram">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.62 5.367 11.987 11.988 11.987s11.987-5.367 11.987-11.987C24.014 5.367 18.647.001 12.017.001zM8.449 16.988c-1.297 0-2.448-.49-3.33-1.293C4.239 14.81 3.748 13.659 3.748 12.362c0-1.297.49-2.448 1.293-3.33.88-.803 2.031-1.293 3.33-1.293 1.297 0 2.448.49 3.33 1.293.802.88 1.293 2.031 1.293 3.33 0 1.297-.49 2.448-1.293 3.33-.88.803-2.031 1.293-3.33 1.293zm7.718-1.293c-.88.803-2.031 1.293-3.33 1.293-1.297 0-2.448-.49-3.33-1.293-.802-.88-1.293-2.031-1.293-3.33 0-1.297.49-2.448 1.293-3.33.88-.803 2.031-1.293 3.33-1.293 1.297 0 2.448.49 3.33 1.293.802.88 1.293 2.031 1.293 3.33 0 1.297-.49 2.448-1.293 3.33z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Services</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/upload/sports" className="text-gray-400 hover:text-white transition-colors">
                  Sports Card Grading
                </Link>
              </li>
              <li>
                <Link href="/upload" className="text-gray-400 hover:text-white transition-colors">
                  All Card Types
                </Link>
              </li>
              <li>
                <Link href="/collection" className="text-gray-400 hover:text-white transition-colors">
                  Collection Management
                </Link>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  Authentication Services
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  Market Valuation
                </a>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Support</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  Help Center
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  Grading Standards
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  Submission Guidelines
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  Contact Support
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Legal & Company */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Company</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  About Us
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  Cookie Policy
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  Security
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-sm text-gray-400">
              © {currentYear} Dynamic Collectibles Management. All rights reserved.
            </div>

            <div className="flex items-center space-x-6 text-sm text-gray-400">
              <span>Powered by AI Technology</span>
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span>System Status: Operational</span>
              </div>
            </div>
          </div>
        </div>

        {/* Professional Disclaimer */}
        <div className="border-t border-gray-800 py-4">
          <p className="text-xs text-gray-500 text-center max-w-4xl mx-auto">
            DCM provides AI-powered grading assessments for informational purposes. While our technology delivers highly accurate results,
            final market valuations may vary. Always consult with certified professionals for insurance or major transaction purposes.
            Our grading standards are designed to be consistent with industry best practices.
          </p>
        </div>
      </div>
    </footer>
  );
}