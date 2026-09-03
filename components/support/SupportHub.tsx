'use client';

import { useState } from 'react';
import {
  Heart,
  MessageCircle,
  HelpCircle,
  FileText,
  Phone,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { ResourceCard } from './ResourceCard';
import { EmergencyContactsList } from './EmergencyContacts';
import { CounselingForm } from './CounselingForm';
import { FaqAssistant } from './FaqAssistant';
import { cn } from '@/lib/cn';
import { SUPPORT_RESOURCE_LABELS } from '@/lib/constants';
import type {
  SupportResource,
  SupportResourceType,
  CounselingRequest,
  EmergencyContact,
  Policy,
} from '@/types/database';

type TabKey = 'resources' | 'counseling' | 'faq' | 'policies' | 'emergency';

const TABS: { key: TabKey; label: string; icon: typeof Heart }[] = [
  { key: 'resources', label: 'Resources', icon: Heart },
  { key: 'counseling', label: 'Counseling', icon: MessageCircle },
  { key: 'faq', label: 'FAQs', icon: HelpCircle },
  { key: 'policies', label: 'Policies', icon: FileText },
  { key: 'emergency', label: 'Emergency', icon: Phone },
];

interface SupportHubProps {
  resources: SupportResource[];
  counselingRequests: CounselingRequest[];
  emergencyContacts: EmergencyContact[];
  policies: Policy[];
}

export function SupportHub({
  resources,
  counselingRequests,
  emergencyContacts,
  policies,
}: SupportHubProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('resources');

  const groupedResources = resources.reduce<Record<string, SupportResource[]>>(
    (acc, resource) => {
      const type = resource.resource_type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(resource);
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-6">
      <div
        className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-1.5"
        role="tablist"
        aria-label="Support sections"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition',
                isActive
                  ? 'bg-white text-blue-900 shadow-sm'
                  : 'text-slate-600 hover:bg-white/60 hover:text-slate-800',
              )}
            >
              <tab.icon className="h-4 w-4" aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`panel-${activeTab}`} aria-label={TABS.find((t) => t.key === activeTab)?.label}>
        {activeTab === 'resources' && (
          <div className="space-y-6">
            {Object.keys(groupedResources).length === 0 ? (
              <Card className="py-10 text-center">
                <Heart className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
                <p className="mt-3 text-sm text-slate-500">
                  No support resources available at this time.
                </p>
              </Card>
            ) : (
              Object.entries(groupedResources).map(([type, items]) => (
                <div key={type}>
                  <h3 className="mb-3 text-base font-bold text-slate-900">
                    {SUPPORT_RESOURCE_LABELS[type] ?? type}
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {items.map((resource) => (
                      <ResourceCard key={resource.id} resource={resource} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'counseling' && (
          <CounselingForm existingRequests={counselingRequests} />
        )}

        {activeTab === 'faq' && <FaqAssistant />}

        {activeTab === 'policies' && (
          <div className="space-y-4">
            {policies.length === 0 ? (
              <Card className="py-10 text-center">
                <FileText className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
                <p className="mt-3 text-sm text-slate-500">
                  No policies available at this time.
                </p>
              </Card>
            ) : (
              policies.map((policy) => (
                <Card key={policy.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">
                        {policy.title}
                      </h3>
                      {policy.description ? (
                        <p className="mt-1 text-sm leading-relaxed text-slate-600">
                          {policy.description}
                        </p>
                      ) : null}
                      {policy.effective_date ? (
                        <p className="mt-2 text-xs text-slate-400">
                          Effective:{' '}
                          {new Date(policy.effective_date).toLocaleDateString()}
                        </p>
                      ) : null}
                    </div>
                    {policy.document_url ? (
                      <a
                        href={policy.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-slate-50"
                      >
                        View Document
                      </a>
                    ) : null}
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === 'emergency' && (
          <EmergencyContactsList contacts={emergencyContacts} />
        )}
      </div>
    </div>
  );
}
