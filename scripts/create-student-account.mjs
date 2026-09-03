import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const authClient = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EMAIL = 'amnazafar943@gmail.com';
const PASSWORD = 'Student@123';
const FULL_NAME = 'Amna Zafar';

async function main() {
  console.log('Creating student account...');

  const { data: authData, error: authError } = await authClient.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });

  if (authError) {
    if (authError.message.includes('already')) {
      console.log('User already exists, finding user ID...');
      const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
        email: EMAIL,
        password: PASSWORD,
      });
      if (signInError || !signInData.user) {
        console.error('Could not find existing user:', signInError);
        process.exit(1);
      }
      authData.user = signInData.user;
    } else {
      console.error('Error creating user:', authError);
      process.exit(1);
    }
  }

  const userId = authData.user.id;
  console.log(`✓ User created/found: ${EMAIL}`);
  console.log(`  ID: ${userId}`);

  console.log('\nGetting Arid University...');
  const { data: university, error: uniError } = await db
    .from('universities')
    .select('id')
    .eq('code', 'ARID')
    .single();

  if (uniError || !university) {
    console.error('Could not find Arid University:', uniError);
    process.exit(1);
  }

  console.log(`✓ Found Arid University: ${university.id}`);

  console.log('\nCreating student profile...');
  const { error: profileError } = await db.from('profiles').upsert(
    {
      id: userId,
      full_name: FULL_NAME,
      university_id: university.id,
      affiliation_status: 'verified',
      student_type: 'current_student',
      privacy_mode: 'identified',
    },
    { onConflict: 'id' }
  );

  if (profileError) {
    console.error('Error creating profile:', profileError);
    process.exit(1);
  }

  console.log('✓ Student profile created');
  console.log(`  Name: ${FULL_NAME}`);
  console.log(`  University: PMAS Arid Agriculture University`);
  console.log(`  Status: Verified Student`);
  console.log(`  Role: Student (no admin access)`);

  console.log('\n✓ Student account ready!');
  console.log(`  Email: ${EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
