import { createAdminClient } from './supabase/admin';
import { audit, AUDIT_EVENTS } from './audit';
import type { Notification, NotificationType } from '@/types/database';

/**
 * Server-side notification helpers.
 *
 * SERVER ONLY — every function uses the service-role client. Ownership checks
 * are performed explicitly since the service role bypasses RLS.
 */

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  complaintId?: string;
  title: string;
  body?: string;
  trackingId?: string;
}

/**
 * Creates a notification row and returns its id. Never throws — notification
 * failures are logged but must not break the calling workflow.
 */
export async function createNotification(
  input: CreateNotificationInput,
  request?: Request,
): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('notifications')
      .insert({
        user_id: input.userId,
        type: input.type,
        complaint_id: input.complaintId ?? null,
        title: input.title,
        body: input.body ?? null,
        tracking_id: input.trackingId ?? null,
      })
      .select('id')
      .single();

    if (error || !data) {
      console.error('[notifications] insert failed:', error?.message);
      return null;
    }

    await audit(AUDIT_EVENTS.NOTIFICATION_CREATED, {
      userId: input.userId,
      actor: 'system',
      metadata: {
        notification_id: data.id,
        type: input.type,
        complaint_id: input.complaintId,
        tracking_id: input.trackingId,
      },
      request,
    });

    return data.id;
  } catch (err) {
    console.error(
      '[notifications] unexpected error:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/** Notifications for one user, newest first, limited. */
export async function getUserNotifications(
  userId: string,
  limit = 50,
): Promise<Notification[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('notifications')
    .select('id, user_id, type, complaint_id, title, body, tracking_id, is_read, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[notifications] list failed:', error.message);
    return [];
  }
  return (data ?? []) as Notification[];
}

/** Marks a single notification as read, enforcing ownership. */
export async function markNotificationRead(
  notificationId: string,
  userId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) {
    console.error('[notifications] mark read failed:', error.message);
  }
}

/** Marks all unread notifications for a user as read. */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('[notifications] mark all read failed:', error.message);
  }
}

/** Count of unread notifications for one user. */
export async function getUnreadCount(userId: string): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('[notifications] unread count failed:', error.message);
    return 0;
  }
  return count ?? 0;
}
