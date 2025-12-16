// Script to delete all storage files for a specific user
// Usage: node scripts/delete-user-storage.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const USER_ID = '2fa3b216-3073-45f5-afdc-d91f0707c0fa';
const BUCKET = 'cards';

async function deleteUserStorage() {
  console.log(`Deleting storage for user: ${USER_ID}`);
  console.log(`Bucket: ${BUCKET}\n`);

  let totalDeleted = 0;

  // List all items in user's folder
  const { data: folders, error: listError } = await supabase.storage
    .from(BUCKET)
    .list(USER_ID, { limit: 1000 });

  if (listError) {
    console.error('Error listing folders:', listError);
    return;
  }

  if (!folders || folders.length === 0) {
    console.log('No folders found for this user');
    return;
  }

  console.log(`Found ${folders.length} card folders to process...\n`);

  // Process in batches to avoid timeouts
  for (let i = 0; i < folders.length; i++) {
    const item = folders[i];
    const cardPath = `${USER_ID}/${item.name}`;

    // List files in card folder (front.jpg, back.jpg, etc.)
    const { data: cardFiles, error: cardListError } = await supabase.storage
      .from(BUCKET)
      .list(cardPath);

    if (cardListError) {
      console.error(`Error listing ${cardPath}:`, cardListError.message);
      continue;
    }

    if (cardFiles && cardFiles.length > 0) {
      // Delete all files in card folder
      const filePaths = cardFiles.map(f => `${cardPath}/${f.name}`);
      const { error: deleteError } = await supabase.storage
        .from(BUCKET)
        .remove(filePaths);

      if (deleteError) {
        console.error(`Error deleting files in ${cardPath}:`, deleteError.message);
      } else {
        totalDeleted += filePaths.length;
        // Progress update every 50 cards
        if ((i + 1) % 50 === 0 || i === folders.length - 1) {
          console.log(`Progress: ${i + 1}/${folders.length} folders processed (${totalDeleted} files deleted)`);
        }
      }
    }
  }

  console.log(`\n✅ Done! Deleted ${totalDeleted} files total.`);
  console.log('\nNow run the SQL in Supabase to delete the database records.');
}

deleteUserStorage().catch(console.error);
