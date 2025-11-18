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
              Professional card grading and collection management service. Get detailed assessments of your trading card collection with DCM Optic™ technology.
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