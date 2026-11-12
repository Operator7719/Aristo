import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { ActiveStatus, SchoolDatabase, Student } from '../types';

interface StudentManagementViewProps {
  db: SchoolDatabase;
  readOnly?: boolean;
  allowedClassSectionPairs?: { classId: string; sectionId: string }[];
  onUpdateStudents: (students: Student[]) => void;
  onViewGradeSheet: (student: Student) => void;
}

const EMPTY_FORM = {
  id: '',
  studentCode: '',
  name: '',
  classId: '',
  sectionId: '',
  rollNo: 1,
  academicYear: '2082',
  dob: '',
  guardianName: '',
  contact: '',
  opt1: '',
  opt2: '',
  status: 'active' as ActiveStatus,
};

export const StudentManagementView: React.FC<StudentManagementViewProps> = ({
  db,
  readOnly = false,
  allowedClassSectionPairs,
  onUpdateStudents,
  onViewGradeSheet,
}) => {
  const [search, setSearch] = useState('');
  const [filterClassId, setFilterClassId] = useState('all');
  const [filterSectionId, setFilterSectionId] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all' | ActiveStatus>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const visibleClasses = useMemo(() => {
    if (!allowedClassSectionPairs) return db.classes;
    const allowedIds = new Set(allowedClassSectionPairs.map((p) => p.classId));
    return db.classes.filter((c) => allowedIds.has(c.id));
  }, [db.classes, allowedClassSectionPairs]);

  const selectedClassObj = visibleClasses.find((c) => c.id === filterClassId);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.students
      .filter((s) => {
        if (
          allowedClassSectionPairs &&
          !allowedClassSectionPairs.some(
            (p) => p.classId === s.classId && p.sectionId === s.sectionId,
          )
        ) {
          return false;
        }
        if (filterClassId !== 'all' && s.classId !== filterClassId) return false;
        if (filterSectionId !== 'all' && s.sectionId !== filterSectionId)
          return false;
        if (filterStatus !== 'all' && s.status !== filterStatus) return false;
        if (
          q &&
          !s.name.toLowerCase().includes(q) &&
          !s.studentCode.toLowerCase().includes(q) &&
          !s.guardianName.toLowerCase().includes(q) &&
          !String(s.rollNo).includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const ca = db.classes.find((c) => c.id === a.classId)?.order ?? 99;
        const cb = db.classes.find((c) => c.id === b.classId)?.order ?? 99;
        if (ca !== cb) return ca - cb;
        return a.rollNo - b.rollNo;
      });
  }, [
    db.students,
    db.classes,
    allowedClassSectionPairs,
    search,
    filterClassId,
    filterSectionId,
    filterStatus,
  ]);

  const openAdd = () => {
    const defaultCls =
      (filterClassId !== 'all'
        ? db.classes.find((c) => c.id === filterClassId)
        : db.classes.find((c) => c.id === 'cls-9')) ?? db.classes[0];
    const defaultSec = defaultCls?.sections[0];
    const nextRoll =
      db.students
        .filter((s) => s.classId === defaultCls?.id)
        .reduce((max, s) => Math.max(max, s.rollNo), 0) + 1;

    setForm({
      id: '',
      studentCode: `${db.settings.iemisCode}-${String(db.students.length + 1).padStart(3, '0')}`,
      name: '',
      classId: defaultCls?.id ?? '',
      sectionId: defaultSec?.id ?? '',
      rollNo: nextRoll,
      academicYear: db.settings.academicYear.replace(/[^0-9]/g, '') || '2082',
      dob: '',
      guardianName: '',
      contact: '',
      opt1: '',
      opt2: '',
      status: 'active',
    });
    setIsModalOpen(true);
  };

  const openEdit = (student: Student) => {
    setForm({
      id: student.id,
      studentCode: student.studentCode,
      name: student.name,
      classId: student.classId,
      sectionId: student.sectionId,
      rollNo: student.rollNo,
      academicYear: student.academicYear,
      dob: student.dob || '',
      guardianName: student.guardianName,
      contact: student.contact,
      opt1: student.optionalSubjects?.opt_1 || '',
      opt2: student.optionalSubjects?.opt_2 || '',
      status: student.status,
    });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.classId) return;

    const payload: Student = {
      id: form.id || `stu-${Date.now()}`,
      studentCode: form.studentCode.trim() || `STU-${Date.now()}`,
      name: form.name.trim(),
      classId: form.classId,
      sectionId:
        form.sectionId ||
        db.classes.find((c) => c.id === form.classId)?.sections[0]?.id ||
        '',
      rollNo: Number(form.rollNo) || 1,
      academicYear: form.academicYear.trim() || '2082',
      dob: form.dob.trim() || undefined,
      guardianName: form.guardianName.trim(),
      contact: form.contact.trim(),
      optionalSubjects: {
        ...(form.opt1 ? { opt_1: form.opt1 } : {}),
        ...(form.opt2 ? { opt_2: form.opt2 } : {}),
      },
      status: form.status,
    };

    if (form.id) {
      onUpdateStudents(
        db.students.map((s) => (s.id === form.id ? payload : s)),
      );
    } else {
      onUpdateStudents([...db.students, payload]);
    }
    setIsModalOpen(false);
  };

  const toggleStatus = (studentId: string) => {
    onUpdateStudents(
      db.students.map((s) =>
        s.id === studentId
          ? { ...s, status: s.status === 'active' ? 'inactive' : 'active' }
          : s,
      ),
    );
  };

  const deleteStudent = (studentId: string) => {
    onUpdateStudents(db.students.filter((s) => s.id !== studentId));
    setConfirmDeleteId(null);
  };

  const modalClass = db.classes.find((c) => c.id === form.classId);
  const modalOpt1Subjects = db.subjects.filter(
    (s) => s.classId === form.classId && s.category === 'opt_1' && s.status === 'active',
  );
  const modalOpt2Subjects = db.subjects.filter(
    (s) => s.classId === form.classId && s.category === 'opt_2' && s.status === 'active',
  );

  return (
    <div className="space-y-4">
      {/* Filter & Action Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, code, roll, guardian..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <select
            value={filterClassId}
            onChange={(e) => {
              setFilterClassId(e.target.value);
              setFilterSectionId('all');
            }}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
          >
            <option value="all">All Assigned Classes</option>
            {visibleClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={filterSectionId}
            onChange={(e) => setFilterSectionId(e.target.value)}
            disabled={filterClassId === 'all'}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          >
            <option value="all">All Sections</option>
            {selectedClassObj?.sections.map((sec) => (
              <option key={sec.id} value={sec.id}>
                Section {sec.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['all', 'active', 'inactive'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors whitespace-nowrap ${
                  filterStatus === st
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-700 text-white text-sm font-medium rounded-lg hover:bg-indigo-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Student
          </button>
        )}
      </div>

      {/* Students Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Roll</th>
                <th className="px-4 py-3">Student Code</th>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Class & Section</th>
                <th className="px-4 py-3">Guardian</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredStudents.map((stu) => {
                const cls = db.classes.find((c) => c.id === stu.classId);
                const sec = cls?.sections.find((s) => s.id === stu.sectionId);
                return (
                  <tr key={stu.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono tabular-nums text-slate-700">
                      {stu.rollNo}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-xs text-slate-600">
                      {stu.studentCode}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {stu.name}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {cls?.name} · Sec {sec?.name || '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {stu.guardianName || '-'}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-xs text-slate-600">
                      {stu.contact || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={() => !readOnly && toggleStatus(stu.id)}
                        className={`text-xs font-semibold ${readOnly ? 'cursor-default' : 'hover:underline'} ${
                          stu.status === 'active'
                            ? 'text-emerald-700'
                            : 'text-red-700'
                        }`}
                      >
                        {stu.status === 'active' ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {!readOnly && confirmDeleteId === stu.id ? (
                        <div className="inline-flex items-center gap-2">
                          <span className="text-xs text-red-700 font-medium">
                            Delete?
                          </span>
                          <button
                            type="button"
                            onClick={() => deleteStudent(stu.id)}
                            className="px-2 py-1 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2">
                          {!readOnly && (
                            <>
                              <button
                                type="button"
                                onClick={() => onViewGradeSheet(stu)}
                                className="text-xs font-medium text-indigo-700 hover:underline mr-1"
                              >
                                Grade Sheet
                              </button>
                              <button
                                type="button"
                                onClick={() => openEdit(stu)}
                                aria-label={`Edit ${stu.name}`}
                                className="p-1.5 text-slate-500 hover:text-indigo-700 rounded hover:bg-slate-100"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(stu.id)}
                                aria-label={`Delete ${stu.name}`}
                                className="p-1.5 text-slate-500 hover:text-red-700 rounded hover:bg-slate-100"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {readOnly && (
                            <span className="text-xs text-slate-400">
                              View Only
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                    No students match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Student Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                {form.id ? 'Edit Student Record' : 'Add New Student'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Student Code / IEMIS ID
                  </label>
                  <input
                    type="text"
                    value={form.studentCode}
                    onChange={(e) =>
                      setForm({ ...form, studentCode: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Class *
                  </label>
                  <select
                    value={form.classId}
                    onChange={(e) => {
                      const nextCls = db.classes.find(
                        (c) => c.id === e.target.value,
                      );
                      setForm({
                        ...form,
                        classId: e.target.value,
                        sectionId: nextCls?.sections[0]?.id || '',
                        opt1: '',
                        opt2: '',
                      });
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {db.classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Section *
                  </label>
                  <select
                    value={form.sectionId}
                    onChange={(e) =>
                      setForm({ ...form, sectionId: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {modalClass?.sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        Section {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Roll Number *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={form.rollNo}
                    onChange={(e) =>
                      setForm({ ...form, rollNo: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        status: e.target.value as ActiveStatus,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Guardian Name
                  </label>
                  <input
                    type="text"
                    value={form.guardianName}
                    onChange={(e) =>
                      setForm({ ...form, guardianName: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Contact Number
                  </label>
                  <input
                    type="text"
                    value={form.contact}
                    onChange={(e) =>
                      setForm({ ...form, contact: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="text"
                    value={form.dob}
                    onChange={(e) => setForm({ ...form, dob: e.target.value })}
                    placeholder="2067-05-14 B.S."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              {modalClass && modalClass.gradeLevel >= 9 && (
                <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Optional I Subject
                    </label>
                    <select
                      value={form.opt1}
                      onChange={(e) =>
                        setForm({ ...form, opt1: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="">Default Optional I</option>
                      {modalOpt1Subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Optional II Subject
                    </label>
                    <select
                      value={form.opt2}
                      onChange={(e) =>
                        setForm({ ...form, opt2: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="">Default Optional II</option>
                      {modalOpt2Subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-700 rounded-lg hover:bg-indigo-800"
                >
                  {form.id ? 'Save Changes' : 'Add Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
