import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: authData } = await db.auth.admin.listUsers();
  const user = authData.users.find((u) => u.email === 'fatimanusrat496@gmail.com');

  const { data: profile, error } = await db
    .from('profiles')
    .select('*, universities(name, code)')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log('Current profile:');
  console.log(`  Name: ${profile.full_name}`);
  console.log(`  University ID: ${profile.university_id}`);
  console.log(`  University: ${profile.universities?.name} (${profile.universities?.code})`);
  console.log(`  Status: ${profile.affiliation_status}`);
}

main().catch(console.error);
