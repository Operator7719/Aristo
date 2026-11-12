import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  ActiveStatus,
  ConversionTier,
  SchoolDatabase,
  Subject,
  SubjectCategory,
  SubjectGradingMode,
} from '../types';
import { isGradeOnlySubject } from '../utils/grading';

interface SubjectManagementViewProps {
  db: SchoolDatabase;
  onUpdateSubjects: (subjects: Subject[]) => void;
}

export const SubjectManagementView: React.FC<SubjectManagementViewProps> = ({
  db,
  onUpdateSubjects,
}) => {
  const [selectedClassId, setSelectedClassId] = useState<string>('cls-9');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<SubjectCategory>('compulsory');
  const [gradingMode, setGradingMode] = useState<SubjectGradingMode>('academic');
  const [fullMarksTheory, setFullMarksTheory] = useState(75);
  const [fullMarksPractical, setFullMarksPractical] = useState(19);
  const [passMarksTheory, setPassMarksTheory] = useState(27);
  const [passMarksPractical, setPassMarksPractical] = useState(7);
  const [creditHourTheory, setCreditHourTheory] = useState(3.75);
  const [creditHourPractical, setCreditHourPractical] = useState(1.25);
  const [conversionRule, setConversionRule] = useState<'inherit' | ConversionTier>('inherit');
  const [status, setStatus] = useState<ActiveStatus>('active');
  const [displayOrder, setDisplayOrder] = useState(1);

  const selectedClass = db.classes.find((c) => c.id === selectedClassId);

  const classSubjects = useMemo(
    () =>
      db.subjects
        .filter((s) => s.classId === selectedClassId)
        .sort((a, b) => a.displayOrder - b.displayOrder),
    [db.subjects, selectedClassId],
  );

  const openAdd = () => {
    setEditingId(null);
    const tier = selectedClass?.conversionTier ?? 'none';
    setCode('');
    setName('');
    setCategory('compulsory');
    setGradingMode('academic');
    if (tier === 'grade_9_12') {
      setFullMarksTheory(75);
      setFullMarksPractical(19);
      setPassMarksTheory(27);
      setPassMarksPractical(7);
      setCreditHourTheory(3.75);
      setCreditHourPractical(1.25);
    } else if (tier === 'grade_4_8') {
      setFullMarksTheory(50);
      setFullMarksPractical(40);
      setPassMarksTheory(18);
      setPassMarksPractical(14);
      setCreditHourTheory(2.5);
      setCreditHourPractical(2.5);
    } else {
      setFullMarksTheory(100);
      setFullMarksPractical(0);
      setPassMarksTheory(35);
      setPassMarksPractical(0);
      setCreditHourTheory(4);
      setCreditHourPractical(0);
    }
    setConversionRule('inherit');
    setStatus('active');
    setDisplayOrder(classSubjects.length + 1);
    setIsModalOpen(true);
  };

  const openEdit = (sub: Subject) => {
    setEditingId(sub.id);
    setCode(sub.code);
    setName(sub.name);
    setCategory(sub.category);
    setGradingMode(isGradeOnlySubject(sub) ? 'grade_only' : 'academic');
    setFullMarksTheory(sub.fullMarksTheory);
    setFullMarksPractical(sub.fullMarksPractical);
    setPassMarksTheory(sub.passMarksTheory);
    setPassMarksPractical(sub.passMarksPractical);
    setCreditHourTheory(sub.creditHourTheory);
    setCreditHourPractical(sub.creditHourPractical);
    setConversionRule(sub.conversionRule);
    setStatus(sub.status);
    setDisplayOrder(sub.displayOrder);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const payload: Subject = {
      id: editingId || `sub-${Date.now()}`,
      classId: selectedClassId,
      code: code.trim().toUpperCase() || `SUB-${classSubjects.length + 1}`,
      name: name.trim().toUpperCase(),
      category,
      gradingMode,
      fullMarksTheory: gradingMode === 'grade_only' ? 0 : Number(fullMarksTheory) || 0,
      fullMarksPractical: gradingMode === 'grade_only' ? 0 : Number(fullMarksPractical) || 0,
      passMarksTheory: gradingMode === 'grade_only' ? 0 : Number(passMarksTheory) || 0,
      passMarksPractical: gradingMode === 'grade_only' ? 0 : Number(passMarksPractical) || 0,
      creditHourTheory: gradingMode === 'grade_only' ? 0 : Number(creditHourTheory) || 0,
      creditHourPractical: gradingMode === 'grade_only' ? 0 : Number(creditHourPractical) || 0,
      conversionRule: gradingMode === 'grade_only' ? 'none' : conversionRule,
      status,
      displayOrder: Number(displayOrder) || 1,
    };

    if (editingId) {
      onUpdateSubjects(
        db.subjects.map((s) => (s.id === editingId ? payload : s)),
      );
    } else {
      onUpdateSubjects([...db.subjects, payload]);
    }
    setIsModalOpen(false);
  };

  const toggleStatus = (id: string) => {
    onUpdateSubjects(
      db.subjects.map((s) =>
        s.id === id
          ? { ...s, status: s.status === 'active' ? 'inactive' : 'active' }
          : s,
      ),
    );
  };

  const deleteSubject = (id: string) => {
    onUpdateSubjects(db.subjects.filter((s) => s.id !== id));
  };

  const categoryLabel = (cat: SubjectCategory) => {
    if (cat === 'opt_1') return 'Optional I';
    if (cat === 'opt_2') return 'Optional II';
    return 'Compulsory';
  };

  const effectiveFinalPracticalFM = (sub: Subject) => {
    const rule =
      sub.conversionRule !== 'inherit'
        ? sub.conversionRule
        : selectedClass?.conversionTier ?? 'none';
    if (sub.fullMarksPractical <= 0) return 0;
    if (rule === 'grade_4_8') return 10 + sub.fullMarksPractical;
    if (rule === 'grade_9_12') return 6 + sub.fullMarksPractical;
    return sub.fullMarksPractical;
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="sub-class" className="text-xs font-medium text-slate-600">
              Class
            </label>
            <select
              id="sub-class"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              {db.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <span className="text-xs text-slate-500">
            Default Conversion:{' '}
            <strong className="text-slate-800">
              {selectedClass?.conversionTier === 'none'
                ? 'Direct (No Conversion)'
                : selectedClass?.conversionTier === 'grade_4_8'
                  ? 'Grade 4–8 (50 TH + 40 PR -> 50 PR)'
                  : 'Grade 9–12 (75 TH + 19 PR -> 25 PR)'}
            </strong>
          </span>
        </div>

        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-700 text-white text-sm font-medium rounded-lg hover:bg-indigo-800 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Add Subject
        </button>
      </div>

      {/* Subjects Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Subject Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">TH Full</th>
                <th className="px-4 py-3 text-right">PR Full</th>
                <th className="px-4 py-3 text-right">Final PR Out Of</th>
                <th className="px-4 py-3 text-right">Total Full</th>
                <th className="px-4 py-3 text-right">Credit (TH/PR)</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {classSubjects.map((sub) => {
                const gradeOnly = isGradeOnlySubject(sub);
                const finalPr = gradeOnly ? 0 : effectiveFinalPracticalFM(sub);
                const totalFull = gradeOnly ? 0 : sub.fullMarksTheory + finalPr;
                return (
                  <tr key={sub.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono tabular-nums text-slate-600">
                      {sub.displayOrder}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">
                      {sub.code}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {sub.name}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {gradeOnly
                        ? 'Grade-Only (Gradesheet)'
                        : categoryLabel(sub.category)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-800">
                      {gradeOnly ? '—' : sub.fullMarksTheory}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-800">
                      {gradeOnly ? '—' : sub.fullMarksPractical}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-indigo-700 font-medium">
                      {gradeOnly ? '—' : finalPr}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {gradeOnly ? '—' : totalFull}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-xs text-slate-600">
                      {gradeOnly
                        ? 'Non-GPA'
                        : `${sub.creditHourTheory} / ${sub.creditHourPractical}`}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleStatus(sub.id)}
                        className={`text-xs font-semibold hover:underline ${
                          sub.status === 'active'
                            ? 'text-emerald-700'
                            : 'text-red-700'
                        }`}
                      >
                        {sub.status === 'active' ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(sub)}
                          aria-label={`Edit ${sub.name}`}
                          className="p-1.5 text-slate-500 hover:text-indigo-700 rounded hover:bg-slate-100"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSubject(sub.id)}
                          aria-label={`Delete ${sub.name}`}
                          className="p-1.5 text-slate-500 hover:text-red-700 rounded hover:bg-slate-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {classSubjects.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-slate-500">
                    No subjects configured for {selectedClass?.name}. Click "Add Subject" to configure subjects and marks.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Subject Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                {editingId ? 'Edit Subject' : `Add Subject (${selectedClass?.name})`}
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
                    Subject Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. COMP. MATHEMATICS"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Subject Code
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. MTH-9"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as SubjectCategory)
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="compulsory">Compulsory</option>
                    <option value="opt_1">Optional I (Grades 9–12)</option>
                    <option value="opt_2">Optional II (Grades 9–12)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Evaluation Mode
                  </label>
                  <select
                    value={gradingMode}
                    onChange={(e) =>
                      setGradingMode(e.target.value as SubjectGradingMode)
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="academic">Academic (Marks, Ledger & GPA)</option>
                    <option value="grade_only">Grade-Only (Gradesheet Only)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Conversion Rule
                  </label>
                  <select
                    value={conversionRule}
                    onChange={(e) =>
                      setConversionRule(
                        e.target.value as 'inherit' | ConversionTier,
                      )
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="inherit">Inherit Class Rule</option>
                    <option value="none">Direct (No Conversion)</option>
                    <option value="grade_4_8">Grade 4–8 (50 TH + 40 PR)</option>
                    <option value="grade_9_12">Grade 9–12 (75 TH + 19 PR)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Full Marks (Theory)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={fullMarksTheory}
                    onChange={(e) => setFullMarksTheory(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Full Marks (Practical)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={fullMarksPractical}
                    onChange={(e) =>
                      setFullMarksPractical(Number(e.target.value))
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Credit Hour (Theory)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={creditHourTheory}
                    onChange={(e) => setCreditHourTheory(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Credit Hour (Practical / IN)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={creditHourPractical}
                    onChange={(e) =>
                      setCreditHourPractical(Number(e.target.value))
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
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
                  {editingId ? 'Save Changes' : 'Add Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
