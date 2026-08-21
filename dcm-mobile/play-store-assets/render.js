// One-shot script to render feature-graphic.html into a 1024x500 PNG using
// Puppeteer. Run with: node render.js
// Saves output as feature-graphic.png in this same folder.

const puppeteer = require('puppeteer')
const path = require('path')
const url = require('url')

;(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--disable-web-security', '--allow-file-access-from-files']
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1200, height: 700, deviceScaleFactor: 2 })

  const htmlPath = path.resolve(__dirname, 'feature-graphic.html')
  const fileUrl = url.pathToFileURL(htmlPath).href
  await page.goto(fileUrl, { waitUntil: 'networkidle0' })

  // Wait for the card images to load fully before screenshotting
  await page.evaluate(() => Promise.all(
    Array.from(document.images).map(img =>
      img.complete && img.naturalHeight !== 0
        ? Promise.resolve()
        : new Promise(res => { img.onload = img.onerror = res })
    )
  ))

  // Hide the "how to export" instructions panel — it's fixed-positioned and
  // can overlap the bottom of the graphic in the viewport, which Puppeteer
  // would otherwise capture as part of the element screenshot.
  await page.evaluate(() => {
    const ins = document.querySelector('.instructions')
    if (ins) ins.style.display = 'none'
  })

  const el = await page.$('.feature')
  await el.screenshot({
    path: path.resolve(__dirname, 'feature-graphic.png'),
    omitBackground: false,
  })

  await browser.close()
  console.log('✓ Saved feature-graphic.png at 1024x500 (rendered at 2x for sharpness)')
})()
