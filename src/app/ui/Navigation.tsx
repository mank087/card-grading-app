"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getStoredSession, signOut } from "@/lib/directAuth";
import { useCredits } from "@/contexts/CreditsContext";

export default function Navigation() {
  const [user, setUser] = useState<any>(null);
  const [searchSerial, setSearchSerial] = useState("");
  const [uploadDropdownOpen, setUploadDropdownOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const { balance, isLoading: creditsLoading } = useCredits();

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

            {/* Credits Display - Only show when logged in */}
            {user && (
              <Link
                href="/credits"
                className="flex items-center gap-1.5 bg-gradient-to-r from-amber-50 to-yellow-50 hover:from-amber-100 hover:to-yellow-100 border border-amber-200 px-3 py-1.5 rounded-full text-sm font-medium transition-all group"
                title="View credits"
              >
                <svg
                  className="w-4 h-4 text-amber-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.736 6.979C9.208 6.193 9.696 6 10 6c.304 0 .792.193 1.264.979a1 1 0 001.715-1.029C12.279 4.784 11.232 4 10 4s-2.279.784-2.979 1.95c-.285.475-.507 1-.67 1.55H6a1 1 0 000 2h.013a9.358 9.358 0 000 1H6a1 1 0 100 2h.351c.163.55.385 1.075.67 1.55C7.721 15.216 8.768 16 10 16s2.279-.784 2.979-1.95a1 1 0 10-1.715-1.029c-.472.786-.96.979-1.264.979-.304 0-.792-.193-1.264-.979a4.265 4.265 0 01-.264-.521H10a1 1 0 100-2H8.017a7.36 7.36 0 010-1H10a1 1 0 100-2H8.472c.08-.185.167-.36.264-.521z" />
                </svg>
                <span className="text-amber-700 group-hover:text-amber-800">
                  {creditsLoading ? (
                    <span className="inline-block w-4 h-4 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin"></span>
                  ) : (
                    <>{balance} {balance === 1 ? 'Credit' : 'Credits'}</>
                  )}
                </span>
              </Link>
            )}

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

            {/* Credits Badge - Mobile (logged in only) */}
            {user && (
              <Link
                href="/credits"
                className="flex items-center gap-1 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 px-2 py-1 rounded-full text-xs font-medium"
                title="View credits"
              >
                <svg className="w-3 h-3 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.736 6.979C9.208 6.193 9.696 6 10 6c.304 0 .792.193 1.264.979a1 1 0 001.715-1.029C12.279 4.784 11.232 4 10 4s-2.279.784-2.979 1.95c-.285.475-.507 1-.67 1.55H6a1 1 0 000 2h.013a9.358 9.358 0 000 1H6a1 1 0 100 2h.351c.163.55.385 1.075.67 1.55C7.721 15.216 8.768 16 10 16s2.279-.784 2.979-1.95a1 1 0 10-1.715-1.029c-.472.786-.96.979-1.264.979-.304 0-.792-.193-1.264-.979a4.265 4.265 0 01-.264-.521H10a1 1 0 100-2H8.017a7.36 7.36 0 010-1H10a1 1 0 100-2H8.472c.08-.185.167-.36.264-.521z" />
                </svg>
                <span className="text-amber-700">{creditsLoading ? '...' : balance}</span>
              </Link>
            )}

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