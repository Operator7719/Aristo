import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ConversionTier, SchoolClass, SchoolDatabase } from '../types';

interface ClassSectionViewProps {
  db: SchoolDatabase;
  onUpdateClasses: (classes: SchoolClass[]) => void;
}

export const ClassSectionView: React.FC<ClassSectionViewProps> = ({
  db,
  onUpdateClasses,
}) => {
  const [newClassName, setNewClassName] = useState('');
  const [newGradeLevel, setNewGradeLevel] = useState(1);
  const [newTier, setNewTier] = useState<ConversionTier>('none');
  const [sectionInputs, setSectionInputs] = useState<Record<string, string>>({});

  const addClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    const nextOrder =
      db.classes.reduce((max, c) => Math.max(max, c.order), 0) + 1;
    const cls: SchoolClass = {
      id: `cls-${Date.now()}`,
      name: newClassName.trim(),
      gradeLevel: newGradeLevel,
      conversionTier: newTier,
      sections: [{ id: `sec-${Date.now()}`, name: 'A', status: 'active' }],
      status: 'active',
      order: nextOrder,
    };
    onUpdateClasses([...db.classes, cls]);
    setNewClassName('');
  };

  const toggleClassStatus = (classId: string) => {
    onUpdateClasses(
      db.classes.map((c) =>
        c.id === classId
          ? { ...c, status: c.status === 'active' ? 'inactive' : 'active' }
          : c,
      ),
    );
  };

  const changeConversionTier = (classId: string, tier: ConversionTier) => {
    onUpdateClasses(
      db.classes.map((c) =>
        c.id === classId ? { ...c, conversionTier: tier } : c,
      ),
    );
  };

  const addSection = (classId: string) => {
    const rawName = (sectionInputs[classId] || '').trim().toUpperCase();
    if (!rawName) return;
    onUpdateClasses(
      db.classes.map((c) => {
        if (c.id !== classId) return c;
        if (c.sections.some((s) => s.name.toUpperCase() === rawName)) return c;
        return {
          ...c,
          sections: [
            ...c.sections,
            { id: `sec-${Date.now()}`, name: rawName, status: 'active' },
          ],
        };
      }),
    );
    setSectionInputs((prev) => ({ ...prev, [classId]: '' }));
  };

  const toggleSectionStatus = (classId: string, sectionId: string) => {
    onUpdateClasses(
      db.classes.map((c) => {
        if (c.id !== classId) return c;
        return {
          ...c,
          sections: c.sections.map((s) =>
            s.id === sectionId
              ? { ...s, status: s.status === 'active' ? 'inactive' : 'active' }
              : s,
          ),
        };
      }),
    );
  };

  const removeSection = (classId: string, sectionId: string) => {
    onUpdateClasses(
      db.classes.map((c) => {
        if (c.id !== classId) return c;
        if (c.sections.length <= 1) return c;
        return {
          ...c,
          sections: c.sections.filter((s) => s.id !== sectionId),
        };
      }),
    );
  };

  return (
    <div className="space-y-6">
      {/* Add New Class Form */}
      <form
        onSubmit={addClass}
        className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-end gap-4"
      >
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-slate-700 mb-1">
            New Class Name
          </label>
          <input
            type="text"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            placeholder="e.g. Grade 11 Science"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
        </div>
        <div className="w-36">
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Grade Level
          </label>
          <input
            type="number"
            min={-2}
            max={12}
            value={newGradeLevel}
            onChange={(e) => {
              const lvl = Number(e.target.value);
              setNewGradeLevel(lvl);
              if (lvl <= 3) setNewTier('none');
              else if (lvl <= 8) setNewTier('grade_4_8');
              else setNewTier('grade_9_12');
            }}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
          />
        </div>
        <div className="w-64">
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Marks Conversion Rule
          </label>
          <select
            value={newTier}
            onChange={(e) => setNewTier(e.target.value as ConversionTier)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
          >
            <option value="none">Direct (Nursery – Grade 3)</option>
            <option value="grade_4_8">50 TH + 40 PR + 10% TH (Grade 4 – 8)</option>
            <option value="grade_9_12">75 TH + 19 PR + 6% TH (Grade 9 – 12)</option>
          </select>
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-700 text-white text-sm font-medium rounded-lg hover:bg-indigo-800 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Add Class
        </button>
      </form>

      {/* Class & Section Matrix */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Conversion Tier</th>
                <th className="px-4 py-3">Sections</th>
                <th className="px-4 py-3">Add Section</th>
                <th className="px-4 py-3 text-right">Students</th>
                <th className="px-4 py-3 text-right">Subjects</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {db.classes.map((cls) => {
                const studentCount = db.students.filter(
                  (s) => s.classId === cls.id,
                ).length;
                const subjectCount = db.subjects.filter(
                  (s) => s.classId === cls.id,
                ).length;
                return (
                  <tr key={cls.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                      {cls.name}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={cls.conversionTier}
                        onChange={(e) =>
                          changeConversionTier(
                            cls.id,
                            e.target.value as ConversionTier,
                          )
                        }
                        className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                      >
                        <option value="none">Direct (No Conversion)</option>
                        <option value="grade_4_8">Grade 4–8 (10% TH to 50 PR)</option>
                        <option value="grade_9_12">Grade 9–12 (6% TH to 25 PR)</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {cls.sections.map((sec) => (
                          <div
                            key={sec.id}
                            className="inline-flex items-center gap-1.5 border border-slate-200 rounded-md px-2 py-1 text-xs bg-slate-50"
                          >
                            <span className="font-mono font-semibold text-slate-800">
                              {sec.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleSectionStatus(cls.id, sec.id)}
                              className={
                                sec.status === 'active'
                                  ? 'text-emerald-700 hover:underline'
                                  : 'text-red-700 hover:underline'
                              }
                            >
                              {sec.status === 'active' ? 'Active' : 'Off'}
                            </button>
                            {cls.sections.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeSection(cls.id, sec.id)}
                                aria-label={`Remove Section ${sec.name}`}
                                className="text-slate-400 hover:text-red-700"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          maxLength={4}
                          value={sectionInputs[cls.id] || ''}
                          onChange={(e) =>
                            setSectionInputs({
                              ...sectionInputs,
                              [cls.id]: e.target.value,
                            })
                          }
                          placeholder="C"
                          className="w-16 px-2 py-1 text-xs border border-slate-300 rounded-md font-mono uppercase"
                        />
                        <button
                          type="button"
                          onClick={() => addSection(cls.id)}
                          className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md"
                        >
                          Add
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                      {studentCount}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                      {subjectCount}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => toggleClassStatus(cls.id)}
                        className={`text-xs font-semibold hover:underline ${
                          cls.status === 'active'
                            ? 'text-emerald-700'
                            : 'text-red-700'
                        }`}
                      >
                        {cls.status === 'active' ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
