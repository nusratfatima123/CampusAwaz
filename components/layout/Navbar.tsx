'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronDown, Menu, X } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { ButtonLink } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'How It Works', href: '/#how-it-works' },
  { label: 'Safety', href: '/#categories' },
  { label: 'Student Rights', href: '/#resources' },
  { label: 'Universities', href: '/register' },
];

const RESOURCE_LINKS = [
  { label: 'Know Your Rights', href: '/#resources' },
  { label: 'University Policies', href: '/#resources' },
  { label: 'Student FAQs', href: '/#resources' },
];

/** Public marketing navbar — sticky, with a mobile sheet. */
export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [language, setLanguage] = useState<'EN' | 'UR'>('EN');
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Escape closes the Resources dropdown.
  useEffect(() => {
    if (!resourcesOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setResourcesOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [resourcesOpen]);

  // Focus trap and Escape for mobile menu.
  useEffect(() => {
    if (!mobileOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        return;
      }
      if (e.key === 'Tab' && mobileMenuRef.current) {
        const focusable = mobileMenuRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
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
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <nav className="container-page" aria-label="Main navigation">
        <div className="flex h-20 items-center justify-between gap-4">
          <Logo />

          {/* Desktop links */}
          <ul className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-blue-900"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li
              className="relative"
              onMouseEnter={() => setResourcesOpen(true)}
              onMouseLeave={() => setResourcesOpen(false)}
            >
              <button
                type="button"
                onClick={() => setResourcesOpen((open) => !open)}
                aria-expanded={resourcesOpen}
                aria-haspopup="true"
                className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-blue-900"
              >
                Resources
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform',
                    resourcesOpen && 'rotate-180'
                  )}
                  aria-hidden="true"
                />
              </button>
              {resourcesOpen ? (
                <div className="absolute left-0 top-full w-56 pt-2">
                  <ul className="rounded-xl border border-slate-200 bg-white p-2 shadow-md">
                    {RESOURCE_LINKS.map((link) => (
                      <li key={link.label}>
                        <Link
                          href={link.href}
                          className="block rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-blue-900"
                          onClick={() => setResourcesOpen(false)}
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          </ul>

          {/* Desktop actions */}
          <div className="hidden items-center gap-3 lg:flex">
            <LanguageToggle value={language} onChange={setLanguage} />
            <ButtonLink href="/login" variant="secondary" size="sm">
              Login
            </ButtonLink>
            <ButtonLink href="/register" size="sm">
              Get Started
            </ButtonLink>
          </div>

          {/* Mobile trigger */}
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
          <div className="container-page space-y-1 py-4">
            {[...NAV_LINKS, ...RESOURCE_LINKS].map((link) => (
              <Link
                key={`${link.label}-${link.href}`}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block rounded-xl px-3 py-3 text-base font-medium text-slate-700 transition hover:bg-slate-50 hover:text-blue-900"
              >
                {link.label}
              </Link>
            ))}

            <div className="flex items-center justify-between gap-3 pt-4">
              <LanguageToggle value={language} onChange={setLanguage} />
            </div>

            <div className="grid gap-3 pt-2">
              <ButtonLink href="/login" variant="secondary" fullWidth>
                Login
              </ButtonLink>
              <ButtonLink href="/register" fullWidth>
                Get Started
              </ButtonLink>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

/**
 * Visual-only language toggle. Sprint 1 ships no i18n wiring — the control
 * exists so the nav matches the target design.
 */
function LanguageToggle({
  value,
  onChange,
}: {
  value: 'EN' | 'UR';
  onChange: (next: 'EN' | 'UR') => void;
}) {
  return (
    <div
      className="flex items-center rounded-xl border border-slate-200 p-0.5"
      role="group"
      aria-label="Language (display only in this release)"
    >
      {(['EN', 'UR'] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => onChange(code)}
          aria-pressed={value === code}
          className={cn(
            'rounded-lg px-2.5 py-1 text-xs font-semibold transition',
            value === code
              ? 'bg-blue-900 text-white'
              : 'text-slate-500 hover:text-slate-800'
          )}
        >
          {code === 'EN' ? 'EN' : 'اردو'}
        </button>
      ))}
    </div>
  );
}
