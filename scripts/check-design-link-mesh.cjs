const assert = require('node:assert/strict');
const base = process.env.SHOWCASE_BASE_URL || 'http://127.0.0.1:3000';
const mesh = {
 '/': ['/ai-card-grading','/ai-card-grading-accuracy','/grading-rubric','/reports-and-labels','/cheapest-card-grading','/grading-standard','/grading-limitations','/card-grading-companies','/pop'],
 '/get-started': ['/grade-your-first-card','/cheapest-card-grading','/grading-standard','/card-grading-companies','/pop','/pokemon-grading','/sports-grading','/card-grading','/psa-alternative'],
 '/why-dcm': ['/fastest-card-grading','/psa-alternative','/card-grading-companies','/cheapest-card-grading','/pop','/grading-standard','/instalist-marketplace','/collection'],
 '/ai-card-grading': ['/get-started','/grading-rubric','/reports-and-labels','/cheapest-card-grading','/fastest-card-grading','/card-grading-companies','/psa-alternative','/credits','/grading-standard','/grading-limitations','/ai-card-grading-accuracy','/pop'],
};
(async () => {
 for (const [route, links] of Object.entries(mesh)) {
   const response = await fetch(base + route, { signal: AbortSignal.timeout(60000) });
   assert.equal(response.status, 200, route);
   const html = await response.text();
   const body = html.replace(/<footer\b[\s\S]*?<\/footer>/g, '').replace(/<nav\b[\s\S]*?<\/nav>/g, '').replace(/<script\b[\s\S]*?<\/script>/g, '');
   for (const link of links) assert.ok(body.includes(`href="${link}"`), `${route}: missing body link ${link}`);
   if (route === '/') { assert.ok(body.includes('dcm-reel-card--complete') && body.includes('front photo'), 'Missing server-rendered graded card first frame'); assert.ok(!body.includes('Grade 2 Cards Free'), 'Unresolved authentication must use neutral CTA'); }
   if (route === '/ai-card-grading') { assert.match(body, /<h1[^>]*>[\s\S]*?AI Card Grading/); assert.ok((body.match(/<h2/g) || []).length >= 6, 'Missing AI article sections'); assert.ok(html.includes('application/ld+json'), 'Missing structured data'); }
   console.log(`PASS ${route}: ${links.length} body links${route === '/' ? ', initial hero and neutral CTA' : ''}`);
 }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
