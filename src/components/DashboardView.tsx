import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Layers,
  Users,
} from 'lucide-react';
import { NavPage, SchoolDatabase } from '../types';
import { computeClassResults } from '../utils/grading';

interface DashboardViewProps {
  db: SchoolDatabase;
  onNavigate: (page: NavPage, context?: { classId?: string; sectionId?: string; examId?: string }) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ db, onNavigate }) => {
  const activeExams = db.exams.filter((e) => e.status === 'active');
  const [selectedExamId, setSelectedExamId] = useState<string>(
    activeExams[1]?.id || activeExams[0]?.id || db.exams[0]?.id || '',
  );

  const selectedExam = db.exams.find((e) => e.id === selectedExamId) || db.exams[0];

  const stats = useMemo(() => {
    const activeStudents = db.students.filter((s) => s.status === 'active').length;
    const activeClasses = db.classes.filter((c) => c.status === 'active').length;
    const activeSubjects = db.subjects.filter((s) => s.status === 'active').length;
    const examCount = db.exams.length;
    const publishedResults = db.marks.filter(
      (m) => !selectedExam || m.examId === selectedExam.id,
    ).length;

    return {
      activeStudents,
      totalStudents: db.students.length,
      activeClasses,
      activeSubjects,
      examCount,
      publishedResults,
    };
  }, [db, selectedExam]);

  const classSummaries = useMemo(() => {
    if (!selectedExam) return [];
    return db.classes
      .filter((c) => c.status === 'active')
      .map((cls) => {
        const clsStudents = db.students.filter(
          (s) => s.classId === cls.id && s.status === 'active',
        );
        const computed = computeClassResults(
          clsStudents,
          db.subjects,
          cls,
          db.marks,
          selectedExam.id,
          db.settings,
          selectedExam.workingDays,
        );
        const evaluated = computed.filter((r) => r.hasAnyMarks);
        const passed = evaluated.filter((r) => r.isPassed).length;
        const ng = evaluated.length - passed;
        const avgGpa =
          evaluated.length > 0
            ? evaluated.reduce((s, r) => s + r.gpa, 0) / evaluated.length
            : 0;
        const topGpa =
          evaluated.length > 0
            ? Math.max(...evaluated.map((r) => r.gpa))
            : 0;

        return {
          cls,
          totalStudents: clsStudents.length,
          evaluatedCount: evaluated.length,
          passed,
          ng,
          passRate:
            evaluated.length > 0 ? (passed / evaluated.length) * 100 : 0,
          avgGpa,
          topGpa,
        };
      })
      .filter((item) => item.totalStudents > 0 || item.evaluatedCount > 0);
  }, [db, selectedExam]);

  const ruleLabel = (tier: string) => {
    if (tier === 'none') return 'Direct (No Conversion)';
    if (tier === 'grade_4_8') return '50 TH + 40 PR (10% TH -> 50 PR)';
    return '75 TH + 19 PR (6% TH -> 25 PR)';
  };

  return (
    <div className="space-y-6">
      {/* Top School Context Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1">
            <span>IEMIS {db.settings.iemisCode}</span>
            <span aria-hidden="true">·</span>
            <span>Estd. {db.settings.estd}</span>
            <span aria-hidden="true">·</span>
            <span>Academic Year {db.settings.academicYear}</span>
            <span aria-hidden="true">·</span>
            <span
              className={
                db.settings.status === 'active'
                  ? 'text-emerald-700 font-medium'
                  : 'text-red-700 font-medium'
              }
            >
              {db.settings.status === 'active' ? 'Active Session' : 'Inactive Session'}
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {db.settings.schoolName}
          </h1>
          <p className="text-sm text-slate-600">{db.settings.address}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="dash-exam" className="text-xs font-medium text-slate-600">
              Examination
            </label>
            <select
              id="dash-exam"
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              {db.exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.name} ({exam.academicYear})
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('marks-entry', { examId: selectedExamId })}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-700 text-white text-sm font-medium rounded-lg hover:bg-indigo-800 transition-colors whitespace-nowrap shrink-0"
          >
            Enter Marks
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('students')}
          className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-300 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Total Students</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums font-mono">
            {stats.activeStudents}
          </div>
          <div className="text-xs text-slate-500 mt-1 tabular-nums">
            {stats.totalStudents} enrolled overall
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('classes')}
          className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-300 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Classes & Sections</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums font-mono">
            {stats.activeClasses}
          </div>
          <div className="text-xs text-slate-500 mt-1">Nursery through Grade 12</div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('subjects')}
          className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-300 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Active Subjects</span>
            <BookOpen className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums font-mono">
            {stats.activeSubjects}
          </div>
          <div className="text-xs text-slate-500 mt-1">Compulsory & Optional</div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('exams')}
          className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-300 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Terminal Exams</span>
            <ClipboardCheck className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums font-mono">
            {stats.examCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">1st, 2nd, 3rd & Annual</div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('grade-sheet', { examId: selectedExamId })}
          className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-300 transition-colors col-span-2 md:col-span-1"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Published Results</span>
            <GraduationCap className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums font-mono">
            {stats.publishedResults}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            In {selectedExam?.term ? `${selectedExam.term} term` : 'selected exam'}
          </div>
        </button>
      </div>

      {/* Class-wise Results Summary Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Class-Wise Examination Summary
            </h2>
            <p className="text-xs text-slate-500">
              {selectedExam?.name} · Automatic conversion & GPA status
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('markwise-ledger', { examId: selectedExamId })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Markwise Ledger
            </button>
            <button
              type="button"
              onClick={() => onNavigate('gradewise-ledger', { examId: selectedExamId })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5" />
              Gradewise Ledger
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Conversion Rule</th>
                <th className="px-4 py-3 text-right">Students</th>
                <th className="px-4 py-3 text-right">Evaluated</th>
                <th className="px-4 py-3 text-right">Passed</th>
                <th className="px-4 py-3 text-right">NG</th>
                <th className="px-4 py-3 text-right">Pass Rate</th>
                <th className="px-4 py-3 text-right">Mean GPA</th>
                <th className="px-4 py-3 text-right">Top GPA</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {classSummaries.map((row) => (
                <tr key={row.cls.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                    {row.cls.name}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                    {ruleLabel(row.cls.conversionTier)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-mono text-slate-700">
                    {row.totalStudents}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-mono text-slate-700">
                    {row.evaluatedCount}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-mono text-emerald-700 font-medium">
                    {row.passed}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-mono text-red-700 font-medium">
                    {row.ng}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-mono text-slate-900">
                    {row.evaluatedCount > 0 ? `${row.passRate.toFixed(1)}%` : '-'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-mono text-slate-900">
                    {row.evaluatedCount > 0 ? row.avgGpa.toFixed(2) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-mono font-semibold text-indigo-700">
                    {row.evaluatedCount > 0 ? row.topGpa.toFixed(2) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-3 text-xs font-medium">
                      <button
                        type="button"
                        onClick={() =>
                          onNavigate('marks-entry', {
                            classId: row.cls.id,
                            sectionId: row.cls.sections[0]?.id,
                            examId: selectedExamId,
                          })
                        }
                        className="text-indigo-700 hover:underline"
                      >
                        Marks
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onNavigate('grade-sheet', {
                            classId: row.cls.id,
                            sectionId: row.cls.sections[0]?.id,
                            examId: selectedExamId,
                          })
                        }
                        className="text-slate-700 hover:underline"
                      >
                        Grade Sheet
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {classSummaries.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                    No active students enrolled yet. Add students to see examination summaries.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Marks Conversion Reference */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-base font-semibold text-slate-900 mb-3">
          Configured Marks Conversion Rules
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="border border-slate-200 rounded-lg p-4">
            <div className="font-semibold text-slate-900 mb-1">Nursery to Grade 3</div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Direct evaluation with no conversion. Obtained theory and practical marks are summed directly against configured full marks.
            </p>
          </div>
          <div className="border border-slate-200 rounded-lg p-4">
            <div className="font-semibold text-slate-900 mb-1">Grade 4 to Grade 8</div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Full Marks: <span className="font-mono">50 TH</span> + <span className="font-mono">40 PR</span>. Theory converts at 10% (<span className="font-mono">TH × 10 ÷ 50</span>) and adds to obtained practical for Final Practical out of <span className="font-mono">50</span>.
            </p>
          </div>
          <div className="border border-slate-200 rounded-lg p-4">
            <div className="font-semibold text-slate-900 mb-1">Grade 9 to Grade 12</div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Full Marks: <span className="font-mono">75 TH</span> + <span className="font-mono">19 PR</span>. Theory converts at 6% (<span className="font-mono">TH × 6 ÷ 75</span>) and adds to obtained practical for Final Practical out of <span className="font-mono">25</span>. Grades 9 & 10 support student-chosen optional subjects.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
