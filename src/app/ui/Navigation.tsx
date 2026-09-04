"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { getStoredSession, signOut, AUTH_STATE_CHANGE_EVENT } from "@/lib/directAuth";
import { useCredits } from "@/contexts/CreditsContext";
import { useOrgContext } from "@/contexts/OrgContext";
import AppStoreBadge from "@/components/AppStoreBadge";
import GooglePlayBadge from "@/components/GooglePlayBadge";
import { isStorefrontHost, isOrgPublicPath } from "@/lib/storefrontHost";
import NavDropdown from "./NavDropdown";

/**
 * Logged-out information architecture. One list drives both the desktop row
 * and the mobile menu so they cannot drift.
 *
 * Order is deliberate: what you can do (How It Works → the three product
 * surfaces), then what it costs, then everything else. "How It Works" is the
 * Get Started guide (photograph → grade → label); the scoring rubric that
 * used to sit behind that label is now "Grading Standards" under Resources.
 */
const GUEST_PRIMARY = [
  { href: '/get-started', label: 'How It Works' },
  { href: '/instalist-marketplace', label: 'eBay InstaList' },
  { href: '/market-pricing', label: 'Portfolio' },
  { href: '/labels', label: 'Label Studio' },
] as const;
const GUEST_PRICING = [
  { href: '/credits', label: 'Grading Credits', description: 'Pay per card, from 2 free grades' },
  { href: '/card-lovers', label: 'Card Lovers Membership', description: 'Monthly or annual bundles for collectors' },
  { href: '/vip', label: 'VIP Package', description: '150 grades at the lowest per-card price' },
] as const;
const GUEST_RESOURCES = [
  { href: '/grading-rubric', label: 'Grading Standards' },
  { href: '/faq', label: 'FAQ' },
  { href: '/featured', label: 'Featured Cards' },
  { href: '/pop', label: 'Pop Report' },
  { href: '/blog', label: 'Blog' },
  { href: '/enterprise', label: 'Enterprise' },
  { href: '/#get-the-app', label: 'Get the App' },
] as const;

/**
 * Logged-in information architecture. Manage cards → check value → sell →
 * label, then everything else. Label Studio is dropped for org members
 * (their label design is locked to Brand Setup), which happens at render.
 */
const MEMBER_PRIMARY = [
  { href: '/collection', label: 'Collection' },
  { href: '/market-pricing', label: 'Portfolio' },
  { href: '/instalist-marketplace', label: 'eBay InstaList' },
  { href: '/labels', label: 'Label Studio' },
] as const;
/** The balance pill's menu: buying first, then the bundles. */
const MEMBER_CREDITS = [
  { href: '/credits', label: 'Buy credits', description: 'Single grades and packs' },
  { href: '/card-lovers', label: 'Card Lovers Membership', description: 'Monthly or annual bundles' },
  { href: '/vip', label: 'VIP Package', description: '150 grades at the lowest per-card price' },
] as const;
const MEMBER_RESOURCES = [
  { href: '/get-started', label: 'How It Works' },
  { href: '/grading-rubric', label: 'Grading Standards' },
  { href: '/pop', label: 'Pop Report' },
  { href: '/featured', label: 'Featured Cards' },
  { href: '/blog', label: 'Blog' },
  { href: '/faq', label: 'FAQ' },
  { href: '/shop', label: 'Recommended Products' },
  { href: '/enterprise', label: 'Enterprise' },
  { href: '/#get-the-app', label: 'Get the App' },
] as const;

// Routes that render in a fullscreen modal/WebView from the mobile app —
// they should not show the site nav. Mobile InAppPage already injects CSS
// to hide nav/footer, but external browsers (SFSafariViewController on iOS,
// Chrome Custom Tab on Android) can't run that injection so the nav leaks
// through. Returning null here covers both cases at the source.
const FULLSCREEN_ROUTES = ['/label-export', '/label-preview'];

