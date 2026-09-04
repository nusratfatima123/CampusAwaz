import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createAuthorityRequest, getAuthorityRequests, canRequestAuthority } from '@/lib/authority';
import { AUTHORITY_REQUESTABLE_ROLES } from '@/lib/roles';
import type { RoleName } from '@/types/database';

/**
 * GET /api/authority/request
 * List the current user's authority requests.
 */
export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const requests = await getAuthorityRequests({ userId: user.id });
    return NextResponse.json({ requests });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch requests.';
    console.error('[authority/request] GET failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * POST /api/authority/request
 * Create a new authority request.
 */
export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('id, university_id, affiliation_status')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || profile.affiliation_status !== 'verified' || !profile.university_id) {
      return NextResponse.json(
        { error: 'You must be a verified user to request authority.' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { roleName, departmentId, statement, evidencePath } = body;

    if (!roleName || !statement) {
      return NextResponse.json(
        { error: 'roleName and statement are required.' },
        { status: 400 },
      );
    }

    if (!AUTHORITY_REQUESTABLE_ROLES.includes(roleName as RoleName)) {
      return NextResponse.json(
        { error: 'Invalid role.' },
        { status: 400 },
      );
    }

    if (statement.length < 50 || statement.length > 2000) {
      return NextResponse.json(
        { error: 'Statement must be between 50 and 2000 characters.' },
        { status: 400 },
      );
    }

    const eligibility = await canRequestAuthority(user.id, roleName as RoleName);
    if (!eligibility.eligible) {
      return NextResponse.json({ error: eligibility.reason }, { status: 400 });
    }

    const { data: roleRow } = await admin
      .from('roles')
      .select('id')
      .eq('name', roleName)
      .single();

    if (!roleRow) {
      return NextResponse.json({ error: 'Role not found.' }, { status: 404 });
    }

    const result = await createAuthorityRequest(
      {
        userId: user.id,
        universityId: profile.university_id,
        roleId: roleRow.id,
        departmentId: departmentId ?? null,
        statement,
        evidencePath: evidencePath ?? null,
      },
      request,
    );

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, request: result.request });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create request.';
    console.error('[authority/request] POST failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
