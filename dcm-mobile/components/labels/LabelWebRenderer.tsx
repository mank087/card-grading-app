/**
 * LabelWebRenderer
 *
 * Hidden WebView-based label renderer for the DCM Grading mobile app.
 * Renders label previews by loading minimal HTML with canvas rendering code,
 * receiving config via postMessage, and returning base64 PNG images.
 *
 * Ported from src/lib/customSlabLabelGenerator.ts (web) — simplified for
 * inline HTML context without external dependencies.
 */

import { useRef, useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import { WebView } from 'react-native-webview'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LabelConfig {
  width: number       // inches
  height: number      // inches
  colorPreset: string
  gradientStart: string
  gradientEnd: string
  style: 'modern' | 'traditional'
  borderEnabled: boolean
  borderColor: string
  borderWidth: number
  topEdgeGradient?: string[]
  gradientAngle?: number
  geometricPattern?: number
  customColors?: string[]
}

export interface LabelCardData {
  primaryName: string
  contextLine: string
  featuresLine: string
  serial: string
  grade: number | null
  condition: string
  isAlteredAuthentic?: boolean
  subScores?: { centering: number; corners: number; edges: number; surface: number }
  qrUrl?: string
}

export interface LabelWebRendererProps {
  config: LabelConfig | null
  cardData: LabelCardData | null
  onRender: (base64DataUrl: string) => void
  side?: 'front' | 'back'
}

// ---------------------------------------------------------------------------
// Inline HTML
// ---------------------------------------------------------------------------

const LABEL_HTML = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;padding:0;overflow:hidden;background:transparent;}</style>
</head>
<body>
<canvas id="c"></canvas>
<script>
// =========================================================================
// Label renderer — self-contained, mirrors customSlabLabelGenerator.ts
// =========================================================================
var DPI = 192;

var TRAD = {
  purplePrimary: '#7c3aed',
  purpleDark: '#6b46c1',
  textDark: '#1f2937',
  textMedium: '#4b5563',
  featureBlue: '#2563eb',
  white: '#ffffff'
};

var FONT_RATIO = { name: 1.0, context: 0.76, features: 0.70, serial: 0.76 };
var SPACING_RATIO = { afterName: 0.15, contextLineGap: 0.09, afterContext: 0.12, afterFeatures: 0.12 };

// ---------- helpers ----------

function formatGrade(grade, isAltAuth) {
  if (grade !== null && grade !== undefined) return Math.round(grade).toString();
  return isAltAuth ? 'A' : 'N/A';
}

function isCardColorPreset(p) {
  return ['color-gradient','card-extension','neon-outline','geometric','team-colors'].indexOf(p) !== -1;
}

function isLightTheme(cfg) {
  if (isCardColorPreset(cfg.colorPreset)) return false;
  return cfg.style === 'traditional' || cfg.colorPreset === 'traditional';
}

