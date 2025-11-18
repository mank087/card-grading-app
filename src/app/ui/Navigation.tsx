"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function Navigation() {
  const [user, setUser] = useState<any>(null);
  const [searchSerial, setSearchSerial] = useState("");
  const [uploadDropdownOpen, setUploadDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  // Check authentication status
  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
          console.warn('Auth error (will clear session):', error.message);
          // Clear any invalid session
          await supabase.auth.signOut();
          setUser(null);
        } else {
          setUser(user);
        }
      } catch (error: any) {
        console.warn('Auth check failed, clearing session:', error.message);
        // Clear session on any auth failure
        try {
          await supabase.auth.signOut();
        } catch (signOutError) {
          console.warn('Failed to sign out:', signOutError);
        }
        setUser(null);
      }
    };

    getUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);

        // Handle auth errors
        if (event === 'TOKEN_REFRESHED' && !session) {
          console.warn('Token refresh failed, user will need to re-login');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Close dropdown and mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;

      if (uploadDropdownOpen && !target.closest('.upload-dropdown')) {
        setUploadDropdownOpen(false);
      }

      if (mobileMenuOpen && !target.closest('.mobile-menu') && !target.closest('.mobile-menu-button')) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [uploadDropdownOpen, mobileMenuOpen]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error: any) {
      console.warn('Logout error (continuing anyway):', error.message);
    }
    setUser(null);
    router.push('/login');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchSerial.trim()) {
      // Navigate to search results or card page
      // For now, assume it's searching for card serial in collection
      router.push(`/collection?search=${encodeURIComponent(searchSerial.trim())}`);
      setSearchSerial("");
    }
  };

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">

          {/* Logo - Left Side */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center space-x-2">
              <Image
                src="/DCM-logo.png"
                alt="DCM Logo"
                width={40}
                height={40}
                className="object-contain"
              />
              <span className="text-base sm:text-xl font-bold text-gray-800">
                <span className="hidden sm:inline">Dynamic Collectibles Management</span>
                <span className="sm:hidden">DCM</span>
              </span>
            </Link>
          </div>

          {/* Center Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              href="/collection"
              className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              My Collection
            </Link>
            <Link
              href="/account"
              className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Account
            </Link>
            {/* Upload Dropdown */}
            <div className="relative upload-dropdown">
              <button
                onClick={() => setUploadDropdownOpen(!uploadDropdownOpen)}
                className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-1"
              >
                <span>Grade a Card</span>
                <svg
                  className={`w-4 h-4 transition-transform ${uploadDropdownOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {uploadDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                  <div className="py-1">
                    <Link
                      href="/upload?category=Sports"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      onClick={() => setUploadDropdownOpen(false)}
                    >
                      Sports Cards
                    </Link>
                    <Link
                      href="/upload?category=Pokemon"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
                      onClick={() => setUploadDropdownOpen(false)}
                    >
                      Pokémon Cards
                    </Link>
                    <Link
                      href="/upload?category=MTG"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                      onClick={() => setUploadDropdownOpen(false)}
                    >
                      MTG Cards
                    </Link>
                    <Link
                      href="/upload?category=Lorcana"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                      onClick={() => setUploadDropdownOpen(false)}
                    >
                      Lorcana Cards
                    </Link>
                    <Link
                      href="/upload?category=Other"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-800 transition-colors"
                      onClick={() => setUploadDropdownOpen(false)}
                    >
                      Other Cards
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Search Box */}
            <form onSubmit={handleSearch} className="flex items-center">
              <div className="relative">
                <input
                  type="text"
                  value={searchSerial}
                  onChange={(e) => setSearchSerial(e.target.value)}
                  placeholder="Search by serial..."
                  className="w-48 px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="submit"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </button>
              </div>
            </form>
          </div>

          {/* Auth Section - Right Side */}
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-700">
                  {user.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md text-sm font-medium transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Login
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden mobile-menu-button">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-gray-700 hover:text-blue-600 focus:outline-none focus:text-blue-600"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu - Conditional */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 border-t border-gray-200 mt-2 mobile-menu">
            <div className="flex flex-col space-y-2 pt-2">
              <Link
                href="/collection"
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                My Collection
              </Link>
              <Link
                href="/account"
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Account
              </Link>
              <Link
                href="/upload?category=Sports"
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Grade Sports Cards
              </Link>
              <Link
                href="/upload?category=Pokemon"
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-700 hover:text-red-600 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Grade Pokémon Cards
              </Link>
              <Link
                href="/upload?category=MTG"
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-700 hover:text-purple-600 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Grade MTG Cards
              </Link>
              <Link
                href="/upload?category=Lorcana"
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-700 hover:text-purple-600 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Grade Lorcana Cards
              </Link>
              <Link
                href="/upload?category=Other"
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-700 hover:text-gray-600 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Grade Other Cards
              </Link>

              {/* Mobile Search */}
              <form onSubmit={(e) => { handleSearch(e); setMobileMenuOpen(false); }} className="px-3 py-2">
                <input
                  type="text"
                  value={searchSerial}
                  onChange={(e) => setSearchSerial(e.target.value)}
                  placeholder="Search by serial..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </form>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}