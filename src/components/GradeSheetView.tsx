import React, { useMemo, useState } from 'react';
import { FileDown, Printer } from 'lucide-react';
import { MarkRecord, SchoolDatabase } from '../types';
import { computeClassResults, ComputedStudentResult } from '../utils/grading';
import { downloadGradeSheetPDF } from '../utils/pdfGenerator';

interface GradeSheetViewProps {
  db: SchoolDatabase;
  initialExamId?: string;
  initialClassId?: string;
  initialSectionId?: string;
  initialStudentId?: string;
  onUpdateMarks?: (marks: MarkRecord[]) => void;
}

export const GradeSheetView: React.FC<GradeSheetViewProps> = ({
  db,
  initialExamId,
  initialClassId,
  initialSectionId,
  initialStudentId,
  onUpdateMarks,
}) => {
  const [examId, setExamId] = useState(
    initialExamId || db.exams[1]?.id || db.exams[0]?.id || '',
  );
  const [classId, setClassId] = useState(initialClassId || 'cls-9');
  const selectedClass =
    db.classes.find((c) => c.id === classId) || db.classes[0];
  const [sectionId, setSectionId] = useState(
    initialSectionId || selectedClass?.sections[0]?.id || '',
  );
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    initialStudentId || '',
  );
  const [design, setDesign] = useState<'reference_compact' | 'standard'>('reference_compact');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const selectedExam = db.exams.find((e) => e.id === examId) || db.exams[0];
  const sectionName =
    selectedClass?.sections.find((s) => s.id === sectionId)?.name || 'A';

  const students = useMemo(
    () =>
      db.students
        .filter(
          (s) =>
            s.classId === classId &&
            s.sectionId === sectionId &&
            s.status === 'active',
        )
        .sort((a, b) => a.rollNo - b.rollNo),
    [db.students, classId, sectionId],
  );

  const activeStudentId =
    students.some((s) => s.id === selectedStudentId)
      ? selectedStudentId
      : students[0]?.id || '';

  const results = useMemo(
    () =>
      computeClassResults(
        students,
        db.subjects,
        selectedClass,
        db.marks,
        examId,
        db.settings,
        selectedExam?.workingDays || 72,
      ),
    [students, db.subjects, selectedClass, db.marks, examId, db.settings, selectedExam],
  );

  const currentResult = results.find(
    (r) => r.student.id === activeStudentId,
  );

  const sortedGradingRules = useMemo(
    () =>
      [...db.settings.gradingRules].sort((a, b) => b.minPercent - a.minPercent),
    [db.settings.gradingRules],
  );

  const handleDownloadPdf = async (targetResults: ComputedStudentResult[]) => {
    if (!selectedClass || !selectedExam || targetResults.length === 0) return;
    setIsGeneratingPdf(true);
    try {
      await downloadGradeSheetPDF(
        targetResults,
        selectedClass,
        sectionName,
        selectedExam,
        db.settings,
        undefined,
        design,
      );
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const renderSheet = (res: ComputedStudentResult) => {
    const issueDate =
      selectedExam?.dateOfIssue ||
      (selectedExam ? db.settings.examIssueDates?.[selectedExam.term] : undefined) ||
      db.settings.dateOfIssue;

    return (
      <div
        key={res.student.id}
        className="bg-white mx-auto max-w-[794px] p-3 border-[3px] border-[#1e3a8a] print-only-container"
        style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
      >
        <div className="border border-[#1e3a8a] p-4 text-black">
          {/* Header with Single-Line School Title, Left School Logo and Centered Details */}
          <div className="mb-4">
            <h2 className="text-center text-lg sm:text-[23px] font-bold tracking-normal uppercase text-black whitespace-nowrap">
              {db.settings.schoolName}
            </h2>
            <div className="relative flex flex-col sm:flex-row items-center justify-center mt-1 min-h-[88px]">
              <div className="sm:absolute sm:left-0 sm:top-0 w-32 h-20 shrink-0 flex items-center justify-center mb-2 sm:mb-0">
                <img
                  src="/assets/aistudio/2png_bb8dd55e.png"
                  alt={`${db.settings.schoolName} Logo`}
                  className="w-32 h-20 object-contain"
                />
              </div>

              <div className="text-center">
                <p className="text-sm font-bold text-black">
                  {db.settings.address}
                </p>
                <p className="text-sm font-bold text-black">
                  Estd. {db.settings.estd}
                </p>
                <p className="text-sm font-bold text-black">
                  School IEMIS Code : {db.settings.iemisCode}
                </p>
                <p className="text-base font-bold text-black mt-0.5">
                  {selectedExam?.name} – {selectedExam?.academicYear || db.settings.academicYear}
                </p>
                <div className="text-lg font-bold tracking-wider uppercase text-black mt-0.5">
                  GRADE – SHEET
                </div>
              </div>
            </div>
          </div>

          {/* Student Particulars */}
          <div className="space-y-1.5 text-sm font-bold text-black mb-3">
            <div className="flex items-baseline gap-2">
              <span className="whitespace-nowrap">THE GRADE(S) SECURED BY:</span>
              <span className="flex-1 border-b border-dotted border-slate-900 uppercase px-2">
                {res.student.name}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-6">
              <div className="flex items-baseline gap-2">
                <span>Grade:</span>
                <span className="flex-1 border-b border-dotted border-slate-900 px-2">
                  {selectedClass?.name.replace(/^Grade\s+/i, '')}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span>Roll No.:</span>
                <span className="flex-1 border-b border-dotted border-slate-900 px-2 font-mono">
                  {res.student.rollNo}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span>Section:</span>
                <span className="flex-1 border-b border-dotted border-slate-900 px-2">
                  {sectionName}
                </span>
              </div>
            </div>
          </div>

          {/* Main Subjects Table */}
          <table className="w-full border-collapse border border-slate-900 text-xs">
            <thead>
              <tr className="bg-slate-50 font-bold text-center">
                <th className="border border-slate-900 px-2 py-1.5 w-[38%]">
                  SUBJECTS
                </th>
                <th className="border border-slate-900 px-2 py-1.5 w-[12%]">
                  CREDIT HOUR
                </th>
                <th className="border border-slate-900 px-2 py-1.5 w-[12%]">
                  GRADE POINT
                </th>
                <th className="border border-slate-900 px-2 py-1.5 w-[11%]">
                  GRADE
                </th>
                <th className="border border-slate-900 px-2 py-1.5 w-[12%]">
                  FINAL GRADE
                </th>
                <th className="border border-slate-900 px-2 py-1.5 w-[15%]">
                  REMARKS
                </th>
              </tr>
            </thead>
            <tbody>
              {res.subjectResults.map((sr) => {
                const chTh = sr.subject.creditHourTheory
                  .toFixed(2)
                  .replace(/\.00$/, '');
                const chPr = sr.subject.creditHourPractical
                  .toFixed(2)
                  .replace(/\.00$/, '');

                if (sr.hasPractical) {
                  return (
                    <React.Fragment key={sr.subject.id}>
                      <tr>
                        <td className="border-x border-t border-slate-900 px-2 py-1 font-bold uppercase">
                          {sr.subject.name} (TH)
                        </td>
                        <td className="border-x border-t border-slate-900 px-2 py-1 text-center font-mono tabular-nums">
                          {chTh}
                        </td>
                        <td className="border-x border-t border-slate-900 px-2 py-1 text-center font-mono tabular-nums">
                          {sr.hasEnteredMarks
                            ? sr.absentTheory
                              ? 'AB'
                              : sr.theoryGradePoint.toFixed(2)
                            : ''}
                        </td>
                        <td className="border-x border-t border-slate-900 px-2 py-1 text-center font-bold">
                          {sr.hasEnteredMarks ? sr.theoryGrade : ''}
                        </td>
                        <td
                          rowSpan={2}
                          className="border border-slate-900 px-2 py-1 text-center font-bold align-middle"
                        >
                          {sr.hasEnteredMarks ? sr.finalGrade : ''}
                        </td>
                        <td
                          rowSpan={2}
                          className="border border-slate-900 px-2 py-1 text-center align-middle"
                        >
                          {sr.hasEnteredMarks ? sr.remarks : ''}
                        </td>
                      </tr>
                      <tr>
                        <td className="border-x border-b border-slate-900 px-2 py-1 font-bold uppercase">
                          {sr.subject.name} ({sr.effectiveRule === 'none' ? 'PR' : 'IN'})
                        </td>
                        <td className="border-x border-b border-slate-900 px-2 py-1 text-center font-mono tabular-nums">
                          {chPr}
                        </td>
                        <td className="border-x border-b border-slate-900 px-2 py-1 text-center font-mono tabular-nums">
                          {sr.hasEnteredMarks
                            ? sr.absentPractical
                              ? 'AB'
                              : sr.practicalGradePoint.toFixed(2)
                            : ''}
                        </td>
                        <td className="border-x border-b border-slate-900 px-2 py-1 text-center font-bold">
                          {sr.hasEnteredMarks ? sr.practicalGrade : ''}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                }

                return (
                  <tr key={sr.subject.id}>
                    <td className="border border-slate-900 px-2 py-1.5 font-bold uppercase">
                      {sr.subject.name} (TH)
                    </td>
                    <td className="border border-slate-900 px-2 py-1.5 text-center font-mono tabular-nums">
                      {chTh}
                    </td>
                    <td className="border border-slate-900 px-2 py-1.5 text-center font-mono tabular-nums">
                      {sr.hasEnteredMarks
                        ? sr.absentTheory
                          ? 'AB'
                          : sr.theoryGradePoint.toFixed(2)
                        : ''}
                    </td>
                    <td className="border border-slate-900 px-2 py-1.5 text-center font-bold">
                      {sr.hasEnteredMarks ? sr.theoryGrade : ''}
                    </td>
                    <td className="border border-slate-900 px-2 py-1.5 text-center font-bold">
                      {sr.hasEnteredMarks ? sr.finalGrade : ''}
                    </td>
                    <td className="border border-slate-900 px-2 py-1.5 text-center">
                      {sr.hasEnteredMarks ? sr.remarks : ''}
                    </td>
                  </tr>
                );
              })}

              <tr>
                <td
                  colSpan={6}
                  className="border border-slate-900 px-3 py-1.5 text-center font-bold text-sm"
                >
                  Grade Point Average (GPA) ={' '}
                  <span className="font-mono tabular-nums">
                    {res.hasAnyMarks ? res.gpa.toFixed(2) : ''}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Separate Section for Drawing, Rhymes & Craft (Excluded from Total & GPA) */}
          {res.gradeOnlyResults.length > 0 && (
            <table className="w-full border-collapse border border-slate-900 text-xs mt-3">
              <thead>
                <tr className="bg-slate-50 font-bold text-center">
                  <th
                    colSpan={3}
                    className="border border-slate-900 px-2 py-1 text-[11px] uppercase tracking-wide"
                  >
                    Additional / Co-Curricular Subjects (Not Included in Total / GPA)
                  </th>
                </tr>
                <tr className="bg-slate-50 font-bold text-center">
                  <th className="border border-slate-900 px-2 py-1 text-left w-[56%]">
                    SUBJECT
                  </th>
                  <th className="border border-slate-900 px-2 py-1 w-[20%]">
                    GRADE
                  </th>
                  <th className="border border-slate-900 px-2 py-1 w-[24%]">
                    REMARKS
                  </th>
                </tr>
              </thead>
              <tbody>
                {res.gradeOnlyResults.map((gr) => (
                  <tr key={gr.subject.id}>
                    <td className="border border-slate-900 px-2 py-1 font-bold uppercase">
                      {gr.subject.name}
                    </td>
                    <td className="border border-slate-900 px-2 py-1 text-center font-bold">
                      {gr.grade}
                    </td>
                    <td className="border border-slate-900 px-2 py-1 text-center">
                      {gr.remarks}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Bottom Section: Exam Grading System + Attendance & Date of Issue */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mt-4 items-start">
            <div className="md:col-span-7">
              <table className="w-full border-collapse border border-slate-900 text-[11px]">
                <thead>
                  <tr>
                    <th
                      colSpan={4}
                      className="border border-slate-900 px-2 py-1 text-center font-bold bg-slate-50"
                    >
                      Exam Grading System
                    </th>
                  </tr>
                  <tr className="font-bold bg-slate-50">
                    <th className="border border-slate-900 px-2 py-0.5 text-left">
                      Interval
                    </th>
                    <th className="border border-slate-900 px-2 py-0.5 text-left">
                      Grade
                    </th>
                    <th className="border border-slate-900 px-2 py-0.5 text-left">
                      Description
                    </th>
                    <th className="border border-slate-900 px-2 py-0.5 text-left">
                      Grade Point
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedGradingRules.map((rule) => (
                    <tr key={rule.id}>
                      <td className="border border-slate-900 px-2 py-0.5 font-mono">
                        {rule.minPercent}% - {rule.maxPercent}%
                      </td>
                      <td className="border border-slate-900 px-2 py-0.5 font-bold">
                        {rule.grade}
                      </td>
                      <td className="border border-slate-900 px-2 py-0.5">
                        {rule.description}
                      </td>
                      <td className="border border-slate-900 px-2 py-0.5 font-mono">
                        {rule.gradePoint.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:col-span-5 space-y-6">
              <table className="w-full border-collapse border border-slate-900 text-xs">
                <thead>
                  <tr>
                    <th
                      colSpan={2}
                      className="border border-slate-900 px-2 py-1 text-center font-bold bg-slate-50"
                    >
                      Attendance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-900 px-3 py-1.5 font-bold">
                      Working Days
                    </td>
                    <td className="border border-slate-900 px-3 py-1.5 text-center font-mono tabular-nums font-bold">
                      {selectedExam?.workingDays || res.workingDays || 0}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-slate-900 px-3 py-1.5 font-bold">
                      Present Days
                    </td>
                    <td className="border border-slate-900 px-3 py-1.5 text-center font-mono tabular-nums font-bold">
                      {res.presentDays || 0}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="text-sm font-bold pt-2">
                Date of Issue :{' '}
                <span className="border-b border-dotted border-slate-900 px-2 font-mono">
                  {issueDate}
                </span>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-8 pt-12 pb-2 text-center text-sm font-bold">
            <div>
              <div className="border-t border-slate-900 pt-1 mx-4">
                {db.settings.signatories.classTeacher}
              </div>
            </div>
            <div>
              <div className="border-t border-slate-900 pt-1 mx-4">
                {db.settings.signatories.coordinator}
              </div>
            </div>
            <div>
              <div className="border-t border-slate-900 pt-1 mx-4">
                {db.settings.signatories.principal}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderReferenceDesignSheet = (res: ComputedStudentResult) => {
    return (
      <div
        key={res.student.id}
        className="bg-white mx-auto max-w-[794px] p-3 border-[3px] border-[#1e3a8a] print-only-container shadow-sm"
        style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
      >
        <div className="border border-[#1e3a8a] p-4 text-[#1e3a8a]">
          {/* Header matching Reference Image exactly */}
          <div className="relative mb-3 min-h-[96px] flex flex-col items-center justify-center">
            {/* Top-left School Logo + Estd. 2049 below it */}
            <div className="sm:absolute sm:left-0 sm:top-0 w-32 shrink-0 flex flex-col items-center justify-center mb-2 sm:mb-0">
              <img
                src="/assets/aistudio/2png_bb8dd55e.png"
                alt="School Logo"
                className="w-24 h-18 object-contain"
              />
              <span className="text-xs font-bold text-[#1e3a8a] mt-0.5 tracking-wide">
                Estd. 2049
              </span>
            </div>

            {/* School Title & Details */}
            <div className="text-center px-2">
              <h1 className="text-xl sm:text-[24px] font-bold tracking-tight uppercase text-[#1e3a8a] leading-tight">
                ARISTO ENGLISH BOARDING SCHOOL
              </h1>
              <p className="text-xs sm:text-[13px] font-bold text-[#1e3a8a] mt-0.5">
                {db.settings.address || 'Dhangadhi-8, Campus Road, Kailali'}
              </p>
              <p className="text-xs sm:text-[13px] font-bold text-[#1e3a8a]">
                School IEMIS Code: {db.settings.iemisCode || '710100021'}
              </p>
              <p className="text-xs sm:text-[13px] font-bold text-[#1e3a8a] mt-0.5">
                {selectedExam
                  ? `${selectedExam.name} – ${selectedExam.academicYear.includes('2083') ? selectedExam.academicYear : '2083 B.S.'}`
                  : 'Second Terminal Examination – 2083 B.S.'}
              </p>
              <h2 className="text-base sm:text-[17px] font-bold tracking-wider uppercase text-[#1e3a8a] mt-1">
                GRADE - SHEET
              </h2>
            </div>
          </div>

          {/* Student Particulars */}
          <div className="space-y-1.5 text-xs sm:text-[13px] font-bold text-slate-900 mb-2">
            <div className="flex items-baseline gap-2">
              <span className="text-[#1e3a8a] whitespace-nowrap">
                THE GRADE(S) SECURED BY:
              </span>
              <span className="flex-1 border-b border-dotted border-[#1e3a8a] uppercase px-2 font-bold text-black tracking-wide">
                {res.student.name}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-6">
              <div className="flex items-baseline gap-2">
                <span className="text-[#1e3a8a]">Class:</span>
                <span className="flex-1 border-b border-dotted border-[#1e3a8a] px-2 text-black">
                  {selectedClass?.name.replace(/^Grade\s+/i, '')}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[#1e3a8a]">Roll No:</span>
                <span className="flex-1 border-b border-dotted border-[#1e3a8a] px-2 font-mono text-black">
                  {res.student.rollNo}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[#1e3a8a]">Section:</span>
                <span className="flex-1 border-b border-dotted border-[#1e3a8a] px-2 text-black">
                  {sectionName}
                </span>
              </div>
            </div>
          </div>

          {/* Table matching Reference Design */}
          <table className="w-full border-collapse border border-[#1e3a8a] text-xs">
            <thead>
              <tr className="bg-white font-bold text-center text-[#1e3a8a]">
                <th
                  rowSpan={2}
                  className="border border-[#1e3a8a] px-1 py-1 w-[6%]"
                >
                  SN
                </th>
                <th
                  rowSpan={2}
                  className="border border-[#1e3a8a] px-2 py-1 text-center w-[36%]"
                >
                  SUBJECTS
                </th>
                <th
                  rowSpan={2}
                  className="border border-[#1e3a8a] px-1 py-1 w-[10%] leading-tight"
                >
                  CREDIT
                  <br />
                  HOUR
                </th>
                <th
                  colSpan={2}
                  className="border border-[#1e3a8a] px-1 py-1 w-[16%]"
                >
                  OBTAINED GRADE
                </th>
                <th
                  rowSpan={2}
                  className="border border-[#1e3a8a] px-1 py-1 w-[10%] leading-tight"
                >
                  FINAL
                  <br />
                  GRADE
                </th>
                <th
                  rowSpan={2}
                  className="border border-[#1e3a8a] px-1 py-1 w-[10%] leading-tight"
                >
                  GRADE
                  <br />
                  POINT
                </th>
                <th
                  rowSpan={2}
                  className="border border-[#1e3a8a] px-2 py-1 w-[12%]"
                >
                  Remarks
                </th>
              </tr>
              <tr className="bg-white font-bold text-center text-[#1e3a8a]">
                <th className="border border-[#1e3a8a] px-1 py-0.5 w-[8%]">
                  TH
                </th>
                <th className="border border-[#1e3a8a] px-1 py-0.5 w-[8%]">
                  PR
                </th>
              </tr>
            </thead>
            <tbody>
              {res.subjectResults.map((sr, idx) => {
                const totalCredit = (
                  (sr.subject.creditHourTheory || 0) +
                  (sr.subject.creditHourPractical || 0)
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

                return (
                  <tr key={sr.subject.id} className="text-black">
                    <td className="border border-[#1e3a8a] px-1 py-1 text-center font-mono text-[11px]">
                      {idx + 1}
                    </td>
                    <td className="border border-[#1e3a8a] px-2 py-1 font-semibold text-left">
                      {sr.subject.name}
                    </td>
                    <td className="border border-[#1e3a8a] px-1 py-1 text-center font-mono tabular-nums">
                      {totalCredit}
                    </td>
                    <td className="border border-[#1e3a8a] px-1 py-1 text-center font-semibold">
                      {thGrade}
                    </td>
                    <td className="border border-[#1e3a8a] px-1 py-1 text-center font-semibold">
                      {prGrade}
                    </td>
                    <td className="border border-[#1e3a8a] px-1 py-1 text-center font-bold">
                      {sr.hasEnteredMarks ? sr.finalGrade : ''}
                    </td>
                    <td className="border border-[#1e3a8a] px-1 py-1 text-center font-mono tabular-nums">
                      {sr.hasEnteredMarks
                        ? sr.finalGradePoint.toFixed(2)
                        : ''}
                    </td>
                    <td className="border border-[#1e3a8a] px-2 py-1 text-center text-[11px]">
                      {sr.hasEnteredMarks ? sr.remarks : ''}
                    </td>
                  </tr>
                );
              })}

              {/* Add Subject Subsection (e.g. for co-curricular/extra subjects) */}
              {res.gradeOnlyResults.length > 0 && (
                <>
                  <tr className="bg-slate-50">
                    <td className="border border-[#1e3a8a] px-1 py-1 text-center"></td>
                    <td
                      colSpan={7}
                      className="border border-[#1e3a8a] px-2 py-1 text-left font-bold text-[#1e3a8a]"
                    >
                      Add Subject
                    </td>
                  </tr>
                  {res.gradeOnlyResults.map((gr, gIdx) => (
                    <tr key={gr.subject.id} className="text-black">
                      <td className="border border-[#1e3a8a] px-1 py-1 text-center font-mono text-[11px]">
                        {gIdx + 1}
                      </td>
                      <td className="border border-[#1e3a8a] px-2 py-1 font-semibold text-left">
                        {gr.subject.name}
                      </td>
                      <td className="border border-[#1e3a8a] px-1 py-1 text-center font-mono">
                        -
                      </td>
                      <td className="border border-[#1e3a8a] px-1 py-1 text-center">
                        -
                      </td>
                      <td className="border border-[#1e3a8a] px-1 py-1 text-center">
                        -
                      </td>
                      <td className="border border-[#1e3a8a] px-1 py-1 text-center font-bold">
                        {gr.grade}
                      </td>
                      <td className="border border-[#1e3a8a] px-1 py-1 text-center font-mono">
                        -
                      </td>
                      <td className="border border-[#1e3a8a] px-2 py-1 text-center text-[11px]">
                        {gr.remarks || ''}
                      </td>
                    </tr>
                  ))}
                </>
              )}

              {/* GPA Row across full width */}
              <tr>
                <td
                  colSpan={8}
                  className="border border-[#1e3a8a] px-3 py-1.5 text-center font-bold text-sm text-[#1e3a8a]"
                >
                  GRADE POINT AVERAGE (GPA):{' '}
                  <span className="font-mono tabular-nums text-black ml-1">
                    {res.hasAnyMarks ? res.gpa.toFixed(2) : ''}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Bottom Grid: Attendance (Left) + Grading Scale (Right) */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 mt-3 items-start">
            {/* Left: Attendance Table */}
            <div className="sm:col-span-5">
              <table className="w-full border-collapse border border-[#1e3a8a] text-xs">
                <thead>
                  <tr>
                    <th
                      colSpan={2}
                      className="border border-[#1e3a8a] px-2 py-1 text-center font-bold text-[#1e3a8a] bg-white text-sm"
                    >
                      Attendance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-[#1e3a8a] px-3 py-1.5 font-bold text-[#1e3a8a]">
                      Working Days
                    </td>
                    <td className="border border-[#1e3a8a] px-3 py-1.5 text-center font-mono tabular-nums font-bold text-black">
                      {selectedExam?.workingDays || res.workingDays || 0}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-[#1e3a8a] px-3 py-1.5 font-bold text-[#1e3a8a]">
                      Present Days
                    </td>
                    <td className="border border-[#1e3a8a] px-3 py-1.5 text-center font-mono tabular-nums font-bold text-black">
                      {res.presentDays || 0}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Right: 8-Tier Standard Grading Scale */}
            <div className="sm:col-span-7">
              <table className="w-full border-collapse border border-[#1e3a8a] text-[11px]">
                <thead>
                  <tr className="font-bold text-[#1e3a8a] bg-white text-center">
                    <th className="border border-[#1e3a8a] px-2 py-0.5">
                      Percentage
                    </th>
                    <th className="border border-[#1e3a8a] px-2 py-0.5">
                      Letter Grade
                    </th>
                    <th className="border border-[#1e3a8a] px-2 py-0.5 text-left">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { range: '90 to 100', grade: 'A+', desc: 'Outstanding' },
                    { range: '80 to below 90', grade: 'A', desc: 'Excellent' },
                    { range: '70 to below 80', grade: 'B+', desc: 'Very good' },
                    { range: '60 to below 70', grade: 'B', desc: 'Good' },
                    { range: '50 to below 60', grade: 'C+', desc: 'Satisfactory' },
                    { range: '40 to below 50', grade: 'C', desc: 'Acceptable' },
                    { range: '35 to below 40', grade: 'D', desc: 'Basic' },
                    { range: 'Below 35', grade: 'NG', desc: 'Not Graded' },
                  ].map((row) => (
                    <tr key={row.range} className="text-black">
                      <td className="border border-[#1e3a8a] px-2 py-0.5 text-center font-mono">
                        {row.range}
                      </td>
                      <td className="border border-[#1e3a8a] px-2 py-0.5 text-center font-bold">
                        {row.grade}
                      </td>
                      <td className="border border-[#1e3a8a] px-2 py-0.5 text-left">
                        {row.desc}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Signatures: Class Teacher, Checked By, Principal */}
          <div className="grid grid-cols-3 gap-6 pt-10 pb-2 text-center text-xs font-bold text-[#1e3a8a]">
            <div>
              <div className="text-slate-400 font-mono tracking-widest text-xs">
                ................................
              </div>
              <div className="pt-1">Class Teacher</div>
            </div>
            <div>
              <div className="text-slate-400 font-mono tracking-widest text-xs">
                ................................
              </div>
              <div className="pt-1">Checked By</div>
            </div>
            <div>
              <div className="text-slate-400 font-mono tracking-widest text-xs">
                ................................
              </div>
              <div className="pt-1">Principal</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Control Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 no-print">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Examination
            </label>
            <select
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              {db.exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name} ({ex.academicYear})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Class
            </label>
            <select
              value={classId}
              onChange={(e) => {
                const nextCls = db.classes.find((c) => c.id === e.target.value);
                setClassId(e.target.value);
                setSectionId(nextCls?.sections[0]?.id || '');
                setSelectedStudentId('');
              }}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              {db.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Section
            </label>
            <select
              value={sectionId}
              onChange={(e) => {
                setSectionId(e.target.value);
                setSelectedStudentId('');
              }}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              {selectedClass?.sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  Section {sec.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Student
            </label>
            <select
              value={activeStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white min-w-[200px]"
            >
              {students.map((stu) => (
                <option key={stu.id} value={stu.id}>
                  Roll {stu.rollNo} — {stu.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Design Format
            </label>
            <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-300">
              <button
                type="button"
                onClick={() => setDesign('reference_compact')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                  design === 'reference_compact'
                    ? 'bg-[#1e3a8a] text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <span>Design 2 (Reference)</span>
                {design === 'reference_compact' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setDesign('standard')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                  design === 'standard'
                    ? 'bg-[#1e3a8a] text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <span>Design 1 (Institutional)</span>
                {design === 'standard' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button
            type="button"
            disabled={!currentResult || !selectedClass || !selectedExam || isGeneratingPdf}
            onClick={() => currentResult && handleDownloadPdf([currentResult])}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg disabled:opacity-50 whitespace-nowrap"
          >
            <FileDown className="w-4 h-4" />
            Download PDF (Student)
          </button>
          <button
            type="button"
            disabled={results.length === 0 || !selectedClass || !selectedExam || isGeneratingPdf}
            onClick={() => handleDownloadPdf(results)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-800 bg-slate-200 hover:bg-slate-300 rounded-lg disabled:opacity-50 whitespace-nowrap"
          >
            <FileDown className="w-4 h-4" />
            Download All Class PDF
          </button>
        </div>
      </div>

      {/* Inline Editor for Grade-Only Subjects (Drawing, Rhymes, Craft) */}
      {currentResult &&
        currentResult.gradeOnlyResults.length > 0 &&
        onUpdateMarks && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 no-print">
            <div>
              <div className="text-xs font-semibold text-slate-900">
                Co-Curricular Grades for {currentResult.student.name}
              </div>
              <div className="text-[11px] text-slate-500">
                Displayed separately on the Gradesheet (excluded from Marks Entry, Markwise Ledger, Total, and GPA).
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {currentResult.gradeOnlyResults.map((gr) => (
                <label
                  key={gr.subject.id}
                  className="flex items-center gap-2 text-xs font-medium text-slate-700"
                >
                  <span>{gr.subject.name}</span>
                  <select
                    value={gr.grade === '-' ? '' : gr.grade}
                    onChange={(e) => {
                      const nextGrade = e.target.value;
                      const recId = `${examId}__${currentResult.student.id}`;
                      const existing = db.marks.find((m) => m.id === recId);
                      const updated: MarkRecord = existing
                        ? {
                            ...existing,
                            nonAcademicGrades: {
                              ...(existing.nonAcademicGrades || {}),
                              [gr.subject.id]: nextGrade,
                            },
                          }
                        : {
                            id: recId,
                            examId,
                            studentId: currentResult.student.id,
                            classId,
                            sectionId,
                            workingDays: selectedExam?.workingDays || 72,
                            presentDays: selectedExam?.workingDays || 72,
                            subjects: {},
                            nonAcademicGrades: {
                              [gr.subject.id]: nextGrade,
                            },
                          };
                      const nextMarks = existing
                        ? db.marks.map((m) => (m.id === recId ? updated : m))
                        : [...db.marks, updated];
                      onUpdateMarks(nextMarks);
                    }}
                    className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white font-mono font-semibold"
                  >
                    <option value="">Select</option>
                    {sortedGradingRules.map((rule) => (
                      <option key={rule.id} value={rule.grade}>
                        {rule.grade} ({rule.description})
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>
        )}

      {/* Sheet Preview */}
      {currentResult ? (
        design === 'reference_compact' ? (
          renderReferenceDesignSheet(currentResult)
        ) : (
          renderSheet(currentResult)
        )
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-500 text-sm">
          No students enrolled in {selectedClass?.name} Section {sectionName}.
        </div>
      )}
    </div>
  );
};
