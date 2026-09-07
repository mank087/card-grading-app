const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const forbiddenPath=p=>/^(grading-work|grading-backups)\//.test(p.replaceAll('\\','/'));
const forbiddenSource=/\bgradingV10\b|DCM_Evidence_v10|grading-work[\\/]|grading-backups[\\/]/;
function check(root){
  const issues=[];
  const index=cp.spawnSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8',windowsHide:true});
  if(index.status===0){for(const file of index.stdout.split('\0').filter(Boolean))if(forbiddenPath(file))issues.push(`Experimental file tracked or staged: ${file}`);}
  else {
    if(fs.existsSync(path.join(root,'.git')))issues.push('Unable to inspect the Git index; isolation check cannot pass.');
    for(const folder of ['grading-work','grading-backups'])if(fs.existsSync(path.join(root,folder)))issues.push(`Experimental folder included in build input: ${folder}`);
  }
  for(const folder of ['src','prompts']){
    const base=path.join(root,folder);if(!fs.existsSync(base))continue;
    for(const file of fs.readdirSync(base,{recursive:true})){
      const full=path.join(base,file);if(!fs.statSync(full).isFile()||!(/\.(?:[cm]?[jt]sx?|json|txt)$/.test(file)))continue;
      if(forbiddenSource.test(fs.readFileSync(full,'utf8')))issues.push(`Experimental grading reference in production source: ${path.relative(root,full)}`);
    }
  }
  return issues;
}
module.exports={check,forbiddenPath,forbiddenSource};
if(require.main===module){const issues=check(path.resolve(__dirname,'..'));if(issues.length){console.error(issues.join('\n'));process.exitCode=1;}else console.log('Grading isolation passed: experimental folders are not tracked/staged or referenced by production source.');}
