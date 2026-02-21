/**
 * Integration Test: 3 Test Cases for Grid & Prompt Generation
 * 
 * Runs against the local dev server using the same session as the browser.
 * Each case: Create Project → Generate Script → Generate Anchors → Generate Grid → Generate Prompt
 * 
 * Usage: node server/integration-test.mjs [baseUrl]
 */

const BASE_URL = process.argv[2] || 'http://localhost:3000';

// ============================================================
// 3 Test Cases
// ============================================================
const TEST_CASES = [
  {
    name: "Case 1: 咖啡馆浪漫邂逅 (15s短片)",
    project: {
      title: "集成测试 - 咖啡馆浪漫邂逅",
      l1Id: "narrative",
      l2Id: "narrative.romance",
      l3Id: "narrative.romance.firstmeet",
      duration: "15",
    },
    additionalContext: "温暖的午后，男女主角在咖啡馆偶遇，目光交汇的瞬间",
  },
  {
    name: "Case 2: 赛博朋克追逐 (30s中等时长)",
    project: {
      title: "集成测试 - 赛博朋克追逐",
      l1Id: "scifi",
      l2Id: "scifi.cyberpunk",
      l3Id: "scifi.cyberpunk.chase",
      duration: "30",
    },
    additionalContext: "霓虹灯闪烁的未来城市，主角在高楼间穿梭逃亡",
  },
  {
    name: "Case 3: 武术格斗 (60s长片多Grid)",
    project: {
      title: "集成测试 - 武术格斗对决",
      l1Id: "sports",
      l2Id: "sports.martial",
      l3Id: "sports.martial.kungfu",
      duration: "60",
    },
    additionalContext: "古代武林大会，两位高手在擂台上的终极对决",
  },
];

