"use client";

import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-white relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">

          {/* Company Info & Logo */}
          <div className="lg:col-span-1">
            <div className="flex items-center space-x-3 mb-4">
              <Image
                src="/DCM Logo white.png"
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
              Professional card grading and collection management service. Get detailed assessments of your trading card collection with DCM Optic™ technology.
            </p>
            <div className="flex space-x-4">
              {/* Social Media Links */}
              <a href="https://www.facebook.com/dcmgrading" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors" aria-label="Facebook">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              <a href="https://www.instagram.com/dcm_grading/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors" aria-label="Instagram">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              <a href="https://x.com/DCM_Grading" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors" aria-label="X (Twitter)">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Get Started */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Get Started</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link
                  href="/login?mode=signup"
                  className="inline-block bg-purple-700 hover:bg-purple-800 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-md"
                >
                  Sign Up
                </Link>
              </li>
              <li>
                <Link href="/login?mode=login" className="text-gray-400 hover:text-white transition-colors">
                  Login
                </Link>
              </li>
              <li>
                <Link href="/credits" className="text-gray-400 hover:text-white transition-colors">
                  Buy Credits
                </Link>
              </li>
            </ul>
          </div>

          {/* Grade a Card */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Grade a Card</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/upload?category=Sports" className="text-gray-400 hover:text-white transition-colors">
                  Sports Cards
                </Link>
              </li>
              <li>
                <Link href="/upload?category=Pokemon" className="text-gray-400 hover:text-white transition-colors">
                  Pokémon Cards
                </Link>
              </li>
              <li>
                <Link href="/upload?category=MTG" className="text-gray-400 hover:text-white transition-colors">
                  MTG Cards
                </Link>
              </li>
              <li>
                <Link href="/upload?category=Lorcana" className="text-gray-400 hover:text-white transition-colors">
                  Lorcana Cards
                </Link>
              </li>
              <li>
                <Link href="/upload?category=Other" className="text-gray-400 hover:text-white transition-colors">
                  Other Cards
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Resources</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/about" className="text-gray-400 hover:text-white transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/grading-rubric" className="text-gray-400 hover:text-white transition-colors">
                  Grading Rubric
                </Link>
              </li>
              <li>
                <Link href="/reports-and-labels" className="text-gray-400 hover:text-white transition-colors">
                  Reports & Labels
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-gray-400 hover:text-white transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/grading-limitations" className="text-gray-400 hover:text-white transition-colors">
                  Grading Limitations
                </Link>
              </li>
              <li>
                <Link href="/collection" className="text-gray-400 hover:text-white transition-colors">
                  My Collection
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Legal</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/contact" className="text-gray-400 hover:text-white transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-gray-400 hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-gray-400 hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 py-6">
          <div className="text-center text-sm text-gray-400">
            © {currentYear} Dynamic Collectibles Management. All rights reserved.
          </div>
        </div>

        {/* Professional Disclaimer */}
        <div className="border-t border-gray-800 py-4">
          <p className="text-xs text-gray-500 text-center max-w-4xl mx-auto">
            DCM grading assessments are provided for informational and hobby purposes only. Our grades are independent evaluations
            and should not be considered as an indication of grades that may be assigned by third-party professional grading services
            such as PSA, BGS, CGC, or SGC. For official authentication, certification, or resale purposes, please consult with
            established third-party grading companies.
          </p>
        </div>
      </div>
    </footer>
  );
}