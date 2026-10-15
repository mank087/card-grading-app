// Preload for the frozen Sept 16 probe (docs/dcm-accuracy-audit-2026-09-16-probes.cjs).
//
// That probe is a historical record and is not edited. It measures every prompt
// delta that existed on Sept 16, including starwars_delta_v5.txt, which was
// deleted in Oct 2026 with the abandoned Star Wars category (Star Wars cards are
// graded as Other / Star Wars). Without this preload the probe crashes on the
// missing file. A read of a RETIRED delta that is no longer on disk returns '';
// scripts/accuracy-phase0.cjs then drops retired files from the observed sizes.
const fs = require('node:fs');
const path = require('node:path');

const RETIRED_PROMPT_FILES = ['starwars_delta_v5.txt'];

const readFileSync = fs.readFileSync;
fs.readFileSync = function patchedReadFileSync(file, ...rest) {
  if (typeof file === 'string' && RETIRED_PROMPT_FILES.includes(path.basename(file))
    && path.basename(path.dirname(file)) === 'prompts' && !fs.existsSync(file)) return '';
  return readFileSync.call(this, file, ...rest);
};

module.exports = { RETIRED_PROMPT_FILES };
