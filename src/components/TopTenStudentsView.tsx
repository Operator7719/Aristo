import React, { useMemo, useState } from 'react';
import { Award, FileDown, FileSpreadsheet, Printer, Trophy } from 'lucide-react';
import { SchoolDatabase, Student } from '../types';
import { ComputedStudentResult, computeClassResults } from '../utils/grading';
import { exportTopTenExcel, TopTenExportRow } from '../utils/excelHelper';
import { downloadTopTenPDF, TopTenPdfRow } from '../utils/pdfGenerator';

interface TopTenStudentsViewProps {
  db: SchoolDatabase;
  initialExamId?: string;
  initialClassId?: string;
  onViewGradeSheet?: (student: Student, examId: string) => void;
}

type MeritScope = 'passed' | 'all';
type ViewMode = 'both' | 'gpa' | 'percentage';

interface RankedEntry {
  rank: number;
  result: ComputedStudentResult;
  sectionName: string;
}

export const TopTenStudentsView: React.FC<TopTenStudentsViewProps> = ({
  db,
  initialExamId,
  initialClassId,
  onViewGradeSheet,
}) => {
  const [examId, setExamId] = useState(
    initialExamId || db.exams[1]?.id || db.exams[0]?.id || '',
  );

  const defaultClass =
    db.classes.find((c) => c.id === initialClassId) ||
    db.classes.find((c) => c.id === 'cls-9') ||
    db.classes[0];
  const [classId, setClassId] = useState(defaultClass?.id || '');
  const [sectionId, setSectionId] = useState<string>('all');
  const [meritScope, setMeritScope] = useState<MeritScope>('passed');
  const [viewMode, setViewMode] = useState<ViewMode>('both');

  const selectedExam = db.exams.find((e) => e.id === examId) || db.exams[0];
  const selectedClass =
    db.classes.find((c) => c.id === classId) || db.classes[0];

  const sectionNameById = useMemo(() => {
    const map = new Map<string, string>();
    selectedClass?.sections.forEach((sec) => map.set(sec.id, sec.name));
    return map;
  }, [selectedClass]);

  const sectionLabel =
    sectionId === 'all'
      ? 'All Sections (Class-Wise)'
      : `Section ${sectionNameById.get(sectionId) || sectionId}`;

  const classResults = useMemo(() => {
    if (!selectedClass || !selectedExam) return [];
    const activeStudents = db.students.filter(
      (s) =>
        s.classId === selectedClass.id &&
        s.status === 'active' &&
        (sectionId === 'all' || s.sectionId === sectionId),
    );
    return computeClassResults(
      activeStudents,
      db.subjects,
      selectedClass,
      db.marks,
      selectedExam.id,
      db.settings,
      selectedExam.workingDays || 72,
    );
  }, [db.students, db.subjects, db.marks, db.settings, selectedClass, selectedExam, sectionId]);

  const eligibleResults = useMemo(() => {
    return classResults.filter((r) => {
      if (!r.hasAnyMarks) return false;
      if (meritScope === 'passed') return r.isPassed;
      return true;
    });
  }, [classResults, meritScope]);

  const topTenGpa = useMemo<RankedEntry[]>(() => {
    const sorted = [...eligibleResults].sort((a, b) => {
      if (b.gpa !== a.gpa) return b.gpa - a.gpa;
      if (b.percentage !== a.percentage) return b.percentage - a.percentage;
      if (b.grandTotalObtained !== a.grandTotalObtained) {
        return b.grandTotalObtained - a.grandTotalObtained;
      }
      if (b.presentDays !== a.presentDays) return b.presentDays - a.presentDays;
      return a.student.rollNo - b.student.rollNo;
    });

    return sorted.slice(0, 10).map((result, idx) => ({
      rank: idx + 1,
      result,
      sectionName: sectionNameById.get(result.student.sectionId) || '-',
    }));
  }, [eligibleResults, sectionNameById]);

  const topTenPercentage = useMemo<RankedEntry[]>(() => {
    const sorted = [...eligibleResults].sort((a, b) => {
      if (b.percentage !== a.percentage) return b.percentage - a.percentage;
      if (b.grandTotalObtained !== a.grandTotalObtained) {
        return b.grandTotalObtained - a.grandTotalObtained;
      }
      if (b.gpa !== a.gpa) return b.gpa - a.gpa;
      if (b.presentDays !== a.presentDays) return b.presentDays - a.presentDays;
      return a.student.rollNo - b.student.rollNo;
    });

    return sorted.slice(0, 10).map((result, idx) => ({
      rank: idx + 1,
      result,
      sectionName: sectionNameById.get(result.student.sectionId) || '-',
    }));
  }, [eligibleResults, sectionNameById]);

  const summary = useMemo(() => {
    const evaluatedCount = classResults.filter((r) => r.hasAnyMarks).length;
    const passedCount = classResults.filter(
      (r) => r.hasAnyMarks && r.isPassed,
    ).length;
    const topGpa = topTenGpa[0]?.result.gpa ?? 0;
    const topPct = topTenPercentage[0]?.result.percentage ?? 0;
    return {
      totalStudents: classResults.length,
      evaluatedCount,
      passedCount,
      topGpa,
      topPct,
    };
  }, [classResults, topTenGpa, topTenPercentage]);

  const handleExportExcel = () => {
    if (!selectedClass || !selectedExam) return;
    const toRows = (list: RankedEntry[]): TopTenExportRow[] =>
      list.map((item) => ({
        rank: item.rank,
        rollNo: item.result.student.rollNo,
        studentCode: item.result.student.studentCode,
        studentName: item.result.student.name,
        sectionName: item.sectionName,
        totalObtained: item.result.grandTotalObtained,
        totalFullMarks: item.result.grandTotalFullMarks,
        percentage: item.result.percentage,
        gpa: item.result.gpa,
        overallGrade: item.result.overallGrade,
        presentDays: item.result.presentDays,
        workingDays: item.result.workingDays,
        resultStatus: item.result.isPassed ? 'PASS' : 'NG',
      }));

    exportTopTenExcel(
      toRows(topTenGpa),
      toRows(topTenPercentage),
      selectedClass.name,
      sectionLabel,
      selectedExam,
    );
  };

  const handleExportPDF = () => {
    if (!selectedClass || !selectedExam) return;
    const toPdfRows = (list: RankedEntry[]): TopTenPdfRow[] =>
      list.map((item) => ({
        rank: item.rank,
        rollNo: item.result.student.rollNo,
        studentName: item.result.student.name,
        sectionName: item.sectionName,
        totalText: `${item.result.grandTotalObtained}/${item.result.grandTotalFullMarks}`,
        percentageText: `${item.result.percentage.toFixed(2)}%`,
        gpaText: item.result.gpa.toFixed(2),
        overallGrade: item.result.overallGrade,
        presentDaysText: item.result.markRecord
          ? `${item.result.presentDays}/${item.result.workingDays}`
          : '-',
        resultStatus: item.result.isPassed ? 'PASS' : 'NG',
      }));

    downloadTopTenPDF(
      toPdfRows(topTenGpa),
      toPdfRows(topTenPercentage),
      selectedClass,
      sectionLabel,
      selectedExam,
      db.settings,
    );
  };

  const renderMeritTable = (
    title: string,
    subtitle: string,
    entries: RankedEntry[],
    primaryMetric: 'gpa' | 'percentage',
  ) => (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {primaryMetric === 'gpa' ? (
            <Trophy className="w-4 h-4 text-indigo-700 shrink-0" />
          ) : (
            <Award className="w-4 h-4 text-emerald-700 shrink-0" />
          )}
          <div>
            <h2 className="text-sm font-bold text-slate-900">{title}</h2>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>
        <div className="text-xs font-mono text-slate-600">
          Showing {entries.length} of {eligibleResults.length} eligible
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-slate-50 font-semibold text-slate-700 border-b border-slate-200">
            <tr>
              <th className="px-3 py-3 text-center w-14">Rank</th>
              <th className="px-3 py-3 text-center w-14">Roll</th>
              <th className="px-3 py-3 min-w-[160px]">Student Name</th>
              <th className="px-3 py-3 text-center">Sec</th>
              <th className="px-3 py-3 text-right">Total Marks</th>
              <th
                className={`px-3 py-3 text-right ${
                  primaryMetric === 'percentage'
                    ? 'text-emerald-800 bg-emerald-50/70'
                    : ''
                }`}
              >
                %
              </th>
              <th
                className={`px-3 py-3 text-right ${
                  primaryMetric === 'gpa'
                    ? 'text-indigo-800 bg-indigo-50/70'
                    : ''
                }`}
              >
                GPA
              </th>
              <th className="px-3 py-3 text-center">Grade</th>
              <th className="px-3 py-3 text-center whitespace-nowrap">
                Present Days
              </th>
              <th className="px-3 py-3 text-center">Result</th>
              {onViewGradeSheet && (
                <th className="px-3 py-3 text-right no-print">Action</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {entries.map(({ rank, result, sectionName }) => (
              <tr
                key={`${primaryMetric}-${result.student.id}`}
                className={`hover:bg-slate-50 ${
                  rank <= 3 ? 'bg-slate-50/50' : ''
                }`}
              >
                <td className="px-3 py-2.5 text-center font-mono tabular-nums font-bold text-slate-900">
                  #{rank}
                </td>
                <td className="px-3 py-2.5 text-center font-mono tabular-nums text-slate-600">
                  {result.student.rollNo}
                </td>
                <td className="px-3 py-2.5 font-semibold text-slate-900 whitespace-nowrap">
                  {result.student.name}
                </td>
                <td className="px-3 py-2.5 text-center font-mono text-slate-700">
                  {sectionName}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                  {result.grandTotalObtained}/{result.grandTotalFullMarks}
                </td>
                <td
                  className={`px-3 py-2.5 text-right font-mono tabular-nums whitespace-nowrap ${
                    primaryMetric === 'percentage'
                      ? 'font-bold text-emerald-700 bg-emerald-50/40'
                      : 'text-slate-700'
                  }`}
                >
                  {result.percentage.toFixed(2)}%
                </td>
                <td
                  className={`px-3 py-2.5 text-right font-mono tabular-nums ${
                    primaryMetric === 'gpa'
                      ? 'font-bold text-indigo-700 bg-indigo-50/40'
                      : 'font-semibold text-slate-800'
                  }`}
                >
                  {result.gpa.toFixed(2)}
                </td>
                <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-900">
                  {result.overallGrade}
                </td>
                <td className="px-3 py-2.5 text-center font-mono tabular-nums text-slate-700 whitespace-nowrap">
                  {result.markRecord
                    ? `${result.presentDays}/${result.workingDays}`
                    : '-'}
                </td>
                <td
                  className={`px-3 py-2.5 text-center font-semibold ${
                    result.isPassed ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {result.isPassed ? 'PASS' : 'NG'}
                </td>
                {onViewGradeSheet && (
                  <td className="px-3 py-2.5 text-right whitespace-nowrap no-print">
                    <button
                      type="button"
                      onClick={() =>
                        onViewGradeSheet(result.student, selectedExam?.id || '')
                      }
                      className="text-indigo-700 font-medium hover:underline"
                    >
                      Grade Sheet
                    </button>
                  </td>
                )}
              </tr>
            ))}

            {entries.length === 0 && (
              <tr>
                <td
                  colSpan={onViewGradeSheet ? 11 : 10}
                  className="px-4 py-10 text-center text-slate-500 text-sm"
                >
                  {meritScope === 'passed' && summary.evaluatedCount > 0
                    ? 'No passed students found in this class yet. Switch Merit Scope to "All Evaluated" to rank all students with marks.'
                    : 'No evaluated student mark records found for the selected class and examination.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Filter & Export Toolbar */}
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
                setClassId(e.target.value);
                setSectionId('all');
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
              Section Scope
            </label>
            <select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="all">All Sections (Class-Wise)</option>
              {selectedClass?.sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  Section {sec.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Merit Eligibility
            </label>
            <select
              value={meritScope}
              onChange={(e) => setMeritScope(e.target.value as MeritScope)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="passed">Passed Students Only</option>
              <option value="all">All Evaluated Students</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Display Mode
            </label>
            <div className="inline-flex p-1 bg-slate-100 border border-slate-200 rounded-lg">
              <button
                type="button"
                onClick={() => setViewMode('both')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                  viewMode === 'both'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Both Lists
              </button>
              <button
                type="button"
                onClick={() => setViewMode('gpa')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                  viewMode === 'gpa'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                GPA-Wise
              </button>
              <button
                type="button"
                onClick={() => setViewMode('percentage')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                  viewMode === 'percentage'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Percentage-Wise
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Excel
          </button>
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
            onClick={handleExportPDF}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg whitespace-nowrap"
          >
            <FileDown className="w-4 h-4" />
            Download PDF
          </button>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block text-center border-b border-slate-300 pb-3 mb-2">
        <div className="text-lg font-bold text-slate-900">
          {db.settings.schoolName}
        </div>
        <div className="text-xs text-slate-600">
          {db.settings.address} · School IEMIS Code: {db.settings.iemisCode}
        </div>
        <div className="text-sm font-semibold text-slate-900 mt-1">
          Class-Wise Top Ten Students — {selectedExam?.name} (
          {selectedExam?.academicYear}) · {selectedClass?.name} · {sectionLabel}
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">
            Selected Class Scope
          </div>
          <div className="text-lg font-bold text-slate-900 mt-1">
            {selectedClass?.name}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{sectionLabel}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">
            Evaluated / Passed
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {summary.evaluatedCount} / {summary.totalStudents}
          </div>
          <div className="text-xs text-emerald-700 font-medium mt-0.5 font-mono tabular-nums">
            {summary.passedCount} passed students
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">
            Highest Class GPA
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-indigo-700 mt-1">
            {eligibleResults.length > 0 ? summary.topGpa.toFixed(2) : '-'}
          </div>
          <div className="text-xs text-slate-500 mt-0.5 truncate">
            {topTenGpa[0]?.result.student.name || 'No ranked student'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">
            Highest Class Percentage
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
            {eligibleResults.length > 0 ? `${summary.topPct.toFixed(2)}%` : '-'}
          </div>
          <div className="text-xs text-slate-500 mt-0.5 truncate">
            {topTenPercentage[0]?.result.student.name || 'No ranked student'}
          </div>
        </div>
      </div>

      {/* Rankings Tables */}
      <div
        className={
          viewMode === 'both'
            ? 'grid grid-cols-1 2xl:grid-cols-2 gap-4'
            : 'space-y-4'
        }
      >
        {(viewMode === 'both' || viewMode === 'gpa') &&
          renderMeritTable(
            `Top Ten Students (GPA-Wise) — ${selectedClass?.name}`,
            `Ranked by GPA descending, tie-broken by Percentage, Total Marks & Attendance`,
            topTenGpa,
            'gpa',
          )}

        {(viewMode === 'both' || viewMode === 'percentage') &&
          renderMeritTable(
            `Top Ten Students (Percentage-Wise) — ${selectedClass?.name}`,
            `Ranked by Percentage descending, tie-broken by Total Marks, GPA & Attendance`,
            topTenPercentage,
            'percentage',
          )}
      </div>
    </div>
  );
};
