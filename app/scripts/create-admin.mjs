import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ADMIN = {
  email: 'admin@campusawaz.pk',
  password: 'Admin@12345',
  fullName: 'CampusAwaz Admin',
  role: 'admin',
};

async function main() {
  console.log('Seeding admin account...\n');

  const { data: existingUsers } = await db.auth.admin.listUsers();
  const found = existingUsers?.users?.find((u) => u.email === ADMIN.email);

  let userId;

  if (found) {
    userId = found.id;
    console.log(`Admin user already exists: ${userId}`);

    const { error: resetErr } = await db.auth.admin.updateUserById(userId, {
      password: ADMIN.password,
    });
    if (resetErr) {
      console.error(`Failed to reset password: ${resetErr.message}`);
      return;
    }
    console.log('Password reset to default.');
  } else {
    const { data: signUpData, error: signUpErr } = await db.auth.admin.createUser({
      email: ADMIN.email,
      password: ADMIN.password,
      email_confirm: true,
      user_metadata: { full_name: ADMIN.fullName },
    });

    if (signUpErr) {
      console.error(`Sign-up error: ${signUpErr.message}`);
      return;
    }
    userId = signUpData.user.id;
    console.log(`Created auth user: ${userId}`);
  }

  // Prefer the university that has complaints, so admin can manage them.
  let uni;
  const { data: complaintUnis } = await db
    .from('complaints')
    .select('university_id')
    .limit(1);
  if (complaintUnis?.[0]?.university_id) {
    const { data: matched } = await db
      .from('universities')
      .select('id')
      .eq('id', complaintUnis[0].university_id)
      .single();
    uni = matched;
  }
  if (!uni) {
    const { data: first } = await db.from('universities').select('id').limit(1).single();
    uni = first;
  }
  if (!uni) {
    console.error('No university found in database — seed universities first.');
    return;
  }

  const { error: profileErr } = await db.from('profiles').upsert({
    id: userId,
    full_name: ADMIN.fullName,
    university_id: uni.id,
    affiliation_status: 'verified',
  });
  if (profileErr) {
    console.error(`Profile error: ${profileErr.message}`);
    return;
  }
  console.log('Profile upserted.');

  const { data: roleRow } = await db
    .from('roles')
    .select('id')
    .eq('name', ADMIN.role)
    .limit(1)
    .single();

  if (!roleRow) {
    console.error('Role "admin" not found in roles table.');
    return;
  }

  const { data: existingRole } = await db
    .from('user_roles')
    .select('user_id')
    .eq('user_id', userId)
    .eq('role_id', roleRow.id)
    .maybeSingle();

  if (existingRole) {
    console.log('Admin role already assigned.');
  } else {
    const { error: roleErr } = await db.from('user_roles').insert({
      user_id: userId,
      role_id: roleRow.id,
      university_id: uni.id,
    });
    if (roleErr) {
      console.error(`Role insert error: ${roleErr.message}`);
      return;
    }
    console.log('Admin role assigned.');
  }

  console.log('\n========================================');
  console.log('Admin login credentials:');
  console.log(`  Email:    ${ADMIN.email}`);
  console.log(`  Password: ${ADMIN.password}`);
  console.log('========================================\n');

  process.exit(0);
}

main();