function wrapText(ctx, text, maxW, fontSize, style) {
  ctx.font = (style ? style + ' ' : '') + fontSize + "px 'Helvetica Neue', Arial, sans-serif";
  var words = text.split(' '), lines = [], cur = '';
  for (var i = 0; i < words.length; i++) {
    var test = cur ? cur + ' ' + words[i] : words[i];
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = words[i]; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

function strokeT(ctx, text, x, y, isDark, sw) {
  if (isDark) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = sw || 3;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeText(text, x, y);
    ctx.restore();
  }
  ctx.fillText(text, x, y);
}

// ---------- font fitting ----------

function fitFonts(ctx, maxW, maxH, name, ctxLine, feat, serial, baseMax, scale) {
  var MIN = Math.max(4, Math.round(14 * scale));
  for (var ns = baseMax; ns >= MIN; ns--) {
    var s = {
      name: ns,
      context: Math.round(ns * FONT_RATIO.context),
      features: Math.round(ns * FONT_RATIO.features),
      serial: Math.round(ns * FONT_RATIO.serial),
      afterName: Math.round(ns * SPACING_RATIO.afterName),
      contextLineGap: Math.round(ns * SPACING_RATIO.contextLineGap),
      afterContext: Math.round(ns * SPACING_RATIO.afterContext),
      afterFeatures: Math.round(ns * SPACING_RATIO.afterFeatures)
    };
    ctx.font = "bold " + s.name + "px 'Helvetica Neue', Arial, sans-serif";
    if (ctx.measureText(name).width > maxW) continue;
    var cl = ctxLine ? wrapText(ctx, ctxLine, maxW, s.context).slice(0, 2) : [];
    if (feat) {
      ctx.font = "bold " + s.features + "px 'Helvetica Neue', Arial, sans-serif";
      if (ctx.measureText(feat).width > maxW) continue;
    }
    ctx.font = s.serial + "px 'Courier New', monospace";
    if (ctx.measureText(serial).width > maxW) continue;
    var bh = s.name;
    if (cl.length) { bh += s.afterName + cl.length * s.context + (cl.length - 1) * s.contextLineGap; }
    if (feat) bh += s.afterContext + s.features;
    bh += s.afterFeatures + s.serial;
    if (bh <= maxH) return { sizes: s, ctxLines: cl };
  }
  var fb = MIN;
  var fs = {
    name: fb,
    context: Math.max(3, Math.round(fb * FONT_RATIO.context)),
    features: Math.max(3, Math.round(fb * FONT_RATIO.features)),
    serial: Math.max(3, Math.round(fb * FONT_RATIO.serial)),
    afterName: Math.max(1, Math.round(fb * SPACING_RATIO.afterName)),
    contextLineGap: Math.max(1, Math.round(fb * SPACING_RATIO.contextLineGap)),
    afterContext: Math.max(1, Math.round(fb * SPACING_RATIO.afterContext)),
    afterFeatures: Math.max(1, Math.round(fb * SPACING_RATIO.afterFeatures))
  };
  return { sizes: fs, ctxLines: ctxLine ? wrapText(ctx, ctxLine, maxW, fs.context).slice(0, 2) : [] };
}

// ---------- background ----------

function drawBG(ctx, W, H, cfg) {
  if (cfg.colorPreset === 'rainbow') {
    var g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, '#ff0000'); g.addColorStop(0.17, '#ff8800');
    g.addColorStop(0.33, '#ffff00'); g.addColorStop(0.5, '#00cc00');
    g.addColorStop(0.67, '#0066ff'); g.addColorStop(0.83, '#8800ff');
    g.addColorStop(1, '#ff00ff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  } else if (cfg.colorPreset === 'card-extension') {
    var g2 = ctx.createLinearGradient(0, 0, W, 0);
    if (cfg.topEdgeGradient && cfg.topEdgeGradient.length >= 3) {
      cfg.topEdgeGradient.forEach(function(c, i) {
        g2.addColorStop(i / (cfg.topEdgeGradient.length - 1), c);
      });
    } else {
      g2.addColorStop(0, cfg.gradientStart); g2.addColorStop(1, cfg.gradientEnd);
    }
    ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
    var fade = ctx.createLinearGradient(0, 0, 0, H);
    fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = fade; ctx.fillRect(0, 0, W, H);
  } else if (cfg.colorPreset === 'team-colors') {
    var g3 = ctx.createLinearGradient(0, 0, W, 0);
    g3.addColorStop(0, cfg.gradientStart); g3.addColorStop(0.45, cfg.gradientStart);
    g3.addColorStop(0.55, cfg.gradientEnd); g3.addColorStop(1, cfg.gradientEnd);
    ctx.fillStyle = g3; ctx.fillRect(0, 0, W, H);
  } else if (cfg.colorPreset === 'color-gradient') {
    // Color gradient with angle support
    var cAngle = (cfg.gradientAngle !== undefined ? cfg.gradientAngle : 135) * Math.PI / 180;
    var gcx = W/2, gcy = H/2, glen = Math.max(W,H)/2;
    var gg = ctx.createLinearGradient(gcx-Math.cos(cAngle)*glen, gcy-Math.sin(cAngle)*glen, gcx+Math.cos(cAngle)*glen, gcy+Math.sin(cAngle)*glen);
    gg.addColorStop(0, cfg.gradientStart); gg.addColorStop(1, cfg.gradientEnd);
    ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H);
  } else if (cfg.colorPreset === 'geometric') {
    var cols = cfg.customColors || [cfg.gradientStart, cfg.gradientEnd];
    var pick = function(i) { return cols[i % cols.length] || cols[0]; };
    var pat = cfg.geometricPattern || 0;
    function strokeDiv(x1,y1,x2,y2) {
      ctx.save(); ctx.strokeStyle='rgba(0,0,0,0.9)'; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); ctx.restore();
    }

    if (pat === 0) {
      // Shattered Glass: triangular shards from off-center point
      var cx3=W*0.35, cy3=H*0.4;
      var pts=[{x:0,y:0},{x:W*0.25,y:0},{x:W*0.5,y:0},{x:W*0.75,y:0},{x:W,y:0},
               {x:W,y:H*0.5},{x:W,y:H},{x:W*0.7,y:H},{x:W*0.4,y:H},{x:W*0.15,y:H},{x:0,y:H},{x:0,y:H*0.5}];
      for(var ti=0;ti<pts.length;ti++){
        var p1=pts[ti], p2=pts[(ti+1)%pts.length];
        ctx.beginPath(); ctx.moveTo(cx3,cy3); ctx.lineTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.closePath();
        ctx.fillStyle=pick(ti); ctx.fill();
      }
      for(var ti2=0;ti2<pts.length;ti2++){
        strokeDiv(cx3,cy3,pts[ti2].x,pts[ti2].y);
      }
    } else if (pat === 1) {
      // Diagonal Stripes
      var sc=7, sw=W/sc*1.8;
      for(var si=0;si<sc;si++){
        var sx=si*W/sc-W*0.3;
        ctx.beginPath(); ctx.moveTo(sx,0); ctx.lineTo(sx+sw,0); ctx.lineTo(sx+sw-W*0.3,H); ctx.lineTo(sx-W*0.3,H); ctx.closePath();
        ctx.fillStyle=pick(si); ctx.fill();
      }
      for(var si2=0;si2<=sc;si2++){
        var sx2=si2*W/sc-W*0.3;
        strokeDiv(sx2,0,sx2-W*0.3,H);
      }
    } else if (pat === 2) {
      // Fractured: 5 distinct non-overlapping regions, no color repeats
      // Ensure 5 unique colors
      var c5=[];
      for(var ci=0;ci<5;ci++){
        var cc=cols[ci%cols.length];
        if(c5.indexOf(cc)!==-1){
          var rr=parseInt(cc.slice(1,3),16),gg2=parseInt(cc.slice(3,5),16),bb=parseInt(cc.slice(5,7),16);
          var adj=ci%2===0?30:-30;
          c5.push('#'+[rr,gg2,bb].map(function(v){return Math.max(0,Math.min(255,v+adj)).toString(16).padStart(2,'0')}).join(''));
        } else { c5.push(cc); }
      }
      var d1x=W*0.12,d2x=W*0.38,d3x=W*0.62,hY2=H*0.45;
      // Region 0: far left
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(d1x,0); ctx.lineTo(d1x+W*0.08,H); ctx.lineTo(0,H); ctx.closePath();
      ctx.fillStyle=c5[0]; ctx.fill();
      // Region 1: left-center
      ctx.beginPath(); ctx.moveTo(d1x,0); ctx.lineTo(d2x,0); ctx.lineTo(d2x+W*0.05,H); ctx.lineTo(d1x+W*0.08,H); ctx.closePath();
      ctx.fillStyle=c5[1]; ctx.fill();
      // Region 2: center
      ctx.beginPath(); ctx.moveTo(d2x,0); ctx.lineTo(d3x,0); ctx.lineTo(d3x-W*0.03,H); ctx.lineTo(d2x+W*0.05,H); ctx.closePath();
      ctx.fillStyle=c5[2]; ctx.fill();
      // Region 3: upper right
      ctx.beginPath(); ctx.moveTo(d3x,0); ctx.lineTo(W,0); ctx.lineTo(W,hY2); ctx.lineTo(d3x-W*0.01,hY2); ctx.closePath();
      ctx.fillStyle=c5[3]; ctx.fill();
      // Region 4: lower right
      ctx.beginPath(); ctx.moveTo(d3x-W*0.01,hY2); ctx.lineTo(W,hY2); ctx.lineTo(W,H); ctx.lineTo(d3x-W*0.03,H); ctx.closePath();
      ctx.fillStyle=c5[4]; ctx.fill();
      // Divider lines
      strokeDiv(d1x,0,d1x+W*0.08,H); strokeDiv(d2x,0,d2x+W*0.05,H);
      strokeDiv(d3x,0,d3x-W*0.03,H); strokeDiv(d3x-W*0.01,hY2,W,hY2);
    } else if (pat === 3) {
      // Mosaic Grid: 5x2
      var gc=5, gr=2, tw=W/gc, th=H/gr;
      for(var r=0;r<gr;r++) for(var c=0;c<gc;c++) {
        ctx.fillStyle=pick(r*gc+c); ctx.fillRect(c*tw,r*th,tw,th);
      }
      for(var c2=1;c2<gc;c2++) strokeDiv(c2*tw,0,c2*tw,H);
      strokeDiv(0,th,W,th);
    } else {
      // Lightning Bolt
      var zy1=H*0.3,zy2=H*0.5,zy3=H*0.7;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(W*0.6,0); ctx.lineTo(W*0.4,zy1); ctx.lineTo(W*0.7,zy2);
      ctx.lineTo(W*0.3,zy3); ctx.lineTo(W*0.5,H); ctx.lineTo(0,H); ctx.closePath();
      ctx.fillStyle=pick(0); ctx.fill();
      ctx.beginPath(); ctx.moveTo(W*0.6,0); ctx.lineTo(W,0); ctx.lineTo(W,H); ctx.lineTo(W*0.5,H);
      ctx.lineTo(W*0.3,zy3); ctx.lineTo(W*0.7,zy2); ctx.lineTo(W*0.4,zy1); ctx.closePath();
      ctx.fillStyle=pick(1); ctx.fill();
      ctx.save(); ctx.strokeStyle='rgba(0,0,0,0.9)'; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.moveTo(W*0.6,0); ctx.lineTo(W*0.4,zy1); ctx.lineTo(W*0.7,zy2);
      ctx.lineTo(W*0.3,zy3); ctx.lineTo(W*0.5,H); ctx.stroke(); ctx.restore();
    }
    ctx.fillStyle='rgba(0,0,0,0.1)'; ctx.fillRect(0,0,W,H);
  } else {
    var angle = (cfg.gradientAngle !== undefined ? cfg.gradientAngle : 135) * Math.PI / 180;
    var cx2 = W/2, cy2 = H/2, len = Math.max(W,H)/2;
    var g5 = ctx.createLinearGradient(cx2-Math.cos(angle)*len, cy2-Math.sin(angle)*len, cx2+Math.cos(angle)*len, cy2+Math.sin(angle)*len);
    g5.addColorStop(0, cfg.gradientStart); g5.addColorStop(0.5, cfg.gradientEnd);
    g5.addColorStop(1, cfg.gradientStart);
    ctx.fillStyle = g5; ctx.fillRect(0, 0, W, H);
  }
  // Neon glow
  if (cfg.colorPreset === 'neon-outline' && cfg.borderColor) {
    var gn = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.3, W/2, H/2, W/2);
    gn.addColorStop(0, 'transparent');
    gn.addColorStop(1, cfg.borderColor + '33');
    ctx.fillStyle = gn; ctx.fillRect(0, 0, W, H);
  } else if (cfg.style === 'modern') {
    var gm = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W/2);
    gm.addColorStop(0, 'rgba(139,92,246,0.1)');
    gm.addColorStop(1, 'transparent');
    ctx.fillStyle = gm; ctx.fillRect(0, 0, W, H);
  }
}

