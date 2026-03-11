import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function updateSubId() {
  const { data, error } = await supabase
    .from('user_credits')
    .update({ card_lover_subscription_id: 'sub_1T05NzHgM2Rh4o2Bbd9opiPG' })
    .eq('user_id', '48846a6b-26e1-4241-ab54-8fd5f0d6c4f0')
    .select('card_lover_subscription_id');

  if (error) console.error('Error:', error);
  else console.log('Updated:', JSON.stringify(data));
}

updateSubId();
