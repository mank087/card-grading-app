import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function setCardLoverStatus() {
  const targetEmail = 'dmankiewicz@gmail.com';
  
  // Try to find user by querying with pagination
  let allUsers: any[] = [];
  let page = 1;
  const perPage = 1000;
  
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage
    });
    
    if (error) {
      console.error('Error listing users:', error);
      return;
    }
    
    allUsers = allUsers.concat(data.users);
    
    if (data.users.length < perPage) break;
    page++;
  }
  
  console.log('Total users found:', allUsers.length);
  
  const user = allUsers.find(u => u.email?.toLowerCase() === targetEmail.toLowerCase());
  
  if (!user) {
    console.error('User not found with email:', targetEmail);
    // Show some emails for debugging
    console.log('Sample emails in system:');
    allUsers.slice(0, 5).forEach(u => console.log(' -', u.email));
    return;
  }
  
  console.log('Found user:', user.id, user.email);
  
  // Update user_credits to set Card Lovers status
  const { data, error } = await supabase
    .from('user_credits')
    .update({
      is_card_lover: true,
      card_lover_plan: 'monthly',
      card_lover_subscribed_at: new Date().toISOString(),
      card_lover_current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      card_lover_months_active: 1,
      show_card_lover_badge: true
    })
    .eq('user_id', user.id)
    .select();
  
  if (error) {
    console.error('Error updating user_credits:', error);
    return;
  }
  
  console.log('Successfully set Card Lovers status!');
  console.log('Updated record:', JSON.stringify(data, null, 2));
}

setCardLoverStatus();
