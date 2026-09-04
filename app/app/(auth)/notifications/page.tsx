import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Bell } from 'lucide-react';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { getAuthContext } from '@/lib/auth';
import { isVerified } from '@/lib/verification';
import { getUserNotifications } from '@/lib/notifications';

export const metadata: Metadata = {
  title: 'Notifications',
  description: 'View your complaint updates and notifications.',
};

export const dynamic = 'force-dynamic';

/**
 * Notification center page: list of all notifications, newest first.
 */
export default async function NotificationsPage() {
  const { user, profile } = await getAuthContext();

  if (!user) redirect('/login');
  if (!isVerified(profile)) redirect('/pending');

  const notifications = await getUserNotifications(user.id, 50);

  return (
    <div className="container-page py-10 md:py-14">
      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          <Bell className="h-6 w-6 text-blue-900" aria-hidden="true" />
          Notifications
        </h1>
        <p className="mt-2 text-base text-slate-600">
          Stay updated on your complaint progress.
        </p>
      </div>

      <NotificationCenter
        initialNotifications={notifications.map((n) => ({
          id: n.id,
          type: n.type,
          complaint_id: n.complaint_id,
          title: n.title,
          body: n.body,
          tracking_id: n.tracking_id,
          is_read: n.is_read,
          created_at: n.created_at,
        }))}
      />
    </div>
  );
}
