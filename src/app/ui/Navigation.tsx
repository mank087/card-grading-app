"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getStoredSession, signOut } from "@/lib/directAuth";

export default function Navigation() {
  const [user, setUser] = useState<any>(null);
  const [searchSerial, setSearchSerial] = useState("");
  const [uploadDropdownOpen, setUploadDropdownOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  // Check authentication status
  useEffect(() => {
    const checkAuth = () => {
      try {
        // Use the same auth method as collection page
        const session = getStoredSession();
        if (session && session.user) {
          console.log('[Navigation] User state updated:', `Logged in as ${session.user.email}`);
          setUser(session.user);
        } else {
          console.log('[Navigation] User state updated: Not logged in');
          setUser(null);
        }
      } catch (error: any) {
        console.warn('[Navigation] Auth check failed:', error.message);
        setUser(null);
      }
    };

    // Check auth immediately
    checkAuth();

    // Re-check auth periodically (every 5 seconds) to catch login/logout
    const interval = setInterval(checkAuth, 5000);

    // Also listen for storage events (in case user logs in/out in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'supabase.auth.token') {
        checkAuth();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Close dropdown and mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;

      if (uploadDropdownOpen && !target.closest('.upload-dropdown')) {
        setUploadDropdownOpen(false);
      }

      if (accountDropdownOpen && !target.closest('.account-dropdown')) {
        setAccountDropdownOpen(false);
      }

      if (mobileMenuOpen && !target.closest('.mobile-menu') && !target.closest('.mobile-menu-button')) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [uploadDropdownOpen, accountDropdownOpen, mobileMenuOpen]);

  const handleLogout = () => {
    // Clear the session using the directAuth signOut function
    signOut();
    setUser(null);
    router.push('/login');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchSerial.trim()) {
      // Navigate to public search page (works for anyone, logged in or not)
      router.push(`/search?serial=${encodeURIComponent(searchSerial.trim())}`);
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
              <span className="text-base sm:text-xl font-bold text-gray-800 hidden sm:inline">
                Dynamic Collectibles Management
              </span>
            </Link>
          </div>

          {/* Center Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {/* My Collection */}
            <Link
              href="/collection"
              className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              My Collection
            </Link>

            {/* Grade a Card - Highlighted Purple Dropdown */}
            <div className="relative upload-dropdown">
              <button
                onClick={() => setUploadDropdownOpen(!uploadDropdownOpen)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-1 shadow-md"
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
                      href={`/upload?category=Sports&t=${Date.now()}`}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      onClick={() => setUploadDropdownOpen(false)}
                    >
                      Sports Cards
                    </Link>
                    <Link
                      href={`/upload?category=Pokemon&t=${Date.now()}`}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
                      onClick={() => setUploadDropdownOpen(false)}
                    >
                      Pokémon Cards
                    </Link>
                    <Link
                      href={`/upload?category=MTG&t=${Date.now()}`}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                      onClick={() => setUploadDropdownOpen(false)}
                    >
                      MTG Cards
                    </Link>
                    <Link
                      href={`/upload?category=Lorcana&t=${Date.now()}`}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                      onClick={() => setUploadDropdownOpen(false)}
                    >
                      Lorcana Cards
                    </Link>
                    <Link
                      href={`/upload?category=Other&t=${Date.now()}`}
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
                  className="w-48 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                <button
                  type="submit"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-purple-600"
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

            {/* Account Dropdown - Only show when logged in */}
            {user && (
              <div className="relative account-dropdown">
                <button
                  onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                  className="text-gray-700 hover:text-purple-600 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-1"
                >
                  <span>Account</span>
                  <svg
                    className={`w-4 h-4 transition-transform ${accountDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {accountDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                    <div className="py-1">
                      <Link
                        href="/account"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                        onClick={() => setAccountDropdownOpen(false)}
                      >
                        My Account
                      </Link>
                      <button
                        onClick={() => {
                          setAccountDropdownOpen(false);
                          handleLogout();
                        }}
                        className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile Top Buttons - Right Side */}
          <div className="flex md:hidden items-center space-x-2">
            {/* Grade a Card Button - Mobile */}
            <div className="relative upload-dropdown">
              <button
                onClick={() => setUploadDropdownOpen(!uploadDropdownOpen)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors shadow-md"
              >
                Grade
              </button>

              {uploadDropdownOpen && (
                <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                  <div className="py-1">
                    <Link
                      href={`/upload?category=Sports&t=${Date.now()}`}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      onClick={() => setUploadDropdownOpen(false)}
                    >
                      Sports Cards
                    </Link>
                    <Link
                      href={`/upload?category=Pokemon&t=${Date.now()}`}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
                      onClick={() => setUploadDropdownOpen(false)}
                    >
                      Pokémon Cards
                    </Link>
                    <Link
                      href={`/upload?category=MTG&t=${Date.now()}`}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                      onClick={() => setUploadDropdownOpen(false)}
                    >
                      MTG Cards
                    </Link>
                    <Link
                      href={`/upload?category=Lorcana&t=${Date.now()}`}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                      onClick={() => setUploadDropdownOpen(false)}
                    >
                      Lorcana Cards
                    </Link>
                    <Link
                      href={`/upload?category=Other&t=${Date.now()}`}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-800 transition-colors"
                      onClick={() => setUploadDropdownOpen(false)}
                    >
                      Other Cards
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Login or My Collection Button - Mobile */}
            {user ? (
              <Link
                href="/collection"
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              >
                Collection
              </Link>
            ) : (
              <Link
                href="/login"
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              >
                Login
              </Link>
            )}

            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-gray-700 hover:text-purple-600 focus:outline-none focus:text-purple-600 mobile-menu-button"
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

          {/* Desktop Auth Section - Right Side */}
          <div className="hidden md:flex items-center space-x-4">
            {!user && (
              <Link
                href="/login"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Login
              </Link>
            )}
          </div>
        </div>

        {/* Mobile Navigation Menu - Conditional */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 border-t border-gray-200 mt-2 mobile-menu">
            <div className="flex flex-col space-y-2 pt-2">
              {/* My Account - Only show when logged in */}
              {user && (
                <Link
                  href="/account"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-gray-700 hover:text-purple-600 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  My Account
                </Link>
              )}

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

              {/* Logout - Only show when logged in */}
              {user && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="text-left text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full border-t border-gray-200 mt-2 pt-4"
                >
                  Logout
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}