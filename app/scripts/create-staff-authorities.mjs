import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const authClient = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const STAFF_ACCOUNTS = [
  {
    email: 'hod@campusawaz.pk',
    password: 'Hod@12345',
    fullName: 'Dr. Ahmad Khan',
    role: 'hod',
    label: 'Head of Department',
  },
  {
    email: 'proctor@campusawaz.pk',
    password: 'Proctor@12345',
    fullName: 'Mr. Tariq Mehmood',
    role: 'proctor',
    label: 'Proctor',
  },
  {
    email: 'femalefocal@campusawaz.pk',
    password: 'Focal@12345',
    fullName: 'Ms. Ayesha Siddiqua',
    role: 'female_focal_person',
    label: 'Female Focal Person',
  },
  {
    email: 'warden@campusawaz.pk',
    password: 'Warden@12345',
    fullName: 'Mr. Imran Ali',
    role: 'hostel_warden',
    label: 'Hostel Warden',
  },
  {
    email: 'counselor@campusawaz.pk',
    password: 'Counsel@12345',
    fullName: 'Dr. Sana Malik',
    role: 'counselor',
    label: 'Counselor',
  },
];

async function createStaffAccount(account) {
  console.log(`\n--- Creating ${account.label} ---`);

  const { data: existingUser } = await authClient.auth.admin.listUsers();
  const found = existingUser?.users?.find((u) => u.email === account.email);

  let userId;

  if (found) {
    userId = found.id;
    console.log(`  User already exists: ${userId}`);
  } else {
    const { data: signUpData, error: signUpErr } = await authClient.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: { full_name: account.fullName },
    });

    if (signUpErr) {
      console.error(`  Sign-up error: ${signUpErr.message}`);
      return;
    }
    userId = signUpData.user.id;
    console.log(`  Created auth user: ${userId}`);
  }

  // Prefer the university that has complaints, so staff can manage them.
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
    console.error('  No university found');
    return;
  }

  const { error: profileErr } = await db.from('profiles').upsert({
    id: userId,
    full_name: account.fullName,
    university_id: uni.id,
    affiliation_status: 'verified',
  });
  if (profileErr) {
    console.error(`  Profile error: ${profileErr.message}`);
    return;
  }
  console.log('  Profile upserted');

  const { data: roleRow } = await db
    .from('roles')
    .select('id')
    .eq('name', account.role)
    .limit(1)
    .single();

  if (!roleRow) {
    console.log(`  Role "${account.role}" not found in roles table — skipping`);
    return;
  }

  const { data: existingRole } = await db
    .from('user_roles')
    .select('user_id')
    .eq('user_id', userId)
    .eq('role_id', roleRow.id)
    .maybeSingle();

  if (existingRole) {
    console.log(`  ${account.label} role already assigned`);
  } else {
    const { error: roleErr } = await db.from('user_roles').insert({
      user_id: userId,
      role_id: roleRow.id,
      university_id: uni.id,
    });
    if (roleErr) {
      console.error(`  Role insert error: ${roleErr.message}`);
    } else {
      console.log(`  ${account.label} role assigned`);
    }
  }
}

async function main() {
  console.log('Seeding staff authorities...\n');

  for (const account of STAFF_ACCOUNTS) {
    await createStaffAccount(account);
  }

  console.log('\n========================================');
  console.log('Staff authority login credentials:');
  console.log('========================================');
  for (const account of STAFF_ACCOUNTS) {
    console.log(`  ${account.label}:`);
    console.log(`    Email:    ${account.email}`);
    console.log(`    Password: ${account.password}`);
  }
  console.log('========================================\n');

  process.exit(0);
}

main();
