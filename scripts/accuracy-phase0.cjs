#!/usr/bin/env node
// Offline source/config baseline. Does not import the grader or call any service.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const ENV_KEYS = [
  'GRADING_BASELINE_MODEL', 'GRADING_CANARY_MODEL', 'GRADING_CANARY_PERCENT',
  'GRADING_CANARY_KILL', 'GRADING_CANARY_REASONING_EFFORT', 'GRADING_CANARY_CACHE_RETENTION',
  'GRADING_IMAGE_DETAIL', 'IDENTIFICATION_MODEL', 'GRADING_MODEL',
  'IDENTIFICATION_PASS_ENABLED', 'CV_CENTERING_ADVISORY', 'CV_CENTERING_MODE',
  'CENTERING_POLICY', 'CENTERING_R0', 'ZOOM_DISABLED', 'YEAR_EVIDENCE_REQUIRED',
  'CARD_NUMBER_EVIDENCE_REQUIRED', 'SPORTS_CHECKLIST_ENABLED', 'GRADE_REVIEW_CAPTURE_ENABLED',
];

function sourceModule(relative, env) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, {
    module, exports: module.exports, process: { env },
    require: (id) => { throw new Error(`Baseline must remain offline; unexpected import: ${id}`); },
  }, { filename: relative, timeout: 2000 });
  return module.exports;
}

function buildManifest(environment = process.env, configSource = 'shell environment; .env files not loaded') {
  const configured = Object.fromEntries(ENV_KEYS.map(key => [key, environment[key] ?? null]));
  const env = Object.fromEntries(Object.entries(configured).filter(([, value]) => value !== null));
  const router = sourceModule('src/lib/grading/modelRouter.ts', env);
  const detail = sourceModule('src/lib/grading/imageDetail.ts', env);
  const files = [
    'src/lib/grading/modelRouter.ts', 'src/lib/grading/imageDetail.ts',
    'src/lib/visionGrader.ts', 'src/lib/promptLoader_v5.ts',
    'src/lib/identification/reconcile.ts', 'src/lib/identification/identifyCard.ts', 'src/lib/identity/nameAgreement.ts',
    'src/hooks/useCamera.ts', 'src/components/camera/MobileCamera.tsx',
    'src/lib/localCaptureAudit.ts', 'src/utils/cameraGuideGeometry.ts', 'src/utils/guideCrop.ts',
    'src/app/upload/page.tsx', 'dcm-mobile/app/grade/capture.tsx', 'dcm-mobile/lib/imageUtils.ts',
    'docs/dcm-accuracy-audit-2026-09-16-probes.cjs',
    'docs/DCM_ACCURACY_AUDIT_PROBES_2026-09-16.json', 'scripts/accuracy-phase0.cjs',
    ...fs.readdirSync(path.join(root, 'prompts')).filter(name => /^(master_grading_rubric|.+_delta)_v5\.txt$/.test(name)).map(name => `prompts/${name}`),
  ].sort();
  const hashes = Object.fromEntries(files.map(file => [file,
    crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]));
  const baselineRequest = { model: router.BASELINE_MODEL, temperature: 0.3, top_p: 0.9,
    max_tokens: 16000, seed: 7, n: 3, response_format: { type: 'json_object' } };
  const observed = JSON.parse(execFileSync(process.execPath,
    [path.join(root, 'docs/dcm-accuracy-audit-2026-09-16-probes.cjs')], { encoding: 'utf8', cwd: root }));
  const frozen = JSON.parse(fs.readFileSync(path.join(root, 'docs/DCM_ACCURACY_AUDIT_PROBES_2026-09-16.json'), 'utf8').replace(/^\uFEFF/, ''));
  return {
    schemaVersion: 1, generatedAt: new Date().toISOString(), kind: 'offline-source-baseline',
    limitations: ['Not a deployed configuration attestation or an actual API request trace.',
      'No camera device, customer image, grading accuracy, or API compatibility verification.',
      'Request template is the audited main ensemble only; retries and other passes may differ.',
      'Matching frozen probes preserves known defects; it does not assert correct behavior.'],
    git: { head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      scopedStatus: execFileSync('git', ['status', '--short', '--', ...files], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean) },
    configSource, configured,
    declaredPromptVersion: fs.readFileSync(path.join(root, 'src/lib/visionGrader.ts'), 'utf8')
      .match(/export const DCM_PROMPT_VERSION = '([^']+)'/)?.[1] ?? null,
    localEffective: { noRoutingKey: router.resolveGradingModel(),
      syntheticRoutingKey: router.resolveGradingModel('phase0-fixture'),
      baselineMainRequestTemplate: router.applyModelCompat(baselineRequest, router.BASELINE_MODEL),
      canaryMainRequestTemplate: router.applyModelCompat({ ...baselineRequest, model: router.CANARY_MODEL }, router.CANARY_MODEL),
      gradingImageDetail: detail.imageDetail(),
      identificationModel: env.IDENTIFICATION_MODEL || env.GRADING_MODEL || 'gpt-5.6-luna' },
    sourceHashes: hashes,
    probes: { matchesFrozenBaseline: JSON.stringify(observed) === JSON.stringify(frozen), observed },
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.some((arg, index) => !['--local-env', '--output'].includes(arg) && args[index - 1] !== '--output')) {
    throw new Error('Usage: node scripts/accuracy-phase0.cjs [--local-env] [--output path.json]');
  }
  if (args.includes('--local-env')) {
    require('@next/env').loadEnvConfig(root, true, { info() {}, error() {} });
  }
  const manifest = buildManifest(process.env, args.includes('--local-env')
    ? 'local Next development environment (shell precedence); deployed settings unverified'
    : undefined);
  const outputIndex = args.indexOf('--output');
  const json = JSON.stringify(manifest, null, 2) + '\n';
  if (outputIndex !== -1) {
    if (!args[outputIndex + 1] || args[outputIndex + 1].startsWith('--')) throw new Error('--output requires a file');
    const outputPath = path.resolve(args[outputIndex + 1]);
    const relative = path.relative(root, outputPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Output must be within this workspace');
    fs.writeFileSync(outputPath, json, { flag: 'wx' });
    console.log(`Saved local baseline: ${relative}`);
  } else process.stdout.write(json);
  if (!manifest.probes.matchesFrozenBaseline) process.exitCode = 2;
}
module.exports = { buildManifest, ENV_KEYS };
