const path = require('path');
const fs = require('fs');
const XlsxPopulate = require('xlsx-populate');
const { contentScore, coEntryScore, facilitiesScore, teacherScore } = require('../utils/feedbackScores');

// Helper to convert column number (1-based) to Excel letter (A, B, ..., Z, AA, AB, ...)
function colToLetter(col) {
  let temp = col;
  let letter = '';
  while (temp > 0) {
    let mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter;
}

function ratingToText(val) {
  const map = { 5: 'Strongly Agree', 4: 'Agree', 3: 'Neutral', 2: 'Disagree', 1: 'Strongly Disagree' };
  return map[val] || '';
}

// Course Teacher numeric rating (1-5)
const TEACHER_RATING_LABELS = ['5 - Excellent', '4 - Very Good', '3 - Good', '2 - Fair', '1 - Poor'];
function teacherRatingToText(val) {
  const map = { 5: '5 - Excellent', 4: '4 - Very Good', 3: '3 - Good', 2: '2 - Fair', 1: '1 - Poor' };
  return map[val] || '';
}

// Reset all stale merged cells from a worksheet
function resetSheetMerges(sheet) {
  sheet._mergeCells = {};
  if (sheet._mergeCellsNode) {
    sheet._mergeCellsNode.children = [];
    sheet._mergeCellsNode.attributes = { count: 0 };
  }
}

// Generate valid 32-character GUID matching Excel's native pattern: {00000000-0008-0000-0200-XXXXXXXXXXXX}
function makeGuid(index) {
  const hexPart = String(index).padStart(6, '0') + '000000';
  return `{00000000-0008-0000-0200-${hexPart}}`;
}

function buildChartXml({ chartId, catRange, catLabels, seriesList }) {
  const catCount = catLabels.length;
  const colors = ['accent1', 'accent2', 'accent3', 'accent4', 'accent5'];
  const catPtsXml = catLabels.map((lbl, idx) => `<c:pt idx="${idx}"><c:v>${lbl}</c:v></c:pt>`).join('');

  const seriesXml = seriesList.map((ser, sIdx) => {
    const valPtsXml = ser.values.map((v, idx) => `<c:pt idx="${idx}"><c:v>${v}</c:v></c:pt>`).join('');
    const clr = colors[sIdx % colors.length];
    return `
      <c:ser>
        <c:idx val="${sIdx}"/>
        <c:order val="${sIdx}"/>
        <c:tx>
          <c:strRef>
            <c:f>${ser.labelCell}</c:f>
            <c:strCache>
              <c:ptCount val="1"/>
              <c:pt idx="0"><c:v>${ser.name}</c:v></c:pt>
            </c:strCache>
          </c:strRef>
        </c:tx>
        <c:spPr>
          <a:solidFill><a:schemeClr val="${clr}"/></a:solidFill>
          <a:ln><a:noFill/></a:ln>
          <a:effectLst/>
        </c:spPr>
        <c:invertIfNegative val="0"/>
        <c:cat>
          <c:strRef>
            <c:f>${catRange}</c:f>
            <c:strCache>
              <c:ptCount val="${catCount}"/>
              ${catPtsXml}
            </c:strCache>
          </c:strRef>
        </c:cat>
        <c:val>
          <c:numRef>
            <c:f>${ser.valRange}</c:f>
            <c:numCache>
              <c:formatCode>0.0</c:formatCode>
              <c:ptCount val="${catCount}"/>
              ${valPtsXml}
            </c:numCache>
          </c:numRef>
        </c:val>
      </c:ser>
    `;
  }).join('');

  const axId1 = 100000000 + chartId * 2;
  const axId2 = 100000001 + chartId * 2;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:date1904 val="0"/>
  <c:lang val="en-US"/>
  <c:roundedCorners val="0"/>
  <mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">
    <mc:Choice Requires="c14" xmlns:c14="http://schemas.microsoft.com/office/drawing/2007/8/2/chart">
      <c14:style val="102"/>
    </mc:Choice>
    <mc:Fallback>
      <c:style val="2"/>
    </mc:Fallback>
  </mc:AlternateContent>
  <c:chart>
    <c:autoTitleDeleted val="1"/>
    <c:plotArea>
      <c:layout>
        <c:manualLayout>
          <c:layoutTarget val="inner"/>
          <c:xMode val="edge"/>
          <c:yMode val="edge"/>
          <c:x val="0.06"/>
          <c:y val="0.03"/>
          <c:w val="0.90"/>
          <c:h val="0.78"/>
        </c:manualLayout>
      </c:layout>
      <c:barChart>
        <c:barDir val="col"/>
        <c:grouping val="clustered"/>
        <c:varyColors val="0"/>
        ${seriesXml}
        <c:dLbls>
          <c:showLegendKey val="0"/>
          <c:showVal val="0"/>
          <c:showCatName val="0"/>
          <c:showSerName val="0"/>
          <c:showPercent val="0"/>
          <c:showBubbleSize val="0"/>
        </c:dLbls>
        <c:gapWidth val="219"/>
        <c:overlap val="-27"/>
        <c:axId val="${axId1}"/>
        <c:axId val="${axId2}"/>
      </c:barChart>
      <c:catAx>
        <c:axId val="${axId1}"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/>
        <c:axPos val="b"/>
        <c:numFmt formatCode="General" sourceLinked="1"/>
        <c:majorTickMark val="none"/>
        <c:minorTickMark val="none"/>
        <c:tickLblPos val="nextTo"/>
        <c:spPr>
          <a:noFill/>
          <a:ln w="9525" cap="flat" cmpd="sng" algn="ctr">
            <a:solidFill><a:schemeClr val="tx1"><a:lumMod val="15000"/><a:lumOff val="85000"/></a:schemeClr></a:solidFill>
            <a:round/>
          </a:ln>
          <a:effectLst/>
        </c:spPr>
        <c:txPr>
          <a:bodyPr rot="-60000000" spcFirstLastPara="1" vertOverflow="ellipsis" vert="horz" wrap="square" anchor="ctr" anchorCtr="1"/>
          <a:lstStyle/>
          <a:p>
            <a:pPr>
              <a:defRPr sz="900" b="0" i="0" u="none" strike="noStrike" kern="1200" baseline="0">
                <a:solidFill><a:schemeClr val="tx1"/></a:solidFill>
                <a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/>
              </a:defRPr>
            </a:pPr>
            <a:endParaRPr lang="en-US"/>
          </a:p>
        </c:txPr>
        <c:crossAx val="${axId2}"/>
        <c:crosses val="autoZero"/>
        <c:auto val="1"/>
        <c:lblAlgn val="ctr"/>
        <c:lblOffset val="100"/>
        <c:noMultiLvlLbl val="0"/>
      </c:catAx>
      <c:valAx>
        <c:axId val="${axId2}"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/>
        <c:axPos val="l"/>
        <c:majorGridlines>
          <c:spPr>
            <a:ln w="9525" cap="flat" cmpd="sng" algn="ctr">
              <a:solidFill><a:schemeClr val="tx1"><a:lumMod val="15000"/><a:lumOff val="85000"/></a:schemeClr></a:solidFill>
              <a:round/>
            </a:ln>
            <a:effectLst/>
          </c:spPr>
        </c:majorGridlines>
        <c:numFmt formatCode="#,##0" sourceLinked="0"/>
        <c:majorTickMark val="none"/>
        <c:minorTickMark val="none"/>
        <c:tickLblPos val="nextTo"/>
        <c:spPr><a:noFill/><a:ln><a:noFill/></a:ln><a:effectLst/></c:spPr>
        <c:txPr>
          <a:bodyPr rot="-60000000" spcFirstLastPara="1" vertOverflow="ellipsis" vert="horz" wrap="square" anchor="ctr" anchorCtr="1"/>
          <a:lstStyle/>
          <a:p>
            <a:pPr>
              <a:defRPr sz="900" b="0" i="0" u="none" strike="noStrike" kern="1200" baseline="0">
                <a:solidFill><a:schemeClr val="tx1"/></a:solidFill>
                <a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/>
              </a:defRPr>
            </a:pPr>
            <a:endParaRPr lang="en-US"/>
          </a:p>
        </c:txPr>
        <c:crossAx val="${axId1}"/>
        <c:crosses val="autoZero"/>
        <c:crossBetween val="between"/>
      </c:valAx>
      <c:spPr><a:noFill/><a:ln><a:noFill/></a:ln><a:effectLst/></c:spPr>
    </c:plotArea>
    <c:legend>
      <c:legendPos val="b"/>
      <c:layout>
        <c:manualLayout>
          <c:xMode val="edge"/>
          <c:yMode val="edge"/>
          <c:x val="0.05"/>
          <c:y val="0.89"/>
          <c:w val="0.90"/>
          <c:h val="0.10"/>
        </c:manualLayout>
      </c:layout>
      <c:overlay val="0"/>
      <c:spPr><a:noFill/><a:ln><a:noFill/></a:ln><a:effectLst/></c:spPr>
      <c:txPr>
        <a:bodyPr rot="0" spcFirstLastPara="1" vertOverflow="ellipsis" vert="horz" wrap="square" anchor="ctr" anchorCtr="1"/>
        <a:lstStyle/>
        <a:p>
          <a:pPr>
            <a:defRPr sz="900" b="0" i="0" u="none" strike="noStrike" kern="1200" baseline="0">
              <a:solidFill><a:schemeClr val="tx1"/></a:solidFill>
              <a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/>
            </a:defRPr>
          </a:pPr>
          <a:endParaRPr lang="en-US"/>
        </a:p>
      </c:txPr>
    </c:legend>
    <c:plotVisOnly val="1"/>
    <c:dispBlanksAs val="gap"/>
    <c:showDLblsOverMax val="0"/>
  </c:chart>
  <c:spPr>
    <a:solidFill><a:schemeClr val="bg1"/></a:solidFill>
    <a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:noFill/><a:round/></a:ln>
    <a:effectLst/>
  </c:spPr>
  <c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr/></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr>
  <c:printSettings>
    <c:headerFooter/>
    <c:pageMargins b="0.75" l="0.7" r="0.7" t="0.75" header="0.3" footer="0.3"/>
    <c:pageSetup orientation="portrait"/>
  </c:printSettings>
</c:chartSpace>`;
}

function estimateRowHeight(text, { colWidth = 32, isBold = false, fontSize = 10, minHeight = 22, linePadding = 6 } = {}) {
  if (!text) return minHeight;
  const charsPerLine = Math.max(10, Math.floor(colWidth * (isBold ? 0.82 : 0.95)));
  const words = String(text).split(/\s+/);
  let lineCount = 1;
  let curLineLen = 0;
  for (const w of words) {
    if (curLineLen === 0) {
      curLineLen = w.length;
    } else if (curLineLen + 1 + w.length <= charsPerLine) {
      curLineLen += 1 + w.length;
    } else {
      lineCount++;
      curLineLen = w.length;
    }
  }
  const singleLineHeight = Math.max(14, fontSize * 1.35);
  return Math.max(minHeight, Math.round(lineCount * singleLineHeight + linePadding));
}

function buildDrawingXml(chartAnchors, imageAnchor) {
  const anchorsXml = chartAnchors.map(ca => {
    const guid = makeGuid(ca.chartIndex + 1);
    return `
    <xdr:twoCellAnchor>
      <xdr:from>
        <xdr:col>2</xdr:col>
        <xdr:colOff>30480</xdr:colOff>
        <xdr:row>${ca.fromRow}</xdr:row>
        <xdr:rowOff>45720</xdr:rowOff>
      </xdr:from>
      <xdr:to>
        <xdr:col>2</xdr:col>
        <xdr:colOff>4198620</xdr:colOff>
        <xdr:row>${ca.toRow}</xdr:row>
        <xdr:rowOff>${ca.toRowOff !== undefined ? ca.toRowOff : 0}</xdr:rowOff>
      </xdr:to>
      <xdr:graphicFrame macro="">
        <xdr:nvGraphicFramePr>
          <xdr:cNvPr id="${ca.id}" name="Chart ${ca.chartIndex}">
            <a:extLst>
              <a:ext uri="{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}">
                <a16:creationId xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main" id="${guid}"/>
              </a:ext>
            </a:extLst>
          </xdr:cNvPr>
          <xdr:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></xdr:cNvGraphicFramePr>
        </xdr:nvGraphicFramePr>
        <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
        <a:graphic>
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
            <c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${ca.rId}"/>
          </a:graphicData>
        </a:graphic>
      </xdr:graphicFrame>
      <xdr:clientData/>
    </xdr:twoCellAnchor>
  `;
  }).join('');

  const picGuid = makeGuid(chartAnchors.length + 2);
  const picXml = imageAnchor ? `
    <xdr:twoCellAnchor editAs="oneCell">
      <xdr:from>
        <xdr:col>0</xdr:col>
        <xdr:colOff>220980</xdr:colOff>
        <xdr:row>0</xdr:row>
        <xdr:rowOff>68579</xdr:rowOff>
      </xdr:from>
      <xdr:to>
        <xdr:col>1</xdr:col>
        <xdr:colOff>594360</xdr:colOff>
        <xdr:row>4</xdr:row>
        <xdr:rowOff>40638</xdr:rowOff>
      </xdr:to>
      <xdr:pic>
        <xdr:nvPicPr>
          <xdr:cNvPr id="${imageAnchor.id}" name="Picture 7" descr="RUET Logo">
            <a:extLst>
              <a:ext uri="{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}">
                <a16:creationId xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main" id="${picGuid}"/>
              </a:ext>
            </a:extLst>
          </xdr:cNvPr>
          <xdr:cNvPicPr><a:picLocks noChangeAspect="1" noChangeArrowheads="1"/></xdr:cNvPicPr>
        </xdr:nvPicPr>
        <xdr:blipFill>
          <a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${imageAnchor.rId}" cstate="print">
            <a:extLst>
              <a:ext uri="{28A0092B-C50C-407E-A947-70E740481C1C}">
                <a14:useLocalDpi xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main" val="0"/>
              </a:ext>
            </a:extLst>
          </a:blip>
          <a:srcRect/><a:stretch><a:fillRect/></a:stretch>
        </xdr:blipFill>
        <xdr:spPr bwMode="auto">
          <a:xfrm><a:off x="220980" y="68579"/><a:ext cx="662940" cy="764539"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:noFill/>
          <a:extLst>
            <a:ext uri="{909E8E84-426E-40DD-AFC4-6F175D3DCCD1}">
              <a14:hiddenFill xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main">
                <a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>
              </a14:hiddenFill>
            </a:ext>
          </a:extLst>
        </xdr:spPr>
      </xdr:pic>
      <xdr:clientData/>
    </xdr:twoCellAnchor>
  ` : '';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  ${anchorsXml}
  ${picXml}
</xdr:wsDr>`;
}

function buildDrawingRelsXml(chartAnchors, imageAnchor) {
  const chartRels = chartAnchors.map(ca => `
    <Relationship Id="${ca.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${ca.chartIndex}.xml"/>
  `).join('');

  const imageRel = imageAnchor ? `
    <Relationship Id="${imageAnchor.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.jpeg"/>
  ` : '';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${chartRels}
  ${imageRel}
</Relationships>`;
}

/**
 * Generate a complete, formatted Excel feedback report with:
 * - Input sheet: full student response rows with merged headers and styling
 * - Graphs sheet: percentage tables, participants count, and formula calculations
 * - Final Feedback sheet: RUET header, question tables, native Excel bar charts, metrics, and comments
 */
exports.generateFeedbackExcel = async function({ assignment, feedbacks = [] }) {
  const templatePath = path.join(__dirname, '..', 'feedback_template.xlsx');
  let wb;
  let hasTemplate = false;

  if (fs.existsSync(templatePath)) {
    try {
      wb = await XlsxPopulate.fromFileAsync(templatePath);
      hasTemplate = true;
    } catch (err) {
      console.warn('Could not read template with charts, falling back to blank workbook:', err.message);
      wb = await XlsxPopulate.fromBlankAsync();
    }
  } else {
    wb = await XlsxPopulate.fromBlankAsync();
  }

  const courseName = assignment.courseName || 'Course';
  const courseCode = assignment.courseCode || '';
  const semester = assignment.semester || '';
  const series = assignment.series || '';
  const teacherName = assignment.teacher?.name || 'Unknown';
  const teacherDesignation = assignment.teacher?.designation || '';
  const deptName = assignment.department?.name || 'Unknown';
  const deptCode = assignment.department?.code || '';
  const cos = (assignment.courseOutcomes && assignment.courseOutcomes.length > 0)
    ? assignment.courseOutcomes
    : [
        { coNumber: 1, title: 'CO1', description: 'Course Outcome 1' },
        { coNumber: 2, title: 'CO2', description: 'Course Outcome 2' }
      ];

  const totalStudents = feedbacks.length;
  const lastInputRow = Math.max(4, 3 + totalStudents);

  // ══════════════════════════════════════════════════════════════
  // SHEET 1: Input
  // ══════════════════════════════════════════════════════════════
  let wsInput = wb.sheet('Input');
  if (!wsInput) wsInput = wb.addSheet('Input');

  // Completely wipe out stale merged cells, values, styles, and row heights from template
  resetSheetMerges(wsInput);

  const clearInputRows = Math.max(120, lastInputRow + 20);
  for (let r = 1; r <= clearInputRows; r++) {
    const row = wsInput.row(r);
    row.height(undefined);
    if (row._node && row._node.attributes) {
      delete row._node.attributes.ht;
      delete row._node.attributes.customHeight;
    }
    for (let c = 1; c <= 45; c++) {
      wsInput.cell(r, c).clear();
    }
  }
  for (let c = 1; c <= 45; c++) {
    wsInput.column(c).width(12);
  }

  // Helper to build a clean CO title string without "CO1: CO1" duplication
  function formatCOTitle(co, coNum) {
    const rawTitle = (co?.title || '').trim();
    const rawDesc = (co?.description || '').trim();
    const isGeneric = !rawTitle || rawTitle.toUpperCase() === `CO${coNum}`;
    const body = isGeneric
      ? rawDesc
      : (rawDesc && rawDesc !== rawTitle ? `${rawTitle} — ${rawDesc}` : rawTitle);
    return body ? `CO${coNum}: ${body}` : `CO${coNum}`;
  }

  // Column A: Student No. (merged across all 3 header rows)
  wsInput.cell(1, 1).value('Student No.');
  wsInput.range('A1:A3').merged(true);
  wsInput.column(1).width(14);

  let col = 2;
  const colWidths = { 1: 14 };
  const row1HeaderSpecs = []; // { text, totalWidth }
  const row2QuestionSpecs = []; // { text, width }
  const mergedCommentSpecs = []; // { text, width }

  // Question numbering follows the student form: Q1 (content), Q2.. (COs), then Facilities and Course Teacher.
  // Comment columns are not numbered.

  // Section 1: Course Content and Organization (1 question + comment)
  const s1ColStart = col;
  const s1Title = 'Course Content and Organization';
  const s1Q1 = 'The course contents are up-to-date and well organized';
  wsInput.cell(1, col).value(s1Title);
  wsInput.cell(2, col).value(s1Q1);
  wsInput.cell(3, col).value('Q. 1');
  colWidths[col] = 34;
  row1HeaderSpecs.push({ text: s1Title, totalWidth: 34 });
  row2QuestionSpecs.push({ text: s1Q1, width: 34 });
  col++;
  const s1ColEnd = col - 1;

  const s1CommentCol = col;
  const s1CommentTitle = 'Comments on Course Content and Organization (if any)';
  wsInput.cell(1, col).value(s1CommentTitle);
  wsInput.cell(3, col).value('Comment');
  colWidths[col] = 30;
  mergedCommentSpecs.push({ text: s1CommentTitle, width: 30 });
  col++;

  wsInput.range(`${colToLetter(s1CommentCol)}1:${colToLetter(s1CommentCol)}2`).merged(true);

  let qNum = 2;
  const coCols = [];
  const CO_Q_WIDTH = 28;
  cos.forEach((co) => {
    const coNum = co.coNumber || (coCols.length + 1);
    const coLabel = formatCOTitle(co, coNum);
    const coHeaderText = `Questions Related to ${coLabel}`;
    const coStart = col;
    wsInput.cell(1, col).value(coHeaderText);

    const coQ1 = `The course contents are aligned with CO${coNum}`;
    wsInput.cell(2, col).value(coQ1);
    wsInput.cell(3, col).value(`Q. ${qNum++}`);
    colWidths[col] = CO_Q_WIDTH;
    row2QuestionSpecs.push({ text: coQ1, width: CO_Q_WIDTH });
    col++;

    const coQ2 = `The teaching-learning methods are effective to achieve CO${coNum}`;
    wsInput.cell(2, col).value(coQ2);
    wsInput.cell(3, col).value(`Q. ${qNum++}`);
    colWidths[col] = CO_Q_WIDTH;
    row2QuestionSpecs.push({ text: coQ2, width: CO_Q_WIDTH });
    col++;

    const coQ3 = `The used assessment tools are appropriate for CO${coNum}`;
    wsInput.cell(2, col).value(coQ3);
    wsInput.cell(3, col).value(`Q. ${qNum++}`);
    colWidths[col] = CO_Q_WIDTH;
    row2QuestionSpecs.push({ text: coQ3, width: CO_Q_WIDTH });
    col++;
    const coEnd = col - 1;

    row1HeaderSpecs.push({ text: coHeaderText, totalWidth: CO_Q_WIDTH * 3 });

    const commentCol = col;
    const coCommentTitle = `Comments on CO${coNum} (if any)`;
    wsInput.cell(1, col).value(coCommentTitle);
    wsInput.cell(3, col).value('Comment');
    colWidths[col] = 30;
    mergedCommentSpecs.push({ text: coCommentTitle, width: 30 });
    col++;

    // Merge headers for this CO
    wsInput.range(`${colToLetter(coStart)}1:${colToLetter(coEnd)}1`).merged(true);
    wsInput.range(`${colToLetter(commentCol)}1:${colToLetter(commentCol)}2`).merged(true);

    coCols.push({ co, coNum, coLabel, startCol: coStart, endCol: coEnd, commentCol });
  });

  // Section: Academic and Laboratory Facilities (1 question + comment)
  const s4ColStart = col;
  const s4Title = 'Academic and Laboratory Facilities';
  const s4Q1 = 'Infrastructure and academic facilities are adequate to achieve the COs';
  wsInput.cell(1, col).value(s4Title);
  wsInput.cell(2, col).value(s4Q1);
  wsInput.cell(3, col).value(`Q. ${qNum++}`);
  colWidths[col] = 34;
  row1HeaderSpecs.push({ text: s4Title, totalWidth: 34 });
  row2QuestionSpecs.push({ text: s4Q1, width: 34 });
  col++;
  const s4ColEnd = col - 1;

  const s4CommentCol = col;
  const s4CommentTitle = 'Comments on Facilities (if any)';
  wsInput.cell(1, col).value(s4CommentTitle);
  wsInput.cell(3, col).value('Comment');
  colWidths[col] = 30;
  mergedCommentSpecs.push({ text: s4CommentTitle, width: 30 });
  col++;

  wsInput.range(`${colToLetter(s4CommentCol)}1:${colToLetter(s4CommentCol)}2`).merged(true);

  // Section: Course Teacher (1-5 rating + comment)
  const s5ColStart = col;
  const s5Title = 'Course Teacher';
  const s5Q1 = 'Evaluate the course teacher based on class preparation, lecture delivery, and way of teaching';
  wsInput.cell(1, col).value(s5Title);
  wsInput.cell(2, col).value(s5Q1);
  wsInput.cell(3, col).value(`Q. ${qNum++}`);
  colWidths[col] = 36;
  row1HeaderSpecs.push({ text: s5Title, totalWidth: 36 });
  row2QuestionSpecs.push({ text: s5Q1, width: 36 });
  col++;
  const s5ColEnd = col - 1;

  const s5CommentCol = col;
  const s5CommentTitle = 'Comments on Course Teacher (if any)';
  wsInput.cell(1, col).value(s5CommentTitle);
  wsInput.cell(3, col).value('Comment');
  colWidths[col] = 30;
  mergedCommentSpecs.push({ text: s5CommentTitle, width: 30 });
  col++;

  wsInput.range(`${colToLetter(s5CommentCol)}1:${colToLetter(s5CommentCol)}2`).merged(true);

  const lastCol = s5CommentCol;

  // Apply generous column widths across the Input sheet
  for (let c = 1; c <= lastCol; c++) {
    wsInput.column(c).width(colWidths[c] || 28);
  }

  // Compute spacious header row heights so CO titles and questions never look compact or clipped
  const computedRow1Height = Math.max(
    52,
    ...row1HeaderSpecs.map(h => estimateRowHeight(h.text, {
      colWidth: h.totalWidth,
      isBold: true,
      fontSize: 11,
      minHeight: 52,
      linePadding: 20
    }))
  );
  let computedRow2Height = Math.max(
    68,
    ...row2QuestionSpecs.map(q => estimateRowHeight(q.text, {
      colWidth: q.width,
      isBold: true,
      fontSize: 10,
      minHeight: 68,
      linePadding: 22
    }))
  );
  const maxMergedCommentHeight = Math.max(
    0,
    ...mergedCommentSpecs.map(m => estimateRowHeight(m.text, {
      colWidth: m.width,
      isBold: true,
      fontSize: 10,
      minHeight: 52,
      linePadding: 20
    }))
  );
  if (computedRow1Height + computedRow2Height < maxMergedCommentHeight) {
    computedRow2Height = maxMergedCommentHeight - computedRow1Height;
  }

  wsInput.row(1).height(computedRow1Height);
  wsInput.row(2).height(computedRow2Height);
  wsInput.row(3).height(30);

  // Style Header Cells (Rows 1-3)
  for (let r = 1; r <= 3; r++) {
    for (let c = 1; c <= lastCol; c++) {
      const cell = wsInput.cell(r, c);
      cell.style({
        fill: 'FFF2CC',
        bold: true,
        fontSize: r === 1 ? 11 : 10,
        horizontalAlignment: 'center',
        verticalAlignment: 'center',
        wrapText: true,
        border: true
      });
    }
  }

  // Row 3 question numbers highlight in bold red font
  for (let c = 2; c <= lastCol; c++) {
    const qCell = wsInput.cell(3, c);
    if (qCell.value()) {
      qCell.style({ fontColor: 'FF0000', bold: true, fontSize: 10 });
    }
  }

  if (feedbacks.length === 0) {
    wsInput.row(4).height(28);
  }

  // Populate Student Data Rows
  feedbacks.forEach((fb, idx) => {
    const r = 4 + idx;
    const snCell = wsInput.cell(r, 1);
    snCell.value(idx + 1).style({
      bold: true,
      fontColor: 'FF0000',
      horizontalAlignment: 'center',
      verticalAlignment: 'center',
      border: true
    });

    const rowComments = [];

    // S1: Course Content & Organisation (legacy rows fall back to the old "well organized" question)
    const s1CommentVal = fb.courseContentOrg?.comment || '';
    wsInput.cell(r, s1ColStart).value(ratingToText(fb.courseContentOrg?.q1_upToDate || fb.courseContentOrg?.q3_organized));
    wsInput.cell(r, s1CommentCol).value(s1CommentVal);
    rowComments.push(s1CommentVal);

    // COs
    coCols.forEach(({ coNum, startCol, commentCol }) => {
      const cd = (fb.coFeedback || []).find(c => c.coNumber === coNum);
      const coCommentVal = cd?.comment || '';
      wsInput.cell(r, startCol).value(ratingToText(cd?.q1_contentAligned));
      wsInput.cell(r, startCol + 1).value(ratingToText(cd?.q2_methodsEffective || cd?.q2_alignment));
      wsInput.cell(r, startCol + 2).value(ratingToText(cd?.q3_assessmentAppropriate || cd?.q3_assessment));
      wsInput.cell(r, commentCol).value(coCommentVal);
      rowComments.push(coCommentVal);
    });

    // Facilities (legacy rows fall back to the old laboratory question)
    const s4CommentVal = fb.academicFacilities?.comment || '';
    wsInput.cell(r, s4ColStart).value(ratingToText(fb.academicFacilities?.q1_infrastructure || fb.academicFacilities?.q3_laboratory));
    wsInput.cell(r, s4CommentCol).value(s4CommentVal);
    rowComments.push(s4CommentVal);

    // Course Teacher
    const s5CommentVal = fb.courseTeacherEval?.comment || '';
    wsInput.cell(r, s5ColStart).value(teacherRatingToText(fb.courseTeacherEval?.rating));
    wsInput.cell(r, s5CommentCol).value(s5CommentVal);
    rowComments.push(s5CommentVal);

    // Style data row cells with wrapping and comfortable box height
    for (let c = 2; c <= lastCol; c++) {
      wsInput.cell(r, c).style({
        fill: 'E2EFDA',
        italic: true,
        fontSize: 10,
        horizontalAlignment: 'center',
        verticalAlignment: 'center',
        wrapText: true,
        border: true
      });
    }

    const dataRowHeight = Math.max(
      30,
      ...rowComments.map(txt => estimateRowHeight(txt, {
        colWidth: 30,
        isBold: false,
        fontSize: 10,
        minHeight: 30,
        linePadding: 14
      }))
    );
    wsInput.row(r).height(dataRowHeight);
  });

  // ══════════════════════════════════════════════════════════════
  // SHEET 2: Graphs
  // ══════════════════════════════════════════════════════════════
  let wsGraphs = wb.sheet('Graphs');
  if (!wsGraphs) wsGraphs = wb.addSheet('Graphs');

  // Completely wipe out stale merged cells and row heights from template
  resetSheetMerges(wsGraphs);

  for (let r = 1; r <= 150; r++) {
    const row = wsGraphs.row(r);
    row.height(undefined);
    if (row._node && row._node.attributes) {
      delete row._node.attributes.ht;
      delete row._node.attributes.customHeight;
    }
    for (let c = 1; c <= 20; c++) {
      wsGraphs.cell(r, c).value(undefined);
    }
  }

  // Set column widths for Graphs sheet
  wsGraphs.column(1).width(5);
  wsGraphs.column(2).width(30);
  for (let c = 3; c <= 15; c++) {
    wsGraphs.column(c).width(14);
  }
  wsGraphs.row(2).height(22);
  wsGraphs.row(3).height(22);
  wsGraphs.row(5).height(26);

  // Total Participants Banner
  wsGraphs.cell('C2').value('Total Participants :');
  wsGraphs.range('C2:E3').merged(true).style({
    fill: 'FFFF00',
    fontColor: 'FF0000',
    bold: true,
    fontSize: 14,
    horizontalAlignment: 'center',
    verticalAlignment: 'center',
    border: true
  });

  wsGraphs.cell('F2').value(totalStudents);
  if (totalStudents > 0) {
    wsGraphs.cell('F2').formula(`COUNTA(Input!A4:A${lastInputRow})`);
  }
  wsGraphs.range('F2:F3').merged(true).style({
    fill: 'FFFF00',
    fontColor: 'FF0000',
    bold: true,
    fontSize: 14,
    horizontalAlignment: 'center',
    verticalAlignment: 'center',
    border: true
  });

  // Header row 5
  wsGraphs.cell('B5').value('Criterias').style({
    bold: true,
    horizontalAlignment: 'center',
    verticalAlignment: 'center',
    border: true
  });
  wsGraphs.cell('C5').value('Question Nos.');
  wsGraphs.range('C5:H5').merged(true).style({
    bold: true,
    horizontalAlignment: 'center',
    verticalAlignment: 'center',
    border: true
  });

  const ratingLabels = ['Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree'];

  let currentGraphRow = 7;
  const chartDefinitions = [];

  function addGraphTable({ titleFormula, titleText, startCol, endCol, labels = ratingLabels }) {
    const tRow = currentGraphRow;
    const qCount = endCol - startCol + 1;
    const colEndLetter = colToLetter(2 + qCount);

    // Section title row
    wsGraphs.cell(tRow, 2).formula(titleFormula).value(titleText);
    wsGraphs.range(`B${tRow}:${colEndLetter}${tRow}`).merged(true).style({
      bold: true,
      underline: true,
      wrapText: true,
      horizontalAlignment: 'center',
      verticalAlignment: 'center'
    });
    wsGraphs.row(tRow).height(estimateRowHeight(titleText, {
      colWidth: 30 + qCount * 14,
      isBold: true,
      minHeight: 28,
      linePadding: 10
    }));
    wsGraphs.row(tRow + 1).height(24);

    // Question numbers row
    const catLabels = [];
    wsGraphs.cell(tRow + 1, 2).value(undefined).style({ border: true });
    for (let i = 0; i < qCount; i++) {
      const inputColLetter = colToLetter(startCol + i);
      const cellRef = `Input!${inputColLetter}3`;
      const qText = String(wsInput.cell(3, startCol + i).value() || `Q. ${i + 1}`);
      wsGraphs.cell(tRow + 1, 3 + i).formula(cellRef).value(qText).style({
        bold: true,
        horizontalAlignment: 'center',
        verticalAlignment: 'center',
        border: true
      });
      catLabels.push(qText);
    }

    const catStartLetter = colToLetter(3);
    const catEndLetter = colToLetter(3 + qCount - 1);
    const catRange = `Graphs!$${catStartLetter}$${tRow + 1}:$${catEndLetter}$${tRow + 1}`;

    const seriesList = [];
    labels.forEach((label, lIdx) => {
      const rRow = tRow + 2 + lIdx;
      wsGraphs.row(rRow).height(22);
      wsGraphs.cell(rRow, 2).value(label).style({
        bold: true,
        horizontalAlignment: 'center',
        verticalAlignment: 'center',
        border: true
      });

      const rowVals = [];
      for (let i = 0; i < qCount; i++) {
        const inputColLetter = colToLetter(startCol + i);
        const formula = totalStudents > 0 
          ? `COUNTIF(Input!${inputColLetter}$4:Input!${inputColLetter}$${lastInputRow}, "${label}")/$F$2*100`
          : '0';

        let cMatches = 0;
        for (let r = 4; r <= lastInputRow; r++) {
          if (wsInput.cell(r, startCol + i).value() === label) cMatches++;
        }
        const pct = totalStudents > 0 ? +((cMatches / totalStudents) * 100).toFixed(1) : 0;
        rowVals.push(pct);

        wsGraphs.cell(rRow, 3 + i).formula(formula).value(pct).style({
          horizontalAlignment: 'center',
          verticalAlignment: 'center',
          numberFormat: '0.0',
          border: true
        });
      }

      seriesList.push({
        name: label,
        labelCell: `Graphs!$B$${rRow}`,
        valRange: `Graphs!$${catStartLetter}$${rRow}:$${catEndLetter}$${rRow}`,
        values: rowVals
      });
    });

    currentGraphRow = tRow + 8;
    return { catRange, catLabels, seriesList };
  }

  // Table 1: Section 1
  const s1Graph = addGraphTable({
    titleFormula: 'Input!B1',
    titleText: 'Course Content and Organization',
    startCol: s1ColStart,
    endCol: s1ColEnd
  });
  chartDefinitions.push({ ...s1Graph, sectionName: 'Course Content and Organization' });

  // Tables for COs
  coCols.forEach(({ coLabel, startCol, endCol }) => {
    const coGraph = addGraphTable({
      titleFormula: `Input!${colToLetter(startCol)}1`,
      titleText: coLabel,
      startCol,
      endCol
    });
    chartDefinitions.push({ ...coGraph, sectionName: coLabel });
  });

  // Table for Facilities
  const s4Graph = addGraphTable({
    titleFormula: `Input!${colToLetter(s4ColStart)}1`,
    titleText: 'Academic and Laboratory Facilities',
    startCol: s4ColStart,
    endCol: s4ColEnd
  });
  chartDefinitions.push({ ...s4Graph, sectionName: 'Academic and Laboratory Facilities' });

  // Table for Course Teacher
  const s5Graph = addGraphTable({
    titleFormula: `Input!${colToLetter(s5ColStart)}1`,
    titleText: 'Course Teacher',
    startCol: s5ColStart,
    endCol: s5ColEnd,
    labels: TEACHER_RATING_LABELS
  });
  chartDefinitions.push({ ...s5Graph, sectionName: 'Course Teacher' });

  // ══════════════════════════════════════════════════════════════
  // SHEET 3: Final Feedback
  // ══════════════════════════════════════════════════════════════
  let wsFF = wb.sheet('Final Feedback');
  if (!wsFF) wsFF = wb.addSheet('Final Feedback');

  // Completely wipe out stale merged cells, values, styles, and row heights from template
  resetSheetMerges(wsFF);

  for (let r = 1; r <= 250; r++) {
    const row = wsFF.row(r);
    row.height(undefined);
    if (row._node && row._node.attributes) {
      delete row._node.attributes.ht;
      delete row._node.attributes.customHeight;
    }
    for (let c = 1; c <= 20; c++) {
      wsFF.cell(r, c).clear();
    }
  }

  // Layout: 3 main columns for Final Feedback
  wsFF.column(1).width(5);   // Col A: Sl.
  wsFF.column(2).width(32);  // Col B: Criteria / Questions / Section Titles
  wsFF.column(3).width(62);  // Col C: Charts / Performance metrics

  // Institutional Header (Merged A:C)
  wsFF.cell('A1').value(`Department of ${deptName}`);
  wsFF.range('A1:C1').merged(true).style({ bold: true, fontSize: 16, horizontalAlignment: 'center', verticalAlignment: 'center' });
  wsFF.row(1).height(26);

  wsFF.cell('A2').value('Rajshahi University of Engineering & Technology');
  wsFF.range('A2:C2').merged(true).style({ italic: true, fontSize: 12, horizontalAlignment: 'center', verticalAlignment: 'center' });
  wsFF.row(2).height(20);

  wsFF.cell('A3').value(courseCode ? `Students' Feedback on ${courseName} (${courseCode})` : `Students' Feedback on ${courseName}`);
  wsFF.range('A3:C3').merged(true).style({ bold: true, fontSize: 13, horizontalAlignment: 'center', verticalAlignment: 'center' });
  wsFF.row(3).height(22);

  wsFF.cell('A4').value(`Course Teacher: ${teacherName}, ${teacherDesignation}, Dept of ${deptCode}`);
  wsFF.range('A4:C4').merged(true).style({ fontSize: 11, horizontalAlignment: 'center', verticalAlignment: 'center' });
  wsFF.row(4).height(18);

  wsFF.cell('A5').value(`Session: ${series} | Semester: ${semester || 'N/A'}`);
  wsFF.range('A5:C5').merged(true).style({ fontSize: 11, horizontalAlignment: 'center', verticalAlignment: 'center' });
  wsFF.row(5).height(18);

  wsFF.row(6).height(10); // spacing

  wsFF.cell('A7').value('A. CORE QUESTIONS');
  wsFF.range('A7:C7').merged(true).style({
    bold: true,
    fontSize: 12,
    fill: 'F2F2F2',
    horizontalAlignment: 'center',
    verticalAlignment: 'center',
    border: true
  });
  wsFF.row(7).height(24);

  wsFF.row(8).height(10); // spacing

  let ffRow = 9;
  const chartAnchors = [];
  let chartIndex = 1;

  function renderFFSection({ title, questions, comments, chartDef }) {
    const startRow = ffRow;
    const chartRowEntries = [];

    // Header Row
    wsFF.cell(ffRow, 1).value('Sl.').style({ bold: true, horizontalAlignment: 'center', verticalAlignment: 'center', border: true });
    wsFF.cell(ffRow, 2).value(title).style({ bold: true, verticalAlignment: 'center', border: true, wrapText: true });
    const hHeader = estimateRowHeight(title, { colWidth: 32, isBold: true, minHeight: 28, linePadding: 8 });
    chartRowEntries.push({ r: ffRow, h: hHeader });
    ffRow++;

    // Question Rows
    questions.forEach((q, idx) => {
      wsFF.cell(ffRow, 1).value(idx + 1).style({ horizontalAlignment: 'center', verticalAlignment: 'center', border: true });
      wsFF.cell(ffRow, 2).value(q).style({ verticalAlignment: 'center', border: true, wrapText: true });
      const hQ = estimateRowHeight(q, { colWidth: 32, isBold: false, minHeight: 26, linePadding: 8 });
      chartRowEntries.push({ r: ffRow, h: hQ });
      ffRow++;
    });

    const lastChartRow = ffRow - 1;

    // Ensure chart box rows span enough vertical height (~138pt min) so 1-question charts in Col C are never cramped
    const totalChartH = chartRowEntries.reduce((sum, e) => sum + e.h, 0);
    const minChartBoxHeight = 138;
    if (totalChartH < minChartBoxHeight) {
      const extraPerRow = Math.ceil((minChartBoxHeight - totalChartH) / chartRowEntries.length);
      chartRowEntries.forEach(e => { e.h += extraPerRow; });
    }
    chartRowEntries.forEach(e => wsFF.row(e.r).height(e.h));

    // Merge and border the chart container box in Column C
    wsFF.range(`C${startRow}:C${lastChartRow}`).merged(true).style({ border: true });

    // Comments Row (spans B:C underneath the chart box, matching template layout)
    const cSl = questions.length + 1;
    wsFF.cell(ffRow, 1).value(cSl).style({ horizontalAlignment: 'center', verticalAlignment: 'center', border: true });
    const commentSummary = comments.length > 0 ? comments.slice(0, 4).join('; ') : 'No comments';
    const commentText = `Comments (if any): ${commentSummary}`;
    wsFF.cell(ffRow, 2).value(commentText);
    wsFF.range(`B${ffRow}:C${ffRow}`).merged(true).style({
      italic: true,
      verticalAlignment: 'center',
      border: true,
      wrapText: true
    });
    const hComment = estimateRowHeight(commentText, { colWidth: 90, isBold: false, minHeight: 26, linePadding: 8 });
    wsFF.row(ffRow).height(hComment);
    ffRow++;

    const lastChartRowHeight = chartRowEntries[chartRowEntries.length - 1].h;
    const anchorFromRow = startRow - 1;
    const anchorToRow = lastChartRow - 1;
    const anchorToRowOff = Math.max(0, Math.round((lastChartRowHeight - 3.6) * 12700));

    chartAnchors.push({
      chartIndex,
      id: chartIndex + 1,
      rId: `rId${chartIndex}`,
      fromRow: anchorFromRow,
      toRow: anchorToRow,
      toRowOff: anchorToRowOff,
      chartDef
    });
    chartIndex++;

    wsFF.row(ffRow).height(12); // Spacing row height
    ffRow++; // empty spacing row
  }

  // Section 1: Course Content and Organization
  const isRealComment = (c) => c && c.trim() && c.trim().toLowerCase() !== 'no comments';
  const s1Comments = feedbacks.map(f => f.courseContentOrg?.comment).filter(isRealComment);
  renderFFSection({
    title: 'Course Content and Organization',
    questions: [
      'The course contents are up-to-date and well organized'
    ],
    comments: s1Comments,
    chartDef: chartDefinitions[0]
  });

  // Dynamic CO Sections
  coCols.forEach(({ coLabel, coNum }, idx) => {
    const coComments = feedbacks.map(f => (f.coFeedback || []).find(c => c.coNumber === coNum)?.comment).filter(isRealComment);
    renderFFSection({
      title: coLabel,
      questions: [
        `The course contents are aligned with CO${coNum}`,
        `The teaching-learning methods are effective to achieve CO${coNum}`,
        `The used assessment tools are appropriate for CO${coNum}`
      ],
      comments: coComments,
      chartDef: chartDefinitions[1 + idx]
    });
  });

  // Academic and Laboratory Facilities
  const s4Comments = feedbacks.map(f => f.academicFacilities?.comment).filter(isRealComment);
  renderFFSection({
    title: 'Academic and Laboratory Facilities',
    questions: [
      'Infrastructure and academic facilities are adequate to achieve the COs'
    ],
    comments: s4Comments,
    chartDef: chartDefinitions[1 + coCols.length]
  });

  // Course Teacher
  const s5Comments = feedbacks.map(f => f.courseTeacherEval?.comment).filter(isRealComment);
  renderFFSection({
    title: 'Course Teacher',
    questions: [
      'Evaluate the course teacher based on class preparation, lecture delivery, and way of teaching (1-5)'
    ],
    comments: s5Comments,
    chartDef: chartDefinitions[2 + coCols.length]
  });

  // ══════════════════════════════════════════════════════════════
  // Section B: Summary & Performance Metrics Table
  // ══════════════════════════════════════════════════════════════
  wsFF.cell(ffRow, 1).value('B. SUMMARY & PERFORMANCE METRICS');
  wsFF.range(`A${ffRow}:C${ffRow}`).merged(true).style({
    bold: true,
    fontSize: 12,
    fill: 'F2F2F2',
    horizontalAlignment: 'center',
    verticalAlignment: 'center',
    border: true
  });
  wsFF.row(ffRow).height(24);
  ffRow++;

  // Table Header Row
  wsFF.cell(ffRow, 1).value('Sl.').style({ bold: true, horizontalAlignment: 'center', verticalAlignment: 'center', fill: 'E7E6E6', border: true });
  wsFF.cell(ffRow, 2).value('Evaluation Criteria / Section').style({ bold: true, verticalAlignment: 'center', fill: 'E7E6E6', border: true });
  wsFF.cell(ffRow, 3).value('Performance Summary (Avg Score out of 5.0  |  Attainment % Favorable ≥ 3)').style({
    bold: true,
    horizontalAlignment: 'center',
    verticalAlignment: 'center',
    fill: 'E7E6E6',
    border: true
  });
  wsFF.row(ffRow).height(24);
  ffRow++;

  function calcAvg(arr) {
    const valid = arr.filter(v => typeof v === 'number' && v > 0);
    return valid.length ? +(valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(2) : 0;
  }

  function calcPctHigh(arr) {
    const valid = arr.filter(v => typeof v === 'number' && v > 0);
    return valid.length ? `${Math.round((valid.filter(v => v >= 3).length / valid.length) * 100)}%` : '0%';
  }

  let metricSl = 1;
  const allSectionScores = [];

  const addMetricRow = (title, vals) => {
    const avg = calcAvg(vals);
    allSectionScores.push(...vals);
    wsFF.cell(ffRow, 1).value(metricSl++).style({ horizontalAlignment: 'center', verticalAlignment: 'center', border: true });
    wsFF.cell(ffRow, 2).value(title).style({ bold: true, verticalAlignment: 'center', border: true, wrapText: true });
    wsFF.cell(ffRow, 3).value(`Average Score: ${avg.toFixed(2)} / 5.00        Attainment: ${calcPctHigh(vals)} Favorable (Rating ≥ 3)`).style({
      horizontalAlignment: 'center',
      verticalAlignment: 'center',
      border: true
    });
    wsFF.row(ffRow).height(estimateRowHeight(title, { colWidth: 32, isBold: true, minHeight: 24, linePadding: 8 }));
    ffRow++;
  };

  // 1. Course Content & Organisation
  addMetricRow('Course Content & Organisation', feedbacks.map(f => contentScore(f)).filter(v => v !== null));

  // 2. Dynamic COs
  coCols.forEach(({ coLabel, coNum }) => {
    const coVals = feedbacks
      .map(f => coEntryScore((f.coFeedback || []).find(c => c.coNumber === coNum)))
      .filter(v => v !== null);
    addMetricRow(coLabel, coVals);
  });

  // 3. Academic & Lab Facilities
  addMetricRow('Academic & Laboratory Facilities', feedbacks.map(f => facilitiesScore(f)).filter(v => v !== null));

  // 4. Course Teacher
  addMetricRow('Course Teacher', feedbacks.map(f => teacherScore(f)).filter(v => v !== null));

  // Overall Row
  const overallAvg = calcAvg(allSectionScores);
  wsFF.cell(ffRow, 1).value('★').style({ horizontalAlignment: 'center', verticalAlignment: 'center', fill: 'FFF2CC', bold: true, border: true });
  wsFF.cell(ffRow, 2).value('Overall Course Rating & Attainment').style({ fill: 'FFF2CC', bold: true, verticalAlignment: 'center', border: true, wrapText: true });
  wsFF.cell(ffRow, 3).value(`Average Score: ${overallAvg.toFixed(2)} / 5.00        Attainment: ${calcPctHigh(allSectionScores)} Favorable (Rating ≥ 3)`).style({
    fill: 'FFF2CC',
    bold: true,
    horizontalAlignment: 'center',
    verticalAlignment: 'center',
    border: true
  });
  wsFF.row(ffRow).height(26);
  ffRow++;

  // ══════════════════════════════════════════════════════════════
  // UPDATE CHARTS & DRAWINGS IN ZIP (if template loaded)
  // ══════════════════════════════════════════════════════════════
  if (hasTemplate && wb._zip) {
    const zip = wb._zip;

    // Write chart XMLs for all generated charts
    chartAnchors.forEach(ca => {
      const chartXml = buildChartXml({
        chartId: ca.chartIndex,
        catRange: ca.chartDef.catRange,
        catLabels: ca.chartDef.catLabels,
        seriesList: ca.chartDef.seriesList
      });
      zip.file(`xl/charts/chart${ca.chartIndex}.xml`, chartXml);

      // Ensure style and color files exist for this chart
      if (!zip.file(`xl/charts/style${ca.chartIndex}.xml`)) {
        const s1 = zip.file('xl/charts/style1.xml');
        if (s1) zip.file(`xl/charts/style${ca.chartIndex}.xml`, s1.asNodeBuffer ? s1.asNodeBuffer() : s1._data);
      }
      if (!zip.file(`xl/charts/colors${ca.chartIndex}.xml`)) {
        const c1 = zip.file('xl/charts/colors1.xml');
        if (c1) zip.file(`xl/charts/colors${ca.chartIndex}.xml`, c1.asNodeBuffer ? c1.asNodeBuffer() : c1._data);
      }
    });

    // Remove any excess chart files from the template zip that are not used
    for (let k = chartAnchors.length + 1; k <= 20; k++) {
      if (zip.file(`xl/charts/chart${k}.xml`)) zip.remove(`xl/charts/chart${k}.xml`);
      if (zip.file(`xl/charts/style${k}.xml`)) zip.remove(`xl/charts/style${k}.xml`);
      if (zip.file(`xl/charts/colors${k}.xml`)) zip.remove(`xl/charts/colors${k}.xml`);
      if (zip.file(`xl/charts/_rels/chart${k}.xml.rels`)) zip.remove(`xl/charts/_rels/chart${k}.xml.rels`);
    }

    // Picture anchor for RUET logo
    const imageAnchor = {
      id: chartAnchors.length + 2,
      rId: `rId${chartAnchors.length + 1}`
    };

    // Build and write drawing1.xml
    const drawingXml = buildDrawingXml(chartAnchors, imageAnchor);
    zip.file('xl/drawings/drawing1.xml', drawingXml);

    // Build and write drawing1.xml.rels
    const drawingRelsXml = buildDrawingRelsXml(chartAnchors, imageAnchor);
    zip.file('xl/drawings/_rels/drawing1.xml.rels', drawingRelsXml);

    // Rebuild [Content_Types].xml clean with exact chart overrides
    if (wb._contentTypes && wb._contentTypes._node && wb._contentTypes._node.children) {
      const ctNode = wb._contentTypes._node;
      ctNode.children = ctNode.children.filter(child => {
        if (child.name !== 'Override') return true;
        const part = child.attributes?.PartName || '';
        return !part.startsWith('/xl/charts/');
      });

      chartAnchors.forEach(ca => {
        ctNode.children.push({
          name: 'Override',
          attributes: {
            PartName: `/xl/charts/chart${ca.chartIndex}.xml`,
            ContentType: 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml'
          },
          children: []
        });
        ctNode.children.push({
          name: 'Override',
          attributes: {
            PartName: `/xl/charts/style${ca.chartIndex}.xml`,
            ContentType: 'application/vnd.ms-office.chartstyle+xml'
          },
          children: []
        });
        ctNode.children.push({
          name: 'Override',
          attributes: {
            PartName: `/xl/charts/colors${ca.chartIndex}.xml`,
            ContentType: 'application/vnd.ms-office.chartcolorstyle+xml'
          },
          children: []
        });
      });
    }
  }

  return await wb.outputAsync();
};
