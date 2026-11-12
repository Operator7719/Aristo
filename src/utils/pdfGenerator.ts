import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Exam,
  SchoolClass,
  SchoolSettings,
  Subject,
} from '../types';
import { ComputedStudentResult, isGradeOnlySubject } from './grading';

async function loadLogoDataUrl(): Promise<string | null> {
  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return null;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 250;
        canvas.height = img.naturalHeight || 250;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = '/assets/aistudio/2png_bb8dd55e.png';
  });
}

function renderGradeSheetPage(
  doc: jsPDF,
  res: ComputedStudentResult,
  schoolClass: SchoolClass,
  sectionName: string,
  exam: Exam,
  settings: SchoolSettings,
  logoDataUrl: string | null,
) {
  const pageW = doc.internal.pageSize.getWidth(); // 210mm
  const pageH = doc.internal.pageSize.getHeight(); // 297mm

  // Outer & inner double frame matching the institutional gradesheet
  doc.setDrawColor(30, 58, 138);
  doc.setLineWidth(0.9);
  doc.rect(8, 8, pageW - 16, pageH - 16);
  doc.setLineWidth(0.35);
  doc.rect(10.2, 10.2, pageW - 20.4, pageH - 20.4);

  // Header Typography (Single-line centered school name at top + left-side school logo only)
  doc.setTextColor(0, 0, 0);
  doc.setFont('times', 'bold');
  doc.setFontSize(20);
  doc.text(settings.schoolName.toUpperCase(), pageW / 2, 18.5, { align: 'center' });

  // Left-side School Logo ONLY (no right-side logo)
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', 15, 21, 24, 20);
  }

  doc.setFontSize(16);
  doc.text(settings.address, pageW / 2, 24.5, { align: 'center' });
  doc.text(`Estd. ${settings.estd}`, pageW / 2, 29.5, { align: 'center' });
  doc.text(`School IEMIS Code : ${settings.iemisCode}`, pageW / 2, 34.5, {
    align: 'center',
  });

  doc.setFontSize(12);
  doc.text(
    `${exam.name} – ${exam.academicYear || settings.academicYear}`,
    pageW / 2,
    40.5,
    { align: 'center' },
  );

  doc.setFontSize(13);
  doc.text('GRADE – SHEET', pageW / 2, 46.5, { align: 'center' });

  // Student Particulars Block
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.text('THE GRADE(S) SECURED BY:', 15, 55);
  doc.text(res.student.name.toUpperCase(), 68, 55);
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.3);
  doc.line(66, 56, 195, 56);

  doc.text('Grade:', 15, 62);
  doc.text(schoolClass.name.replace(/^Grade\s+/i, ''), 29, 62);
  doc.line(28, 63, 70, 63);

  doc.text('Roll No.:', 78, 62);
  doc.text(String(res.student.rollNo), 96, 62);
  doc.line(94, 63, 130, 63);

  doc.text('Section:', 138, 62);
  doc.text(sectionName, 155, 62);
  doc.line(153, 63, 195, 63);

  // Subjects Table (paired TH + IN/PR rows)
  const bodyRows: Array<
    Array<string | { content: string; rowSpan?: number; colSpan?: number; styles?: Record<string, unknown> }>
  > = [];

  for (const sr of res.subjectResults) {
    const chTh = sr.subject.creditHourTheory
      ? sr.subject.creditHourTheory.toFixed(2).replace(/\.00$/, '')
      : '0';
    const chPr = sr.subject.creditHourPractical
      ? sr.subject.creditHourPractical.toFixed(2).replace(/\.00$/, '')
      : '0';

    if (sr.hasPractical) {
      bodyRows.push([
        `${sr.subject.name} (TH)`,
        chTh,
        sr.hasEnteredMarks
          ? sr.absentTheory
            ? 'AB'
            : sr.theoryGradePoint.toFixed(2)
          : '',
        sr.hasEnteredMarks ? sr.theoryGrade : '',
        {
          content: sr.hasEnteredMarks ? sr.finalGrade : '',
          rowSpan: 2,
          styles: { valign: 'middle', halign: 'center', fontStyle: 'bold' },
        },
        {
          content: sr.hasEnteredMarks ? sr.remarks : '',
          rowSpan: 2,
          styles: { valign: 'middle', halign: 'center' },
        },
      ]);
      bodyRows.push([
        `${sr.subject.name} (${sr.effectiveRule === 'none' ? 'PR' : 'IN'})`,
        chPr,
        sr.hasEnteredMarks
          ? sr.absentPractical
            ? 'AB'
            : sr.practicalGradePoint.toFixed(2)
          : '',
        sr.hasEnteredMarks ? sr.practicalGrade : '',
      ]);
    } else {
      bodyRows.push([
        `${sr.subject.name} (TH)`,
        chTh,
        sr.hasEnteredMarks
          ? sr.absentTheory
            ? 'AB'
            : sr.theoryGradePoint.toFixed(2)
          : '',
        sr.hasEnteredMarks ? sr.theoryGrade : '',
        {
          content: sr.hasEnteredMarks ? sr.finalGrade : '',
          styles: { valign: 'middle', halign: 'center', fontStyle: 'bold' },
        },
        {
          content: sr.hasEnteredMarks ? sr.remarks : '',
          styles: { valign: 'middle', halign: 'center' },
        },
      ]);
    }
  }

  // GPA summary row
  bodyRows.push([
    {
      content: `Grade Point Average (GPA) = ${res.hasAnyMarks ? res.gpa.toFixed(2) : ''}`,
      colSpan: 6,
      styles: { halign: 'center', fontStyle: 'bold', fontSize: 10 },
    },
  ]);

  autoTable(doc, {
    startY: 67,
    margin: { left: 15, right: 15 },
    theme: 'grid',
    head: [
      [
        'SUBJECTS',
        'CREDIT\nHOUR',
        'GRADE\nPOINT',
        'GRADE',
        'FINAL\nGRADE',
        'REMARKS',
      ],
    ],
    body: bodyRows as never,
    styles: {
      font: 'times',
      fontSize: 8.5,
      textColor: [15, 23, 42],
      lineColor: [30, 41, 59],
      lineWidth: 0.25,
      cellPadding: 1.55,
    },
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 64, halign: 'left', fontStyle: 'bold' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: 32, halign: 'center' },
    },
  });

  let afterTableY =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 4;

  // Separate Co-Curricular / Grade-Only Subjects (Drawing, Rhymes, Craft — not in GPA/Total)
  if (res.gradeOnlyResults.length > 0) {
    autoTable(doc, {
      startY: afterTableY,
      margin: { left: 15, right: 15 },
      theme: 'grid',
      head: [
        [
          {
            content:
              'ADDITIONAL / CO-CURRICULAR SUBJECTS (NOT INCLUDED IN TOTAL / GPA)',
            colSpan: 3,
            styles: { halign: 'center', fontSize: 7.5 },
          },
        ],
        ['SUBJECT', 'GRADE', 'REMARKS'],
      ],
      body: res.gradeOnlyResults.map((gr) => [
        gr.subject.name,
        gr.grade,
        gr.remarks,
      ]),
      styles: {
        font: 'times',
        fontSize: 8,
        textColor: [15, 23, 42],
        lineColor: [30, 41, 59],
        lineWidth: 0.25,
        cellPadding: 1.3,
      },
      headStyles: {
        fillColor: [248, 250, 252],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 106, halign: 'left', fontStyle: 'bold' },
        1: { cellWidth: 32, halign: 'center', fontStyle: 'bold' },
        2: { cellWidth: 42, halign: 'center' },
      },
    });
    afterTableY =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 4;
  }

  const footerStartY = Math.min(afterTableY + 2, 214);

  // Left: Exam Grading System Table
  const gradingRows = [...settings.gradingRules]
    .sort((a, b) => b.minPercent - a.minPercent)
    .map((r) => [
      `${r.minPercent}% - ${r.maxPercent}%`,
      r.grade,
      r.description,
      r.gradePoint.toFixed(2),
    ]);

  autoTable(doc, {
    startY: footerStartY,
    margin: { left: 15, right: 98 },
    theme: 'grid',
    head: [
      [{ content: 'Exam Grading System', colSpan: 4, styles: { halign: 'center' } }],
      ['Interval', 'Grade', 'Description', 'Grade Point'],
    ],
    body: gradingRows,
    styles: {
      font: 'times',
      fontSize: 7.5,
      textColor: [15, 23, 42],
      lineColor: [30, 41, 59],
      lineWidth: 0.22,
      cellPadding: 1.1,
    },
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 24, halign: 'center' },
      1: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 33, halign: 'left' },
      3: { cellWidth: 24, halign: 'center' },
    },
  });

  // Right: Attendance Table + Date of Issue
  autoTable(doc, {
    startY: footerStartY,
    margin: { left: 122, right: 15 },
    theme: 'grid',
    head: [[{ content: 'Attendance', colSpan: 2, styles: { halign: 'center' } }]],
    body: [
      ['Working Days', String(exam.workingDays || res.workingDays || 0)],
      ['Present Days', String(res.presentDays || 0)],
    ],
    styles: {
      font: 'times',
      fontSize: 8.5,
      textColor: [15, 23, 42],
      lineColor: [30, 41, 59],
      lineWidth: 0.25,
      cellPadding: 2.2,
    },
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 40, fontStyle: 'bold' },
      1: { cellWidth: 33, halign: 'center' },
    },
  });

  const issueDate =
    exam.dateOfIssue ||
    settings.examIssueDates?.[exam.term] ||
    settings.dateOfIssue;
  doc.setFont('times', 'bold');
  doc.setFontSize(9.5);
  doc.text(`Date of Issue : ${issueDate}`, 124, footerStartY + 34);

  // Signatures at bottom
  const sigY = 274;
  doc.setDrawColor(15, 23, 42);
  doc.setTextColor(15, 23, 42);
  doc.setLineWidth(0.35);
  doc.line(18, sigY - 5, 58, sigY - 5);
  doc.text(settings.signatories.classTeacher || 'Class Teacher', 38, sigY, {
    align: 'center',
  });

  doc.line(85, sigY - 5, 125, sigY - 5);
  doc.text(settings.signatories.coordinator || 'Co-ordinator', 105, sigY, {
    align: 'center',
  });

  doc.line(152, sigY - 5, 192, sigY - 5);
  doc.text(settings.signatories.principal || 'Principal', 172, sigY, {
    align: 'center',
  });
}

