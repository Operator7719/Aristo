import React, { useMemo, useState } from 'react';
import { ArrowDownCircle, Check } from 'lucide-react';
import { SchoolDatabase, Student } from '../types';

interface OptionalAssignmentViewProps {
  db: SchoolDatabase;
  onUpdateStudents: (students: Student[]) => void;
}

export const OptionalAssignmentView: React.FC<OptionalAssignmentViewProps> = ({
  db,
  onUpdateStudents,
}) => {
  const higherClasses = useMemo(
    () => db.classes.filter((c) => c.gradeLevel >= 9 && c.status === 'active'),
    [db.classes],
  );

  const [classId, setClassId] = useState<string>(
    higherClasses[0]?.id || 'cls-9',
  );
  const selectedClass =
    db.classes.find((c) => c.id === classId) || higherClasses[0];
  const [sectionId, setSectionId] = useState<string>(
    selectedClass?.sections[0]?.id || '',
  );
  const [savedNotice, setSavedNotice] = useState(false);

  const classStudents = useMemo(
    () =>
      db.students
        .filter(
          (s) =>
            s.classId === classId &&
            (!sectionId || s.sectionId === sectionId) &&
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

  const compulsory = classSubjects.filter((s) => s.category === 'compulsory');
  const opt1Subjects = classSubjects.filter((s) => s.category === 'opt_1');
  const opt2Subjects = classSubjects.filter((s) => s.category === 'opt_2');

  const updateStudentOptional = (
    studentId: string,
    slot: 'opt_1' | 'opt_2',
    subjectId: string,
  ) => {
    onUpdateStudents(
      db.students.map((s) =>
        s.id === studentId
          ? {
              ...s,
              optionalSubjects: {
                ...s.optionalSubjects,
                [slot]: subjectId,
              },
            }
          : s,
      ),
    );
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1800);
  };

  const fillDown = (fromIndex: number, slot: 'opt_1' | 'opt_2') => {
    const sourceStudent = classStudents[fromIndex];
    if (!sourceStudent) return;
    const chosenId =
      sourceStudent.optionalSubjects?.[slot] ??
      (slot === 'opt_1' ? opt1Subjects[0]?.id : opt2Subjects[0]?.id);
    if (!chosenId) return;

    const targetIds = new Set(
      classStudents.slice(fromIndex).map((s) => s.id),
    );

    onUpdateStudents(
      db.students.map((s) =>
        targetIds.has(s.id)
          ? {
              ...s,
              optionalSubjects: {
                ...s.optionalSubjects,
                [slot]: chosenId,
              },
            }
          : s,
      ),
    );
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1800);
  };

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Selected School
            </label>
            <div className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium">
              {db.settings.iemisCode} | {db.settings.schoolName}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Year
            </label>
            <div className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-700">
              {db.settings.academicYear}
            </div>
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
              {higherClasses.map((c) => (
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

        {savedNotice && (
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <Check className="w-4 h-4" />
            Optional assignments updated
          </div>
        )}
      </div>

      {/* Subject Assignment Matrix */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <p className="text-xs text-slate-600">
            Assign Optional I and Optional II subjects per student for {selectedClass?.name}. Click the fill-down icon beside any dropdown to copy that subject choice to all students below.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 font-semibold text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-3 py-3 w-12">S.N</th>
                <th className="px-3 py-3 min-w-[170px]">Student Name</th>
                {compulsory.map((sub, i) => (
                  <th key={sub.id} className="px-3 py-3 min-w-[115px]">
                    Sub {i + 1}
                  </th>
                ))}
                <th className="px-3 py-3 min-w-[215px]">
                  Sub {compulsory.length + 1} (Optional I)
                </th>
                <th className="px-3 py-3 min-w-[215px]">
                  Sub {compulsory.length + 2} (Optional II)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {classStudents.map((stu, idx) => {
                const currentOpt1 =
                  stu.optionalSubjects?.opt_1 || opt1Subjects[0]?.id || '';
                const currentOpt2 =
                  stu.optionalSubjects?.opt_2 || opt2Subjects[0]?.id || '';
                return (
                  <tr key={stu.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-mono tabular-nums text-slate-600">
                      {idx + 1}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-900">
                      {stu.name}
                    </td>
                    {compulsory.map((sub) => (
                      <td
                        key={sub.id}
                        className="px-3 py-2.5 text-slate-600 uppercase leading-tight"
                      >
                        {sub.name}
                      </td>
                    ))}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <select
                          value={currentOpt1}
                          onChange={(e) =>
                            updateStudentOptional(stu.id, 'opt_1', e.target.value)
                          }
                          disabled={opt1Subjects.length === 0}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-900"
                        >
                          {opt1Subjects.length === 0 && (
                            <option value="">No Optional I configured</option>
                          )}
                          {opt1Subjects.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          title="Copy choice to all students below"
                          onClick={() => fillDown(idx, 'opt_1')}
                          className="p-1 text-slate-500 hover:text-indigo-700 shrink-0"
                        >
                          <ArrowDownCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <select
                          value={currentOpt2}
                          onChange={(e) =>
                            updateStudentOptional(stu.id, 'opt_2', e.target.value)
                          }
                          disabled={opt2Subjects.length === 0}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-900"
                        >
                          {opt2Subjects.length === 0 && (
                            <option value="">No Optional II configured</option>
                          )}
                          {opt2Subjects.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          title="Copy choice to all students below"
                          onClick={() => fillDown(idx, 'opt_2')}
                          className="p-1 text-slate-500 hover:text-indigo-700 shrink-0"
                        >
                          <ArrowDownCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {classStudents.length === 0 && (
                <tr>
                  <td
                    colSpan={compulsory.length + 4}
                    className="px-4 py-10 text-center text-slate-500 text-sm"
                  >
                    No active students found in {selectedClass?.name} Section{' '}
                    {
                      selectedClass?.sections.find((s) => s.id === sectionId)
                        ?.name
                    }
                    .
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
