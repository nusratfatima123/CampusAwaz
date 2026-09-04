import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

// Auth client for sign-in
const authClient = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Separate DB client (never used for auth)
const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EMAIL = 'fatimanusrat496@gmail.com';
const PASSWORD = 'Demo@12345';
const FULL_NAME = 'Fatima Nusrat';

async function main() {
  // Sign in to get user ID
  const { data: signInData, error: signInErr } = await authClient.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });

  let userId;
  if (signInErr) {
    console.log('Sign-in failed:', signInErr.message);
    process.exit(1);
  }
  userId = signInData.user.id;
  console.log('User ID:', userId);

  // Confirm email and update metadata via admin
  await authClient.auth.admin.updateUserById(userId, {
    email_confirm: true,
    user_metadata: { full_name: FULL_NAME },
  });

  // Get first university
  const { data: uni, error: uniErr } = await db.from('universities').select('id').limit(1).single();
  if (uniErr || !uni) {
    console.error('No university found', uniErr?.message);
    process.exit(1);
  }

  // Upsert profile
  const { error: profileErr } = await db.from('profiles').upsert({
    id: userId,
    full_name: FULL_NAME,
    university_id: uni.id,
    student_type: 'current_student',
    affiliation_status: 'verified',
  });
  if (profileErr) {
    console.error('Profile error:', profileErr.message);
    process.exit(1);
  }
  console.log('Profile upserted');

  // Get admin role
  const { data: adminRole } = await db
    .from('roles')
    .select('id')
    .eq('name', 'admin')
    .limit(1)
    .single();

  if (adminRole) {
    // Check if role already exists
    const { data: existingRole } = await db
      .from('user_roles')
      .select('user_id')
      .eq('user_id', userId)
      .eq('role_id', adminRole.id)
      .maybeSingle();

    if (existingRole) {
      console.log('Admin role already assigned');
    } else {
      const { error: roleErr } = await db.from('user_roles').insert({
        user_id: userId,
        role_id: adminRole.id,
        university_id: uni.id,
      });
      if (roleErr) {
        console.error('Role insert error:', roleErr.message);
      } else {
        console.log('Admin role assigned');
      }
    }
  } else {
    console.log('No admin role found — skipping');
  }

  console.log('\nLogin credentials:');
  console.log('  Email: fatimanusrat496@gmail.com');
  console.log('  Password: Demo@12345');
  process.exit(0);
}

main();