function renderGradeSheetPageReference(
  doc: jsPDF,
  res: ComputedStudentResult,
  schoolClass: SchoolClass,
  sectionName: string,
  exam: Exam,
  settings: SchoolSettings,
  logoDataUrl: string | null,
) {
  const pageW = doc.internal.pageSize.getWidth(); // 210mm
  const pageH = doc.internal.pageSize.getHeight(); // 297mm

  // Outer & inner double frame matching the reference gradesheet
  doc.setDrawColor(30, 58, 138);
  doc.setLineWidth(0.9);
  doc.rect(8, 8, pageW - 16, pageH - 16);
  doc.setLineWidth(0.35);
  doc.rect(10.2, 10.2, pageW - 20.4, pageH - 20.4);

  // Left-side School Logo + Estd. 2049 below it
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', 14, 13, 24, 18.5);
  }
  doc.setFont('times', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 58, 138);
  doc.text('Estd. 2049', 26, 35, { align: 'center' });

  // Header Typography (Matches the corrected reference text)
  doc.setTextColor(30, 58, 138);
  doc.setFont('times', 'bold');
  doc.setFontSize(17);
  doc.text('ARISTO ENGLISH BOARDING SCHOOL', pageW / 2, 16.5, {
    align: 'center',
  });

  doc.setFontSize(10.5);
  doc.text(settings.address || 'Dhangadhi-8, Campus Road, Kailali', pageW / 2, 21.5, {
    align: 'center',
  });

  doc.setFontSize(10);
  doc.text(
    `School IEMIS Code: ${settings.iemisCode || '710100021'}`,
    pageW / 2,
    26,
    { align: 'center' },
  );

  const examHeading = exam
    ? `${exam.name} – ${exam.academicYear.includes('2083') ? exam.academicYear : '2083 B.S.'}`
    : 'Second Terminal Examination – 2083 B.S.';
  doc.setFontSize(10.5);
  doc.text(examHeading, pageW / 2, 30.5, { align: 'center' });

  doc.setFontSize(12.5);
  doc.text('GRADE - SHEET', pageW / 2, 36, { align: 'center' });

  // Student Particulars Block
  doc.setTextColor(15, 23, 42);
  doc.setFont('times', 'bold');
  doc.setFontSize(9.5);
  doc.text('THE GRADE(S) SECURED BY:', 14, 43);
  doc.text(res.student.name.toUpperCase(), 66, 43);
  doc.setDrawColor(30, 58, 138);
  doc.setLineWidth(0.3);
  doc.line(64, 44, 196, 44);

  doc.text('Class:', 14, 50);
  doc.text(schoolClass.name.replace(/^Grade\s+/i, ''), 26, 50);
  doc.line(25, 51, 70, 51);

  doc.text('Roll No:', 78, 50);
  doc.text(String(res.student.rollNo), 95, 50);
  doc.line(93, 51, 132, 51);

  doc.text('Section:', 140, 50);
  doc.text(sectionName, 156, 50);
  doc.line(154, 51, 196, 51);

  // Table Body Rows
  type AutoTableRow = Array<
    | string
    | {
        content: string;
        rowSpan?: number;
        colSpan?: number;
        styles?: Record<string, unknown>;
      }
  >;
  const bodyRows: AutoTableRow[] = [];

  res.subjectResults.forEach((sr, idx) => {
    const totalCredit = (
      (sr.subject.creditHourTheory || 0) + (sr.subject.creditHourPractical || 0)
    )
      .toFixed(2)
      .replace(/\.00$/, '');

    const thGrade = sr.hasEnteredMarks
      ? sr.absentTheory
        ? 'AB'
        : sr.theoryGrade
      : '';
    const prGrade = sr.hasPractical
      ? sr.hasEnteredMarks
        ? sr.absentPractical
          ? 'AB'
          : sr.practicalGrade
        : ''
      : '';

    bodyRows.push([
      String(idx + 1),
      sr.subject.name,
      totalCredit,
      thGrade,
      prGrade,
      sr.hasEnteredMarks ? sr.finalGrade : '',
      sr.hasEnteredMarks ? sr.finalGradePoint.toFixed(2) : '',
      sr.hasEnteredMarks ? sr.remarks : '',
    ]);
  });

  // Additional subjects (Add Subject section as in reference)
  if (res.gradeOnlyResults.length > 0) {
    bodyRows.push([
      '',
      {
        content: 'Add Subject',
        styles: { fontStyle: 'bold', textColor: [30, 58, 138] },
      },
      '',
      '',
      '',
      '',
      '',
      '',
    ]);

    res.gradeOnlyResults.forEach((gr, gIdx) => {
      bodyRows.push([
        String(gIdx + 1),
        gr.subject.name,
        '',
        '',
        '',
        gr.grade,
        '',
        gr.remarks || '',
      ]);
    });
  }

  // GPA summary row at bottom of table
  bodyRows.push([
    {
      content: `GRADE POINT AVERAGE (GPA):   ${res.hasAnyMarks ? res.gpa.toFixed(2) : ''}`,
      colSpan: 8,
      styles: {
        halign: 'center',
        fontStyle: 'bold',
        fontSize: 10,
        textColor: [30, 58, 138],
      },
    },
  ]);

  autoTable(doc, {
    startY: 55,
    margin: { left: 14, right: 14 },
    theme: 'grid',
    head: [
      [
        { content: 'SN', rowSpan: 2 },
        { content: 'SUBJECTS', rowSpan: 2 },
        { content: 'CREDIT\nHOUR', rowSpan: 2 },
        {
          content: 'OBTAINED GRADE',
          colSpan: 2,
          styles: { halign: 'center' },
        },
        { content: 'FINAL\nGRADE', rowSpan: 2 },
        { content: 'GRADE\nPOINT', rowSpan: 2 },
        { content: 'Remarks', rowSpan: 2 },
      ],
      ['TH', 'PR'],
    ],
    body: bodyRows as never,
    styles: {
      font: 'times',
      fontSize: 8.5,
      textColor: [15, 23, 42],
      lineColor: [30, 58, 138],
      lineWidth: 0.25,
      cellPadding: 1.5,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [30, 58, 138],
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.25,
      lineColor: [30, 58, 138],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 64, halign: 'left', fontStyle: 'bold' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 15, halign: 'center' },
      4: { cellWidth: 15, halign: 'center' },
      5: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      6: { cellWidth: 18, halign: 'center' },
      7: { cellWidth: 24, halign: 'center' },
    },
  });

  const afterTableY =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 5;
  const bottomStartY = Math.min(afterTableY, 215);

  // Left: Attendance Table
  autoTable(doc, {
    startY: bottomStartY,
    margin: { left: 14, right: 124 },
    theme: 'grid',
    head: [
      [
        {
          content: 'Attendance',
          colSpan: 2,
          styles: {
            halign: 'center',
            fontStyle: 'bold',
            textColor: [30, 58, 138],
          },
        },
      ],
    ],
    body: [
      ['Working Days', String(exam.workingDays || res.workingDays || 0)],
      ['Present Days', String(res.presentDays || 0)],
    ],
    styles: {
      font: 'times',
      fontSize: 8.5,
      textColor: [15, 23, 42],
      lineColor: [30, 58, 138],
      lineWidth: 0.25,
      cellPadding: 2.2,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      lineColor: [30, 58, 138],
      lineWidth: 0.25,
    },
    columnStyles: {
      0: { cellWidth: 40, fontStyle: 'bold' },
      1: { cellWidth: 32, halign: 'center' },
    },
  });

  // Right: 8-Tier Standard Grading Scale Table (Matches Reference)
  const referenceScale = [
    ['90 to 100', 'A+', 'Outstanding'],
    ['80 to below 90', 'A', 'Excellent'],
    ['70 to below 80', 'B+', 'Very good'],
    ['60 to below 70', 'B', 'Good'],
    ['50 to below 60', 'C+', 'Satisfactory'],
    ['40 to below 50', 'C', 'Acceptable'],
    ['35 to below 40', 'D', 'Basic'],
    ['Below 35', 'NG', 'Not Graded'],
  ];

  autoTable(doc, {
    startY: bottomStartY,
    margin: { left: 104, right: 14 },
    theme: 'grid',
    head: [
      [
        { content: 'Percentage', styles: { halign: 'center' } },
        { content: 'Letter Grade', styles: { halign: 'center' } },
        { content: 'Description', styles: { halign: 'center' } },
      ],
    ],
    body: referenceScale,
    styles: {
      font: 'times',
      fontSize: 7.2,
      textColor: [15, 23, 42],
      lineColor: [30, 58, 138],
      lineWidth: 0.2,
      cellPadding: 0.9,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [30, 58, 138],
      fontStyle: 'bold',
      lineColor: [30, 58, 138],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 28, halign: 'center' },
      1: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 40, halign: 'left' },
    },
  });

  // Signatures at bottom (Dotted lines matching reference: Class Teacher, Checked By, Principal)
  const sigY = 276;
  doc.setTextColor(30, 58, 138);
  doc.setFont('times', 'bold');
  doc.setFontSize(9);

  doc.text('.....................................', 36, sigY - 5, {
    align: 'center',
  });
  doc.text('Class Teacher', 36, sigY, { align: 'center' });

  doc.text('.....................................', 105, sigY - 5, {
    align: 'center',
  });
  doc.text('Checked By', 105, sigY, { align: 'center' });

  doc.text('.....................................', 172, sigY - 5, {
    align: 'center',
  });
  doc.text('Principal', 172, sigY, { align: 'center' });
}

