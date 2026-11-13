import React, { useMemo, useState } from 'react';
import { FileDown, FileSpreadsheet, Search } from 'lucide-react';
import { SchoolDatabase } from '../types';
import { computeClassResults, isGradeOnlySubject } from '../utils/grading';
import { exportMarkwiseLedgerExcel } from '../utils/excelHelper';
import { downloadMarkwiseLedgerPDF } from '../utils/pdfGenerator';

interface MarkwiseLedgerViewProps {
  db: SchoolDatabase;
  initialExamId?: string;
  initialClassId?: string;
  initialSectionId?: string;
}

export const MarkwiseLedgerView: React.FC<MarkwiseLedgerViewProps> = ({
  db,
  initialExamId,
  initialClassId,
  initialSectionId,
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
  const [search, setSearch] = useState('');

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
        .filter(
          (s) =>
            s.classId === classId &&
            s.status === 'active' &&
            !isGradeOnlySubject(s),
        )
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

  const filteredResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return results;
    return results.filter(
      (r) =>
        r.student.name.toLowerCase().includes(q) ||
        String(r.student.rollNo).includes(q),
    );
  }, [results, search]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
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
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter student..."
              className="pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              selectedClass &&
              selectedExam &&
              exportMarkwiseLedgerExcel(
                filteredResults,
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
              downloadMarkwiseLedgerPDF(
                filteredResults,
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

      {/* Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span>
            <strong className="text-slate-900">
              {selectedClass?.name} – Section {sectionName}
            </strong>{' '}
            · {selectedExam?.name} ({selectedExam?.academicYear}) · Working Days:{' '}
            <strong className="font-mono text-slate-900">
              {selectedExam?.workingDays ?? 72}
            </strong>
          </span>
          <span>Format per subject: TH | Final PR (with Conv.) | Total</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 font-semibold text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-3 py-3 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                  Roll
                </th>
                <th className="px-3 py-3 sticky left-10 bg-slate-50 z-10 border-r border-slate-200 min-w-[160px]">
                  Student Name
                </th>
                {classSubjects.map((sub) => (
                  <th
                    key={sub.id}
                    className="px-3 py-3 text-center border-r border-slate-200 min-w-[115px]"
                  >
                    <div className="font-semibold text-slate-900">{sub.code}</div>
                    <div className="text-[10px] font-normal text-slate-500">
                      {sub.fullMarksPractical > 0 ? 'TH | Fin.PR | Tot' : 'Total'}
                    </div>
                  </th>
                ))}
                <th className="px-3 py-3 text-right">Total</th>
                <th className="px-3 py-3 text-right">%</th>
                <th className="px-3 py-3 text-right">GPA</th>
                <th className="px-3 py-3 text-center whitespace-nowrap">
                  Present Days
                </th>
                <th className="px-3 py-3 text-center">Rank</th>
                <th className="px-3 py-3 text-center">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredResults.map((r) => (
                <tr key={r.student.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-mono tabular-nums text-slate-700 sticky left-0 bg-white border-r border-slate-200">
                    {r.student.rollNo}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-slate-900 sticky left-10 bg-white border-r border-slate-200 whitespace-nowrap">
                    {r.student.name}
                  </td>
                  {classSubjects.map((sub) => {
                    const sr = r.subjectResults.find(
                      (x) => x.subject.id === sub.id,
                    );
                    if (!sr) {
                      return (
                        <td
                          key={sub.id}
                          className="px-3 py-2.5 text-center text-slate-300 border-r border-slate-100 font-mono"
                        >
                          —
                        </td>
                      );
                    }
                    if (!sr.hasEnteredMarks) {
                      return (
                        <td
                          key={sub.id}
                          className="px-3 py-2.5 text-center text-slate-400 border-r border-slate-100 font-mono"
                        >
                          Pending
                        </td>
                      );
                    }
                    return (
                      <td
                        key={sub.id}
                        className="px-3 py-2.5 text-center font-mono tabular-nums border-r border-slate-100 whitespace-nowrap"
                      >
                        {sr.hasPractical ? (
                          <span>
                            <span className="text-slate-600">
                              {sr.absentTheory ? 'AB' : sr.theoryObtained}
                            </span>
                            <span className="text-slate-300 mx-1">|</span>
                            <span className="text-indigo-700">
                              {sr.absentPractical
                                ? 'AB'
                                : sr.finalPracticalMarks}
                            </span>
                            <span className="text-slate-300 mx-1">|</span>
                            <strong className="text-slate-900">
                              {sr.totalObtained}
                            </strong>
                          </span>
                        ) : (
                          <strong className="text-slate-900">
                            {sr.totalObtained}
                          </strong>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                    {r.hasAnyMarks
                      ? `${r.grandTotalObtained}/${r.grandTotalFullMarks}`
                      : '-'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-800">
                    {r.hasAnyMarks ? `${r.percentage.toFixed(2)}%` : '-'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums font-semibold text-indigo-700">
                    {r.hasAnyMarks ? r.gpa.toFixed(2) : '-'}
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono tabular-nums text-slate-700 whitespace-nowrap">
                    {r.markRecord ? `${r.presentDays}/${r.workingDays}` : '-'}
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono tabular-nums text-slate-800">
                    {r.rank ?? '-'}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-center font-semibold ${
                      !r.hasAnyMarks
                        ? 'text-slate-400'
                        : r.isPassed
                          ? 'text-emerald-700'
                          : 'text-red-700'
                    }`}
                  >
                    {r.hasAnyMarks ? (r.isPassed ? 'PASS' : 'NG') : 'Pending'}
                  </td>
                </tr>
              ))}
              {filteredResults.length === 0 && (
                <tr>
                  <td
                    colSpan={classSubjects.length + 8}
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
