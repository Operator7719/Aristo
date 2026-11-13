import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  Edit3,
  Layers,
  Lock,
  Users,
} from 'lucide-react';
import { NavPage, SchoolDatabase, Teacher, TeacherPassport } from '../types';

interface TeacherDashboardViewProps {
  db: SchoolDatabase;
  teacher: Teacher;
  passport?: TeacherPassport | null;
  onNavigate: (
    page: NavPage,
    context?: { examId?: string; classId?: string; sectionId?: string },
  ) => void;
}

export const TeacherDashboardView: React.FC<TeacherDashboardViewProps> = ({
  db,
  teacher,
  passport,
  onNavigate,
}) => {
  const academicYearOptions = useMemo(() => {
    const set = new Set<string>([
      ...(db.academicYears || ['2081 B.S', '2082 B.S', '2083 B.S']),
      db.settings.academicYear,
      ...db.teacher_subject_assignments.map((a) => a.academicYearId),
    ]);
    return Array.from(set).filter(Boolean);
  }, [db.academicYears, db.settings.academicYear, db.teacher_subject_assignments]);

  const [selectedYear, setSelectedYear] = useState<string>(
    db.settings.academicYear || '2082 B.S',
  );

  const myAssignments = useMemo(() => {
    return db.teacher_subject_assignments
      .filter(
        (a) => a.teacherId === teacher.id && a.academicYearId === selectedYear,
      )
      .map((a) => {
        const cls = db.classes.find((c) => c.id === a.classId);
        const sec = cls?.sections.find((s) => s.id === a.sectionId);
        const sub = db.subjects.find((s) => s.id === a.subjectId);
        const studentCount = db.students.filter(
          (st) =>
            st.classId === a.classId &&
            st.sectionId === a.sectionId &&
            st.status === 'active',
        ).length;
        return {
          assignment: a,
          className: cls?.name || a.classId,
          classOrder: cls?.order ?? 99,
          sectionName: sec?.name || a.sectionId,
          subjectName: sub?.name || a.subjectId,
          subjectCode: sub?.code || '',
          fullMarksTheory: sub?.fullMarksTheory ?? 0,
          fullMarksPractical: sub?.fullMarksPractical ?? 0,
          studentCount,
        };
      })
      .sort((a, b) => {
        if (a.classOrder !== b.classOrder) return a.classOrder - b.classOrder;
        if (a.sectionName !== b.sectionName)
          return a.sectionName.localeCompare(b.sectionName);
        return a.subjectName.localeCompare(b.subjectName);
      });
  }, [db, teacher.id, selectedYear]);

  const stats = useMemo(() => {
    const uniqueClassSections = new Map<string, number>();
    const classTeacherSections: string[] = [];
    for (const item of myAssignments) {
      const key = `${item.assignment.classId}__${item.assignment.sectionId}`;
      uniqueClassSections.set(key, item.studentCount);
      if (item.assignment.assignmentType === 'class_teacher') {
        const label = `${item.className} - Sec ${item.sectionName}`;
        if (!classTeacherSections.includes(label)) {
          classTeacherSections.push(label);
        }
      }
    }
    const totalStudentsCovered = Array.from(uniqueClassSections.values()).reduce(
      (sum, c) => sum + c,
      0,
    );

    return {
      assignedClassesCount: uniqueClassSections.size,
      assignedSubjectsCount: myAssignments.length,
      classTeacherSections,
      totalStudentsCovered,
    };
  }, [myAssignments]);

  const matchingExam = useMemo(() => {
    const digits = selectedYear.replace(/[^0-9]/g, '');
    return (
      db.exams.find(
        (e) =>
          e.academicYear === selectedYear ||
          (digits && e.academicYear.includes(digits)),
      ) || db.exams[1] || db.exams[0]
    );
  }, [db.exams, selectedYear]);

  return (
    <div className="space-y-5">
      {/* Pink & White Teacher Workspace Header */}
      <div className="bg-white border border-pink-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-pink-800 font-semibold mb-1">
            <span>Teacher Portal</span>
            <span aria-hidden="true">·</span>
            <span>Assigned Workspace</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            My Assigned Subjects &amp; Classes
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Subjects and classes shown below are centrally assigned by School Admin.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label
              htmlFor="teacher-year-select"
              className="text-xs font-semibold text-pink-900"
            >
              Academic Year
            </label>
            <select
              id="teacher-year-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-2 text-xs border border-pink-300 rounded-lg bg-white font-mono"
            >
              {academicYearOptions.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={myAssignments.length === 0}
            onClick={() =>
              onNavigate('marks-entry', {
                examId: matchingExam?.id,
                classId: myAssignments[0]?.assignment.classId,
                sectionId: myAssignments[0]?.assignment.sectionId,
              })
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-pink-700 text-white text-xs font-semibold rounded-lg hover:bg-pink-800 disabled:opacity-50 whitespace-nowrap"
          >
            Enter Subject Marks
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-pink-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-pink-900 mb-2">
            <span>Assigned Classes &amp; Sections</span>
            <Layers className="w-4 h-4 text-pink-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {stats.assignedClassesCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Active class sections
          </div>
        </div>

        <div className="bg-white border border-pink-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-pink-900 mb-2">
            <span>Assigned Subjects</span>
            <BookOpen className="w-4 h-4 text-pink-600" />
          </div>
          <div className="text-2xl font-bold text-pink-700 font-mono tabular-nums">
            {stats.assignedSubjectsCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            In {selectedYear}
          </div>
        </div>

        <div className="bg-white border border-pink-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-pink-900 mb-2">
            <span>Assigned Students</span>
            <Users className="w-4 h-4 text-pink-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {stats.totalStudentsCovered}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Across your assigned sections
          </div>
        </div>

        <div className="bg-white border border-pink-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-pink-900 mb-2">
            <span>Class Teacher Duty</span>
            <ClipboardCheck className="w-4 h-4 text-pink-600" />
          </div>
          <div className="text-sm font-bold text-slate-900 truncate">
            {stats.classTeacherSections.length > 0
              ? stats.classTeacherSections.join(', ')
              : 'Subject Teacher Only'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {stats.classTeacherSections.length > 0
              ? 'Attendance editing enabled'
              : 'Subject marks entry enabled'}
          </div>
        </div>
      </div>

      {/* Permission & Authority Note */}
      <div className="bg-pink-50 border border-pink-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-pink-950">
        <div className="flex items-center gap-2 font-medium">
          <Lock className="w-4 h-4 text-pink-700 shrink-0" />
          <span>
            Strict Access Control: You can view students and enter marks only for your Admin-assigned classes, sections, and subjects.
          </span>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('students')}
          className="text-pink-800 font-semibold hover:underline whitespace-nowrap"
        >
          View My Assigned Students
        </button>
      </div>

      {/* Assigned Classes & Subjects Table */}
      <div className="bg-white border border-pink-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-pink-200 flex items-center justify-between bg-pink-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              My Assigned Subjects &amp; Classes ({selectedYear})
            </h3>
            <p className="text-xs text-slate-600">
              Click Enter Marks on any row to open your scoped Marks Entry sheet for that subject.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-pink-100 text-xs font-semibold text-pink-950 border-b border-pink-200">
              <tr>
                <th className="px-4 py-3 text-center w-14">S.N.</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3 text-center">Section</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Marks Structure</th>
                <th className="px-4 py-3">Role &amp; Permissions</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3 text-right">Students</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pink-100">
              {myAssignments.map((item, idx) => (
                <tr key={item.assignment.id} className="hover:bg-pink-50/50">
                  <td className="px-4 py-3 text-center font-mono tabular-nums text-slate-500">
                    {idx + 1}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                    {item.className}
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-slate-700">
                    {item.sectionName}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-pink-950">
                      {item.subjectName}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      {item.subjectCode}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700 whitespace-nowrap">
                    {item.fullMarksPractical > 0
                      ? `TH:${item.fullMarksTheory} · PR:${item.fullMarksPractical}`
                      : `TH:${item.fullMarksTheory}`}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="font-semibold text-slate-900">
                      {item.assignment.assignmentType === 'class_teacher'
                        ? 'Class Teacher'
                        : 'Subject Teacher'}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {item.assignment.assignmentType === 'class_teacher'
                        ? 'Marks + Attendance'
                        : 'Subject Marks Only'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                    {item.assignment.periodSlot || 'Flexible'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-800">
                    {item.studentCount}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() =>
                        onNavigate('marks-entry', {
                          examId: matchingExam?.id,
                          classId: item.assignment.classId,
                          sectionId: item.assignment.sectionId,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-pink-700 hover:bg-pink-800 rounded-md whitespace-nowrap"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Enter Marks
                    </button>
                  </td>
                </tr>
              ))}

              {myAssignments.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-slate-500 text-sm"
                  >
                    No classes or subjects have been assigned to you for {selectedYear}. Contact School Administration.
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
