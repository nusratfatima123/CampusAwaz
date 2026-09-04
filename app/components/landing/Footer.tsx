import Link from 'next/link';
import { Facebook, Instagram, Linkedin, Phone, LifeBuoy } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';

const EMERGENCY_CONTACTS = [
  { label: 'Police Emergency', value: '15' },
  { label: 'Rescue Service', value: '1122' },
  { label: 'Women Helpline', value: '1099' },
];

const HELP_LINKS = [
  { label: 'Know Your Rights', href: '/#resources' },
  { label: 'University Policies', href: '/#resources' },
  { label: 'Student FAQs', href: '/#resources' },
  { label: 'How It Works', href: '/#how-it-works' },
];

const SOCIALS = [
  { label: 'CampusAwaz on Facebook', Icon: Facebook },
  { label: 'CampusAwaz on Instagram', Icon: Instagram },
  { label: 'CampusAwaz on LinkedIn', Icon: Linkedin },
];

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-gray-50">
      <div className="container-page py-14 md:py-16">
        <div className="grid gap-12 md:grid-cols-3">
          {/* Brand */}
          <div>
            <Logo />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-slate-600">
              A safe, anonymous and effective platform for university students across
              Pakistan.
            </p>
            <div className="mt-6 flex gap-2">
              {SOCIALS.map(({ label, Icon }) => (
                <button
                  key={label}
                  type="button"
                  aria-label={label}
                  className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:border-slate-300 hover:text-blue-900 hover:shadow-sm"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>

          {/* Emergency contacts */}
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-900">
              <Phone className="h-4 w-4 text-red-600" aria-hidden="true" />
              Emergency Contacts
            </h2>
            <ul className="mt-5 space-y-3">
              {EMERGENCY_CONTACTS.map((contact) => (
                <li
                  key={contact.label}
                  className="flex items-center justify-between gap-4 text-sm"
                >
                  <span className="text-slate-600">{contact.label}</span>
                  <a
                    href={`tel:${contact.value}`}
                    className="rounded-lg font-semibold text-blue-900 hover:underline"
                  >
                    {contact.value}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Help center */}
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-900">
              <LifeBuoy className="h-4 w-4 text-blue-900" aria-hidden="true" />
              Help Center
            </h2>
            <ul className="mt-5 space-y-3">
              {HELP_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="rounded-lg text-sm text-slate-600 transition hover:text-blue-900"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-slate-200 pt-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} CampusAwaz. All rights reserved.</p>
          <p>Built for students, with students.</p>
        </div>
      </div>
    </footer>
  );
}
