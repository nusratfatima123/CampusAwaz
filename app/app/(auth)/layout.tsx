import { redirect } from 'next/navigation';
import { NavShell } from '@/components/layout/NavShell';
import { getAuthContext, displayName } from '@/lib/auth';
import { primaryRole } from '@/lib/roles';
import { isVerified } from '@/lib/verification';

/**
 * Shell for every authenticated route.
 * The middleware already enforces the session; this is defence in depth and
 * also supplies the nav with identity details.
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, roles } = await getAuthContext();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <NavShell
        user={{
          name: displayName(profile, user),
          role: primaryRole(roles),
          universityName: profile?.universities?.name ?? null,
          verified: isVerified(profile),
          roles,
        }}
      />
      <main id="main" className="flex-1">
        {children}
      </main>
    </div>
  );
}
