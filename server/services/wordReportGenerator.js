const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const JSZip = require('jszip');
const { buildReportData } = require('./reportSectionBuilder');

// ════════════════════════════════════════════════════════════════════════════
// XML Escaping Helpers
// ════════════════════════════════════════════════════════════════════════════
function escapeXml(str) {
  return String(str ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ════════════════════════════════════════════════════════════════════════════
// Pure-JS PNG Encoder + 5x7 Bitmap Font + Clustered Bar Chart Renderer
// ════════════════════════════════════════════════════════════════════════════
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function makePngChunk(typeStr, dataBuf) {
  const typeBuf = Buffer.from(typeStr, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(dataBuf.length, 0);
  const crcInput = Buffer.concat([typeBuf, dataBuf]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, dataBuf, crcBuf]);
}

function encodeRgbPng(width, height, rgbBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // 8-bit depth
  ihdr[9] = 2;  // RGB truecolor
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // Filter type 0 (None)
    rgbBuffer.copy(raw, rowStart + 1, y * stride, (y + 1) * stride);
  }

  const compressed = zlib.deflateSync(raw, { level: 6 });
  return Buffer.concat([
    signature,
    makePngChunk('IHDR', ihdr),
    makePngChunk('IDAT', compressed),
    makePngChunk('IEND', Buffer.alloc(0))
  ]);
}

// Clean 5x7 pixel font for crisp chart labels & legends
const FONT_5X7 = {
  ' ': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
  '0': [0x0E, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0E],
  '1': [0x04, 0x0C, 0x04, 0x04, 0x04, 0x04, 0x0E],
  '2': [0x0E, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1F],
  '3': [0x1F, 0x02, 0x04, 0x06, 0x01, 0x11, 0x0E],
  '4': [0x02, 0x06, 0x0A, 0x12, 0x1F, 0x02, 0x02],
  '5': [0x1F, 0x10, 0x1E, 0x01, 0x01, 0x11, 0x0E],
  '6': [0x06, 0x08, 0x10, 0x1E, 0x11, 0x11, 0x0E],
  '7': [0x1F, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0E, 0x11, 0x11, 0x0E, 0x11, 0x11, 0x0E],
  '9': [0x0E, 0x11, 0x11, 0x0F, 0x01, 0x02, 0x0C],
  '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x0C, 0x0C],
  '-': [0x00, 0x00, 0x00, 0x1F, 0x00, 0x00, 0x00],
  '%': [0x18, 0x19, 0x02, 0x04, 0x08, 0x13, 0x03],
  ':': [0x00, 0x0C, 0x0C, 0x00, 0x0C, 0x0C, 0x00],
  '(': [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ')': [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  '/': [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
  'A': [0x0E, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11],
  'B': [0x1E, 0x11, 0x11, 0x1E, 0x11, 0x11, 0x1E],
  'C': [0x0E, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0E],
  'D': [0x1C, 0x12, 0x11, 0x11, 0x11, 0x12, 0x1C],
  'E': [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x1F],
  'F': [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x10],
  'G': [0x0E, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0F],
  'H': [0x11, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11],
  'I': [0x0E, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0E],
  'J': [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0C],
  'K': [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  'L': [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1F],
  'M': [0x11, 0x1B, 0x15, 0x15, 0x11, 0x11, 0x11],
  'N': [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  'O': [0x0E, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E],
  'P': [0x1E, 0x11, 0x11, 0x1E, 0x10, 0x10, 0x10],
  'Q': [0x0E, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0D],
  'R': [0x1E, 0x11, 0x11, 0x1E, 0x14, 0x12, 0x11],
  'S': [0x0F, 0x10, 0x10, 0x0E, 0x01, 0x01, 0x1E],
  'T': [0x1F, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  'U': [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E],
  'V': [0x11, 0x11, 0x11, 0x11, 0x11, 0x0A, 0x04],
  'W': [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0A],
  'X': [0x11, 0x11, 0x0A, 0x04, 0x0A, 0x11, 0x11],
  'Y': [0x11, 0x11, 0x0A, 0x04, 0x04, 0x04, 0x04],
  'Z': [0x1F, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1F],
  'a': [0x00, 0x00, 0x0E, 0x01, 0x0F, 0x11, 0x0F],
  'b': [0x10, 0x10, 0x16, 0x19, 0x11, 0x11, 0x1E],
  'c': [0x00, 0x00, 0x0E, 0x10, 0x10, 0x11, 0x0E],
  'd': [0x01, 0x01, 0x0D, 0x13, 0x11, 0x11, 0x0F],
  'e': [0x00, 0x00, 0x0E, 0x11, 0x1F, 0x10, 0x0E],
  'f': [0x06, 0x09, 0x08, 0x1C, 0x08, 0x08, 0x08],
  'g': [0x00, 0x0F, 0x11, 0x11, 0x0F, 0x01, 0x0E],
  'h': [0x10, 0x10, 0x16, 0x19, 0x11, 0x11, 0x11],
  'i': [0x04, 0x00, 0x0C, 0x04, 0x04, 0x04, 0x0E],
  'j': [0x02, 0x00, 0x06, 0x02, 0x02, 0x12, 0x0C],
  'k': [0x10, 0x10, 0x12, 0x14, 0x18, 0x14, 0x12],
  'l': [0x0C, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0E],
  'm': [0x00, 0x00, 0x1A, 0x15, 0x15, 0x11, 0x11],
  'n': [0x00, 0x00, 0x16, 0x19, 0x11, 0x11, 0x11],
  'o': [0x00, 0x00, 0x0E, 0x11, 0x11, 0x11, 0x0E],
  'p': [0x00, 0x00, 0x1E, 0x11, 0x1E, 0x10, 0x10],
  'q': [0x00, 0x00, 0x0D, 0x13, 0x0F, 0x01, 0x01],
  'r': [0x00, 0x00, 0x16, 0x19, 0x10, 0x10, 0x10],
  's': [0x00, 0x00, 0x0F, 0x10, 0x0E, 0x01, 0x1E],
  't': [0x08, 0x08, 0x1C, 0x08, 0x08, 0x09, 0x06],
  'u': [0x00, 0x00, 0x11, 0x11, 0x11, 0x13, 0x0D],
  'v': [0x00, 0x00, 0x11, 0x11, 0x11, 0x0A, 0x04],
  'w': [0x00, 0x00, 0x11, 0x11, 0x15, 0x15, 0x0A],
  'x': [0x00, 0x00, 0x11, 0x0A, 0x04, 0x0A, 0x11],
  'y': [0x00, 0x00, 0x11, 0x11, 0x0F, 0x01, 0x0E],
  'z': [0x00, 0x00, 0x1F, 0x02, 0x04, 0x08, 0x1F]
};

// Office Excel theme palette (accent1..accent5)
const SERIES_COLORS = [
  [0x44, 0x72, 0xC4], // Strongly Agree / 5 - Excellent (Royal Blue)
  [0xED, 0x7D, 0x31], // Agree / 4 - Very Good (Orange)
  [0xA5, 0xA5, 0xA5], // Neutral / 3 - Good (Grey)
  [0xFF, 0xC0, 0x00], // Disagree / 2 - Fair (Gold)
  [0x5B, 0x9B, 0xD5]  // Strongly Disagree / 1 - Poor (Sky Blue)
];

function renderBarChartPng(section) {
  const W = 720;
  const H = 410;
  const buf = Buffer.alloc(W * H * 3, 255); // White background

  const setPx = (x, y, r, g, b) => {
    const ix = x | 0;
    const iy = y | 0;
    if (ix < 0 || ix >= W || iy < 0 || iy >= H) return;
    const off = (iy * W + ix) * 3;
    buf[off] = r;
    buf[off + 1] = g;
    buf[off + 2] = b;
  };

  const fillRect = (x0, y0, w, h, rgb) => {
    const [r, g, b] = rgb;
    const xStart = Math.max(0, Math.round(x0));
    const yStart = Math.max(0, Math.round(y0));
    const xEnd = Math.min(W, Math.round(x0 + w));
    const yEnd = Math.min(H, Math.round(y0 + h));
    for (let y = yStart; y < yEnd; y++) {
      let off = (y * W + xStart) * 3;
      for (let x = xStart; x < xEnd; x++) {
        buf[off] = r;
        buf[off + 1] = g;
        buf[off + 2] = b;
        off += 3;
      }
    }
  };

  const drawText = (text, x, y, scale = 2, rgb = [0x33, 0x41, 0x55]) => {
    const str = String(text || '');
    const [r, g, b] = rgb;
    let cx = Math.round(x);
    const cy = Math.round(y);
    for (let i = 0; i < str.length; i++) {
      const glyph = FONT_5X7[str[i]] || FONT_5X7[str[i].toUpperCase()] || FONT_5X7[' '];
      for (let row = 0; row < 7; row++) {
        const bits = glyph[row];
        for (let col = 0; col < 5; col++) {
          if (bits & (1 << (4 - col))) {
            for (let sy = 0; sy < scale; sy++) {
              for (let sx = 0; sx < scale; sx++) {
                setPx(cx + col * scale + sx, cy + row * scale + sy, r, g, b);
              }
            }
          }
        }
      }
      cx += 6 * scale;
    }
  };

  const measureText = (text, scale = 2) => {
    const len = String(text || '').length;
    return len > 0 ? len * 6 * scale - scale : 0;
  };

  // Subtle card border
  fillRect(0, 0, W, 2, [0xE2, 0xE8, 0xF0]);
  fillRect(0, H - 2, W, 2, [0xE2, 0xE8, 0xF0]);
  fillRect(0, 0, 2, H, [0xE2, 0xE8, 0xF0]);
  fillRect(W - 2, 0, 2, H, [0xE2, 0xE8, 0xF0]);

  const plotLeft = 64;
  const plotRight = W - 26;
  const plotTop = 26;
  const plotBottom = 292;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;

  // Y-axis gridlines & labels (0..100%)
  const ySteps = [0, 20, 40, 60, 80, 100];
  ySteps.forEach(val => {
    const gy = Math.round(plotBottom - (val / 100) * plotH);
    const lineColor = val === 0 ? [0x94, 0xA3, 0xB8] : [0xE2, 0xE8, 0xF0];
    fillRect(plotLeft, gy, plotW, val === 0 ? 2 : 1, lineColor);
    const lbl = `${val}`;
    const lw = measureText(lbl, 2);
    drawText(lbl, plotLeft - lw - 10, gy - 7, 2, [0x47, 0x55, 0x69]);
  });

  // Clustered bars
  const qCount = Math.max(1, section.questions.length);
  const sCount = section.distributions.length;
  const groupW = plotW / qCount;
  const clusterW = Math.min(groupW * 0.72, sCount * 38);
  const barGap = 4;
  const barW = Math.max(6, Math.floor((clusterW - barGap * (sCount - 1)) / sCount));
  const actualClusterW = barW * sCount + barGap * (sCount - 1);

  for (let qIdx = 0; qIdx < qCount; qIdx++) {
    const groupCenterX = plotLeft + groupW * (qIdx + 0.5);
    const clusterStartX = groupCenterX - actualClusterW / 2;

    for (let sIdx = 0; sIdx < sCount; sIdx++) {
      const pct = Math.max(0, Math.min(100, Number(section.distributions[sIdx]?.values[qIdx] || 0)));
      const barH = Math.round((pct / 100) * plotH);
      const bx = Math.round(clusterStartX + sIdx * (barW + barGap));
      const by = plotBottom - barH;
      const color = SERIES_COLORS[sIdx % SERIES_COLORS.length];

      if (barH > 0) {
        fillRect(bx, by, barW, barH, color);
      }
    }

    // Category label (Q. 1, Q. 2, ...)
    const qObj = section.questions[qIdx];
    const catLabel = qObj ? `Q. ${qObj.qNum}` : `Q. ${qIdx + 1}`;
    const cw = measureText(catLabel, 2);
    drawText(catLabel, groupCenterX - cw / 2, plotBottom + 12, 2, [0x1E, 0x29, 0x3B]);
  }

  // Legend at bottom (2 rows max for clean readability)
  const labels = section.scaleLabels || [];
  const row1Items = labels.slice(0, 3);
  const row2Items = labels.slice(3);

  const renderLegendRow = (items, offsetIdx, yPos) => {
    if (items.length === 0) return;
    const itemWidths = items.map(lbl => 16 + 6 + measureText(lbl, 2));
    const gap = 22;
    const totalW = itemWidths.reduce((a, b) => a + b, 0) + gap * (items.length - 1);
    let lx = Math.max(16, Math.round((W - totalW) / 2));
    items.forEach((lbl, idx) => {
      const color = SERIES_COLORS[(offsetIdx + idx) % SERIES_COLORS.length];
      fillRect(lx, yPos, 14, 14, color);
      drawText(lbl, lx + 20, yPos, 2, [0x33, 0x41, 0x55]);
      lx += itemWidths[idx] + gap;
    });
  };

  renderLegendRow(row1Items, 0, 340);
  renderLegendRow(row2Items, 3, 370);

  return encodeRgbPng(W, H, buf);
}

// ════════════════════════════════════════════════════════════════════════════
// Extract Institutional Logo from feedback_template.xlsx if available
// ════════════════════════════════════════════════════════════════════════════
let cachedLogoBuffer = undefined;
async function getTemplateLogoBuffer() {
  if (cachedLogoBuffer !== undefined) return cachedLogoBuffer;
  const templatePath = path.join(__dirname, '..', 'feedback_template.xlsx');
  if (!fs.existsSync(templatePath)) {
    cachedLogoBuffer = null;
    return null;
  }
  try {
    const fileBuf = fs.readFileSync(templatePath);
    const zip = await JSZip.loadAsync(fileBuf);
    const logoEntry = zip.file('xl/media/image1.jpeg');
    if (logoEntry) {
      cachedLogoBuffer = await logoEntry.async('nodebuffer');
      return cachedLogoBuffer;
    }
  } catch {
    // Ignore logo extraction failures cleanly
  }
  cachedLogoBuffer = null;
  return null;
}

// ════════════════════════════════════════════════════════════════════════════
// OpenXML WordprocessingML Builders
// ════════════════════════════════════════════════════════════════════════════
function wRun(text, { bold = false, italic = false, sizeHalfPt = 20, color = '111827' } = {}) {
  return `<w:r>
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
      ${bold ? '<w:b/><w:bCs/>' : ''}
      ${italic ? '<w:i/><w:iCs/>' : ''}
      <w:color w:val="${color}"/>
      <w:sz w:val="${sizeHalfPt}"/>
      <w:szCs w:val="${sizeHalfPt}"/>
    </w:rPr>
    <w:t xml:space="preserve">${escapeXml(text)}</w:t>
  </w:r>`;
}

function wPara(runsXml, { align = 'left', spaceBefore = 40, spaceAfter = 40, line = 260 } = {}) {
  return `<w:p>
    <w:pPr>
      <w:spacing w:before="${spaceBefore}" w:after="${spaceAfter}" w:line="${line}" w:lineRule="auto"/>
      <w:jc w:val="${align}"/>
    </w:pPr>
    ${runsXml}
  </w:p>`;
}

function wInlineImage({ rId, docPrId, name, cx, cy }) {
  return `<w:r>
    <w:drawing>
      <wp:inline distT="0" distB="0" distL="0" distR="0">
        <wp:extent cx="${cx}" cy="${cy}"/>
        <wp:effectExtent l="0" t="0" r="0" b="0"/>
        <wp:docPr id="${docPrId}" name="${escapeXml(name)}"/>
        <wp:cNvGraphicFramePr>
          <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
        </wp:cNvGraphicFramePr>
        <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:nvPicPr>
                <pic:cNvPr id="${docPrId}" name="${escapeXml(name)}"/>
                <pic:cNvPicPr/>
              </pic:nvPicPr>
              <pic:blipFill>
                <a:blip r:embed="${rId}"/>
                <a:stretch><a:fillRect/></a:stretch>
              </pic:blipFill>
              <pic:spPr>
                <a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
                <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
              </pic:spPr>
            </pic:pic>
          </a:graphicData>
        </a:graphic>
      </wp:inline>
    </w:drawing>
  </w:r>`;
}

function wTableBorders(borderColor = '94A3B8', sz = 6) {
  return `<w:tblBorders>
    <w:top w:val="single" w:sz="${sz}" w:space="0" w:color="${borderColor}"/>
    <w:left w:val="single" w:sz="${sz}" w:space="0" w:color="${borderColor}"/>
    <w:bottom w:val="single" w:sz="${sz}" w:space="0" w:color="${borderColor}"/>
    <w:right w:val="single" w:sz="${sz}" w:space="0" w:color="${borderColor}"/>
    <w:insideH w:val="single" w:sz="${sz}" w:space="0" w:color="${borderColor}"/>
    <w:insideV w:val="single" w:sz="${sz}" w:space="0" w:color="${borderColor}"/>
  </w:tblBorders>`;
}

function wBannerTable(title) {
  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="10800" w:type="dxa"/>
      ${wTableBorders('64748B', 8)}
      <w:tblCellMar>
        <w:top w:w="100" w:type="dxa"/>
        <w:left w:w="140" w:type="dxa"/>
        <w:bottom w:w="100" w:type="dxa"/>
        <w:right w:w="140" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    <w:tblGrid><w:gridCol w:w="10800"/></w:tblGrid>
    <w:tr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="10800" w:type="dxa"/>
          <w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>
          <w:vAlign w:val="center"/>
        </w:tcPr>
        ${wPara(wRun(title, { bold: true, sizeHalfPt: 23, color: '0F172A' }), { align: 'center', spaceBefore: 20, spaceAfter: 20 })}
      </w:tc>
    </w:tr>
  </w:tbl>`;
}

/**
 * Generate a `.docx` Word document mirroring Excel Sheet 3 (`Final Feedback`):
 * - Institutional Header (+ RUET logo)
 * - A. CORE QUESTIONS (each section with Sl., Questions, embedded clustered bar chart, and Comments row)
 * - B. SUMMARY & PERFORMANCE METRICS (per-section Avg & Attainment + Overall row)
 * - No Option C
 */
exports.generateFeedbackWord = async function ({ assignment, feedbacks = [], feedbackConfig = null }) {
  const report = await buildReportData({ assignment, feedbacks, feedbackConfig });
  const { meta, sections, overallAvg, overallAttainmentPct } = report;

  const zip = new JSZip();
  const relEntries = [
    {
      id: 'rIdStyles',
      type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles',
      target: 'styles.xml'
    }
  ];

  let nextDocPrId = 1;

  // Optional logo from template
  const logoBuf = await getTemplateLogoBuffer();
  const hasLogo = Boolean(logoBuf);
  if (hasLogo) {
    zip.file('word/media/logo.jpeg', logoBuf);
    relEntries.push({
      id: 'rIdLogo',
      type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
      target: 'media/logo.jpeg'
    });
  }

  // Generate PNG chart per section
  sections.forEach((sec, idx) => {
    const chartPng = renderBarChartPng(sec);
    const chartIndex = idx + 1;
    const rId = `rIdChart${chartIndex}`;
    zip.file(`word/media/chart${chartIndex}.png`, chartPng);
    relEntries.push({
      id: rId,
      type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
      target: `media/chart${chartIndex}.png`
    });
    sec.wordChartRId = rId;
  });

  // 1. Institutional Header Block
  const courseHeading = meta.courseCode
    ? `Students' Feedback on ${meta.courseName} (${meta.courseCode})`
    : `Students' Feedback on ${meta.courseName}`;
  const teacherLineParts = [meta.teacherName, meta.teacherDesignation, meta.deptCode ? `Dept of ${meta.deptCode}` : ''].filter(Boolean);
  const teacherLine = `Course Teacher: ${teacherLineParts.join(', ')}`;
  const sessionLine = `Session: ${meta.series || 'N/A'}  |  Semester: ${meta.semester || 'N/A'}  |  Total Participants: ${meta.totalStudents}`;

  const headerTextParas = [
    wPara(wRun(`Department of ${meta.deptName}`, { bold: true, sizeHalfPt: 30, color: '0F172A' }), { align: 'center', spaceBefore: 0, spaceAfter: 40 }),
    wPara(wRun('Rajshahi University of Engineering & Technology', { italic: true, sizeHalfPt: 22, color: '334155' }), { align: 'center', spaceBefore: 0, spaceAfter: 40 }),
    wPara(wRun(courseHeading, { bold: true, sizeHalfPt: 25, color: '0F172A' }), { align: 'center', spaceBefore: 20, spaceAfter: 40 }),
    wPara(wRun(teacherLine, { sizeHalfPt: 21, color: '1E293B' }), { align: 'center', spaceBefore: 0, spaceAfter: 30 }),
    wPara(wRun(sessionLine, { sizeHalfPt: 20, color: '334155' }), { align: 'center', spaceBefore: 0, spaceAfter: 20 })
  ].join('');

  const headerBlockXml = hasLogo
    ? `<w:tbl>
        <w:tblPr>
          <w:tblW w:w="10800" w:type="dxa"/>
          <w:tblBorders>
            <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>
            <w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>
            <w:bottom w:val="single" w:sz="8" w:space="0" w:color="CBD5E1"/>
            <w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>
            <w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>
            <w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          </w:tblBorders>
          <w:tblCellMar>
            <w:top w:w="40" w:type="dxa"/>
            <w:left w:w="60" w:type="dxa"/>
            <w:bottom w:w="100" w:type="dxa"/>
            <w:right w:w="60" w:type="dxa"/>
          </w:tblCellMar>
        </w:tblPr>
        <w:tblGrid>
          <w:gridCol w:w="1300"/>
          <w:gridCol w:w="9500"/>
        </w:tblGrid>
        <w:tr>
          <w:tc>
            <w:tcPr>
              <w:tcW w:w="1300" w:type="dxa"/>
              <w:vAlign w:val="center"/>
            </w:tcPr>
            ${wPara(wInlineImage({ rId: 'rIdLogo', docPrId: nextDocPrId++, name: 'Institution Logo', cx: 640000, cy: 740000 }), { align: 'center', spaceBefore: 0, spaceAfter: 0 })}
          </w:tc>
          <w:tc>
            <w:tcPr>
              <w:tcW w:w="9500" w:type="dxa"/>
              <w:vAlign w:val="center"/>
            </w:tcPr>
            ${headerTextParas}
          </w:tc>
        </w:tr>
      </w:tbl>`
    : headerTextParas;

  // 2. Section A: Core Questions Tables
  const sectionTablesXml = sections.map((sec, sIdx) => {
    const ffQuestions = sec.questions.map(q => (
      sec.scaleType === 'rating' && !/\(1\s*-\s*5\)/.test(q.text) ? `${q.text} (1-5)` : q.text
    ));

    const chartImgXml = wInlineImage({
      rId: sec.wordChartRId,
      docPrId: nextDocPrId++,
      name: `Chart ${sIdx + 1}`,
      cx: 3320000,
      cy: 1890000
    });

    const headerRowXml = `<w:tr>
      <w:trPr><w:cantSplit/></w:trPr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="650" w:type="dxa"/>
          <w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/>
          <w:vAlign w:val="center"/>
        </w:tcPr>
        ${wPara(wRun('Sl.', { bold: true, sizeHalfPt: 20 }), { align: 'center' })}
      </w:tc>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="4350" w:type="dxa"/>
          <w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/>
          <w:vAlign w:val="center"/>
        </w:tcPr>
        ${wPara(wRun(sec.ffTitle, { bold: true, sizeHalfPt: 20 }))}
      </w:tc>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="5800" w:type="dxa"/>
          <w:vMerge w:val="restart"/>
          <w:vAlign w:val="center"/>
        </w:tcPr>
        ${wPara(chartImgXml, { align: 'center', spaceBefore: 40, spaceAfter: 40 })}
      </w:tc>
    </w:tr>`;

    const questionRowsXml = ffQuestions.map((qText, qIdx) => `<w:tr>
      <w:trPr><w:cantSplit/></w:trPr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="650" w:type="dxa"/>
          <w:vAlign w:val="center"/>
        </w:tcPr>
        ${wPara(wRun(String(qIdx + 1), { sizeHalfPt: 19 }), { align: 'center' })}
      </w:tc>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="4350" w:type="dxa"/>
          <w:vAlign w:val="center"/>
        </w:tcPr>
        ${wPara(wRun(qText, { sizeHalfPt: 19 }))}
      </w:tc>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="5800" w:type="dxa"/>
          <w:vMerge/>
          <w:vAlign w:val="center"/>
        </w:tcPr>
        ${wPara('', { spaceBefore: 0, spaceAfter: 0 })}
      </w:tc>
    </w:tr>`).join('');

    const commentSl = ffQuestions.length + 1;
    const commentSummary = sec.comments.length > 0 ? sec.comments.slice(0, 4).join('; ') : 'No comments';
    const commentRowXml = `<w:tr>
      <w:trPr><w:cantSplit/></w:trPr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="650" w:type="dxa"/>
          <w:vAlign w:val="center"/>
        </w:tcPr>
        ${wPara(wRun(String(commentSl), { sizeHalfPt: 19 }), { align: 'center' })}
      </w:tc>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="10150" w:type="dxa"/>
          <w:gridSpan w:val="2"/>
          <w:vAlign w:val="center"/>
        </w:tcPr>
        ${wPara(
          wRun('Comments (if any): ', { bold: true, italic: true, sizeHalfPt: 19 }) +
          wRun(commentSummary, { italic: true, sizeHalfPt: 19, color: '334155' })
        )}
      </w:tc>
    </w:tr>`;

    return `<w:tbl>
      <w:tblPr>
        <w:tblW w:w="10800" w:type="dxa"/>
        ${wTableBorders('94A3B8', 6)}
        <w:tblCellMar>
          <w:top w:w="70" w:type="dxa"/>
          <w:left w:w="110" w:type="dxa"/>
          <w:bottom w:w="70" w:type="dxa"/>
          <w:right w:w="110" w:type="dxa"/>
        </w:tblCellMar>
      </w:tblPr>
      <w:tblGrid>
        <w:gridCol w:w="650"/>
        <w:gridCol w:w="4350"/>
        <w:gridCol w:w="5800"/>
      </w:tblGrid>
      ${headerRowXml}
      ${questionRowsXml}
      ${commentRowXml}
    </w:tbl>
    ${wPara('', { spaceBefore: 60, spaceAfter: 60 })}`;
  }).join('');

  // 3. Section B: Summary & Performance Metrics Table
  const summaryHeaderRow = `<w:tr>
    <w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>
    <w:tc>
      <w:tcPr>
        <w:tcW w:w="650" w:type="dxa"/>
        <w:shd w:val="clear" w:color="auto" w:fill="E7E6E6"/>
        <w:vAlign w:val="center"/>
      </w:tcPr>
      ${wPara(wRun('Sl.', { bold: true, sizeHalfPt: 20 }), { align: 'center' })}
    </w:tc>
    <w:tc>
      <w:tcPr>
        <w:tcW w:w="4350" w:type="dxa"/>
        <w:shd w:val="clear" w:color="auto" w:fill="E7E6E6"/>
        <w:vAlign w:val="center"/>
      </w:tcPr>
      ${wPara(wRun('Evaluation Criteria / Section', { bold: true, sizeHalfPt: 20 }))}
    </w:tc>
    <w:tc>
      <w:tcPr>
        <w:tcW w:w="5800" w:type="dxa"/>
        <w:shd w:val="clear" w:color="auto" w:fill="E7E6E6"/>
        <w:vAlign w:val="center"/>
      </w:tcPr>
      ${wPara(wRun('Performance Summary (Avg Score out of 5.0  |  Attainment % Favorable >= 3)', { bold: true, sizeHalfPt: 19 }), { align: 'center' })}
    </w:tc>
  </w:tr>`;

  const summaryMetricRows = sections.map((sec, idx) => `<w:tr>
    <w:trPr><w:cantSplit/></w:trPr>
    <w:tc>
      <w:tcPr>
        <w:tcW w:w="650" w:type="dxa"/>
        <w:vAlign w:val="center"/>
      </w:tcPr>
      ${wPara(wRun(String(idx + 1), { sizeHalfPt: 19 }), { align: 'center' })}
    </w:tc>
    <w:tc>
      <w:tcPr>
        <w:tcW w:w="4350" w:type="dxa"/>
        <w:vAlign w:val="center"/>
      </w:tcPr>
      ${wPara(wRun(sec.metricTitle, { bold: true, sizeHalfPt: 19 }))}
    </w:tc>
    <w:tc>
      <w:tcPr>
        <w:tcW w:w="5800" w:type="dxa"/>
        <w:vAlign w:val="center"/>
      </w:tcPr>
      ${wPara(
        wRun(`Average Score: ${sec.avgScore.toFixed(2)} / 5.00      |      Attainment: ${sec.attainmentPct} Favorable (Rating >= 3)`, { sizeHalfPt: 19 }),
        { align: 'center' }
      )}
    </w:tc>
  </w:tr>`).join('');

  const summaryOverallRow = `<w:tr>
    <w:trPr><w:cantSplit/></w:trPr>
    <w:tc>
      <w:tcPr>
        <w:tcW w:w="650" w:type="dxa"/>
        <w:shd w:val="clear" w:color="auto" w:fill="FFF2CC"/>
        <w:vAlign w:val="center"/>
      </w:tcPr>
      ${wPara(wRun('★', { bold: true, sizeHalfPt: 20 }), { align: 'center' })}
    </w:tc>
    <w:tc>
      <w:tcPr>
        <w:tcW w:w="4350" w:type="dxa"/>
        <w:shd w:val="clear" w:color="auto" w:fill="FFF2CC"/>
        <w:vAlign w:val="center"/>
      </w:tcPr>
      ${wPara(wRun('Overall Course Rating & Attainment', { bold: true, sizeHalfPt: 20 }))}
    </w:tc>
    <w:tc>
      <w:tcPr>
        <w:tcW w:w="5800" w:type="dxa"/>
        <w:shd w:val="clear" w:color="auto" w:fill="FFF2CC"/>
        <w:vAlign w:val="center"/>
      </w:tcPr>
      ${wPara(
        wRun(`Average Score: ${overallAvg.toFixed(2)} / 5.00      |      Attainment: ${overallAttainmentPct} Favorable (Rating >= 3)`, { bold: true, sizeHalfPt: 20 }),
        { align: 'center' }
      )}
    </w:tc>
  </w:tr>`;

  const summaryTableXml = `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="10800" w:type="dxa"/>
      ${wTableBorders('94A3B8', 6)}
      <w:tblCellMar>
        <w:top w:w="80" w:type="dxa"/>
        <w:left w:w="110" w:type="dxa"/>
        <w:bottom w:w="80" w:type="dxa"/>
        <w:right w:w="110" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    <w:tblGrid>
      <w:gridCol w:w="650"/>
      <w:gridCol w:w="4350"/>
      <w:gridCol w:w="5800"/>
    </w:tblGrid>
    ${summaryHeaderRow}
    ${summaryMetricRows}
    ${summaryOverallRow}
  </w:tbl>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    ${headerBlockXml}
    ${wPara('', { spaceBefore: 60, spaceAfter: 60 })}
    ${wBannerTable('A. CORE QUESTIONS')}
    ${wPara('', { spaceBefore: 60, spaceAfter: 60 })}
    ${sectionTablesXml}
    ${wBannerTable('B. SUMMARY & PERFORMANCE METRICS')}
    ${wPara('', { spaceBefore: 60, spaceAfter: 60 })}
    ${summaryTableXml}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="360" w:footer="360" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="20"/>
        <w:szCs w:val="20"/>
        <w:lang w:val="en-US"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="60" w:line="260" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
</w:styles>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${relEntries.map(r => `<Relationship Id="${r.id}" Type="${r.type}" Target="${r.target}"/>`).join('\n  ')}
</Relationships>`;

  zip.file('[Content_Types].xml', contentTypesXml);
  zip.file('_rels/.rels', rootRelsXml);
  zip.file('word/styles.xml', stylesXml);
  zip.file('word/_rels/document.xml.rels', docRelsXml);
  zip.file('word/document.xml', documentXml);

  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
};

