// Direct DB seed script
// Run with: npx tsx seed-data.mjs
import { seedCategories } from './server/db.ts';
import { seedRuleChapters } from './server/db.ts';
import { CATEGORY_SEED } from './server/seed-categories.ts';
import { RULE_CHAPTERS_SEED } from './server/seed-rules.ts';

async function main() {
  console.log('Seeding categories...');
  await seedCategories(CATEGORY_SEED);
  console.log('Categories seeded!');
  
  console.log('Seeding rule chapters...');
  await seedRuleChapters(RULE_CHAPTERS_SEED);
  console.log('Rule chapters seeded!');
  
  console.log('Done! Exiting...');
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
