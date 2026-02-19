// Automated project creation and full pipeline test
// Run with: npx tsx test-create-projects.mjs

import { createProject, getProjectById, getLatestScript, getLatestGrid } from './server/db.ts';
import { CATEGORY_SEED } from './server/seed-categories.ts';

// We need to create projects directly via DB since we don't have admin cookie
async function main() {
  const projects = [
    {
      title: "午夜飙车 - 城市追逐",
      l1Id: "narrative",
      l2Id: "narrative.chase",
      l3Id: "narrative.chase.car",
      duration: "30",
    },
    {
      title: "樱花树下的告白",
      l1Id: "narrative",
      l2Id: "narrative.dialogue",
      l3Id: "narrative.dialogue.confession",
      duration: "45",
    },
    {
      title: "废弃医院的夜晚",
      l1Id: "narrative",
      l2Id: "narrative.suspense",
      l3Id: "narrative.suspense.horror",
      duration: "30",
    },
  ];

  for (const p of projects) {
    try {
      const id = await createProject({ ...p, createdBy: 1 });
      console.log(`✅ Created project: "${p.title}" (ID: ${id}, Duration: ${p.duration}s, L3: ${p.l3Id})`);
    } catch (e) {
      console.error(`❌ Failed to create "${p.title}":`, e.message);
    }
  }

  console.log('\nDone! Now use the UI to generate scripts, anchors, and grids for these projects.');
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