export async function downloadGradeSheetPDF(
  results: ComputedStudentResult[],
  schoolClass: SchoolClass,
  sectionName: string,
  exam: Exam,
  settings: SchoolSettings,
  filename?: string,
  design: 'standard' | 'reference_compact' = 'standard',
) {
  const logoDataUrl = await loadLogoDataUrl();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  results.forEach((res, idx) => {
    if (idx > 0) doc.addPage();
    if (design === 'reference_compact') {
      renderGradeSheetPageReference(
        doc,
        res,
        schoolClass,
        sectionName,
        exam,
        settings,
        logoDataUrl,
      );
    } else {
      renderGradeSheetPage(
        doc,
        res,
        schoolClass,
        sectionName,
        exam,
        settings,
        logoDataUrl,
      );
    }
  });
  const outName =
    filename ||
    (results.length === 1
      ? `GradeSheet_${results[0].student.name.replace(/\s+/g, '_')}_${schoolClass.name}.pdf`
      : `GradeSheets_${schoolClass.name}_${sectionName}_${exam.term}.pdf`);
  doc.save(outName);
}

export function downloadMarkwiseLedgerPDF(
  results: ComputedStudentResult[],
  subjects: Subject[],
  schoolClass: SchoolClass,
  sectionName: string,
  exam: Exam,
  settings: SchoolSettings,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(settings.schoolName, pageW / 2, 12, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(
    `${settings.address} | IEMIS: ${settings.iemisCode}`,
    pageW / 2,
    17,
    { align: 'center' },
  );
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(
    `MARKWISE LEDGER — ${exam.name} (${exam.academicYear}) | ${schoolClass.name} - Section ${sectionName}`,
    pageW / 2,
    23,
    { align: 'center' },
  );

  // Build academic subject columns only (Drawing, Rhymes, Craft excluded)
  const displaySubjects = subjects
    .filter(
      (s) =>
        s.classId === schoolClass.id &&
        s.status === 'active' &&
        !isGradeOnlySubject(s),
    )
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const headRow = [
    'Roll',
    'Student Name',
    ...displaySubjects.map((s) => `${s.code}\n(TH|PR|Tot)`),
    'Total',
    '%',
    'GPA',
    'Rank',
    'Result',
  ];

  const bodyRows = results.map((r) => {
    const subCells = displaySubjects.map((sub) => {
      const sr = r.subjectResults.find((x) => x.subject.id === sub.id);
      if (!sr) return '-';
      if (sr.hasPractical) {
        return `${sr.theoryObtained}|${sr.finalPracticalMarks}|${sr.totalObtained}`;
      }
      return `${sr.totalObtained}`;
    });
    return [
      String(r.student.rollNo),
      r.student.name,
      ...subCells,
      r.hasAnyMarks ? `${r.grandTotalObtained}/${r.grandTotalFullMarks}` : '-',
      r.hasAnyMarks ? `${r.percentage.toFixed(1)}%` : '-',
      r.hasAnyMarks ? r.gpa.toFixed(2) : '-',
      r.rank ? String(r.rank) : '-',
      r.hasAnyMarks ? (r.isPassed ? 'PASS' : 'NG') : 'Pending',
    ];
  });

  autoTable(doc, {
    startY: 27,
    margin: { left: 8, right: 8 },
    theme: 'grid',
    head: [headRow],
    body: bodyRows,
    styles: {
      fontSize: 7.2,
      cellPadding: 1.5,
      halign: 'center',
      valign: 'middle',
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { halign: 'left', cellWidth: 34 },
    },
  });

  doc.save(
    `Markwise_Ledger_${schoolClass.name}_${sectionName}_${exam.term}.pdf`,
  );
}

export function downloadGradewiseLedgerPDF(
  results: ComputedStudentResult[],
  subjects: Subject[],
  schoolClass: SchoolClass,
  sectionName: string,
  exam: Exam,
  settings: SchoolSettings,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(settings.schoolName, pageW / 2, 12, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(
    `${settings.address} | IEMIS: ${settings.iemisCode}`,
    pageW / 2,
    17,
    { align: 'center' },
  );
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(
    `GRADEWISE LEDGER — ${exam.name} (${exam.academicYear}) | ${schoolClass.name} - Section ${sectionName}`,
    pageW / 2,
    23,
    { align: 'center' },
  );

  // Grade Distribution Summary
  const gradeBuckets = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'NG'];
  const distCounts = gradeBuckets.map(
    (g) => results.filter((r) => r.hasAnyMarks && r.overallGrade === g).length,
  );

  autoTable(doc, {
    startY: 27,
    margin: { left: 8, right: 8 },
    theme: 'grid',
    head: [['Overall Grade Distribution', ...gradeBuckets, 'Total Students']],
    body: [['Student Count', ...distCounts.map(String), String(results.length)]],
    styles: { fontSize: 8, halign: 'center', cellPadding: 1.8 },
    headStyles: { fillColor: [55, 48, 163], textColor: [255, 255, 255] },
  });

  const afterDistY =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 5;

  const displaySubjects = subjects
    .filter((s) => s.classId === schoolClass.id && s.status === 'active')
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const headRow = [
    'Roll',
    'Student Name',
    ...displaySubjects.map((s) =>
      isGradeOnlySubject(s) ? `${s.code}\n(Grade)` : `${s.code}\n(TH/PR/Fin)`,
    ),
    'GPA',
    'Overall Grade',
    'Remarks',
  ];

  const bodyRows = results.map((r) => {
    const subCells = displaySubjects.map((sub) => {
      const grOnly = r.gradeOnlyResults.find((x) => x.subject.id === sub.id);
      if (grOnly) return grOnly.grade;
      const sr = r.subjectResults.find((x) => x.subject.id === sub.id);
      if (!sr || !sr.hasEnteredMarks) return '-';
      if (sr.hasPractical) {
        return `${sr.theoryGrade}/${sr.practicalGrade}/${sr.finalGrade}`;
      }
      return sr.finalGrade;
    });
    return [
      String(r.student.rollNo),
      r.student.name,
      ...subCells,
      r.hasAnyMarks ? r.gpa.toFixed(2) : '-',
      r.overallGrade,
      r.overallRemarks,
    ];
  });

  autoTable(doc, {
    startY: afterDistY,
    margin: { left: 8, right: 8 },
    theme: 'grid',
    head: [headRow],
    body: bodyRows,
    styles: {
      fontSize: 7.2,
      cellPadding: 1.5,
      halign: 'center',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { halign: 'left', cellWidth: 34 },
    },
  });

  doc.save(
    `Gradewise_Ledger_${schoolClass.name}_${sectionName}_${exam.term}.pdf`,
  );
}

export interface AssignmentPdfRow {
  sn: number;
  className: string;
  sectionName: string;
  subjectName: string;
  teacherName: string;
  assignmentTypeLabel: string;
  periodSlot: string;
  academicYearId: string;
}

export function downloadTeacherAssignmentsPDF(
  rows: AssignmentPdfRow[],
  settings: SchoolSettings,
  filterSummary: string,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(settings.schoolName, pageW / 2, 12, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(
    `${settings.address} | School IEMIS Code: ${settings.iemisCode}`,
    pageW / 2,
    17,
    { align: 'center' },
  );
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('SUBJECT TEACHER ASSIGNMENT REPORT', pageW / 2, 23, {
    align: 'center',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(filterSummary, pageW / 2, 28, { align: 'center' });

  autoTable(doc, {
    startY: 32,
    margin: { left: 10, right: 10 },
    theme: 'grid',
    head: [
      [
        'S.N.',
        'Class',
        'Section',
        'Subject',
        'Teacher Name',
        'Role Type',
        'Period',
        'Academic Year',
      ],
    ],
    body: rows.map((r) => [
      String(r.sn),
      r.className,
      r.sectionName,
      r.subjectName,
      r.teacherName,
      r.assignmentTypeLabel,
      r.periodSlot || '-',
      r.academicYearId,
    ]),
    styles: {
      fontSize: 8.5,
      cellPadding: 2,
      valign: 'middle',
      lineColor: [244, 114, 182],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [190, 24, 93],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center' },
      1: { cellWidth: 26 },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 66 },
      4: { cellWidth: 52 },
      5: { cellWidth: 34 },
      6: { cellWidth: 42 },
      7: { cellWidth: 23, halign: 'center' },
    },
  });

  doc.save('Subject_Teacher_Assignment_Report.pdf');
}

export interface TeacherPassportPdfRow {
  sn: number;
  passportNumber: string;
  passportTitle: string;
  username: string;
  teacherName: string;
  issuedDate: string;
  expiryDate: string;
  status: string;
}

export function downloadTeacherPassportsPDF(
  rows: TeacherPassportPdfRow[],
  settings: SchoolSettings,
  filterSummary: string,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(settings.schoolName, pageW / 2, 12, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(
    `${settings.address} | School IEMIS Code: ${settings.iemisCode}`,
    pageW / 2,
    17,
    { align: 'center' },
  );
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TEACHER PASSPORTS & ACCESS CREDENTIALS REPORT', pageW / 2, 23, {
    align: 'center',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(filterSummary, pageW / 2, 28, { align: 'center' });

  autoTable(doc, {
    startY: 32,
    margin: { left: 10, right: 10 },
    theme: 'grid',
    head: [
      [
        'S.N.',
        'Passport No.',
        'Title',
        'Username',
        'Assigned Teacher',
        'Issued Date',
        'Expiry Date',
        'Status',
      ],
    ],
    body: rows.map((r) => [
      String(r.sn),
      r.passportNumber,
      r.passportTitle,
      r.username,
      r.teacherName || 'Unassigned Pool',
      r.issuedDate,
      r.expiryDate,
      r.status.toUpperCase(),
    ]),
    styles: {
      fontSize: 8.5,
      cellPadding: 2,
      valign: 'middle',
      lineColor: [244, 114, 182],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [190, 24, 93],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center' },
      1: { cellWidth: 44 },
      2: { cellWidth: 42 },
      3: { cellWidth: 36 },
      4: { cellWidth: 58 },
      5: { cellWidth: 28, halign: 'center' },
      6: { cellWidth: 28, halign: 'center' },
      7: { cellWidth: 25, halign: 'center' },
    },
  });

  doc.save('Teacher_Passports_Report.pdf');
}

