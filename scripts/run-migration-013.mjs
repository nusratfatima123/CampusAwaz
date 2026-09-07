import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

console.log('Using service role key');
const supabase = createClient(url, serviceKey);

async function main() {
  const roles = [
    { name: 'finance_officer', description: 'Finance Officer — handles financial complaints' },
    { name: 'admin_officer', description: 'Administration Officer — handles administration complaints' },
  ];

  for (const role of roles) {
    const { error } = await supabase
      .from('roles')
      .upsert(role, { onConflict: 'name' });

    if (error) {
      console.error(`${role.name}: FAILED — ${error.message}`);
    } else {
      console.log(`${role.name}: OK`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
