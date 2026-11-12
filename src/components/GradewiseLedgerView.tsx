import React, { useMemo, useState } from 'react';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import { MarkRecord, SchoolDatabase } from '../types';
import { computeClassResults, isGradeOnlySubject } from '../utils/grading';
import { exportGradewiseLedgerExcel } from '../utils/excelHelper';
import { downloadGradewiseLedgerPDF } from '../utils/pdfGenerator';

interface GradewiseLedgerViewProps {
  db: SchoolDatabase;
  initialExamId?: string;
  initialClassId?: string;
  initialSectionId?: string;
  onUpdateMarks?: (marks: MarkRecord[]) => void;
}

export const GradewiseLedgerView: React.FC<GradewiseLedgerViewProps> = ({
  db,
  initialExamId,
  initialClassId,
  initialSectionId,
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

  const classSubjects = useMemo(
    () =>
      db.subjects
        .filter((s) => s.classId === classId && s.status === 'active')
        .sort((a, b) => a.displayOrder - b.displayOrder),
    [db.subjects, classId],
  );

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

  const gradeBuckets = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'NG'];

  const overallDistribution = useMemo(() => {
    const evaluated = results.filter((r) => r.hasAnyMarks);
    return gradeBuckets.map((grade) => {
      const count = evaluated.filter((r) => r.overallGrade === grade).length;
      const pct = evaluated.length > 0 ? (count / evaluated.length) * 100 : 0;
      return { grade, count, pct };
    });
  }, [results]);

  const sortedRules = useMemo(
    () =>
      [...db.settings.gradingRules].sort((a, b) => b.minPercent - a.minPercent),
    [db.settings.gradingRules],
  );

  const handleNonAcademicGradeChange = (
    studentId: string,
    subjectId: string,
    nextGrade: string,
  ) => {
    if (!onUpdateMarks) return;
    const recId = `${examId}__${studentId}`;
    const existing = db.marks.find((m) => m.id === recId);
    const updated: MarkRecord = existing
      ? {
          ...existing,
          nonAcademicGrades: {
            ...(existing.nonAcademicGrades || {}),
            [subjectId]: nextGrade,
          },
        }
      : {
          id: recId,
          examId,
          studentId,
          classId,
          sectionId,
          workingDays: selectedExam?.workingDays || 72,
          presentDays: selectedExam?.workingDays || 72,
          subjects: {},
          nonAcademicGrades: {
            [subjectId]: nextGrade,
          },
        };
    const nextMarks = existing
      ? db.marks.map((m) => (m.id === recId ? updated : m))
      : [...db.marks, updated];
    onUpdateMarks(nextMarks);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
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
              onChange={(e) => setSectionId(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              {selectedClass?.sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  Section {sec.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              selectedClass &&
              selectedExam &&
              exportGradewiseLedgerExcel(
                results,
                db.subjects,
                selectedClass,
                sectionName,
                selectedExam,
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Excel
          </button>
          <button
            type="button"
            onClick={() =>
              selectedClass &&
              selectedExam &&
              downloadGradewiseLedgerPDF(
                results,
                db.subjects,
                selectedClass,
                sectionName,
                selectedExam,
                db.settings,
              )
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg whitespace-nowrap"
          >
            <FileDown className="w-4 h-4" />
            Download PDF
          </button>
        </div>
      </div>

      {/* Grade Distribution Summary */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">
          Overall Grade Distribution ({selectedClass?.name} – Section {sectionName})
        </h2>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
          {overallDistribution.map((b) => (
            <div
              key={b.grade}
              className="border border-slate-200 rounded-lg p-3 text-center"
            >
              <div
                className={`text-sm font-bold font-mono ${
                  b.grade === 'NG' ? 'text-red-700' : 'text-slate-900'
                }`}
              >
                {b.grade}
              </div>
              <div className="text-xl font-bold font-mono tabular-nums text-indigo-700 my-0.5">
                {b.count}
              </div>
              <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                {b.pct.toFixed(0)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Student Gradewise Ledger */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 font-semibold text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-3 py-3">Roll</th>
                <th className="px-3 py-3 min-w-[160px]">Student Name</th>
                {classSubjects.map((sub) => {
                  const gradeOnly = isGradeOnlySubject(sub);
                  return (
                    <th
                      key={sub.id}
                      className="px-3 py-3 text-center border-l border-slate-200 min-w-[96px]"
                    >
                      <div>{sub.code}</div>
                      <div className="text-[10px] font-normal text-slate-500">
                        {gradeOnly
                          ? 'Grade-Only'
                          : sub.fullMarksPractical > 0
                            ? 'TH / PR / Fin'
                            : 'Final'}
                      </div>
                    </th>
                  );
                })}
                <th className="px-3 py-3 text-right border-l border-slate-200">
                  GPA
                </th>
                <th className="px-3 py-3 text-center">Grade</th>
                <th className="px-3 py-3">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {results.map((r) => (
                <tr key={r.student.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-mono tabular-nums text-slate-700">
                    {r.student.rollNo}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-slate-900 whitespace-nowrap">
                    {r.student.name}
                  </td>
                  {classSubjects.map((sub) => {
                    const grOnly = r.gradeOnlyResults.find(
                      (x) => x.subject.id === sub.id,
                    );
                    if (grOnly) {
                      return (
                        <td
                          key={sub.id}
                          className="px-2 py-2 text-center font-mono border-l border-slate-100 whitespace-nowrap"
                        >
                          {onUpdateMarks ? (
                            <select
                              value={grOnly.grade === '-' ? '' : grOnly.grade}
                              onChange={(e) =>
                                handleNonAcademicGradeChange(
                                  r.student.id,
                                  sub.id,
                                  e.target.value,
                                )
                              }
                              aria-label={`${r.student.name} ${sub.name} Grade`}
                              className="px-1.5 py-1 text-xs border border-slate-300 rounded bg-white font-mono font-semibold"
                            >
                              <option value="">-</option>
                              {sortedRules.map((rule) => (
                                <option key={rule.id} value={rule.grade}>
                                  {rule.grade}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="font-bold text-slate-900">
                              {grOnly.grade}
                            </span>
                          )}
                        </td>
                      );
                    }

                    const sr = r.subjectResults.find(
                      (x) => x.subject.id === sub.id,
                    );
                    if (!sr) {
                      return (
                        <td
                          key={sub.id}
                          className="px-3 py-2.5 text-center text-slate-300 border-l border-slate-100 font-mono"
                        >
                          —
                        </td>
                      );
                    }
                    return (
                      <td
                        key={sub.id}
                        className="px-3 py-2.5 text-center font-mono border-l border-slate-100 whitespace-nowrap"
                      >
                        {!sr.hasEnteredMarks ? (
                          <span className="text-slate-400">-</span>
                        ) : sr.hasPractical ? (
                          <span>
                            <span className="text-slate-600">
                              {sr.theoryGrade}/{sr.practicalGrade}/
                            </span>
                            <strong
                              className={
                                sr.finalGrade === 'NG'
                                  ? 'text-red-700'
                                  : 'text-slate-900'
                              }
                            >
                              {sr.finalGrade}
                            </strong>
                          </span>
                        ) : (
                          <strong
                            className={
                              sr.finalGrade === 'NG'
                                ? 'text-red-700'
                                : 'text-slate-900'
                            }
                          >
                            {sr.finalGrade}
                          </strong>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums font-semibold text-indigo-700 border-l border-slate-200">
                    {r.hasAnyMarks ? r.gpa.toFixed(2) : '-'}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-center font-mono font-bold ${
                      r.overallGrade === 'NG'
                        ? 'text-red-700'
                        : 'text-slate-900'
                    }`}
                  >
                    {r.overallGrade}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                    {r.overallRemarks}
                  </td>
                </tr>
              ))}
              {results.length === 0 && (
                <tr>
                  <td
                    colSpan={classSubjects.length + 5}
                    className="px-4 py-10 text-center text-slate-500 text-sm"
                  >
                    No student records found for this class and section.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
