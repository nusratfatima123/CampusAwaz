'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

/**
 * Tracking ID lookup form for students.
 */
export function TrackingLookup() {
  const router = useRouter();
  const [trackingId, setTrackingId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = trackingId.trim().toUpperCase();
    if (!trimmed) {
      setError('Please enter a tracking ID.');
      return;
    }

    setLoading(true);
    setError(null);

    // Navigate to the complaint detail page.
    router.push(`/complaints/${trimmed}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Tracking ID"
        placeholder="e.g. CA-FAST-2026-00001"
        value={trackingId}
        onChange={(e) => setTrackingId(e.target.value.toUpperCase())}
        leadingIcon={<Search className="h-4 w-4" />}
        error={error}
        autoComplete="off"
      />
      <Button type="submit" loading={loading} fullWidth>
        Track Complaint
      </Button>
    </form>
  );
}
