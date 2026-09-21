(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const holders = {
    slab: { name: 'Graded slab', short: 'slab', description: 'A classic home for your collection.', format: '2.8″ × 0.8″ slab insert', product: 'traditional-graded-slabs', image: 'slab.png' },
    toploader: { name: 'Top loader', short: 'top loader', description: 'Everyday protection. Your signature look.', format: 'Avery 8167 · 1.75″ × 0.5″', product: 'avery-8167', image: 'toploader.png' },
    onetouch: { name: 'One-Touch', short: 'One-Touch', description: 'A magnetic finish for your favorites.', format: 'Avery 6871 · Fold-over label', product: 'zion-magpro', image: 'onetouch.png' }
  };
  let holder = 'slab';
  let style = 'heritage';
  let toastTimer;
  const mainHolder = $('#main-holder');
  const dialog = $('#preview-dialog');
  const evidence = {
    Centering: { score: 8, front: 'Slight left-to-right offset in the front border. The card retains a balanced overall appearance.', back: 'Back measurements and original photography would appear here with the saved assessment.' },
    Corners: { score: 7, front: 'Minor corner wear is represented in this sample assessment. Select the original image for closer inspection.', back: 'Small amounts of whitening at the corners would be documented separately for the reverse.' },
    Edges: { score: 7, front: 'Light edge wear is the main limiting factor in this illustrative Near Mint assessment.', back: 'The production view would show the saved front and back edge findings individually.' },
    Surface: { score: 7, front: 'Minor surface marks are represented in this example. Holographic areas benefit from full-size inspection.', back: 'The complete assessment would retain its image-quality limitations and any reverse-side surface findings.' }
  };
  const cloneHolder = type => {
    const clone = mainHolder.cloneNode(true);
    clone.removeAttribute('id');
    clone.className = `holder ${type}`;
    clone.querySelector('.holder-shell').src = `assets/${holders[type].image}`;
    clone.querySelector('.holder-shell').alt = holders[type].name;
    return clone;
  };
  function buildHolderCards() {
    for (const container of [$('#overview-holders'), $('#labels-holders')]) {
      for (const [type, data] of Object.entries(holders)) {
        const article = document.createElement('article');
        article.className = 'holder-card';
        article.innerHTML = `<button class="mini-stage" data-select-holder="${type}" aria-label="Preview ${data.name}"></button><div class="holder-card-content"><div class="holder-card-title"><h3>${data.name}</h3><span>${type === 'slab' ? 'DISPLAY' : type === 'toploader' ? 'COLLECT' : 'SHOWCASE'}</span></div><p>${data.description}</p><div class="holder-card-bottom"><button class="text-link" data-download-holder="${type}">↓ Download label</button><a href="https://dcmgrading.com/shop#${data.product}" target="_blank" rel="noopener">Shop supplies ↗</a></div></div>`;
        article.querySelector('.mini-stage').append(cloneHolder(type));
        container.append(article);
      }
    }
  }
  function chooseHolder(type) {
    if (!holders[type]) return;
    holder = type;
    mainHolder.className = `holder ${holder}`;
    mainHolder.querySelector('.holder-shell').src = `assets/${holders[holder].image}`;
    mainHolder.querySelector('.holder-shell').alt = holders[holder].name;
    $$('[data-holder]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.holder === holder)));
    $('#download-title').textContent = `Download ${holders[holder].short} label`;
    $('#holder-size').textContent = holders[holder].format;
    $('#shop-holder').href = `https://dcmgrading.com/shop#${holders[holder].product}`;
  }
  function chooseStyle(value) {
    style = value;
    $('#label-style').value = style;
    $$('.holder').forEach(el => el.dataset.style = style);
  }
  function section(name, scroll = true) {
    if (!['overview', 'labels', 'market', 'grade', 'reports'].includes(name)) return;
    $$('.detail-section').forEach(el => el.hidden = el.id !== name);
    $$('.section-nav button').forEach(el => {
      if (el.dataset.section === name) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    });
    history.replaceState(null, '', `#${name}`);
    if (scroll) $('.section-nav').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  }
  function showEvidence(name, navigate = true) {
    const data = evidence[name];
    if (!data) return;
    $$('.evidence-tabs button').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.evidence === name)));
    $('#evidence-content').innerHTML = `<div class="evidence-score"><strong>${data.score}</strong><div><h3>${name}</h3><span>Illustrative assessment · Out of 10</span></div></div><div class="finding"><b>Front of card</b><p>${data.front}</p></div><div class="finding"><b>Back of card</b><p>${data.back}</p></div>`;
    if (navigate) section('grade');
  }
  function toast(message) {
    clearTimeout(toastTimer);
    $('.toast').textContent = message;
    $('.toast').hidden = false;
    toastTimer = setTimeout(() => $('.toast').hidden = true, 4000);
  }
  const dialogContent = {
    back: ['Original back photo', '<p>This local sample includes the Lugia front image only. The redesigned page would show the actual uploaded back photo here, with its matching back label and zoom controls.</p><p class="dialog-note">No substitute back image is used in this mockup.</p>'],
    zoom: ['A closer look at Lugia', '<img class="dialog-preview" src="assets/lugia.png" alt="Original Lugia card artwork at larger scale"><p class="small">Front image · Existing DCM marketing asset</p>'],
    listing: ['Your next listing starts here.', '<p>InstaList brings the card details, original photos, and grade summary into one review step.</p><label class="form-row">Listing title<input value="Lugia 9/111 Neo Genesis Holo 2000 · DCM 7 Near Mint"></label><label class="form-row">Asking price (USD)<input type="number" min="0" step="0.01" value="185.00"></label><div class="finding"><b>Prepared for your review</b><p>Card identity · Original photos · DCM grading summary</p></div><p class="dialog-note">Local design preview. Nothing will be published. A simulated holder does not imply that a physical holder is included.</p><button class="primary" id="save-draft">Preview saved draft →</button>'],
    customize: ['Make the label your own.', '<p>Explore a sample saved design. In the finished page, Label Studio would open with this card and holder already selected.</p><label class="form-row">Choose a design<select id="dialog-style"><option value="heritage">Heritage · Card colors</option><option value="modern">Modern · Midnight</option><option value="traditional">Traditional · Classic</option><option value="custom">My custom · Ocean blue</option></select></label><img class="dialog-sample-label" src="assets/heritage-label.png" alt="Original Lugia Heritage label"><p class="dialog-note">This changes only the local preview. Your saved label preferences are untouched.</p><button class="primary" id="apply-style">Apply to preview →</button>'],
    report: ['Lugia · Grading report', '<div class="finding"><b>DCM 7 · Near Mint</b><p>Neo Genesis · #9/111 · 2000 · Serial 217275</p></div><div class="comparison-row"><span>Centering <b>8</b></span><span>Corners <b>7</b></span><span>Edges / Surface <b>7 / 7</b></span></div><p>Light edge wear and minor surface marks hold this sample assessment at Near Mint.</p><p class="dialog-note">Report layout preview. These findings and subgrades are illustrative, not a new assessment of this card.</p><button class="primary" id="sample-report">Download sample report (.txt) ↓</button>'],
    mini: ['A compact grade summary.', '<div class="finding"><b>LUGIA · DCM 7 NEAR MINT</b><p>Neo Genesis · #9/111 · 2000</p><p>Centering 8 · Corners 7 · Edges 7 · Surface 7</p></div><p>This compact layout puts the card identity and grading summary together for collection records and listing imagery.</p><p class="dialog-note">Design sample only. The existing mini-report generator would supply the real download.</p>'],
    portfolio: ['Your card in your portfolio.', '<div class="finding"><b>Lugia · In collection</b><p>Estimated value $185.00 · Purchase price $145.00 · Unrealized gain +$40.00</p></div><p>The final action would open your portfolio with this card in context.</p><p class="dialog-note">All financial values shown here are sample data. No collection records are changed.</p>'],
    cost: ['Purchase details', '<label class="form-row">Purchase price (USD)<input id="sample-cost" type="number" min="0" step="0.01" value="145.00"></label><label class="form-row">Purchased on<input type="date" value="2026-08-12"></label><p class="dialog-note">Example owner-only information. Saving here demonstrates feedback without writing to your account.</p><button class="primary" id="save-cost">Preview save</button>'],
    edit: ['Card details, within reach.', '<label class="form-row">Card name<input value="Lugia"></label><label class="form-row">Set<input value="Neo Genesis"></label><label class="form-row">Card number<input value="9/111"></label><p class="dialog-note">The existing identity correction flow would open here. This mockup does not update card records.</p><button class="primary" id="sample-edit">Preview save</button>'],
    share: ['Share your card.', '<p>This sample is shown as a private card. The finished page would explain visibility before creating a public sharing link.</p><p class="dialog-note">Your real card visibility is unchanged. No public link is created.</p>'],
    more: ['Card actions', '<div class="dialog-options"><button class="secondary" data-modal="edit">Edit card details</button><button class="secondary" data-modal="share">Sharing & visibility</button><button class="secondary" data-modal="report">View grading report</button></div><p class="dialog-note">Secondary record actions stay available without competing with labels, value, and InstaList.</p>'],
    collection: ['Back to your collection.', '<p>In the finished page, this breadcrumb returns to the collection, binder, or portfolio you came from, preserving its filters.</p><p class="dialog-note">You are viewing an isolated concept, not your connected collection.</p>'],
    account: ['Your personal card workspace.', '<p>Sample account view. This prototype uses no authentication, account services, or production database connections.</p>']
  };
  function openModal(type) {
    let content = dialogContent[type];
    if (type === 'download') {
      content = [`Your ${holders[holder].short} label. Ready to print.`, `<p><b>${holders[holder].format}</b><br>${$('#label-style').selectedOptions[0].textContent}</p><div class="dialog-options"><label><input type="radio" name="format" value="standard" checked><span>${holder === 'slab' ? 'Front + back · Duplex' : holder === 'toploader' ? 'Front + back label pair' : 'Fold-over · Single-sided'}<small>Keep the grade and card details together.</small></span></label>${holder === 'slab' ? '<label><input type="radio" name="format" value="fold"><span>Fold-over · Single-sided<small>Fold the front and back over a shared edge.</small></span></label>' : ''}</div><p class="dialog-note">The production action would create the calibrated print PDF. This prototype exports a watermarked artwork sample for design review only.</p><div class="dialog-actions"><button class="primary" id="download-sample">Download sample label PNG ↓</button><a class="secondary" href="https://dcmgrading.com/shop#${holders[holder].product}" target="_blank" rel="noopener">Shop compatible supplies ↗</a></div>`];
    }
    if (!content) return;
    $('#dialog-title').textContent = content[0];
    $('#dialog-content').innerHTML = content[1];
    if ($('#dialog-style')) $('#dialog-style').value = style;
    if (!dialog.open) dialog.showModal();
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  async function loadImage(url) {
    const img = new Image(); img.src = url; await img.decode(); return img;
  }
  async function labelCanvas() {
    const canvas = document.createElement('canvas'); canvas.width = 1400; canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (style === 'heritage') ctx.drawImage(await loadImage('assets/heritage-label.png'), 0, 0, 1400, 400);
    else {
      const dark = style !== 'traditional';
      ctx.fillStyle = style === 'modern' ? '#251a36' : style === 'custom' ? '#14516b' : '#fffdf7'; ctx.fillRect(0, 0, 1400, 400);
      ctx.fillStyle = dark ? '#f7f4fc' : '#34253f'; ctx.font = 'bold 105px Arial'; ctx.fillText('Lugia', 60, 135);
      ctx.font = '32px Arial'; ctx.fillText('NEO GENESIS · #9/111 · 2000', 60, 200);
      ctx.font = '27px monospace'; ctx.fillText('HOLOFOIL RARE · 217275', 60, 262);
      ctx.font = 'italic bold 48px Arial'; ctx.fillText('DCM', 60, 347);
      ctx.font = 'bold 220px Arial'; ctx.fillText('7', 1170, 240);
      ctx.font = 'bold 24px Arial'; ctx.fillText('NEAR MINT', 1156, 300);
      if (style === 'custom') { ctx.fillStyle = '#d5ba71'; ctx.fillRect(0, 0, 22, 400); }
    }
    return canvas;
  }
  async function exportSample(showcase = false) {
    const label = await labelCanvas();
    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
    if (!showcase) { canvas.width = 1400; canvas.height = 445; ctx.drawImage(label, 0, 0); }
    else {
      const width = holder === 'slab' ? 700 : holder === 'toploader' ? 850 : 800;
      const height = holder === 'slab' ? 1150 : holder === 'toploader' ? 1108 : 1167;
      canvas.width = width; canvas.height = height + 65;
      ctx.fillStyle = '#f3f0f8'; ctx.fillRect(0, 0, width, height);
      ctx.drawImage(await loadImage(`assets/${holders[holder].image}`), 0, 0, width, height);
      const cardRect = holder === 'slab' ? [.107, .20, .786, .739] : holder === 'toploader' ? [.07, .045, .86, .90] : [.11, .13, .78, .76];
      const art = await loadImage('assets/lugia.png');
      const areaW = width * cardRect[2], areaH = height * cardRect[3];
      const scale = Math.min(areaW / art.width, areaH / art.height);
      ctx.drawImage(art, width * cardRect[0] + (areaW - art.width * scale)/2, height * cardRect[1] + (areaH - art.height * scale)/2, art.width * scale, art.height * scale);
      const r = holder === 'slab' ? [.135, .045, .73] : holder === 'toploader' ? [.21, 0, .58] : [.175, 0, .65];
      ctx.drawImage(label, width*r[0], height*r[1], width*r[2], width*r[2]/3.5);
    }
    const barHeight = showcase ? 65 : 45;
    ctx.fillStyle = '#342542'; ctx.fillRect(0, canvas.height-barHeight, canvas.width, barHeight);
    ctx.fillStyle = '#fff'; ctx.font = `${showcase ? 18 : 23}px Arial`; ctx.textAlign = 'center';
    ctx.fillText('DESIGN SAMPLE · HOLDER PREVIEW · NOT FOR PRINT', canvas.width/2, canvas.height - (showcase ? 25 : 13));
    canvas.toBlob(blob => { if (blob) { downloadBlob(blob, `DCM-Lugia-${holder}-${style}-${showcase ? 'showcase' : 'label'}-SAMPLE.png`); toast('Sample artwork downloaded. Your saved card is unchanged.'); } }, 'image/png');
  }
  document.addEventListener('click', async event => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.dataset.holder) chooseHolder(target.dataset.holder);
    if (target.dataset.selectHolder) { chooseHolder(target.dataset.selectHolder); $('.showcase').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    if (target.dataset.downloadHolder) { chooseHolder(target.dataset.downloadHolder); openModal('download'); }
    if (target.dataset.section) section(target.dataset.section);
    if (target.dataset.evidence) showEvidence(target.dataset.evidence);
    if (target.dataset.modal) openModal(target.dataset.modal);
    if (target.id === 'close-dialog') dialog.close();
    if (target.id === 'apply-style') { chooseStyle($('#dialog-style').value); dialog.close(); toast('Label design applied to all holder previews.'); }
    if (target.id === 'save-draft') { dialog.close(); toast('Draft preview saved locally for this interaction. Nothing was published.'); }
    if (target.id === 'save-cost' || target.id === 'sample-edit') { dialog.close(); toast('Save interaction previewed. No account data was changed.'); }
    if (target.id === 'sample-report') downloadBlob(new Blob(['DCM CARD DETAILS — DESIGN SAMPLE\nLugia · Neo Genesis · 9/111 · 2000\nGrade 7 Near Mint\nIllustrative subgrades: Centering 8, Corners 7, Edges 7, Surface 7\nThis is a layout sample, not a new grading report.\n'], { type: 'text/plain' }), 'DCM-Lugia-report-DESIGN-SAMPLE.txt');
    if (target.id === 'download-sample' || target.id === 'showcase-export') {
      target.disabled = true;
      try { await exportSample(target.id === 'showcase-export'); } catch { toast('The sample could not be exported. Please try again.'); }
      finally { target.disabled = false; }
    }
  });
  $('#label-style').addEventListener('change', event => chooseStyle(event.target.value));
  buildHolderCards(); showEvidence('Centering', false);
  section(location.hash.slice(1) || 'overview', false);
})();
