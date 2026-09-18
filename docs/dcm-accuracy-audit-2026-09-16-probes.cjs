// Read-only, offline probes of current TypeScript helpers. No API/database calls.
const fs = require('fs');
const ts = require('typescript');
const path = require('path');
const root = path.resolve(__dirname, '..');
function load(relative, extras = '') {
  const source = fs.readFileSync(path.join(root, relative), 'utf8') + extras;
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', js)((id) => {
    if (id === 'expo-image-manipulator' || id === 'expo-crypto') return {};
    throw Error(`Unexpected dependency: ${id}`);
  }, mod, mod.exports);
  return mod.exports;
}
const reconcile = load('src/lib/identification/reconcile.ts');
const names = load('src/lib/identity/nameAgreement.ts');
const mobile = load('dcm-mobile/lib/imageUtils.ts', '\nexport { computeGuideCrop };');
const web = load('src/utils/cameraGuideGeometry.ts');
const crop = load('src/utils/guideCrop.ts', '\nexport { computeViewportCropRect };');
const independent = {
  printed_name_seen: null, player_or_character: null, card_name: null,
  set_name: null, card_number: null, card_number_text_seen: null, year_hint: null,
  language: null, variant: null, confidence: 'medium', model: 'offline fixture',
  tokens: { in: 0, out: 0 }, ms: 0,
};
const outputs = {
  reconciliation: {
    differentJapaneseNamesAgree: reconcile.namesAgree('ピカチュウ', 'リザードン'),
    mewAndMewtwoAgree: reconcile.namesAgree('Mew', 'Mewtwo'),
    missingEvidenceConfidence: reconcile.reconcileIdentity({ card_name: 'Mew', card_number: '1' }, independent, 'pokemon').confidence,
  },
  catalogNames: {
    differentJapanese: names.namesAgree('ピカチュウ', 'リザードン'),
    differentMegaForms: names.namesAgree('Mega Charizard X EX', 'Mega Charizard Y EX'),
  },
  mobileGuide: [
    { w: 390, h: 600 }, { w: 800, h: 350 },
  ].map(({ w, h }) => {
    const fraction = mobile.computeGuideWidthFraction(w, h, 'portrait');
    const guideHeight = w * fraction / (2.5 / 3.5);
    return { viewport: [w, h], fraction, guideHeight, exceedsViewport: guideHeight > h };
  }),
  webPortraitCrop: (() => {
    const g = web.computeGuideLayoutPx(390, 844, 'portrait');
    return crop.computeViewportCropRect(3840, 2160, {
      viewW: 390, viewH: 844, guideW: g.width, guideH: g.height,
      guideCenterOffsetY: g.centerOffsetY, streamW: 3840, streamH: 2160,
      streamTransform: { scale: 1, offsetX: 0, offsetY: 0 },
    }, 0.05);
  })(),
  promptSizes: ['master_grading_rubric_v5.txt', ...['sports', 'pokemon', 'mtg', 'lorcana', 'onepiece', 'yugioh', 'starwars', 'other'].map(t => `${t}_delta_v5.txt`)].map(file => {
    // Count LF text: a Windows checkout (core.autocrlf) has CRLF, CI has LF, and the
    // character count must not depend on which machine measured it.
    const text = fs.readFileSync(path.join(root, 'prompts', file), 'utf8').replace(/\r\n/g, '\n');
    return { file, characters: text.length, lines: text.split('\n').length, approximateTokensCharsDiv4: Math.ceil(text.length / 4) };
  }),
};
process.stdout.write(JSON.stringify(outputs, null, 2) + '\n');