export default function Navigation() {
  const pathname = usePathname();
  // Tenant subdomains ({slug}.dcmgrading.com) rewrite to /enterprise/{slug}/* but the
  // browser pathname stays '/', so the host must be checked too. SSR can't see
  // the host from a client component, so this resolves after mount.
  const [tenantHost, setTenantHost] = useState(false);
  useEffect(() => { setTenantHost(isStorefrontHost(window.location.hostname)); }, []);
  if (tenantHost || (pathname && (FULLSCREEN_ROUTES.some(p => pathname.startsWith(p)) || isOrgPublicPath(pathname)))) {
    return null;
  }
  return <NavigationInner />;
}

function NavigationInner() {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false); // Track if initial auth check is done
  const [searchSerial, setSearchSerial] = useState("");
  const [gradeDropdownOpen, setGradeDropdownOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [orgSwitcherOpen, setOrgSwitcherOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // startMenuTransition wraps the mobile-menu state flip so React schedules
  // the ~295 lines of menu JSX as a low-priority transition rather than as
  // a blocking update on the click frame. Keeps INP under the 200ms bar on
  // low-end Android — the hamburger tap returns immediately and the menu
  // paint follows. The unused isPending slot is discarded.
  const [, startMenuTransition] = useTransition();
  const router = useRouter();
  const { balance, isLoading: creditsLoading } = useCredits();
  const { membership: orgMembership, scope: orgScope, setScope: setOrgScope, isOrgScope } = useOrgContext();

  // Check authentication status.
  //
  // No setInterval here on purpose — directAuth.ts dispatches
  // AUTH_STATE_CHANGE_EVENT on every sign-in / sign-out / token refresh, and
  // the browser fires a `storage` event on cross-tab localStorage writes.
  // Those two cover same-tab and cross-tab correctness; the previous 5s
  // poll added ~12 main-thread wakeups per minute fighting for the same
  // frame as user interactions, which was a measurable INP regression.
  // visibilitychange + the focus-driven refresh in CreditsContext catch any
  // token expiry that lapses while the tab was backgrounded.
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

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'supabase.auth.token') {
        checkAuth();
      }
    };

    const handleAuthChange = () => {
      checkAuth();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkAuth();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(AUTH_STATE_CHANGE_EVENT, handleAuthChange);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(AUTH_STATE_CHANGE_EVENT, handleAuthChange);
      document.removeEventListener('visibilitychange', handleVisibility);
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
      if (orgSwitcherOpen && !target.closest('.org-switcher')) {
        setOrgSwitcherOpen(false);
      }
      if (mobileMenuOpen && !target.closest('.mobile-menu') && !target.closest('.mobile-menu-button')) {
        setMobileMenuOpen(false);
      }
      if (searchOpen && !target.closest('.search-container')) {
        setSearchOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setGradeDropdownOpen(false);
      setAccountDropdownOpen(false);
      setOrgSwitcherOpen(false);
      setSearchOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [gradeDropdownOpen, accountDropdownOpen, orgSwitcherOpen, mobileMenuOpen, searchOpen]);

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
    <nav
      className="bg-white shadow-lg border-b border-gray-200 sticky top-0 z-50"
      // Org workspace: the header carries the brand accent so members always
      // know which hat they're wearing. A 3px brand-color bar tops the nav
      // and key purple accents follow the brand primary via CSS var.
      style={isOrgScope && orgMembership ? {
        borderTop: `3px solid ${orgMembership.brandColor || '#7C3AED'}`,
        ['--ws-accent' as any]: orgMembership.brandColor || '#7C3AED',
      } : undefined}
    >
      {/* 2xl:max-w widened when the app-store badges joined the row (July
          2026) — at max-w-7xl the badges squeezed the center links into
          two-line wraps. Below 2xl the badges are hidden and the classic
          width returns. */}
      <div className="max-w-7xl 2xl:max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">

          {/* Logo - Left Side. Org workspace: co-branded — the org's mark
              beside the DCM mark. */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/DCM-logo.png"
                alt="DCM Logo"
                width={40}
                height={40}
                className="object-contain"
              />
              {isOrgScope && orgMembership?.logos.color && (
                <>
                  <span className="h-8 w-px bg-gray-200" aria-hidden />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={orgMembership.logos.color}
                    alt={`${orgMembership.name} logo`}
                    className="h-9 w-9 object-contain"
                  />
                </>
              )}
            </Link>
          </div>

          {/* ============ DESKTOP NAVIGATION ============ */}
          {/* Desktop nav shows at lg (≥1024px). Below that — including iPad
              portrait (768-1023px) — we render the hamburger menu instead;
              the 6-item logged-out row plus the auth buttons needs ~1000px. */}
          <div className="hidden lg:flex items-center flex-1 justify-between ml-6 xl:ml-8">

            {/* Left Section - Navigation Links */}
            <div className="flex items-center space-x-1 min-h-[40px]">
              {!authChecked ? (
                /* Skeleton placeholders to prevent CLS — match the 6 logged-out items */
                <>
                  <div className="h-5 w-24 bg-gray-200 rounded animate-pulse mx-3"></div>
                  <div className="h-5 w-24 bg-gray-200 rounded animate-pulse mx-3"></div>
                  <div className="h-5 w-16 bg-gray-200 rounded animate-pulse mx-3"></div>
                  <div className="h-5 w-20 bg-gray-200 rounded animate-pulse mx-3"></div>
                  <div className="h-5 w-16 bg-gray-200 rounded animate-pulse mx-3"></div>
                  <div className="h-5 w-20 bg-gray-200 rounded animate-pulse mx-3"></div>
                </>
              ) : user ? (
                <>
                  {/* Logged In — see MEMBER_* at the top of the file. Bulk
                      grading has no nav entry: the binder / My Collection is
                      the history, and the only way in is the "Submit more than
                      one card" link on /upload. */}
                  {MEMBER_PRIMARY.filter(item => !(isOrgScope && item.href === '/labels')).map(item => {
                    const current = pathname === item.href || (pathname?.startsWith(item.href + '/') ?? false);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={current ? 'page' : undefined}
                        className={`relative px-2.5 xl:px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                          current ? 'text-purple-700' : 'text-gray-700 hover:text-purple-600'
                        }`}
                      >
                        {item.label}
                        {current && <span aria-hidden="true" className="absolute left-3 right-3 -bottom-[13px] h-0.5 bg-purple-600 rounded-full" />}
                      </Link>
                    );
                  })}
                  <NavDropdown label="Resources" items={[...MEMBER_RESOURCES]} />
                </>
              ) : (
                <>
                  {/* Logged Out — see GUEST_* at the top of the file. */}
                  {GUEST_PRIMARY.map(item => {
                    const current = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={current ? 'page' : undefined}
                        className={`relative px-2.5 xl:px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                          current ? 'text-purple-700' : 'text-gray-700 hover:text-purple-600'
                        }`}
                      >
                        {item.label}
                        {current && <span aria-hidden="true" className="absolute left-3 right-3 -bottom-[13px] h-0.5 bg-purple-600 rounded-full" />}
                      </Link>
                    );
                  })}
                  <NavDropdown label="Pricing" items={[...GUEST_PRICING]} width="w-72" />
                  <NavDropdown label="Resources" items={[...GUEST_RESOURCES]} />
                </>
              )}
            </div>

            {/* Right Section - Actions */}
            <div className="flex items-center space-x-2 xl:space-x-3">

              {/* Search Icon Button */}
              <div className="relative search-container">
                <button
                  onClick={() => setSearchOpen(!searchOpen)}
                  className="text-gray-500 hover:text-purple-600 p-2 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                  aria-label="Find a graded card by serial number"
                  aria-expanded={searchOpen}
                  title="Find a graded card"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>

                {/* Search Dropdown */}
                {searchOpen && (
                  <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 p-3">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Find a graded card</p>
                    <form onSubmit={handleSearch}>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={searchSerial}
                          onChange={(e) => setSearchSerial(e.target.value)}
                          placeholder="DCM serial number"
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
                  {/* Enterprise members get ONE compact control combining the
                      workspace switcher and the active balance — two separate
                      pills wrapped the nav at laptop widths. Both balances and
                      the org links live in the dropdown. Non-members keep the
                      classic credits badge untouched. */}
                  {orgMembership ? (
                    <div className="relative org-switcher">
                      <button
                        onClick={() => setOrgSwitcherOpen(!orgSwitcherOpen)}
                        className={`flex items-center gap-2 h-9 px-3 rounded-full text-sm font-semibold whitespace-nowrap transition-colors border ${
                          isOrgScope
                            ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                        title={isOrgScope
                          ? `${orgMembership.name} workspace — click to switch or manage`
                          : 'Personal workspace — click to switch or manage'}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: isOrgScope ? (orgMembership.brandColor || '#7C3AED') : '#9CA3AF' }}
                        />
                        <span className="max-w-[7.5rem] truncate">
                          {isOrgScope ? orgMembership.name : 'Personal'}
                        </span>
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                          isOrgScope
                            ? orgMembership.status === 'pending'
                              ? 'bg-amber-100 text-amber-700'
                              : orgMembership.gradeCredits <= 1 ? 'bg-red-100 text-red-600' : 'bg-purple-100 text-purple-700'
                            : balance <= 1 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'
                        }`}>
                          {isOrgScope
                            ? orgMembership.status === 'pending' ? 'Pending' : orgMembership.gradeCredits
                            : creditsLoading ? '…' : balance}
                        </span>
                        <svg className={`w-3.5 h-3.5 shrink-0 transition-transform ${orgSwitcherOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {orgSwitcherOpen && (
                        <div className="absolute top-full right-0 mt-1 w-64 bg-white rounded-md shadow-lg border border-gray-200 z-50 py-1">
                          <div className="px-4 pt-2 pb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Workspace</div>
                          <button
                            onClick={() => { setOrgScope('personal'); setOrgSwitcherOpen(false); }}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-purple-50 ${
                              !isOrgScope ? 'text-purple-700 font-semibold' : 'text-gray-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-gray-400" />
                                Personal
                              </span>
                              {!isOrgScope && <span className="text-purple-600">✓</span>}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5 pl-4">
                              {creditsLoading ? '…' : balance} personal credit{balance === 1 ? '' : 's'}
                            </div>
                          </button>
                          <button
                            onClick={() => { setOrgScope('org'); setOrgSwitcherOpen(false); }}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-purple-50 ${
                              isOrgScope ? 'text-purple-700 font-semibold' : 'text-gray-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-2 min-w-0">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: orgMembership.brandColor || '#7C3AED' }} />
                                <span className="truncate">{orgMembership.name}</span>
                              </span>
                              {isOrgScope && <span className="text-purple-600 shrink-0">✓</span>}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5 pl-4">
                              {orgMembership.status === 'pending'
                                ? <span className="text-amber-600 font-medium">Awaiting DCM approval</span>
                                : orgMembership.status !== 'active'
                                  ? <span className="text-red-500 font-medium capitalize">{orgMembership.status}</span>
                                  : <>{orgMembership.gradeCredits} grade{orgMembership.gradeCredits !== 1 ? 's' : ''} available</>}
                            </div>
                          </button>
                          <div className="border-t border-gray-100 mt-1 pt-1">
                            {orgMembership.slug && (
                              <a
                                href={`/enterprise/${orgMembership.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => setOrgSwitcherOpen(false)}
                                className="block px-4 py-2 text-sm text-gray-600 hover:bg-purple-50 hover:text-purple-700"
                              >
                                Enterprise Page ↗
                              </a>
                            )}
                            <Link
                              href="/store/welcome"
                              onClick={() => setOrgSwitcherOpen(false)}
                              className="block px-4 py-2 text-sm text-gray-600 hover:bg-purple-50 hover:text-purple-700"
                            >
                              Welcome to Enterprise
                            </Link>
                            <Link
                              href="/store/settings"
                              onClick={() => setOrgSwitcherOpen(false)}
                              className="block px-4 py-2 text-sm text-gray-600 hover:bg-purple-50 hover:text-purple-700"
                            >
                              Brand Setup
                            </Link>
                            <Link
                              href="/store/billing"
                              onClick={() => setOrgSwitcherOpen(false)}
                              className="block px-4 py-2 text-sm text-gray-600 hover:bg-purple-50 hover:text-purple-700"
                            >
                              Billing &amp; Grades
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* One credits control: the balance is the trigger and the
                       menu holds buying + bundles. Replaces the old pair of a
                       "Credits" nav link and a pill that both went to /credits. */
                    <NavDropdown
                      label="Credits"
                      ariaLabel={`${balance} credits — buy credits or view memberships`}
                      items={[...MEMBER_CREDITS]}
                      width="w-72"
                      align="right"
                      triggerClassName={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                        balance <= 1
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                      trigger={creditsLoading ? (
                        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        <>{balance} {balance === 1 ? 'Credit' : 'Credits'}</>
                      )}
                    />
                  )}

                  {/* Logged In: Account Dropdown */}
                  <div className="relative account-dropdown">
                    <button
                      onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                      aria-expanded={accountDropdownOpen}
                      aria-haspopup="true"
                      aria-label="Account menu"
                      className="flex items-center gap-1 text-gray-700 hover:text-purple-600 px-3 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <svg className={`w-4 h-4 transition-transform ${accountDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {accountDropdownOpen && (
                      <div className="absolute top-full right-0 mt-1 w-52 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                        <div className="py-1">
                          <Link
                            href="/account"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                            onClick={() => setAccountDropdownOpen(false)}
                          >
                            My Account
                          </Link>
                          <Link
                            href="/credits"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                            onClick={() => setAccountDropdownOpen(false)}
                          >
                            Credits &amp; Memberships
                          </Link>
                          <hr className="my-1 border-gray-200" />
                          <button
                            onClick={() => {
                              setAccountDropdownOpen(false);
                              handleLogout();
                            }}
                            className="w-full text-left block px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            Log out
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Logged In: Grade a Card - Primary CTA */}
                  <div className="relative grade-dropdown">
                    <button
                      onClick={() => setGradeDropdownOpen(!gradeDropdownOpen)}
                      aria-expanded={gradeDropdownOpen}
                      aria-haspopup="true"
                      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-semibold transition-colors flex items-center gap-1 shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
                    style={isOrgScope && orgMembership?.brandColor ? { backgroundColor: orgMembership.brandColor } : undefined}
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
                    className="text-gray-700 hover:text-purple-600 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                  >
                    Log in
                  </Link>

                  {/* Logged Out: Sign Up - Primary CTA. "2 Cards" matches the
                      actual signup grant (2 free credits, src/lib/credits.ts). */}
                  <Link
                    href="/login?mode=signup"
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-semibold transition-colors shadow-md whitespace-nowrap"
                    style={isOrgScope && orgMembership?.brandColor ? { backgroundColor: orgMembership.brandColor } : undefined}
                  >
                    Grade 2 Cards Free
                  </Link>
                </>
              )}

              {/* App store badges left the header in Sept 2026 — the footer,
                  homepage sections and the mobile menu carry them. */}
            </div>
          </div>

          {/* ============ MOBILE NAVIGATION ============ */}
          {/* min-h-[40px] reserves the row height before the auth check
              resolves so the skeleton → credits-badge swap doesn't shift
              the hamburger button horizontally. Mirrors the desktop row's
              min-h-[40px] at line 188. */}
          <div className="flex lg:hidden items-center space-x-2 min-h-[40px]">

            {!authChecked ? (
              /* Skeleton placeholders for mobile */
              <>
                <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse"></div>
                <div className="h-7 w-14 bg-purple-200 rounded-md animate-pulse"></div>
              </>
            ) : user ? (
              <>
                {/* Logged In: Credits Badge — org context shows the store pool */}
                {isOrgScope && orgMembership ? (
                  <Link
                    href="/store/billing"
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      orgMembership.gradeCredits <= 1
                        ? 'bg-red-100 text-red-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}
                  >
                    {orgMembership.status === 'pending'
                      ? 'Pending'
                      : <>{orgMembership.gradeCredits} {orgMembership.gradeCredits === 1 ? 'Grade' : 'Grades'}</>}
                  </Link>
                ) : (
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
                )}

                {/* Logged In: Grade Button */}
                <div className="relative grade-dropdown">
                  <button
                    onClick={() => setGradeDropdownOpen(!gradeDropdownOpen)}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-colors shadow-md"
                    style={isOrgScope && orgMembership?.brandColor ? { backgroundColor: orgMembership.brandColor } : undefined}
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
              <Link
                href="/login?mode=signup"
                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-colors shadow-md"
                    style={isOrgScope && orgMembership?.brandColor ? { backgroundColor: orgMembership.brandColor } : undefined}
              >
                Grade 2 Cards Free
              </Link>
            )}

            {/* Hamburger Menu Button.
                startMenuTransition keeps the click frame responsive —
                without it, the ~295 lines of mobile-menu JSX render
                synchronously on the click handler and pushed INP above
                200ms on mobile, especially on low-end Android. */}
            <button
              type="button"
              onClick={() => startMenuTransition(() => setMobileMenuOpen(prev => !prev))}
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
          // The parent <nav> is `sticky top-0`. When the logged-in dropdown
          // is taller than the viewport, items below the fold (Pop Report,
          // Logout) become unreachable because sticky keeps the nav pinned
          // at top:0 and the page can't scroll inside the nav itself.
          // Constrain the panel to `100dvh - 4rem` (nav header is h-16) and
          // make it its own scroll container. overscroll-contain stops the
          // bounce from unsticking the nav on iOS.
          <div className="lg:hidden pb-4 border-t border-gray-200 mt-2 mobile-menu max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain">
            <div className="flex flex-col space-y-1 pt-3">

              {/* Search */}
              <form onSubmit={handleSearch} className="px-3 pb-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={searchSerial}
                    onChange={(e) => setSearchSerial(e.target.value)}
                    placeholder="DCM serial number"
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
                  {/* Enterprise workspace switcher (mobile) — org members only */}
                  {orgMembership && (
                    <div className="px-3 pb-2">
                      <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Workspace</div>
                      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                        <button
                          onClick={() => setOrgScope('personal')}
                          className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            !isOrgScope ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600'
                          }`}
                        >
                          👤 Personal
                        </button>
                        <button
                          onClick={() => setOrgScope('org')}
                          className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors truncate ${
                            isOrgScope ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600'
                          }`}
                        >
                          🏪 {orgMembership.name}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Logged In Menu — same groups as the desktop row (MEMBER_*). */}
                  {MEMBER_PRIMARY.filter(item => !(isOrgScope && item.href === '/labels')).map(item => {
                    const current = pathname === item.href || (pathname?.startsWith(item.href + '/') ?? false);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        aria-current={current ? 'page' : undefined}
                        className={`block px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                          current ? 'text-purple-700 bg-purple-50' : 'text-gray-700 hover:text-purple-600 hover:bg-purple-50'
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                  <Link
                    href="/account"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-3 py-2.5 rounded-md text-sm font-medium text-gray-700 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                  >
                    My Account
                  </Link>
                  <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Credits</p>
                  {MEMBER_CREDITS.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-3 py-2 rounded-md text-sm text-gray-700 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                    >
                      {item.label}
                      <span className="block text-xs text-gray-500">{item.description}</span>
                    </Link>
                  ))}
                  <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Resources</p>
                  {MEMBER_RESOURCES.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-3 py-2 rounded-md text-sm text-gray-700 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                    >
                      {item.label}
                    </Link>
                  ))}

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
                    Log out
                  </button>
                </>
              ) : (
                <>
                  {/* Logged Out Menu — same groups as the desktop row (GUEST_*). */}
                  <Link
                    href="/login?mode=login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-3 py-2.5 rounded-md text-sm font-medium text-gray-700 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                  >
                    Log in
                  </Link>
                  {GUEST_PRIMARY.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      aria-current={pathname === item.href ? 'page' : undefined}
                      className={`block px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                        pathname === item.href ? 'text-purple-700 bg-purple-50' : 'text-gray-700 hover:text-purple-600 hover:bg-purple-50'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                  <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Pricing</p>
                  {GUEST_PRICING.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-3 py-2 rounded-md text-sm text-gray-700 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                    >
                      {item.label}
                      <span className="block text-xs text-gray-500">{item.description}</span>
                    </Link>
                  ))}
                  <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Resources</p>
                  {GUEST_RESOURCES.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-3 py-2 rounded-md text-sm text-gray-700 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                    >
                      {item.label}
                    </Link>
                  ))}
                </>
              )}

              {/* App store badges — took over from the retired LaunchBanner
                  (July 2026). Full-size here; the desktop row shows compact
                  versions at xl+. */}
              <div className="flex items-center gap-3 px-3 pt-4 pb-2 mt-2 border-t border-gray-100">
                <AppStoreBadge variant="black" height={40} />
                <GooglePlayBadge height={40} />
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
