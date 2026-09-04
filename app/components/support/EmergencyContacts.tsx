'use client';

import { Phone, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import type { EmergencyContact } from '@/types/database';

export function EmergencyContactsList({
  contacts,
}: {
  contacts: EmergencyContact[];
}) {
  if (contacts.length === 0) {
    return (
      <Card className="py-8 text-center">
        <Phone className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
        <p className="mt-3 text-sm text-slate-500">
          No emergency contacts available.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3" role="list" aria-label="Emergency contacts">
      {contacts.map((contact) => (
        <div
          key={contact.id}
          role="listitem"
          className="flex items-center gap-4 rounded-2xl border border-red-200 bg-red-50 p-4"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100">
            <AlertTriangle className="h-5 w-5 text-red-700" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-red-900">{contact.label}</p>
            {contact.description ? (
              <p className="mt-0.5 text-sm text-red-800">{contact.description}</p>
            ) : null}
          </div>
          <a
            href={`tel:${contact.phone}`}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
            aria-label={`Call ${contact.label} at ${contact.phone}`}
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            {contact.phone}
          </a>
        </div>
      ))}
    </div>
  );
}