// ============================================================
// Helpers
// ============================================================
async function trpcMutation(path, input) {
  const url = `${BASE_URL}/api/trpc/${path}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ json: input }),
  });
  const data = await resp.json();
  if (data.error) {
    throw new Error(`tRPC error [${path}]: ${JSON.stringify(data.error)}`);
  }
  return data.result?.data?.json;
}

async function trpcQuery(path, input) {
  const params = input ? `?input=${encodeURIComponent(JSON.stringify({ json: input }))}` : '';
  const url = `${BASE_URL}/api/trpc/${path}${params}`;
  const resp = await fetch(url);
  const data = await resp.json();
  if (data.error) {
    throw new Error(`tRPC error [${path}]: ${JSON.stringify(data.error)}`);
  }
  return data.result?.data?.json;
}

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function logResult(label, ok, detail = '') {
  const icon = ok ? '✅' : '❌';
  console.log(`  ${icon} ${label}${detail ? ': ' + detail : ''}`);
}

// ============================================================
// Run a single test case
// ============================================================
async function runTestCase(tc, index) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 Test ${index + 1}: ${tc.name}`);
  console.log(`${'='.repeat(60)}`);

  const results = {
    name: tc.name,
    projectId: null,
    steps: {},
    success: true,
    errors: [],
  };

  // Step 1: Create Project
  log('Step 1: Creating project...');
  try {
    const createResult = await trpcMutation('project.create', tc.project);
    results.projectId = createResult.id;
    results.steps.create = { ok: true, projectId: createResult.id };
    logResult('Project created', true, `ID=${createResult.id}`);
  } catch (e) {
    results.steps.create = { ok: false, error: e.message };
    results.success = false;
    results.errors.push(`Create: ${e.message}`);
    logResult('Project created', false, e.message);
    return results;
  }

  const projectId = results.projectId;

  // Step 2: Generate Script
  log('Step 2: Generating script (LLM call, may take 30-60s)...');
  try {
    const scriptResult = await trpcMutation('script.generate', {
      projectId,
      additionalContext: tc.additionalContext,
    });
    const frameCount = scriptResult.script?.frames?.length ?? 0;
    const charCount = scriptResult.script?.characters?.length ?? 0;
    const sceneCount = scriptResult.script?.scenes?.length ?? 0;
    results.steps.script = {
      ok: true,
      version: scriptResult.version,
      frameCount,
      charCount,
      sceneCount,
    };
    logResult('Script generated', true, `${frameCount} frames, ${charCount} chars, ${sceneCount} scenes, v${scriptResult.version}`);
  } catch (e) {
    results.steps.script = { ok: false, error: e.message };
    results.success = false;
    results.errors.push(`Script: ${e.message}`);
    logResult('Script generated', false, e.message);
    return results;
  }

  // Step 3: Generate Anchors
  log('Step 3: Generating anchors (image gen, may take 30-90s)...');
  try {
    const anchorResult = await trpcMutation('anchor.generate', { projectId });
    const total = anchorResult.anchors?.length ?? 0;
    const withImages = anchorResult.anchors?.filter(a => a.imageUrl).length ?? 0;
    results.steps.anchor = {
      ok: true,
      total,
      withImages,
      anchors: anchorResult.anchors?.map(a => ({
        type: a.type,
        name: a.name,
        hasImage: !!a.imageUrl,
      })),
    };
    logResult('Anchors generated', true, `${withImages}/${total} with images`);
  } catch (e) {
    results.steps.anchor = { ok: false, error: e.message };
    results.success = false;
    results.errors.push(`Anchor: ${e.message}`);
    logResult('Anchors generated', false, e.message);
    // Continue to grid even if anchor images fail
  }

  // Step 4: Generate Grid
  log('Step 4: Generating grid (image gen, may take 30-120s)...');
  try {
    const gridResult = await trpcMutation('grid.generate', { projectId });
    const pageCount = gridResult.pages?.length ?? 0;
    const hasImages = gridResult.pages?.filter(p => p.gridImageUrl).length ?? 0;
    results.steps.grid = {
      ok: true,
      gridId: gridResult.gridId,
      totalPanels: gridResult.totalPanels,
      totalPages: gridResult.totalPages,
      pagesWithImages: hasImages,
      firstPageUrl: gridResult.gridImageUrl,
      pages: gridResult.pages?.map(p => ({
        pageIndex: p.pageIndex,
        rows: p.rows,
        cols: p.cols,
        hasImage: !!p.gridImageUrl,
        imageUrl: p.gridImageUrl,
      })),
    };
    logResult('Grid generated', true, `${hasImages}/${pageCount} pages with images, ${gridResult.totalPanels} total panels`);
  } catch (e) {
    results.steps.grid = { ok: false, error: e.message };
    results.success = false;
    results.errors.push(`Grid: ${e.message}`);
    logResult('Grid generated', false, e.message);
  }

  // Step 5: Generate Prompts
  log('Step 5: Generating prompts (LLM call, may take 30-60s)...');
  try {
    const promptResult = await trpcMutation('prompt.generate', { projectId });
    const promptCount = promptResult.prompts?.length ?? 0;
    const models = [...new Set(promptResult.prompts?.map(p => p.model) ?? [])];
    results.steps.prompt = {
      ok: true,
      promptCount,
      models,
      samplePrompt: promptResult.prompts?.[0],
    };
    logResult('Prompts generated', true, `${promptCount} prompts, models: ${models.join(', ')}`);
  } catch (e) {
    results.steps.prompt = { ok: false, error: e.message };
    results.success = false;
    results.errors.push(`Prompt: ${e.message}`);
    logResult('Prompts generated', false, e.message);
  }

  // Step 6: Verify project state
  log('Step 6: Verifying final project state...');
  try {
    const project = await trpcQuery('project.get', { id: projectId });
    results.steps.verify = {
      ok: true,
      status: project.project?.status,
      hasScript: !!project.script,
      anchorCount: project.anchors?.length ?? 0,
      gridPageCount: project.gridPages?.length ?? 0,
      panelCount: project.panels?.length ?? 0,
      promptCount: project.prompts?.length ?? 0,
    };
    logResult('Project verified', true, 
      `status=${project.project?.status}, ` +
      `script=${!!project.script}, ` +
      `anchors=${project.anchors?.length ?? 0}, ` +
      `gridPages=${project.gridPages?.length ?? 0}, ` +
      `panels=${project.panels?.length ?? 0}, ` +
      `prompts=${project.prompts?.length ?? 0}`
    );
  } catch (e) {
    results.steps.verify = { ok: false, error: e.message };
    logResult('Project verified', false, e.message);
  }

  return results;
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log('🚀 Integration Test: 3 Test Cases for Grid & Prompt Generation');
  console.log(`📡 Base URL: ${BASE_URL}`);
  console.log(`📅 Time: ${new Date().toISOString()}`);

  // Check auth first
  try {
    const me = await trpcQuery('auth.me');
    if (!me) {
      console.error('❌ Not authenticated. Please login via browser first.');
      process.exit(1);
    }
    console.log(`👤 Authenticated as: ${me.name} (${me.email})`);
  } catch (e) {
    console.error('❌ Auth check failed:', e.message);
    process.exit(1);
  }

  const allResults = [];

  for (let i = 0; i < TEST_CASES.length; i++) {
    const result = await runTestCase(TEST_CASES[i], i);
    allResults.push(result);
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 SUMMARY');
  console.log(`${'='.repeat(60)}`);

  let totalPass = 0;
  let totalFail = 0;

  for (const r of allResults) {
    const icon = r.success ? '✅' : '❌';
    console.log(`${icon} ${r.name} (Project #${r.projectId})`);
    if (!r.success) {
      totalFail++;
      for (const err of r.errors) {
        console.log(`   ⚠️  ${err}`);
      }
    } else {
      totalPass++;
    }
  }

  console.log(`\n🏁 Results: ${totalPass} passed, ${totalFail} failed out of ${allResults.length} cases`);

  // Write detailed results to file
  const resultFile = `test-results-${Date.now()}.json`;
  const fs = await import('fs');
  fs.writeFileSync(resultFile, JSON.stringify(allResults, null, 2));
  console.log(`📄 Detailed results saved to: ${resultFile}`);

  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
