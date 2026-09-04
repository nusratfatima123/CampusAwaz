import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('=== Account Summary ===\n');

  const { data: authData } = await db.auth.admin.listUsers();

  for (const user of authData.users) {
    const { data: profile } = await db
      .from('profiles')
      .select('*, universities(name, code)')
      .eq('id', user.id)
      .single();

    const { data: roles } = await db
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', user.id);

    const roleNames = roles?.map((r) => r.roles.name).join(', ') || 'none';

    console.log(`Email: ${user.email}`);
    console.log(`  Name: ${profile?.full_name || 'N/A'}`);
    console.log(`  University: ${profile?.universities?.name || 'N/A'} (${profile?.universities?.code || 'N/A'})`);
    console.log(`  Status: ${profile?.affiliation_status || 'N/A'}`);
    console.log(`  Roles: ${roleNames}`);
    console.log(`  Access: ${roleNames.includes('admin') ? 'Admin + Student' : 'Student only'}`);
    console.log('');
  }

  console.log('=== Universities in System ===\n');
  const { data: universities } = await db.from('universities').select('*').order('name');

  universities?.forEach((u) => {
    console.log(`- ${u.name} (${u.code})`);
  });
}

main().catch(console.error);
