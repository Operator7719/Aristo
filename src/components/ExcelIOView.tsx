import React, { useMemo, useRef, useState } from 'react';
import { Check, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { MarkRecord, SchoolDatabase, Student } from '../types';
import {
  downloadMarksTemplateExcel,
  downloadStudentTemplateExcel,
  exportGradewiseLedgerExcel,
  exportMarkwiseLedgerExcel,
  exportStudentsExcel,
  parseMarksExcel,
  parseStudentsExcel,
} from '../utils/excelHelper';
import { computeClassResults } from '../utils/grading';

interface ExcelIOViewProps {
  db: SchoolDatabase;
  onUpdateStudents: (students: Student[]) => void;
  onUpdateMarks: (marks: MarkRecord[]) => void;
}

export const ExcelIOView: React.FC<ExcelIOViewProps> = ({
  db,
  onUpdateStudents,
  onUpdateMarks,
}) => {
  const [examId, setExamId] = useState(
    db.exams[1]?.id || db.exams[0]?.id || '',
  );
  const [classId, setClassId] = useState('cls-9');
  const selectedClass =
    db.classes.find((c) => c.id === classId) || db.classes[0];
  const [sectionId, setSectionId] = useState(
    selectedClass?.sections[0]?.id || '',
  );

  const [pendingStudents, setPendingStudents] = useState<Omit<Student, 'id'>[]>([]);
  const [pendingMarks, setPendingMarks] = useState<MarkRecord[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const studentFileRef = useRef<HTMLInputElement | null>(null);
  const marksFileRef = useRef<HTMLInputElement | null>(null);

  const selectedExam = db.exams.find((e) => e.id === examId) || db.exams[0];
  const sectionName =
    selectedClass?.sections.find((s) => s.id === sectionId)?.name || 'A';

  const classStudents = useMemo(
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

  const handleStudentFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const parsed = await parseStudentsExcel(file, db.classes);
    setPendingStudents(parsed);
    setStatusMessage(`Parsed ${parsed.length} student rows from "${file.name}". Review and click Import Students.`);
    e.target.value = '';
  };

  const commitImportedStudents = () => {
    const withIds: Student[] = pendingStudents.map((s, idx) => ({
      ...s,
      id: `stu-imp-${Date.now()}-${idx}`,
    }));
    onUpdateStudents([...db.students, ...withIds]);
    setStatusMessage(`Imported ${withIds.length} students into directory.`);
    setPendingStudents([]);
  };

  const handleMarksFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedClass || !selectedExam) return;
    const parsed = await parseMarksExcel(
      file,
      db.students,
      db.subjects,
      selectedClass,
      sectionId,
      selectedExam,
    );
    setPendingMarks(parsed);
    setStatusMessage(`Parsed marks for ${parsed.length} students from "${file.name}". Review and click Commit Marks.`);
    e.target.value = '';
  };

  const commitImportedMarks = () => {
    const merged = [...db.marks];
    for (const rec of pendingMarks) {
      const idx = merged.findIndex((m) => m.id === rec.id);
      if (idx >= 0) {
        merged[idx] = {
          ...merged[idx],
          workingDays: rec.workingDays,
          presentDays: rec.presentDays,
          subjects: {
            ...merged[idx].subjects,
            ...rec.subjects,
          },
        };
      } else {
        merged.push(rec);
      }
    }
    onUpdateMarks(merged);
    setStatusMessage(`Committed marks for ${pendingMarks.length} students.`);
    setPendingMarks([]);
  };

  return (
    <div className="space-y-6">
      {statusMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Student Records Import / Export */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Student Records (Excel Import & Export)
            </h2>
            <p className="text-xs text-slate-500">
              Download the template spreadsheet, bulk import student rosters, or export the active directory.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => downloadStudentTemplateExcel()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
            >
              <Download className="w-4 h-4" />
              Download Template
            </button>
            <button
              type="button"
              onClick={() => studentFileRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg"
            >
              <Upload className="w-4 h-4" />
              Upload Students (.xlsx)
            </button>
            <input
              ref={studentFileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleStudentFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => exportStudentsExcel(db.students, db.classes)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-900 text-white rounded-lg"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Export All Students
            </button>
          </div>
        </div>

        {pendingStudents.length > 0 && (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">
                Preview: {pendingStudents.length} Students Ready to Import
              </span>
              <button
                type="button"
                onClick={commitImportedStudents}
                className="px-3 py-1.5 text-xs font-medium bg-indigo-700 text-white rounded-md hover:bg-indigo-800"
              >
                Import Students
              </button>
            </div>
            <div className="max-h-56 overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-white border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Roll</th>
                    <th className="px-3 py-2">Class</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingStudents.map((s, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 font-mono">{s.studentCode}</td>
                      <td className="px-3 py-2 font-medium">{s.name}</td>
                      <td className="px-3 py-2 font-mono">{s.rollNo}</td>
                      <td className="px-3 py-2">
                        {db.classes.find((c) => c.id === s.classId)?.name}
                      </td>
                      <td className="px-3 py-2 capitalize">{s.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Marks & Ledger Excel Import / Export */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Examination Marks & Ledgers (Excel Import & Export)
          </h2>
          <p className="text-xs text-slate-500">
            Select an exam, class, and section to download a pre-filled marks entry sheet, upload bulk marks, or export computed ledgers.
          </p>
        </div>

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

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <button
            type="button"
            onClick={() =>
              selectedClass &&
              selectedExam &&
              downloadMarksTemplateExcel(
                classStudents,
                db.subjects,
                selectedClass,
                sectionName,
                selectedExam,
                db.marks,
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
          >
            <Download className="w-4 h-4" />
            Download Marks Sheet Template
          </button>
          <button
            type="button"
            onClick={() => marksFileRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg"
          >
            <Upload className="w-4 h-4" />
            Import Filled Marks (.xlsx)
          </button>
          <input
            ref={marksFileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleMarksFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => {
              if (!selectedClass || !selectedExam) return;
              const results = computeClassResults(
                classStudents,
                db.subjects,
                selectedClass,
                db.marks,
                examId,
                db.settings,
                selectedExam.workingDays,
              );
              exportMarkwiseLedgerExcel(
                results,
                db.subjects,
                selectedClass,
                sectionName,
                selectedExam,
              );
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-900 text-white rounded-lg"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Markwise Ledger
          </button>
          <button
            type="button"
            onClick={() => {
              if (!selectedClass || !selectedExam) return;
              const results = computeClassResults(
                classStudents,
                db.subjects,
                selectedClass,
                db.marks,
                examId,
                db.settings,
                selectedExam.workingDays,
              );
              exportGradewiseLedgerExcel(
                results,
                db.subjects,
                selectedClass,
                sectionName,
                selectedExam,
              );
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-900 text-white rounded-lg"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Gradewise Ledger
          </button>
        </div>

        {pendingMarks.length > 0 && (
          <div className="border border-slate-200 rounded-lg p-4 flex items-center justify-between bg-slate-50">
            <span className="text-xs font-semibold text-slate-800">
              {pendingMarks.length} student mark records parsed and ready to commit.
            </span>
            <button
              type="button"
              onClick={commitImportedMarks}
              className="px-4 py-2 text-xs font-medium bg-indigo-700 text-white rounded-lg hover:bg-indigo-800"
            >
              Commit Marks
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
