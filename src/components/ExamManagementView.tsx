import React, { useState } from 'react';
import { CalendarDays, Pencil, Plus, Trash2, X } from 'lucide-react';
import { DEFAULT_EXAM_DEFINITIONS } from '../data/seedData';
import { ActiveStatus, Exam, ExamTerm, SchoolDatabase } from '../types';

interface ExamManagementViewProps {
  db: SchoolDatabase;
  onUpdateExams: (exams: Exam[]) => void;
  onEnterMarks: (examId: string) => void;
}

export const ExamManagementView: React.FC<ExamManagementViewProps> = ({
  db,
  onUpdateExams,
  onEnterMarks,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [term, setTerm] = useState<ExamTerm>('first');
  const [academicYear, setAcademicYear] = useState(db.settings.academicYear);
  const [workingDays, setWorkingDays] = useState(72);
  const [dateOfIssue, setDateOfIssue] = useState(db.settings.dateOfIssue);
  const [status, setStatus] = useState<ActiveStatus>('active');

  const openAdd = () => {
    const def = DEFAULT_EXAM_DEFINITIONS.annual;
    setEditingId(null);
    setName(def.name);
    setTerm('annual');
    setAcademicYear(db.settings.academicYear);
    setWorkingDays(db.settings.examWorkingDays?.annual || def.workingDays);
    setDateOfIssue(db.settings.examIssueDates?.annual || def.dateOfIssue);
    setStatus('active');
    setIsModalOpen(true);
  };

  const openEdit = (exam: Exam) => {
    setEditingId(exam.id);
    setName(exam.name);
    setTerm(exam.term);
    setAcademicYear(exam.academicYear);
    setWorkingDays(exam.workingDays);
    setDateOfIssue(exam.dateOfIssue);
    setStatus(exam.status);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const def = DEFAULT_EXAM_DEFINITIONS[term];
    const parsedDays = Math.max(1, Math.round(Number(workingDays) || def.workingDays));
    const payload: Exam = {
      id: editingId || `exam-${Date.now()}`,
      name: name.trim(),
      term,
      academicYear: academicYear.trim(),
      workingDays: parsedDays,
      dateOfIssue: dateOfIssue.trim(),
      status,
    };

    if (editingId) {
      onUpdateExams(db.exams.map((ex) => (ex.id === editingId ? payload : ex)));
    } else {
      onUpdateExams([...db.exams, payload]);
    }
    setIsModalOpen(false);
  };

  const toggleStatus = (id: string) => {
    onUpdateExams(
      db.exams.map((ex) =>
        ex.id === id
          ? { ...ex, status: ex.status === 'active' ? 'inactive' : 'active' }
          : ex,
      ),
    );
  };

  const deleteExam = (id: string) => {
    onUpdateExams(db.exams.filter((ex) => ex.id !== id));
  };

  const updateInlineWorkingDays = (id: string, rawVal: string) => {
    const parsed = Number(rawVal);
    if (Number.isNaN(parsed)) return;
    const safeDays = Math.max(1, Math.round(parsed));
    onUpdateExams(
      db.exams.map((ex) =>
        ex.id === id ? { ...ex, workingDays: safeDays } : ex,
      ),
    );
  };

  const updateInlineIssueDate = (id: string, nextDate: string) => {
    onUpdateExams(
      db.exams.map((ex) =>
        ex.id === id ? { ...ex, dateOfIssue: nextDate } : ex,
      ),
    );
  };

  const termLabel = (t: ExamTerm) => {
    if (t === 'first') return 'First Terminal';
    if (t === 'second') return 'Second Terminal';
    if (t === 'third') return 'Third Terminal';
    return 'Annual Examination';
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Terminal & Annual Examinations
          </h2>
          <p className="text-xs text-slate-500">
            Manage First, Second, Third Terminal, and Annual Examinations, working days, and exam-wise Date of Issue.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-700 text-white text-sm font-medium rounded-lg hover:bg-indigo-800 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Add Examination
        </button>
      </div>

      {/* Examination Working-Day Details Summary */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-indigo-700" />
            <h3 className="text-sm font-semibold text-slate-900">
              Examination Working-Day Details
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            Every examination maintains its configured working days for Grade Sheets & Attendance
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {db.exams.map((exam) => (
            <div
              key={exam.id}
              className="border border-slate-200 rounded-lg p-3 bg-slate-50 flex flex-col justify-between gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    {exam.name}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {termLabel(exam.term)} · {exam.academicYear}
                  </div>
                </div>
                <span
                  className={`text-[11px] font-semibold ${
                    exam.status === 'active'
                      ? 'text-emerald-700'
                      : 'text-red-700'
                  }`}
                >
                  {exam.status === 'active' ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-baseline justify-between pt-1 border-t border-slate-200">
                <span className="text-xs text-slate-600 font-medium">
                  Working Days
                </span>
                <span className="text-base font-bold font-mono tabular-nums text-indigo-700">
                  {exam.workingDays} days
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Date of Issue</span>
                <span className="font-mono">{exam.dateOfIssue}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Examination Title</th>
                <th className="px-4 py-3">Terminal</th>
                <th className="px-4 py-3">Academic Year</th>
                <th className="px-4 py-3">Working Days</th>
                <th className="px-4 py-3">Date of Issue</th>
                <th className="px-4 py-3 text-right">Marks Records</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {db.exams.map((exam) => {
                const recordCount = db.marks.filter(
                  (m) => m.examId === exam.id,
                ).length;
                return (
                  <tr key={exam.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {exam.name}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {termLabel(exam.term)}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">
                      {exam.academicYear}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={exam.workingDays}
                        onChange={(e) =>
                          updateInlineWorkingDays(exam.id, e.target.value)
                        }
                        aria-label={`Working Days for ${exam.name}`}
                        className="w-20 px-2 py-1 text-xs border border-slate-300 rounded font-mono tabular-nums bg-white text-slate-800 text-right"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={exam.dateOfIssue}
                        onChange={(e) =>
                          updateInlineIssueDate(exam.id, e.target.value)
                        }
                        aria-label={`Date of Issue for ${exam.name}`}
                        className="w-28 px-2 py-1 text-xs border border-slate-300 rounded font-mono bg-white text-slate-800"
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                      {recordCount}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleStatus(exam.id)}
                        className={`text-xs font-semibold hover:underline ${
                          exam.status === 'active'
                            ? 'text-emerald-700'
                            : 'text-red-700'
                        }`}
                      >
                        {exam.status === 'active' ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onEnterMarks(exam.id)}
                          className="text-xs font-medium text-indigo-700 hover:underline mr-1"
                        >
                          Enter Marks
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(exam)}
                          aria-label={`Edit ${exam.name}`}
                          className="p-1.5 text-slate-500 hover:text-indigo-700 rounded hover:bg-slate-100"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {db.exams.length > 1 && (
                          <button
                            type="button"
                            onClick={() => deleteExam(exam.id)}
                            aria-label={`Delete ${exam.name}`}
                            className="p-1.5 text-slate-500 hover:text-red-700 rounded hover:bg-slate-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                {editingId ? 'Edit Examination' : 'New Examination'}
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
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Examination Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Terminal Type
                  </label>
                  <select
                    value={term}
                    onChange={(e) => {
                      const nextTerm = e.target.value as ExamTerm;
                      setTerm(nextTerm);
                      if (!editingId) {
                        const def = DEFAULT_EXAM_DEFINITIONS[nextTerm];
                        setName(def.name);
                        setWorkingDays(
                          db.settings.examWorkingDays?.[nextTerm] ||
                            def.workingDays,
                        );
                        setDateOfIssue(
                          db.settings.examIssueDates?.[nextTerm] ||
                            def.dateOfIssue,
                        );
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="first">First Terminal</option>
                    <option value="second">Second Terminal</option>
                    <option value="third">Third Terminal</option>
                    <option value="annual">Annual Examination</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Academic Year
                  </label>
                  <input
                    type="text"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Working Days
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={workingDays}
                    onChange={(e) => setWorkingDays(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Date of Issue
                  </label>
                  <input
                    type="text"
                    value={dateOfIssue}
                    onChange={(e) => setDateOfIssue(e.target.value)}
                    placeholder="2082-08-15"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ActiveStatus)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
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
                  Save Examination
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
