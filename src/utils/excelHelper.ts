import * as XLSX from 'xlsx';
import {
  Exam,
  MarkRecord,
  SchoolClass,
  Student,
  Subject,
} from '../types';
import { ComputedStudentResult, isGradeOnlySubject } from './grading';

export function exportStudentsExcel(
  students: Student[],
  classes: SchoolClass[],
) {
  const rows = students.map((s) => {
    const cls = classes.find((c) => c.id === s.classId);
    const sec = cls?.sections.find((secItem) => secItem.id === s.sectionId);
    return {
      StudentCode: s.studentCode,
      Name: s.name,
      Class: cls?.name || '',
      Section: sec?.name || '',
      RollNo: s.rollNo,
      AcademicYear: s.academicYear,
      GuardianName: s.guardianName,
      Contact: s.contact,
      Status: s.status,
    };
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Students');
  XLSX.writeFile(wb, 'Students_Directory.xlsx');
}

export function downloadStudentTemplateExcel() {
  const sampleRows = [
    {
      StudentCode: '710100021-907',
      Name: 'Sagar Khadka',
      Class: 'Grade 9',
      Section: 'A',
      RollNo: 7,
      AcademicYear: '2082',
      GuardianName: 'Harish Khadka',
      Contact: '9848011299',
      Status: 'active',
    },
  ];
  const ws = XLSX.utils.json_to_sheet(sampleRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Students_Template');
  XLSX.writeFile(wb, 'Students_Import_Template.xlsx');
}

export async function parseStudentsExcel(
  file: File,
  classes: SchoolClass[],
): Promise<Omit<Student, 'id'>[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const firstSheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet);

  return raw
    .filter((row) => row.Name || row.name)
    .map((row, idx) => {
      const clsName = String(row.Class ?? row.class ?? 'Grade 9').trim();
      const matchedClass =
        classes.find(
          (c) => c.name.toLowerCase() === clsName.toLowerCase(),
        ) ?? classes[0];
      const secName = String(row.Section ?? row.section ?? 'A').trim();
      const matchedSection =
        matchedClass.sections.find(
          (s) => s.name.toLowerCase() === secName.toLowerCase(),
        ) ?? matchedClass.sections[0];

      return {
        studentCode: String(
          row.StudentCode ?? row.studentCode ?? `IMP-${Date.now()}-${idx + 1}`,
        ),
        name: String(row.Name ?? row.name ?? '').trim(),
        classId: matchedClass.id,
        sectionId: matchedSection.id,
        rollNo: Number(row.RollNo ?? row.rollNo ?? idx + 1) || idx + 1,
        academicYear: String(row.AcademicYear ?? '2082'),
        guardianName: String(row.GuardianName ?? ''),
        contact: String(row.Contact ?? ''),
        optionalSubjects: {},
        status:
          String(row.Status ?? 'active').toLowerCase() === 'inactive'
            ? 'inactive'
            : 'active',
      };
    });
}

export function downloadMarksTemplateExcel(
  students: Student[],
  subjects: Subject[],
  schoolClass: SchoolClass,
  sectionName: string,
  exam: Exam,
  existingMarks: MarkRecord[],
) {
  const classSubjects = subjects
    .filter(
      (s) =>
        s.classId === schoolClass.id &&
        s.status === 'active' &&
        !isGradeOnlySubject(s),
    )
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const rows = students.map((stu) => {
    const rec = existingMarks.find(
      (m) => m.examId === exam.id && m.studentId === stu.id,
    );
    const row: Record<string, string | number> = {
      StudentCode: stu.studentCode,
      RollNo: stu.rollNo,
      StudentName: stu.name,
      WorkingDays: rec?.workingDays ?? exam.workingDays,
      PresentDays: rec?.presentDays ?? exam.workingDays,
    };
    for (const sub of classSubjects) {
      const m = rec?.subjects?.[sub.id];
      row[`${sub.code}_TH`] = m?.theoryObtained ?? '';
      if (sub.fullMarksPractical > 0) {
        row[`${sub.code}_PR`] = m?.practicalObtained ?? '';
      }
    }
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Marks');
  XLSX.writeFile(
    wb,
    `Marks_Template_${schoolClass.name}_${sectionName}_${exam.term}.xlsx`,
  );
}

export async function parseMarksExcel(
  file: File,
  students: Student[],
  subjects: Subject[],
  schoolClass: SchoolClass,
  sectionId: string,
  exam: Exam,
): Promise<MarkRecord[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const firstSheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet);

  const classSubjects = subjects.filter(
    (s) =>
      s.classId === schoolClass.id &&
      s.status === 'active' &&
      !isGradeOnlySubject(s),
  );

  const imported: MarkRecord[] = [];
  for (const row of raw) {
    const code = String(row.StudentCode ?? '').trim();
    const roll = Number(row.RollNo ?? 0);
    const name = String(row.StudentName ?? '').trim().toLowerCase();

    const student = students.find(
      (s) =>
        s.classId === schoolClass.id &&
        s.sectionId === sectionId &&
        ((code && s.studentCode === code) ||
          (roll > 0 && s.rollNo === roll) ||
          (name && s.name.toLowerCase() === name)),
    );

    if (!student) continue;

    const subjectEntries: MarkRecord['subjects'] = {};
    for (const sub of classSubjects) {
      const thKey = `${sub.code}_TH`;
      const prKey = `${sub.code}_PR`;
      const thVal =
        row[thKey] !== undefined && row[thKey] !== ''
          ? Number(row[thKey])
          : null;
      const prVal =
        row[prKey] !== undefined && row[prKey] !== ''
          ? Number(row[prKey])
          : null;
      if (thVal !== null || prVal !== null) {
        subjectEntries[sub.id] = {
          theoryObtained: thVal,
          practicalObtained: prVal,
        };
      }
    }

    imported.push({
      id: `${exam.id}__${student.id}`,
      examId: exam.id,
      studentId: student.id,
      classId: schoolClass.id,
      sectionId,
      workingDays: Number(row.WorkingDays ?? exam.workingDays) || exam.workingDays,
      presentDays: Number(row.PresentDays ?? exam.workingDays) || 0,
      subjects: subjectEntries,
    });
  }

  return imported;
}

export function exportMarkwiseLedgerExcel(
  results: ComputedStudentResult[],
  subjects: Subject[],
  schoolClass: SchoolClass,
  sectionName: string,
  exam: Exam,
) {
  const displaySubjects = subjects
    .filter(
      (s) =>
        s.classId === schoolClass.id &&
        s.status === 'active' &&
        !isGradeOnlySubject(s),
    )
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const rows = results.map((r) => {
    const row: Record<string, string | number> = {
      RollNo: r.student.rollNo,
      StudentCode: r.student.studentCode,
      StudentName: r.student.name,
    };

    for (const sub of displaySubjects) {
      const sr = r.subjectResults.find((x) => x.subject.id === sub.id);
      if (!sr) {
        row[`${sub.code} TH`] = '-';
        if (sub.fullMarksPractical > 0) {
          row[`${sub.code} PR(Obt)`] = '-';
          row[`${sub.code} PR(Final)`] = '-';
        }
        row[`${sub.code} Total`] = '-';
      } else {
        row[`${sub.code} TH`] = sr.theoryObtained;
        if (sr.hasPractical) {
          row[`${sub.code} PR(Obt)`] = sr.practicalObtained;
          row[`${sub.code} PR(Final)`] = sr.finalPracticalMarks;
        }
        row[`${sub.code} Total`] = sr.totalObtained;
      }
    }

    row['Grand Total'] = r.grandTotalObtained;
    row['Full Marks'] = r.grandTotalFullMarks;
    row['Percentage'] = Number(r.percentage.toFixed(2));
    row['GPA'] = Number(r.gpa.toFixed(2));
    row['Working Days'] = r.workingDays;
    row['Present Days'] = r.markRecord ? r.presentDays : '-';
    row['Rank'] = r.rank ?? '-';
    row['Result'] = r.hasAnyMarks ? (r.isPassed ? 'PASS' : 'NG') : 'Pending';
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Markwise_Ledger');
  XLSX.writeFile(
    wb,
    `Markwise_Ledger_${schoolClass.name}_${sectionName}_${exam.term}.xlsx`,
  );
}

export function exportGradewiseLedgerExcel(
  results: ComputedStudentResult[],
  subjects: Subject[],
  schoolClass: SchoolClass,
  sectionName: string,
  exam: Exam,
) {
  const displaySubjects = subjects
    .filter((s) => s.classId === schoolClass.id && s.status === 'active')
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const rows = results.map((r) => {
    const row: Record<string, string | number> = {
      RollNo: r.student.rollNo,
      StudentName: r.student.name,
    };

    for (const sub of displaySubjects) {
      const sr = r.subjectResults.find((x) => x.subject.id === sub.id);
      const grOnly = r.gradeOnlyResults.find((x) => x.subject.id === sub.id);
      if (grOnly) {
        row[`${sub.code} Grade`] = grOnly.grade;
      } else if (!sr) {
        row[`${sub.code} Grade`] = '-';
      } else {
        row[`${sub.code} TH`] = sr.theoryGrade;
        if (sr.hasPractical) {
          row[`${sub.code} PR`] = sr.practicalGrade;
        }
        row[`${sub.code} Final`] = sr.finalGrade;
      }
    }

    row['Working Days'] = r.workingDays;
    row['Present Days'] = r.markRecord ? r.presentDays : '-';
    row['GPA'] = Number(r.gpa.toFixed(2));
    row['Overall Grade'] = r.overallGrade;
    row['Remarks'] = r.overallRemarks;
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Gradewise_Ledger');
  XLSX.writeFile(
    wb,
    `Gradewise_Ledger_${schoolClass.name}_${sectionName}_${exam.term}.xlsx`,
  );
}

export interface AssignmentReportRow {
  sn: number;
  assignmentId: string;
  className: string;
  sectionName: string;
  subjectName: string;
  subjectCode: string;
  teacherName: string;
  assignmentTypeLabel: string;
  periodSlot: string;
  academicYearId: string;
  createdBy: string;
  createdDate: string;
}

export function exportTeacherAssignmentsExcel(
  rows: AssignmentReportRow[],
  academicYearLabel: string,
) {
  const sheetRows = rows.map((r) => ({
    'S.N.': r.sn,
    'Assignment ID': r.assignmentId,
    Class: r.className,
    Section: r.sectionName,
    Subject: r.subjectName,
    'Subject Code': r.subjectCode,
    'Teacher Name': r.teacherName,
    'Assignment Type': r.assignmentTypeLabel,
    Period: r.periodSlot,
    'Academic Year': r.academicYearId,
    'Created By': r.createdBy,
    'Created Date': r.createdDate,
  }));
  const ws = XLSX.utils.json_to_sheet(sheetRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Teacher_Assignments');
  const safeYear = academicYearLabel.replace(/\s+/g, '_');
  XLSX.writeFile(wb, `Subject_Teacher_Assignments_${safeYear}.xlsx`);
}

export interface TeacherPassportReportRow {
  sn: number;
  passportNumber: string;
  passportTitle: string;
  username: string;
  teacherCode: string;
  teacherName: string;
  issuedDate: string;
  expiryDate: string;
  status: string;
  createdDate: string;
}

export function exportTeacherPassportsExcel(rows: TeacherPassportReportRow[]) {
  const sheetRows = rows.map((r) => ({
    'S.N.': r.sn,
    'Passport Number': r.passportNumber,
    'Passport Title': r.passportTitle,
    Username: r.username,
    'Teacher Code': r.teacherCode || '-',
    'Assigned Teacher': r.teacherName || 'Unassigned Pool',
    'Issued Date': r.issuedDate,
    'Expiry Date': r.expiryDate,
    Status: r.status.toUpperCase(),
    'Created Date': r.createdDate,
  }));
  const ws = XLSX.utils.json_to_sheet(sheetRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Teacher_Passports');
  XLSX.writeFile(wb, 'Teacher_Passports_Directory.xlsx');
}

export interface TopTenExportRow {
  rank: number;
  rollNo: number;
  studentCode: string;
  studentName: string;
  sectionName: string;
  totalObtained: number;
  totalFullMarks: number;
  percentage: number;
  gpa: number;
  overallGrade: string;
  presentDays: number;
  workingDays: number;
  resultStatus: string;
}

export function exportTopTenExcel(
  gpaRows: TopTenExportRow[],
  percentageRows: TopTenExportRow[],
  className: string,
  sectionLabel: string,
  exam: Exam,
) {
  const mapRows = (list: TopTenExportRow[]) =>
    list.map((r) => ({
      Rank: r.rank,
      RollNo: r.rollNo,
      StudentCode: r.studentCode,
      StudentName: r.studentName,
      Section: r.sectionName,
      'Marks Obtained': r.totalObtained,
      'Full Marks': r.totalFullMarks,
      'Percentage (%)': Number(r.percentage.toFixed(2)),
      GPA: Number(r.gpa.toFixed(2)),
      Grade: r.overallGrade,
      'Present Days': `${r.presentDays}/${r.workingDays}`,
      Result: r.resultStatus,
    }));

  const wb = XLSX.utils.book_new();
  const wsGpa = XLSX.utils.json_to_sheet(mapRows(gpaRows));
  const wsPct = XLSX.utils.json_to_sheet(mapRows(percentageRows));
  XLSX.utils.book_append_sheet(wb, wsGpa, 'Top_10_GPA_Wise');
  XLSX.utils.book_append_sheet(wb, wsPct, 'Top_10_Percentage_Wise');

  const safeClass = className.replace(/\s+/g, '_');
  const safeSec = sectionLabel.replace(/\s+/g, '_');
  XLSX.writeFile(wb, `Top_10_${safeClass}_${safeSec}_${exam.term}.xlsx`);
}

