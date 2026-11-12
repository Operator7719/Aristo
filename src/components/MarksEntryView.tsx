import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Download, RefreshCw, Save, Upload } from 'lucide-react';
import {
  MarkRecord,
  SchoolDatabase,
  Student,
  Subject,
  SubjectMarkInput,
} from '../types';
import {
  computeSubjectResult,
  getStudentSubjects,
  isGradeOnlySubject,
  round2,
} from '../utils/grading';
import {
  downloadMarksTemplateExcel,
  parseMarksExcel,
} from '../utils/excelHelper';

interface MarksEntryViewProps {
  db: SchoolDatabase;
  initialExamId?: string;
  initialClassId?: string;
  initialSectionId?: string;
  activeTeacherId?: string | null;
  onSaveMarks: (updatedMarks: MarkRecord[]) => void;
}

interface EntryColumn {
  key: string;
  subjectId: string;
  subjectName: string;
  part: 'th' | 'pr';
  maxMarks: number;
}

export const MarksEntryView: React.FC<MarksEntryViewProps> = ({
  db,
  initialExamId,
  initialClassId,
  initialSectionId,
  activeTeacherId = null,
  onSaveMarks,
}) => {
  const isTeacherMode = Boolean(activeTeacherId);
  const activeTeacher = useMemo(
    () =>
      activeTeacherId
        ? db.teachers.find((t) => t.id === activeTeacherId)
        : undefined,
    [db.teachers, activeTeacherId],
  );

  const [examId, setExamId] = useState(
    initialExamId || db.exams[1]?.id || db.exams[0]?.id || '',
  );
  const selectedExam = db.exams.find((e) => e.id === examId) || db.exams[0];

  const teacherAssignmentsForExam = useMemo(() => {
    if (!activeTeacherId) return [];
    const examYearDigits = (
      selectedExam?.academicYear ||
      db.settings.academicYear ||
      ''
    ).replace(/[^0-9]/g, '');
    return (db.teacher_subject_assignments || []).filter((a) => {
      if (a.teacherId !== activeTeacherId) return false;
      const asgDigits = a.academicYearId.replace(/[^0-9]/g, '');
      return examYearDigits ? asgDigits === examYearDigits : true;
    });
  }, [
    activeTeacherId,
    db.teacher_subject_assignments,
    selectedExam,
    db.settings.academicYear,
  ]);

  const availableClasses = useMemo(() => {
    if (!isTeacherMode) return db.classes;
    const allowedIds = new Set(teacherAssignmentsForExam.map((a) => a.classId));
    return db.classes.filter((c) => allowedIds.has(c.id));
  }, [isTeacherMode, db.classes, teacherAssignmentsForExam]);

  const [classId, setClassId] = useState(initialClassId || 'cls-6');
  const selectedClass =
    availableClasses.find((c) => c.id === classId) || availableClasses[0];

  const availableSections = useMemo(() => {
    const secs = selectedClass?.sections || [];
    if (!isTeacherMode || !selectedClass) return secs;
    const allowedSecIds = new Set(
      teacherAssignmentsForExam
        .filter((a) => a.classId === selectedClass.id)
        .map((a) => a.sectionId),
    );
    return secs.filter((s) => allowedSecIds.has(s.id));
  }, [isTeacherMode, selectedClass, teacherAssignmentsForExam]);

  const [sectionId, setSectionId] = useState(
    initialSectionId || selectedClass?.sections[0]?.id || '',
  );

  useEffect(() => {
    if (
      availableClasses.length > 0 &&
      !availableClasses.some((c) => c.id === classId)
    ) {
      setClassId(availableClasses[0].id);
    }
  }, [availableClasses, classId]);

  useEffect(() => {
    if (
      availableSections.length > 0 &&
      !availableSections.some((s) => s.id === sectionId)
    ) {
      setSectionId(availableSections[0].id);
    }
  }, [availableSections, sectionId]);

  const assignedSubjectIds = useMemo(() => {
    if (!isTeacherMode || !selectedClass) return null;
    return new Set(
      teacherAssignmentsForExam
        .filter((a) => a.classId === selectedClass.id && a.sectionId === sectionId)
        .map((a) => a.subjectId),
    );
  }, [isTeacherMode, selectedClass, sectionId, teacherAssignmentsForExam]);

  const canEditAttendance = useMemo(() => {
    if (!isTeacherMode) return true;
    if (!selectedClass) return false;
    return teacherAssignmentsForExam.some(
      (a) =>
        a.classId === selectedClass.id &&
        a.sectionId === sectionId &&
        a.assignmentType === 'class_teacher',
    );
  }, [isTeacherMode, selectedClass, sectionId, teacherAssignmentsForExam]);

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

  // Academic subjects only — Drawing, Rhymes, Craft are strictly excluded from Marks Entry
  // In Teacher mode, strictly scoped to subjects assigned to the logged-in teacher
  const academicClassSubjects = useMemo(
    () =>
      db.subjects
        .filter(
          (s) =>
            s.classId === classId &&
            s.status === 'active' &&
            !isGradeOnlySubject(s) &&
            (!assignedSubjectIds || assignedSubjectIds.has(s.id)),
        )
        .sort((a, b) => a.displayOrder - b.displayOrder),
    [db.subjects, classId, assignedSubjectIds],
  );

  // Build ordered list of editable columns (TH, and PR only if subject has practical marks)
  const entryColumns = useMemo<EntryColumn[]>(() => {
    const cols: EntryColumn[] = [];
    for (const sub of academicClassSubjects) {
      cols.push({
        key: `${sub.id}__th`,
        subjectId: sub.id,
        subjectName: sub.name,
        part: 'th',
        maxMarks: sub.fullMarksTheory,
      });
      if (sub.fullMarksPractical > 0) {
        cols.push({
          key: `${sub.id}__pr`,
          subjectId: sub.id,
          subjectName: sub.name,
          part: 'pr',
          maxMarks: sub.fullMarksPractical,
        });
      }
    }
    return cols;
  }, [academicClassSubjects]);

  const studentSubjectSets = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const stu of students) {
      const subs = getStudentSubjects(stu, db.subjects, selectedClass).filter(
        (s) => !isGradeOnlySubject(s),
      );
      map.set(stu.id, new Set(subs.map((s) => s.id)));
    }
    return map;
  }, [students, db.subjects, selectedClass]);

  const [drafts, setDrafts] = useState<Record<string, MarkRecord>>({});
  const [savedBanner, setSavedBanner] = useState<string | null>(null);
  const [validationAlert, setValidationAlert] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    const next: Record<string, MarkRecord> = {};
    for (const stu of students) {
      const existing = db.marks.find(
        (m) => m.examId === examId && m.studentId === stu.id,
      );
      next[stu.id] = existing
        ? {
            ...JSON.parse(JSON.stringify(existing)),
            workingDays: selectedExam?.workingDays || existing.workingDays || 72,
          }
        : {
            id: `${examId}__${stu.id}`,
            examId,
            studentId: stu.id,
            classId,
            sectionId,
            workingDays: selectedExam?.workingDays || 72,
            presentDays: selectedExam?.workingDays || 72,
            subjects: {},
          };
    }
    setDrafts(next);
  }, [students, db.marks, examId, classId, sectionId, selectedExam]);

  const isCellActive = (stu: Student, sub: Subject) =>
    studentSubjectSets.get(stu.id)?.has(sub.id) ?? false;

  const updateAttendance = (
    studentId: string,
    field: 'presentDays',
    val: number,
  ) => {
    setDrafts((prev) => {
      const rec = prev[studentId];
      if (!rec) return prev;
      const clamped = Math.max(0, Math.min(rec.workingDays || 365, val));
      return {
        ...prev,
        [studentId]: {
          ...rec,
          [field]: clamped,
        },
      };
    });
  };

  const handleMarkChange = (
    studentId: string,
    subjectId: string,
    part: 'th' | 'pr',
    rawValue: string,
    maxMarks: number,
    subjectName: string,
  ) => {
    if (rawValue === '') {
      setValidationAlert(null);
      setDrafts((prev) => {
        const rec = prev[studentId];
        if (!rec) return prev;
        const existing: SubjectMarkInput = rec.subjects[subjectId] || {
          theoryObtained: null,
          practicalObtained: null,
        };
        return {
          ...prev,
          [studentId]: {
            ...rec,
            subjects: {
              ...rec.subjects,
              [subjectId]: {
                ...existing,
                [part === 'th' ? 'theoryObtained' : 'practicalObtained']: null,
              },
            },
          },
        };
      });
      return;
    }

    const parsed = Number(rawValue);
    if (Number.isNaN(parsed)) return;

    if (parsed < 0) {
      setValidationAlert(
        `${subjectName} (${part.toUpperCase()}): Negative marks are not allowed.`,
      );
      return;
    }
    if (parsed > maxMarks) {
      setValidationAlert(
        `${subjectName} (${part.toUpperCase()}): Entered mark ${parsed} exceeds full marks (${maxMarks}). Clamped to ${maxMarks}.`,
      );
    } else {
      setValidationAlert(null);
    }

    const clamped = Math.max(0, Math.min(maxMarks, parsed));
    setDrafts((prev) => {
      const rec = prev[studentId];
      if (!rec) return prev;
      const existing: SubjectMarkInput = rec.subjects[subjectId] || {
        theoryObtained: null,
        practicalObtained: null,
      };
      return {
        ...prev,
        [studentId]: {
          ...rec,
          subjects: {
            ...rec.subjects,
            [subjectId]: {
              ...existing,
              [part === 'th' ? 'theoryObtained' : 'practicalObtained']: clamped,
            },
          },
        },
      };
    });
  };

  const moveFocus = (rowIdx: number, colIdx: number, dRow: number, dCol: number) => {
    const totalRows = students.length;
    const totalCols = entryColumns.length;
    let r = rowIdx;
    let c = colIdx;

    for (let step = 0; step < totalRows * totalCols; step++) {
      c += dCol;
      if (c >= totalCols) {
        c = 0;
        r += 1;
      } else if (c < 0) {
        c = totalCols - 1;
        r -= 1;
      }
      r += dRow;
      if (r < 0 || r >= totalRows) return;

      const targetKey = `${r}__${c}`;
      const el = inputRefs.current[targetKey];
      if (el && !el.disabled) {
        el.focus();
        el.select();
        return;
      }
      // If vertical move hit disabled cell, keep stepping vertically
      if (dRow !== 0 && dCol === 0) continue;
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    colIdx: number,
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      moveFocus(rowIdx, colIdx, 0, 1);
    } else if (e.key === 'ArrowRight') {
      const input = e.currentTarget;
      if (
        input.selectionStart === input.value.length ||
        input.type === 'number'
      ) {
        e.preventDefault();
        moveFocus(rowIdx, colIdx, 0, 1);
      }
    } else if (e.key === 'ArrowLeft') {
      const input = e.currentTarget;
      if (input.selectionStart === 0 || input.type === 'number') {
        e.preventDefault();
        moveFocus(rowIdx, colIdx, 0, -1);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveFocus(rowIdx, colIdx, 1, 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveFocus(rowIdx, colIdx, -1, 0);
    }
  };

  // Support multi-cell copy-paste directly from Excel / Google Sheets
  const handlePaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    startRow: number,
    startCol: number,
  ) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text || (!text.includes('\t') && !text.includes('\n'))) {
      return; // Let single-cell paste behave normally
    }
    e.preventDefault();

    const pastedRows = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trimEnd()
      .split('\n')
      .map((line) => line.split('\t'));

    let appliedCells = 0;
    setDrafts((prev) => {
      const next = { ...prev };
      pastedRows.forEach((cells, rOffset) => {
        const targetRow = startRow + rOffset;
        const stu = students[targetRow];
        if (!stu || !next[stu.id]) return;

        const updatedSubjects = { ...next[stu.id].subjects };
        cells.forEach((cellVal, cOffset) => {
          const targetCol = startCol + cOffset;
          const colMeta = entryColumns[targetCol];
          if (!colMeta) return;
          if (!studentSubjectSets.get(stu.id)?.has(colMeta.subjectId)) return;

          const trimmed = cellVal.trim();
          const num = trimmed === '' ? null : Number(trimmed);
          if (num !== null && Number.isNaN(num)) return;

          const clamped =
            num === null
              ? null
              : Math.max(0, Math.min(colMeta.maxMarks, num));

          const prevSub = updatedSubjects[colMeta.subjectId] || {
            theoryObtained: null,
            practicalObtained: null,
          };
          updatedSubjects[colMeta.subjectId] = {
            ...prevSub,
            [colMeta.part === 'th' ? 'theoryObtained' : 'practicalObtained']:
              clamped,
          };
          appliedCells++;
        });

        next[stu.id] = {
          ...next[stu.id],
          subjects: updatedSubjects,
        };
      });
      return next;
    });

    setSavedBanner(
      `Pasted ${appliedCells} marks from Excel. Click Save All or Update All to persist.`,
    );
    setTimeout(() => setSavedBanner(null), 3500);
  };

  const commitMarks = (actionLabel: string) => {
    if (isTeacherMode && academicClassSubjects.length === 0) return;
    const draftValues = Object.values(drafts);
    const merged = [...db.marks];
    for (const d of draftValues) {
      const idx = merged.findIndex((m) => m.id === d.id);
      if (idx >= 0) {
        const existingRec = merged[idx];
        // Preserve marks for other teachers' subjects and attendance if not Class Teacher
        const nextSubjects = { ...existingRec.subjects };
        for (const sub of academicClassSubjects) {
          if (d.subjects[sub.id]) {
            nextSubjects[sub.id] = d.subjects[sub.id];
          }
        }
        merged[idx] = {
          ...d,
          presentDays: canEditAttendance ? d.presentDays : existingRec.presentDays,
          subjects: isTeacherMode ? nextSubjects : d.subjects,
        };
      } else {
        merged.push(d);
      }
    }
    onSaveMarks(merged);
    setSavedBanner(`${actionLabel} completed successfully.`);
    setTimeout(() => setSavedBanner(null), 2800);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedClass || !selectedExam) return;
    const imported = await parseMarksExcel(
      file,
      db.students,
      isTeacherMode ? academicClassSubjects : db.subjects,
      selectedClass,
      sectionId,
      selectedExam,
    );
    setDrafts((prev) => {
      const next = { ...prev };
      for (const rec of imported) {
        const prevRec = next[rec.studentId];
        next[rec.studentId] = {
          ...(prevRec || rec),
          workingDays: rec.workingDays,
          presentDays: canEditAttendance
            ? rec.presentDays
            : (prevRec?.presentDays ?? rec.presentDays),
          subjects: {
            ...(prevRec?.subjects || {}),
            ...rec.subjects,
          },
        };
      }
      return next;
    });
    setSavedBanner(
      `Loaded marks for ${imported.length} students. Click Save All or Update All to store.`,
    );
    e.target.value = '';
  };

  const sectionName =
    selectedClass?.sections.find((s) => s.id === sectionId)?.name || 'A';

  const conversionSummary =
    selectedClass?.conversionTier === 'none'
      ? 'Nursery–Grade 3: Direct TH + PR calculation. Drawing, Rhymes & Craft are excluded from Marks Entry and GPA.'
      : selectedClass?.conversionTier === 'grade_4_8'
        ? 'Grade 4–8: 50 TH + 40 PR (10% TH converts to 50 PR). Drawing is graded separately on the Gradesheet.'
        : 'Grade 9–12: 75 TH + 19 PR (6% TH converts to 25 PR).';

  return (
    <div className="space-y-4">
      {/* Pink Theme Header & Controls Toolbar */}
      <div className="bg-pink-50/70 border border-pink-200 rounded-xl p-4 flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold text-pink-900 mb-1">
              Examination
            </label>
            <select
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
              className="px-3 py-2 text-sm border border-pink-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-600"
            >
              {db.exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name} ({ex.academicYear})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-pink-900 mb-1">
              Class
            </label>
            <select
              value={selectedClass?.id || ''}
              onChange={(e) => setClassId(e.target.value)}
              disabled={availableClasses.length === 0}
              className="px-3 py-2 text-sm border border-pink-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-600 disabled:bg-slate-100"
            >
              {availableClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              {availableClasses.length === 0 && (
                <option value="">No Assigned Class</option>
              )}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-pink-900 mb-1">
              Section
            </label>
            <select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              disabled={availableSections.length === 0}
              className="px-3 py-2 text-sm border border-pink-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-600 disabled:bg-slate-100"
            >
              {availableSections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  Section {sec.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!selectedClass || !selectedExam || academicClassSubjects.length === 0}
            onClick={() =>
              selectedClass &&
              selectedExam &&
              downloadMarksTemplateExcel(
                students,
                isTeacherMode ? academicClassSubjects : db.subjects,
                selectedClass,
                sectionName,
                selectedExam,
                db.marks,
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-pink-900 bg-white border border-pink-300 hover:bg-pink-100 rounded-lg whitespace-nowrap transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Excel Template
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-pink-900 bg-white border border-pink-300 hover:bg-pink-100 rounded-lg whitespace-nowrap transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import Excel
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleImportExcel}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => commitMarks('Update All')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-pink-600 text-white text-sm font-medium rounded-lg hover:bg-pink-700 whitespace-nowrap transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Update All
          </button>
          <button
            type="button"
            onClick={() => commitMarks('Save All')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-pink-700 text-white text-sm font-medium rounded-lg hover:bg-pink-800 whitespace-nowrap transition-colors"
          >
            <Save className="w-4 h-4" />
            Save All
          </button>
        </div>
      </div>

      {/* Teacher Access Scoping Notice */}
      {isTeacherMode && (
        <div className="bg-white border border-pink-200 rounded-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-pink-950">
          <div>
            <span className="font-bold">
              Teacher Access ({activeTeacher?.name}):
            </span>{' '}
            Showing only your Admin-assigned subjects ({academicClassSubjects.length}) for {selectedClass?.name || '—'} Section {sectionName}.
            {!canEditAttendance &&
              ' Attendance is read-only (editable by Class Teacher or Admin).'}
          </div>
        </div>
      )}

      {/* Formula & Keyboard Shortcuts Notice */}
      <div className="bg-pink-50 border border-pink-200 rounded-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-pink-950">
        <div>
          <span>{conversionSummary}</span>
          <span className="mx-2 text-pink-400">·</span>
          <span className="text-pink-800">
            Tip: Use Enter / Tab / Arrow keys to move, or copy-paste cells directly from Excel.
          </span>
        </div>
        {savedBanner && (
          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
            <Check className="w-4 h-4" />
            {savedBanner}
          </span>
        )}
      </div>

      {validationAlert && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-2 text-xs font-medium">
          {validationAlert}
        </div>
      )}

      {/* Horizontal Marks Entry Spreadsheet */}
      <div className="bg-white border border-pink-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              {/* Group Header Row */}
              <tr className="bg-pink-100 text-pink-950 border-b border-pink-200 font-semibold">
                <th
                  rowSpan={2}
                  className="px-3 py-2.5 sticky left-0 z-20 bg-pink-100 border-r border-pink-200 min-w-[64px] w-[64px] text-center align-middle"
                >
                  Roll No.
                </th>
                <th
                  rowSpan={2}
                  className="px-3 py-2.5 sticky left-[64px] z-20 bg-pink-100 border-r border-pink-200 min-w-[175px] w-[175px] align-middle"
                >
                  Student Name
                </th>
                {academicClassSubjects.map((sub) => {
                  const hasPr = sub.fullMarksPractical > 0;
                  return (
                    <th
                      key={sub.id}
                      colSpan={hasPr ? 3 : 1}
                      className="px-2 py-2 text-center border-r border-pink-200 whitespace-nowrap"
                    >
                      <div className="font-bold text-pink-950">{sub.name}</div>
                      <div className="text-[10px] font-normal text-pink-800 font-mono">
                        {hasPr
                          ? `TH:${sub.fullMarksTheory} · PR:${sub.fullMarksPractical}`
                          : `TH:${sub.fullMarksTheory}`}
                      </div>
                    </th>
                  );
                })}
                <th
                  rowSpan={2}
                  className="px-3 py-2.5 text-center border-r border-pink-200 bg-pink-100 min-w-[82px] align-middle"
                >
                  <div>Present</div>
                  <div className="text-[10px] font-normal text-pink-800 font-mono">
                    /{selectedExam?.workingDays || 72}
                  </div>
                </th>
                <th
                  rowSpan={2}
                  className="px-3 py-2.5 text-right border-r border-pink-200 bg-pink-100 min-w-[84px] align-middle"
                >
                  Total
                </th>
                <th
                  rowSpan={2}
                  className="px-3 py-2.5 text-right bg-pink-100 min-w-[74px] align-middle"
                >
                  %
                </th>
              </tr>

              {/* Sub-Column Header Row (TH / PR / Total) */}
              <tr className="bg-pink-50 text-pink-900 border-b border-pink-200 font-semibold text-[11px]">
                {academicClassSubjects.map((sub) => {
                  const hasPr = sub.fullMarksPractical > 0;
                  return (
                    <React.Fragment key={sub.id}>
                      <th className="px-2 py-1.5 text-center border-r border-pink-100 min-w-[72px]">
                        TH
                      </th>
                      {hasPr && (
                        <>
                          <th className="px-2 py-1.5 text-center border-r border-pink-100 min-w-[72px]">
                            PR
                          </th>
                          <th className="px-2 py-1.5 text-center border-r border-pink-200 min-w-[68px] text-pink-950">
                            Total
                          </th>
                        </>
                      )}
                    </React.Fragment>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-pink-100">
              {students.map((stu, rowIdx) => {
                const rec = drafts[stu.id];
                if (!rec) return null;

                // Compute student row totals dynamically
                let rowGrandTotal = 0;
                let rowGrandFull = 0;
                const subjectTotals: Record<
                  string,
                  { total: number; hasMarks: boolean }
                > = {};

                for (const sub of academicClassSubjects) {
                  if (!isCellActive(stu, sub)) continue;
                  const computed = computeSubjectResult(
                    sub,
                    selectedClass,
                    rec,
                    db.settings,
                  );
                  subjectTotals[sub.id] = {
                    total: computed.totalObtained,
                    hasMarks: computed.hasEnteredMarks,
                  };
                  if (computed.hasEnteredMarks) {
                    rowGrandTotal = round2(rowGrandTotal + computed.totalObtained);
                    rowGrandFull = round2(rowGrandFull + computed.totalFullMarks);
                  }
                }

                const rowPercent =
                  rowGrandFull > 0
                    ? round2((rowGrandTotal / rowGrandFull) * 100)
                    : 0;

                return (
                  <tr
                    key={stu.id}
                    className="group hover:bg-pink-50/60 transition-colors"
                  >
                    <td className="px-3 py-2 font-mono tabular-nums font-semibold text-pink-950 sticky left-0 z-10 bg-white group-hover:bg-pink-50 border-r border-pink-200 text-center">
                      {stu.rollNo}
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-900 sticky left-[64px] z-10 bg-white group-hover:bg-pink-50 border-r border-pink-200 whitespace-nowrap truncate max-w-[175px]">
                      {stu.name}
                    </td>

                    {academicClassSubjects.map((sub) => {
                      const active = isCellActive(stu, sub);
                      const hasPr = sub.fullMarksPractical > 0;
                      const entry = rec.subjects[sub.id] || {
                        theoryObtained: null,
                        practicalObtained: null,
                      };
                      const thColIdx = entryColumns.findIndex(
                        (col) => col.key === `${sub.id}__th`,
                      );
                      const prColIdx = entryColumns.findIndex(
                        (col) => col.key === `${sub.id}__pr`,
                      );
                      const subSummary = subjectTotals[sub.id];

                      return (
                        <React.Fragment key={sub.id}>
                          <td className="px-1.5 py-1.5 border-r border-pink-100 text-center">
                            {active ? (
                              <input
                                ref={(el) => {
                                  inputRefs.current[`${rowIdx}__${thColIdx}`] =
                                    el;
                                }}
                                type="number"
                                min={0}
                                max={sub.fullMarksTheory}
                                step="0.5"
                                value={
                                  entry.theoryObtained === null ||
                                  entry.theoryObtained === undefined
                                    ? ''
                                    : entry.theoryObtained
                                }
                                onChange={(e) =>
                                  handleMarkChange(
                                    stu.id,
                                    sub.id,
                                    'th',
                                    e.target.value,
                                    sub.fullMarksTheory,
                                    sub.name,
                                  )
                                }
                                onKeyDown={(e) =>
                                  handleKeyDown(e, rowIdx, thColIdx)
                                }
                                onPaste={(e) => handlePaste(e, rowIdx, thColIdx)}
                                aria-label={`${stu.name} ${sub.name} Theory`}
                                placeholder="0"
                                className="w-16 px-1.5 py-1 text-xs border border-pink-200 rounded font-mono tabular-nums text-right bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-600 focus:border-pink-600"
                              />
                            ) : (
                              <span className="text-slate-300 font-mono">—</span>
                            )}
                          </td>

                          {hasPr && (
                            <>
                              <td className="px-1.5 py-1.5 border-r border-pink-100 text-center">
                                {active ? (
                                  <input
                                    ref={(el) => {
                                      inputRefs.current[
                                        `${rowIdx}__${prColIdx}`
                                      ] = el;
                                    }}
                                    type="number"
                                    min={0}
                                    max={sub.fullMarksPractical}
                                    step="0.5"
                                    value={
                                      entry.practicalObtained === null ||
                                      entry.practicalObtained === undefined
                                        ? ''
                                        : entry.practicalObtained
                                    }
                                    onChange={(e) =>
                                      handleMarkChange(
                                        stu.id,
                                        sub.id,
                                        'pr',
                                        e.target.value,
                                        sub.fullMarksPractical,
                                        sub.name,
                                      )
                                    }
                                    onKeyDown={(e) =>
                                      handleKeyDown(e, rowIdx, prColIdx)
                                    }
                                    onPaste={(e) =>
                                      handlePaste(e, rowIdx, prColIdx)
                                    }
                                    aria-label={`${stu.name} ${sub.name} Practical`}
                                    placeholder="0"
                                    className="w-16 px-1.5 py-1 text-xs border border-pink-200 rounded font-mono tabular-nums text-right bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-600 focus:border-pink-600"
                                  />
                                ) : (
                                  <span className="text-slate-300 font-mono">
                                    —
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-1.5 border-r border-pink-200 text-right font-mono tabular-nums font-semibold text-pink-900 bg-pink-50/30">
                                {active && subSummary?.hasMarks
                                  ? subSummary.total.toFixed(
                                      Number.isInteger(subSummary.total) ? 0 : 2,
                                    )
                                  : '—'}
                              </td>
                            </>
                          )}
                        </React.Fragment>
                      );
                    })}

                    <td className="px-2 py-1.5 border-r border-pink-200 text-center">
                      <input
                        type="number"
                        min={0}
                        max={rec.workingDays}
                        disabled={!canEditAttendance}
                        value={rec.presentDays}
                        onChange={(e) =>
                          updateAttendance(
                            stu.id,
                            'presentDays',
                            Number(e.target.value),
                          )
                        }
                        aria-label={`${stu.name} Present Days`}
                        className="w-16 px-1.5 py-1 text-xs border border-pink-200 rounded font-mono tabular-nums text-center bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-600 disabled:bg-slate-100 disabled:text-slate-500"
                      />
                    </td>

                    <td className="px-3 py-2 border-r border-pink-200 text-right font-mono tabular-nums font-bold text-pink-950 whitespace-nowrap bg-pink-50/40">
                      {rowGrandFull > 0
                        ? `${rowGrandTotal}/${rowGrandFull}`
                        : '—'}
                    </td>

                    <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold text-pink-900 whitespace-nowrap bg-pink-50/40">
                      {rowGrandFull > 0 ? `${rowPercent.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                );
              })}

              {students.length === 0 && (
                <tr>
                  <td
                    colSpan={entryColumns.length + academicClassSubjects.length + 5}
                    className="px-4 py-10 text-center text-slate-500 text-sm"
                  >
                    No active students in {selectedClass?.name} Section{' '}
                    {sectionName}. Add students or choose another class.
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
