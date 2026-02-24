"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getStoredSession, signOut, AUTH_STATE_CHANGE_EVENT } from "@/lib/directAuth";
import { useCredits } from "@/contexts/CreditsContext";

export default function Navigation() {
  const [user, setUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false); // Track if initial auth check is done
  const [searchSerial, setSearchSerial] = useState("");
  const [gradeDropdownOpen, setGradeDropdownOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const router = useRouter();
  const { balance, isLoading: creditsLoading } = useCredits();

  // Check authentication status
  useEffect(() => {
    const checkAuth = () => {
      try {
        const session = getStoredSession();
        if (session && session.user) {
          setUser(session.user);
        } else {
          setUser(null);
        }
      } catch (error: any) {
        setUser(null);
      }
      setAuthChecked(true); // Mark auth as checked after first check
    };

    checkAuth();
    const interval = setInterval(checkAuth, 5000);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'supabase.auth.token') {
        checkAuth();
      }
    };

    const handleAuthChange = () => {
      checkAuth();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(AUTH_STATE_CHANGE_EVENT, handleAuthChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(AUTH_STATE_CHANGE_EVENT, handleAuthChange);
    };
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;

      if (gradeDropdownOpen && !target.closest('.grade-dropdown')) {
        setGradeDropdownOpen(false);
      }
      if (accountDropdownOpen && !target.closest('.account-dropdown')) {
        setAccountDropdownOpen(false);
      }
      if (mobileMenuOpen && !target.closest('.mobile-menu') && !target.closest('.mobile-menu-button')) {
        setMobileMenuOpen(false);
      }
      if (searchOpen && !target.closest('.search-container')) {
        setSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [gradeDropdownOpen, accountDropdownOpen, mobileMenuOpen, searchOpen]);

  const handleLogout = () => {
    signOut();
    setUser(null);
    router.push('/login');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchSerial.trim()) {
      router.push(`/search?serial=${encodeURIComponent(searchSerial.trim())}`);
      setSearchSerial("");
      setSearchOpen(false);
      setMobileMenuOpen(false);
    }
  };

  // Grade dropdown content (reused in desktop and mobile)
  const GradeDropdownContent = ({ onItemClick }: { onItemClick: () => void }) => (
    <div className="py-1">
      <Link
        href={`/upload?category=Sports&t=${Date.now()}`}
        className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
        onClick={onItemClick}
      >
        Sports Cards
      </Link>
      <Link
        href={`/upload?category=Pokemon&t=${Date.now()}`}
        className="block px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
        onClick={onItemClick}
      >
        Pokémon Cards
      </Link>
      <Link
        href={`/upload?category=MTG&t=${Date.now()}`}
        className="block px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
        onClick={onItemClick}
      >
        MTG Cards
      </Link>
      <Link
        href={`/upload?category=Lorcana&t=${Date.now()}`}
        className="block px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
        onClick={onItemClick}
      >
        Lorcana Cards
      </Link>
      <Link
        href={`/upload?category=One Piece&t=${Date.now()}`}
        className="block px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors"
        onClick={onItemClick}
      >
        One Piece Cards
      </Link>
      <Link
        href={`/upload?category=Other&t=${Date.now()}`}
        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-800 transition-colors"
        onClick={onItemClick}
      >
        Other Cards
      </Link>
    </div>
  );

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">

          {/* Logo - Left Side */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center">
              <Image
                src="/DCM-logo.png"
                alt="DCM Logo"
                width={40}
                height={40}
                className="object-contain"
              />
            </Link>
          </div>

          {/* ============ DESKTOP NAVIGATION ============ */}
          <div className="hidden md:flex items-center flex-1 justify-between ml-8">

            {/* Left Section - Navigation Links */}
            <div className="flex items-center space-x-1 min-h-[40px]">
              {!authChecked ? (
                /* Skeleton placeholders to prevent CLS — match logged-out link count/widths */
                <>
                  <div className="h-5 w-14 bg-gray-200 rounded animate-pulse mx-3"></div>
                  <div className="h-5 w-20 bg-gray-200 rounded animate-pulse mx-3"></div>
                  <div className="h-5 w-24 bg-gray-200 rounded animate-pulse mx-3"></div>
                  <div className="h-5 w-10 bg-gray-200 rounded animate-pulse mx-3"></div>
                </>
              ) : user ? (
                <>
                  {/* Logged In: My Collection */}
                  <Link
                    href="/collection"
                    className="text-gray-700 hover:text-purple-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    My Collection
                  </Link>
                  <Link
                    href="/credits"
                    className="text-gray-700 hover:text-purple-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Buy Credits
                  </Link>
                  <Link
                    href="/vip"
                    className="text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    <span className="flex items-center gap-1">
                      <span className="text-indigo-500">◆</span> VIP
                    </span>
                  </Link>
                  <Link
                    href="/card-lovers"
                    className="text-gray-700 hover:text-rose-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    <span className="flex items-center gap-1">
                      <span className="text-rose-500">♥</span> Card Lovers
                    </span>
                  </Link>
                  <Link
                    href="/market-pricing"
                    className="text-gray-700 hover:text-emerald-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    <span className="flex items-center gap-1">
                      <span className="text-emerald-500">$</span> Market Pricing
                    </span>
                  </Link>
                  <Link
                    href="/blog"
                    className="text-gray-700 hover:text-purple-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Blog
                  </Link>
                  <Link
                    href="/pop"
                    className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    <span className="flex items-center gap-1">
                      <span className="text-blue-500">#</span> Pop Report
                    </span>
                  </Link>
                </>
              ) : (
                <>
                  {/* Logged Out: Info Pages */}
                  <Link
                    href="/credits"
                    className="text-gray-700 hover:text-purple-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Pricing
                  </Link>
                  <Link
                    href="/vip"
                    className="text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    <span className="flex items-center gap-1">
                      <span className="text-indigo-500">◆</span> VIP
                    </span>
                  </Link>
                  <Link
                    href="/card-lovers"
                    className="text-gray-700 hover:text-rose-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    <span className="flex items-center gap-1">
                      <span className="text-rose-500">♥</span> Card Lovers
                    </span>
                  </Link>
                  <Link
                    href="/grading-rubric"
                    className="text-gray-700 hover:text-purple-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    How It Works
                  </Link>
                  <Link
                    href="/faq"
                    className="text-gray-700 hover:text-purple-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    FAQ
                  </Link>
                  <Link
                    href="/blog"
                    className="text-gray-700 hover:text-purple-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Blog
                  </Link>
                  <Link
                    href="/pop"
                    className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    <span className="flex items-center gap-1">
                      <span className="text-blue-500">#</span> Pop Report
                    </span>
                  </Link>
                </>
              )}
            </div>

            {/* Right Section - Actions */}
            <div className="flex items-center space-x-3">

              {/* Search Icon Button */}
              <div className="relative search-container">
                <button
                  onClick={() => setSearchOpen(!searchOpen)}
                  className="text-gray-500 hover:text-purple-600 p-2 rounded-md transition-colors"
                  aria-label="Search"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>

                {/* Search Dropdown */}
                {searchOpen && (
                  <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 p-3">
                    <form onSubmit={handleSearch}>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={searchSerial}
                          onChange={(e) => setSearchSerial(e.target.value)}
                          placeholder="Search by serial number..."
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          autoFocus
                        />
                        <button
                          type="submit"
                          className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>

              {!authChecked ? (
                /* Skeleton placeholders for auth buttons — match logged-out widths */
                <>
                  <div className="h-9 w-14 bg-gray-200 rounded-md animate-pulse"></div>
                  <div className="h-9 w-36 bg-purple-200 rounded-md animate-pulse"></div>
                </>
              ) : user ? (
                <>
                  {/* Logged In: Credits Badge */}
                  <Link
                    href="/credits"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                      balance <= 1
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                    title="View credits"
                  >
                    {creditsLoading ? (
                      <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <>{balance} {balance === 1 ? 'Credit' : 'Credits'}</>
                    )}
                  </Link>

                  {/* Logged In: Account Dropdown */}
                  <div className="relative account-dropdown">
                    <button
                      onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                      className="flex items-center gap-1 text-gray-700 hover:text-purple-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <svg className={`w-4 h-4 transition-transform ${accountDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {accountDropdownOpen && (
                      <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                        <div className="py-1">
                          <Link
                            href="/account"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                            onClick={() => setAccountDropdownOpen(false)}
                          >
                            My Account
                          </Link>
                          <Link
                            href="/grading-rubric"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                            onClick={() => setAccountDropdownOpen(false)}
                          >
                            Grading Rubric
                          </Link>
                          <Link
                            href="/faq"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                            onClick={() => setAccountDropdownOpen(false)}
                          >
                            FAQ
                          </Link>
                          <Link
                            href="/about"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                            onClick={() => setAccountDropdownOpen(false)}
                          >
                            About Us
                          </Link>
                          <Link
                            href="/blog"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                            onClick={() => setAccountDropdownOpen(false)}
                          >
                            Blog
                          </Link>
                          <hr className="my-1 border-gray-200" />
                          <button
                            onClick={() => {
                              setAccountDropdownOpen(false);
                              handleLogout();
                            }}
                            className="w-full text-left block px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            Logout
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Logged In: Grade a Card - Primary CTA */}
                  <div className="relative grade-dropdown">
                    <button
                      onClick={() => setGradeDropdownOpen(!gradeDropdownOpen)}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-semibold transition-colors flex items-center gap-1 shadow-md"
                    >
                      <span>Grade a Card</span>
                      <svg className={`w-4 h-4 transition-transform ${gradeDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {gradeDropdownOpen && (
                      <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                        <GradeDropdownContent onItemClick={() => setGradeDropdownOpen(false)} />
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Logged Out: Login */}
                  <Link
                    href="/login?mode=login"
                    className="text-gray-700 hover:text-purple-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Login
                  </Link>

                  {/* Logged Out: Sign Up - Primary CTA */}
                  <Link
                    href="/login?mode=signup"
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-semibold transition-colors shadow-md"
                  >
                    Grade 1st Card Free
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* ============ MOBILE NAVIGATION ============ */}
          <div className="flex md:hidden items-center space-x-2">

            {!authChecked ? (
              /* Skeleton placeholders for mobile */
              <>
                <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse"></div>
                <div className="h-7 w-14 bg-purple-200 rounded-md animate-pulse"></div>
              </>
            ) : user ? (
              <>
                {/* Logged In: Credits Badge */}
                <Link
                  href="/credits"
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    balance <= 1
                      ? 'bg-red-100 text-red-700'
                      : 'bg-green-100 text-green-700'
                  }`}
                >
                  {creditsLoading ? '...' : <>{balance} {balance === 1 ? 'Credit' : 'Credits'}</>}
                </Link>

                {/* Logged In: Grade Button */}
                <div className="relative grade-dropdown">
                  <button
                    onClick={() => setGradeDropdownOpen(!gradeDropdownOpen)}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-colors shadow-md"
                  >
                    Grade
                  </button>

                  {gradeDropdownOpen && (
                    <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                      <GradeDropdownContent onItemClick={() => setGradeDropdownOpen(false)} />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Logged Out: Sign Up Button */}
                <Link
                  href="/login?mode=signup"
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-colors shadow-md"
                >
                  1 Free Grade
                </Link>
              </>
            )}

            {/* Hamburger Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-gray-700 hover:text-purple-600 p-2 rounded-md transition-colors mobile-menu-button"
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

        {/* ============ MOBILE DROPDOWN MENU ============ */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 border-t border-gray-200 mt-2 mobile-menu">
            <div className="flex flex-col space-y-1 pt-3">

              {/* Search */}
              <form onSubmit={handleSearch} className="px-3 pb-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={searchSerial}
                    onChange={(e) => setSearchSerial(e.target.value)}
                    placeholder="Search by serial number..."
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                </div>
              </form>

              {user ? (
                <>
                  {/* Logged In Menu */}
                  <Link
                    href="/collection"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 text-gray-700 hover:text-purple-600 hover:bg-purple-50 px-3 py-2.5 rounded-md text-sm font-medium transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    My Collection
                  </Link>
                  <Link
                    href="/credits"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 text-gray-700 hover:text-purple-600 hover:bg-purple-50 px-3 py-2.5 rounded-md text-sm font-medium transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Buy Credits
                  </Link>
                  <Link
                    href="/vip"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-2.5 rounded-md text-sm font-medium transition-colors"
                  >
                    <span className="w-5 h-5 flex items-center justify-center text-indigo-500">◆</span>
                    VIP Package
                  </Link>
                  <Link
                    href="/card-lovers"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 text-gray-700 hover:text-rose-600 hover:bg-rose-50 px-3 py-2.5 rounded-md text-sm font-medium transition-colors"
                  >
                    <span className="w-5 h-5 flex items-center justify-center text-rose-500">♥</span>
                    Card Lovers
                  </Link>
                  <Link
                    href="/market-pricing"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 text-gray-700 hover:text-emerald-600 hover:bg-emerald-50 px-3 py-2.5 rounded-md text-sm font-medium transition-colors"
                  >
                    <span className="w-5 h-5 flex items-center justify-center text-emerald-500 font-bold">$</span>
                    Market Pricing
                  </Link>
                  <Link
                    href="/account"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 text-gray-700 hover:text-purple-600 hover:bg-purple-50 px-3 py-2.5 rounded-md text-sm font-medium transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    My Account
                  </Link>

                  {/* Divider */}
                  <div className="border-t border-gray-200 my-2"></div>
                  <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Resources</p>

                  <Link
                    href="/grading-rubric"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-gray-600 hover:text-purple-600 hover:bg-purple-50 px-3 py-2 rounded-md text-sm transition-colors"
                  >
                    Grading Rubric
                  </Link>
                  <Link
                    href="/faq"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-gray-600 hover:text-purple-600 hover:bg-purple-50 px-3 py-2 rounded-md text-sm transition-colors"
                  >
                    FAQ
                  </Link>
                  <Link
                    href="/about"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-gray-600 hover:text-purple-600 hover:bg-purple-50 px-3 py-2 rounded-md text-sm transition-colors"
                  >
                    About Us
                  </Link>
                  <Link
                    href="/blog"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-gray-600 hover:text-purple-600 hover:bg-purple-50 px-3 py-2 rounded-md text-sm transition-colors"
                  >
                    Blog
                  </Link>
                  <Link
                    href="/pop"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 text-gray-600 hover:text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-md text-sm transition-colors"
                  >
                    <span className="w-5 h-5 flex items-center justify-center text-blue-500 font-bold">#</span>
                    Pop Report
                  </Link>

                  {/* Logout */}
                  <div className="border-t border-gray-200 my-2"></div>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="flex items-center gap-3 text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2.5 rounded-md text-sm font-medium transition-colors w-full text-left"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout
                  </button>
                </>
              ) : (
                <>
                  {/* Logged Out Menu */}
                  <Link
                    href="/login?mode=login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 text-gray-700 hover:text-purple-600 hover:bg-purple-50 px-3 py-2.5 rounded-md text-sm font-medium transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    Login
                  </Link>
                  <Link
                    href="/credits"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 text-gray-700 hover:text-purple-600 hover:bg-purple-50 px-3 py-2.5 rounded-md text-sm font-medium transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Pricing
                  </Link>
                  <Link
                    href="/vip"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-2.5 rounded-md text-sm font-medium transition-colors"
                  >
                    <span className="w-5 h-5 flex items-center justify-center text-indigo-500">◆</span>
                    VIP Package
                  </Link>
                  <Link
                    href="/card-lovers"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 text-gray-700 hover:text-rose-600 hover:bg-rose-50 px-3 py-2.5 rounded-md text-sm font-medium transition-colors"
                  >
                    <span className="w-5 h-5 flex items-center justify-center text-rose-500">♥</span>
                    Card Lovers
                  </Link>
                  <Link
                    href="/grading-rubric"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 text-gray-700 hover:text-purple-600 hover:bg-purple-50 px-3 py-2.5 rounded-md text-sm font-medium transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    How It Works
                  </Link>
                  <Link
                    href="/faq"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 text-gray-700 hover:text-purple-600 hover:bg-purple-50 px-3 py-2.5 rounded-md text-sm font-medium transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    FAQ
                  </Link>
                  <Link
                    href="/about"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 text-gray-700 hover:text-purple-600 hover:bg-purple-50 px-3 py-2.5 rounded-md text-sm font-medium transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    About Us
                  </Link>
                  <Link
                    href="/blog"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 text-gray-700 hover:text-purple-600 hover:bg-purple-50 px-3 py-2.5 rounded-md text-sm font-medium transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                    </svg>
                    Blog
                  </Link>
                  <Link
                    href="/pop"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 text-gray-700 hover:text-blue-600 hover:bg-blue-50 px-3 py-2.5 rounded-md text-sm font-medium transition-colors"
                  >
                    <span className="w-5 h-5 flex items-center justify-center text-blue-500 font-bold">#</span>
                    Pop Report
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
