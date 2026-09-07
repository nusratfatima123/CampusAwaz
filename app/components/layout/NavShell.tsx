'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Building2, LogOut, Menu, ShieldCheck, User, X } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Badge } from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/cn';
import { roleLabel, isStaff } from '@/lib/roles';
import type { RoleName } from '@/types/database';

export interface NavUser {
  name: string;
  role: RoleName;
  universityName: string | null;
  verified: boolean;
  roles?: RoleName[];
}

/** Role-aware application navbar for authenticated areas. */
export function NavShell({ user }: { user: NavUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Focus trap and Escape key for mobile menu.
  useEffect(() => {
    if (!mobileOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        return;
      }
      if (e.key === 'Tab' && mobileMenuRef.current) {
        const focusable = mobileMenuRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);

  // Fetch unread notification count on mount and periodically.
  useEffect(() => {
    let mounted = true;
    async function fetchCount() {
      try {
        const res = await fetch('/api/notifications/unread-count');
        if (res.ok) {
          const json = await res.json();
          if (mounted) setUnreadCount(json.count ?? 0);
        }
      } catch {
        // Silent
      }
    }
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const userRoles = user.roles ?? [user.role];
  const staffUser = isStaff(userRoles);

  const links = staffUser
    ? [
        ...(user.verified
          ? [
              {
                label: userRoles.includes('admin') ? 'Admin Dashboard' : 'Authority Dashboard',
                href: '/admin/dashboard',
              },
              { label: 'Analytics', href: '/admin/analytics' },
              ...(userRoles.includes('admin')
                ? [{ label: 'Authorities', href: '/admin/authorities' }]
                : []),
            ]
          : []),
        { label: 'Profile', href: '/profile' },
      ]
    : [
        { label: 'Dashboard', href: '/dashboard' },
        ...(user.verified ? [{ label: 'New Complaint', href: '/complaints/new' }] : []),
        ...(user.verified ? [{ label: 'Track', href: '/tracking' }] : []),
        ...(user.verified ? [{ label: 'Support', href: '/support' }] : []),
        ...(user.verified ? [] : [{ label: 'Verify', href: '/verify' }]),
        { label: 'Profile', href: '/profile' },
      ];

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const supabase = createClient();

      // Audit first: /api/audit resolves the actor from the session cookie, so
      // this must happen before signOut() clears it. Best-effort — a logging
      // failure must never prevent the user from signing out.
      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'user.logout' }),
      }).catch(() => undefined);

      await supabase.auth.signOut();
      router.replace('/');
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <nav className="container-page" aria-label="Application navigation">
        <div className="flex h-20 items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <Logo href="/dashboard" showTagline={false} />

            <ul className="hidden items-center gap-1 md:flex">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={isActive(link.href) ? 'page' : undefined}
                    className={cn(
                      'rounded-lg px-3 py-2 text-sm font-medium transition',
                      isActive(link.href)
                        ? 'bg-blue-50 text-blue-900'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-blue-900'
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Desktop identity + sign out */}
          <div className="hidden items-center gap-4 lg:flex">
            {/* Notification bell */}
            <Link
              href="/notifications"
              className="relative rounded-xl p-2 text-slate-600 transition hover:bg-slate-100 hover:text-blue-900"
              aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>

            <div className="flex flex-col items-end">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                {user.name}
                {user.verified ? (
                  <ShieldCheck
                    className="h-4 w-4 text-green-600"
                    aria-label="Verified account"
                  />
                ) : null}
              </span>
              {user.universityName ? (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Building2 className="h-3 w-3" aria-hidden="true" />
                  {user.universityName}
                </span>
              ) : null}
            </div>

            <Badge tone={user.verified ? 'info' : 'neutral'}>
              {roleLabel(user.role)}
            </Badge>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {signingOut ? 'Signing out…' : 'Logout'}
            </button>
          </div>

          <button
            type="button"
            className="rounded-xl p-2 text-slate-700 transition hover:bg-slate-100 lg:hidden"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile sheet */}
      {mobileOpen ? (
        <div ref={mobileMenuRef} className="border-t border-slate-200 bg-white lg:hidden">
          <div className="container-page space-y-4 py-5">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <User className="h-4 w-4 text-slate-400" aria-hidden="true" />
                {user.name}
              </p>
              {user.universityName ? (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <Building2 className="h-3 w-3" aria-hidden="true" />
                  {user.universityName}
                </p>
              ) : null}
              <div className="mt-3">
                <Badge tone={user.verified ? 'success' : 'neutral'}>
                  {user.verified ? 'Verified' : 'Not verified'} ·{' '}
                  {roleLabel(user.role)}
                </Badge>
              </div>
            </div>

            <div className="space-y-1">
              {/* Mobile notification link */}
              <Link
                href="/notifications"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center justify-between rounded-xl px-3 py-3 text-base font-medium transition',
                  pathname === '/notifications'
                    ? 'bg-blue-50 text-blue-900'
                    : 'text-slate-700 hover:bg-slate-50'
                )}
              >
                <span className="flex items-center gap-2">
                  <Bell className="h-4 w-4" aria-hidden="true" />
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>

              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'block rounded-xl px-3 py-3 text-base font-medium transition',
                    isActive(link.href)
                      ? 'bg-blue-50 text-blue-900'
                      : 'text-slate-700 hover:bg-slate-50'
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {signingOut ? 'Signing out…' : 'Logout'}
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
}
