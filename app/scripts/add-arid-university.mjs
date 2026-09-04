import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const UNIVERSITY_NAME = 'PMAS Arid Agriculture University';
const UNIVERSITY_CODE = 'ARID';
const USER_EMAIL = 'fatimanusrat496@gmail.com';

async function main() {
  console.log('Adding PMAS Arid Agriculture University...');

  const { data: university, error: uniError } = await db
    .from('universities')
    .upsert(
      {
        name: UNIVERSITY_NAME,
        code: UNIVERSITY_CODE,
      },
      { onConflict: 'code' }
    )
    .select()
    .single();

  if (uniError) {
    console.error('Error adding university:', uniError);
    process.exit(1);
  }

  console.log(`✓ University added: ${university.name} (${university.code})`);
  console.log(`  ID: ${university.id}`);

  console.log('\nUpdating user profile...');

  const { data: authData, error: authError } = await db.auth.admin.listUsers();
  if (authError) {
    console.error('Error listing users:', authError);
    process.exit(1);
  }

  const user = authData.users.find((u) => u.email === USER_EMAIL);
  if (!user) {
    console.error('User not found:', USER_EMAIL);
    process.exit(1);
  }

  const { error: profileError } = await db
    .from('profiles')
    .update({ university_id: university.id })
    .eq('id', user.id);

  if (profileError) {
    console.error('Error updating profile:', profileError);
    process.exit(1);
  }

  console.log(`✓ Profile updated for ${USER_EMAIL}`);
  console.log(`  Now affiliated with: ${university.name}`);
  console.log('\n✓ All changes complete!');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