// ---------- border ----------

function drawBorder(ctx, W, H, B, CW, CH, cfg) {
  if (!cfg.borderEnabled || !cfg.borderWidth) return 0;
  var bw = Math.round(cfg.borderWidth * DPI);
  ctx.fillStyle = cfg.borderColor;
  ctx.fillRect(B, B, CW, bw);                           // top
  ctx.fillRect(B, B + CH - bw, CW, bw);                 // bottom
  ctx.fillRect(B, B + bw, bw, CH - bw * 2);             // left
  ctx.fillRect(B + CW - bw, B + bw, bw, CH - bw * 2);  // right
  return bw;
}

// ---------- front ----------

function renderFront(ctx, canvas, cfg, card) {
  var W = canvas.width, H = canvas.height;
  var B = 0; // no bleed for screen preview
  var CW = W, CH = H;
  var light = isLightTheme(cfg);
  var scale = (cfg.width * DPI) / (2.8 * 300);

  drawBG(ctx, W, H, cfg);
  var bi = drawBorder(ctx, W, H, B, CW, CH, cfg);
  var EB = B + bi, ECW = CW - bi * 2, ECH = CH - bi * 2;
  var pad = Math.round(18 * scale);

  // Logo (text fallback)
  var logoSize = ECH * 0.55;
  var logoX = EB + pad;
  var logoY = EB + (ECH - logoSize) / 2;
  ctx.fillStyle = light ? TRAD.purplePrimary : TRAD.white;
  var logoFontSize = Math.round(36 * scale);
  ctx.font = "bold " + logoFontSize + "px 'Helvetica Neue', Arial, sans-serif";
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('DCM', logoX + 5, EB + ECH / 2);

  // Grade
  var gradeText = formatGrade(card.grade, card.isAlteredAuthentic);
  var condText = (card.isAlteredAuthentic && card.grade === null)
    ? 'AUTHENTIC'
    : (card.condition || '').toUpperCase();
  var gradeAreaW = Math.round(130 * scale);
  var gradeRightPad = pad + Math.round(20 * scale);
  var gradeCX = EB + ECW - gradeRightPad - gradeAreaW / 2;
  var gradeFontSize = Math.round(88 * scale);
  var condFontSize = Math.round(24 * scale);
  var divGap = light ? Math.round(8 * scale) : Math.round(4 * scale);
  var condGap = Math.round(4 * scale);
  var totalGH = gradeFontSize + divGap + condFontSize;
  var gradeStartY = EB + (ECH - totalGH) / 2;

  ctx.fillStyle = light ? TRAD.purplePrimary : TRAD.white;
  ctx.font = "bold " + gradeFontSize + "px 'Helvetica Neue', Arial, sans-serif";
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  strokeT(ctx, gradeText, gradeCX, gradeStartY, !light, 4);

  if (light) {
    var divY = gradeStartY + gradeFontSize + 2;
    ctx.strokeStyle = TRAD.purplePrimary;
    ctx.lineWidth = Math.round(3 * scale);
    ctx.beginPath();
    ctx.moveTo(gradeCX - Math.round(40 * scale), divY);
    ctx.lineTo(gradeCX + Math.round(40 * scale), divY);
    ctx.stroke();
  }

  // Condition text
  ctx.fillStyle = light ? TRAD.purpleDark : 'rgba(255,255,255,0.8)';
  var maxCondW = gradeAreaW + Math.round(20 * scale);
  var acs = condFontSize;
  ctx.font = "bold " + acs + "px 'Helvetica Neue', Arial, sans-serif";
  while (acs > Math.round(12 * scale) && ctx.measureText(condText).width > maxCondW) {
    acs--; ctx.font = "bold " + acs + "px 'Helvetica Neue', Arial, sans-serif";
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  strokeT(ctx, condText, gradeCX, gradeStartY + gradeFontSize + divGap + condGap, !light, 3);

  // Card info
  var infoX = logoX + logoSize + Math.round(16 * scale);
  var infoMaxW = (EB + ECW - gradeRightPad - gradeAreaW) - infoX - Math.round(20 * scale);
  var infoMaxH = ECH - Math.round(16 * scale);
  var maxNameFont = Math.round(38 * scale);
  var name = card.primaryName || 'Card';
  var ctxLine = card.contextLine || '';
  var feat = card.featuresLine || '';
  var serial = card.serial || '';

  var fit = fitFonts(ctx, infoMaxW, infoMaxH, name, ctxLine, feat, serial, maxNameFont, scale);
  var fs = fit.sizes, cl = fit.ctxLines;

  var bh = fs.name;
  if (cl.length) bh += fs.afterName + cl.length * fs.context + (cl.length - 1) * fs.contextLineGap;
  if (feat) bh += fs.afterContext + fs.features;
  bh += fs.afterFeatures + fs.serial;

  var cy = EB + (ECH - bh) / 2;

  ctx.fillStyle = light ? TRAD.textDark : 'rgba(255,255,255,0.95)';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.font = "bold " + fs.name + "px 'Helvetica Neue', Arial, sans-serif";
  strokeT(ctx, name, infoX, cy, !light, 3);
  cy += fs.name + fs.afterName;

  if (cl.length) {
    ctx.fillStyle = light ? TRAD.textMedium : 'rgba(255,255,255,0.7)';
    ctx.font = fs.context + "px 'Helvetica Neue', Arial, sans-serif";
    for (var i = 0; i < cl.length; i++) {
      strokeT(ctx, cl[i], infoX, cy, !light, 2);
      cy += fs.context + fs.contextLineGap;
    }
  }

  if (feat) {
    cy += fs.afterContext - fs.contextLineGap;
    ctx.fillStyle = light ? TRAD.featureBlue : 'rgba(34,197,94,0.9)';
    ctx.font = "bold " + fs.features + "px 'Helvetica Neue', Arial, sans-serif";
    strokeT(ctx, feat, infoX, cy, !light, 2);
    cy += fs.features + fs.afterFeatures;
  } else {
    cy += fs.afterFeatures;
  }

  ctx.fillStyle = light ? TRAD.textMedium : 'rgba(255,255,255,0.7)';
  ctx.font = fs.serial + "px 'Helvetica Neue', Arial, sans-serif";
  strokeT(ctx, serial, infoX, cy, !light, 2);
}

// ---------- back ----------

function renderBack(ctx, canvas, cfg, card) {
  var W = canvas.width, H = canvas.height;
  var B = 0;
  var CW = W, CH = H;
  var light = isLightTheme(cfg);
  var scale = (cfg.width * DPI) / (2.8 * 300);

  drawBG(ctx, W, H, cfg);
  var bi = drawBorder(ctx, W, H, B, CW, CH, cfg);
  var EB = B + bi, ECW = CW - bi * 2, ECH = CH - bi * 2;
  var pad = Math.round(18 * scale);

  // LEFT: QR Code area
  var qrSize = ECH * 0.72;
  var qrX = EB + pad + Math.round(12 * scale);
  var qrY = EB + (ECH - qrSize) / 2;
  var qrPad = Math.round(8 * scale);

  if (!light) {
    ctx.shadowColor = 'rgba(139,92,246,0.6)';
    ctx.shadowBlur = Math.round(12 * scale);
    ctx.fillStyle = cfg.gradientStart;
    ctx.fillRect(qrX - qrPad, qrY - qrPad, qrSize + qrPad * 2, qrSize + qrPad * 2);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(139,92,246,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(qrX - qrPad, qrY - qrPad, qrSize + qrPad * 2, qrSize + qrPad * 2);
  }
  ctx.fillStyle = '#ffffff';
  if (light) {
    ctx.shadowColor = 'rgba(0,0,0,0.1)'; ctx.shadowBlur = 4;
    ctx.fillRect(qrX - 5, qrY - 5, qrSize + 10, qrSize + 10);
    ctx.shadowBlur = 0;
  } else {
    ctx.fillRect(qrX - 3, qrY - 3, qrSize + 6, qrSize + 6);
  }

  // Draw QR code pattern (deterministic from serial)
  var qrUrl = card.qrUrl || ('https://dcmgrading.com/verify/' + (card.serial || ''));
  var qrGrid = 21; // QR Version 1 = 21x21 modules
  var cellSize = qrSize / qrGrid;
  ctx.fillStyle = '#000000';
  // Generate a deterministic QR-like pattern from the serial
  var serialHash = 0;
  for (var si = 0; si < qrUrl.length; si++) serialHash = ((serialHash << 5) - serialHash + qrUrl.charCodeAt(si)) | 0;
  // Finder patterns (3 corners)
  function drawFinder(fx, fy) {
    ctx.fillRect(qrX + fx * cellSize, qrY + fy * cellSize, 7 * cellSize, cellSize);
    ctx.fillRect(qrX + fx * cellSize, qrY + (fy + 6) * cellSize, 7 * cellSize, cellSize);
    ctx.fillRect(qrX + fx * cellSize, qrY + fy * cellSize, cellSize, 7 * cellSize);
    ctx.fillRect(qrX + (fx + 6) * cellSize, qrY + fy * cellSize, cellSize, 7 * cellSize);
    ctx.fillRect(qrX + (fx + 2) * cellSize, qrY + (fy + 2) * cellSize, 3 * cellSize, 3 * cellSize);
  }
  drawFinder(0, 0); drawFinder(14, 0); drawFinder(0, 14);
  // Data modules (deterministic from serial hash)
  for (var qr = 7; qr < qrGrid; qr++) {
    for (var qc = 7; qc < qrGrid; qc++) {
      if (qr < 9 && qc > 12) continue; // skip near finder
      var bit = ((serialHash * (qr * 31 + qc * 17 + 7)) >>> 0) % 3;
      if (bit === 0) ctx.fillRect(qrX + qc * cellSize, qrY + qr * cellSize, cellSize, cellSize);
    }
  }

  // CENTER: Grade + Condition
  var gradeText = fmtGrade(card.grade, card.isAlteredAuthentic);
  var condText = card.isAlteredAuthentic && card.grade === null ? 'AUTHENTIC' : (card.condition || '').toUpperCase();
  var centerX = EB + ECW / 2;
  var gradeFontSize = Math.round(88 * scale);
  var condFontSize = Math.round(24 * scale);
  var condGap = Math.round(8 * scale);
  var totalH = gradeFontSize + (condText ? condGap + condFontSize : 0);
  var centerStartY = EB + (ECH - totalH) / 2;

  ctx.fillStyle = light ? TRAD.purplePrimary : '#ffffff';
  ctx.font = 'bold ' + gradeFontSize + "px 'Helvetica Neue', Arial, sans-serif";
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  strokeT(ctx, gradeText, centerX, centerStartY, !light, 4);

  if (condText) {
    ctx.fillStyle = light ? TRAD.purpleDark : 'rgba(255,255,255,0.8)';
    ctx.font = 'bold ' + condFontSize + "px 'Helvetica Neue', Arial, sans-serif";
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    strokeT(ctx, condText, centerX, centerStartY + gradeFontSize + condGap, !light, 3);
  }

  // RIGHT: Subgrade scores
  if (card.subScores) {
    var cutPad = Math.round(30 * scale);
    var rightEdge = EB + ECW - pad - cutPad;
    var subFontSize = Math.round(26 * scale);
    var lineH = subFontSize + Math.round(10 * scale);
    var totalSubH = lineH * 4 - Math.round(10 * scale);
    var subStartY = EB + (ECH - totalSubH) / 2;

    var subItems = [
      ['Centering', card.subScores.centering],
      ['Corners', card.subScores.corners],
      ['Edges', card.subScores.edges],
      ['Surface', card.subScores.surface],
    ];

    for (var si2 = 0; si2 < subItems.length; si2++) {
      var val = subItems[si2][1];
      if (val == null || isNaN(val)) continue;
      var y = subStartY + si2 * lineH + subFontSize / 2;
      var scoreText = subItems[si2][0] + ': ' + Math.round(val);
      ctx.fillStyle = light ? TRAD.textMedium : 'rgba(255,255,255,0.95)';
      ctx.font = subFontSize + "px 'Helvetica Neue', Arial, sans-serif";
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      strokeT(ctx, scoreText, rightEdge, y, !light, 2);
    }
  }
}

// ---------- main entry ----------

function renderLabel(payload) {
  try {
    var cfg = payload.config;
    var card = payload.cardData;
    var side = payload.side || 'front';

    var cW = Math.round(cfg.width * DPI);
    var cH = Math.round(cfg.height * DPI);

    var canvas = document.getElementById('c');
    canvas.width = cW;
    canvas.height = cH;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, cW, cH);

    if (side === 'back') {
      renderBack(ctx, canvas, cfg, card);
    } else {
      renderFront(ctx, canvas, cfg, card);
    }

    var dataUrl = canvas.toDataURL('image/png');
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'rendered', dataUrl: dataUrl }));
  } catch (e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: e.message || String(e) }));
  }
}
</script>
</body>
</html>
`

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LabelWebRenderer({
  config,
  cardData,
  onRender,
  side = 'front',
}: LabelWebRendererProps) {
  const webViewRef = useRef<WebView>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const readyRef = useRef(false)

  // Send render command to WebView whenever inputs change
  useEffect(() => {
    if (!config || !cardData) return

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(() => {
      if (!webViewRef.current || !readyRef.current) return
      const payload = JSON.stringify({ config, cardData, side })
      webViewRef.current.injectJavaScript(
        `renderLabel(${payload}); true;`
      )
    }, 200)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [config, cardData, side])

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data)
      if (msg.type === 'rendered' && msg.dataUrl) {
        onRender(msg.dataUrl)
      }
    } catch {
      // Ignore malformed messages
    }
  }

  const handleLoad = () => {
    readyRef.current = true
    // Trigger initial render if we already have data
    if (config && cardData) {
      const payload = JSON.stringify({ config, cardData, side })
      webViewRef.current?.injectJavaScript(
        `renderLabel(${payload}); true;`
      )
    }
  }

  return (
    <View style={styles.container} pointerEvents="none">
      <WebView
        ref={webViewRef}
        source={{ html: LABEL_HTML }}
        style={styles.webview}
        originWhitelist={['*']}
        javaScriptEnabled
        onMessage={handleMessage}
        onLoad={handleLoad}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 0,
    height: 0,
    overflow: 'hidden',
    opacity: 0,
  },
  webview: {
    height: 0,
    width: 0,
  },
})
