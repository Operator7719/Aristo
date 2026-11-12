import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FileDown,
  FileSpreadsheet,
  Pencil,
  Plus,
  Printer,
  Search,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  ActiveStatus,
  AssignmentType,
  SchoolDatabase,
  Teacher,
  TeacherSubjectAssignment,
  UserRole,
} from '../types';
import { exportTeacherAssignmentsExcel } from '../utils/excelHelper';
import { downloadTeacherAssignmentsPDF } from '../utils/pdfGenerator';

interface TeacherAssignmentViewProps {
  db: SchoolDatabase;
  userRole: UserRole;
  onUpdateTeachers: (teachers: Teacher[]) => void;
  onUpdateAssignments: (assignments: TeacherSubjectAssignment[]) => void;
}

const PERIOD_SLOTS = [
  'Flexible / Daily',
  'Period 1 (09:30–10:15)',
  'Period 2 (10:15–11:00)',
  'Period 3 (11:00–11:45)',
  'Period 4 (11:45–12:30)',
  'Period 5 (13:00–13:45)',
  'Period 6 (13:45–14:30)',
  'Period 7 (14:30–15:15)',
];

type SubTab = 'assign_report' | 'unassigned' | 'teachers';

export const TeacherAssignmentView: React.FC<TeacherAssignmentViewProps> = ({
  db,
  userRole,
  onUpdateTeachers,
  onUpdateAssignments,
}) => {
  const isAdmin = userRole === 'admin';

  const academicYearOptions = useMemo(() => {
    const set = new Set<string>([
      ...(db.academicYears || ['2081 B.S', '2082 B.S', '2083 B.S']),
      db.settings.academicYear,
      ...db.teacher_subject_assignments.map((a) => a.academicYearId),
    ]);
    return Array.from(set).filter(Boolean);
  }, [db.academicYears, db.settings.academicYear, db.teacher_subject_assignments]);

  const [activeTab, setActiveTab] = useState<SubTab>('assign_report');

  // Assignment Form State
  const [academicYearId, setAcademicYearId] = useState<string>(
    db.settings.academicYear || '2082 B.S',
  );
  const [classId, setClassId] = useState<string>(
    db.classes.find((c) => c.id === 'cls-9')?.id || db.classes[0]?.id || '',
  );
  const selectedClassObj = useMemo(
    () => db.classes.find((c) => c.id === classId) || db.classes[0],
    [db.classes, classId],
  );
  const [sectionId, setSectionId] = useState<string>(
    selectedClassObj?.sections[0]?.id || '',
  );
  const [teacherId, setTeacherId] = useState<string>(
    db.teachers.find((t) => t.status === 'active')?.id || db.teachers[0]?.id || '',
  );
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [assignmentType, setAssignmentType] =
    useState<AssignmentType>('subject_teacher');
  const [periodSlot, setPeriodSlot] = useState<string>(PERIOD_SLOTS[0]);

  // Edit Assignment Modal State
  const [editingAssignment, setEditingAssignment] =
    useState<TeacherSubjectAssignment | null>(null);
  const [editTeacherId, setEditTeacherId] = useState('');
  const [editAssignmentType, setEditAssignmentType] =
    useState<AssignmentType>('subject_teacher');
  const [editPeriodSlot, setEditPeriodSlot] = useState(PERIOD_SLOTS[0]);
  const [editAcademicYearId, setEditAcademicYearId] = useState('');

  // Teacher Registry Modal State
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [teacherForm, setTeacherForm] = useState({
    teacherCode: '',
    name: '',
    email: '',
    phone: '',
    qualification: '',
    specialization: '',
    joinedDate: db.settings.dateOfIssue || '2082-01-01',
    status: 'active' as ActiveStatus,
  });

  // Report Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterYear, setFilterYear] = useState<string>(
    db.settings.academicYear || '2082 B.S',
  );
  const [filterClassId, setFilterClassId] = useState<string>('all');
  const [filterSectionId, setFilterSectionId] = useState<string>('all');
  const [filterSubjectId, setFilterSubjectId] = useState<string>('all');
  const [filterTeacherId, setFilterTeacherId] = useState<string>('all');

  // Notifications & Confirmations
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [confirmDeleteAssignmentId, setConfirmDeleteAssignmentId] = useState<
    string | null
  >(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  const activeTeachers = useMemo(
    () => db.teachers.filter((t) => t.status === 'active'),
    [db.teachers],
  );

  const classSubjects = useMemo(
    () =>
      db.subjects
        .filter((s) => s.classId === classId && s.status === 'active')
        .sort((a, b) => a.displayOrder - b.displayOrder),
    [db.subjects, classId],
  );

  // Dashboard stats scoped to filterYear (or current academicYear if 'all' is chosen)
  const dashboardYear =
    filterYear === 'all' ? db.settings.academicYear || '2082 B.S' : filterYear;

  const dashboardMetrics = useMemo(() => {
    const activeClasses = db.classes.filter((c) => c.status === 'active');
    const totalSections = activeClasses.reduce(
      (sum, c) => sum + c.sections.filter((s) => s.status === 'active').length,
      0,
    );
    const activeSubjects = db.subjects.filter((s) => s.status === 'active');

    // Compute all class-section-subject slots across active classes
    const allSlotKeys = new Set<string>();
    const unassignedSlots: {
      classId: string;
      className: string;
      sectionId: string;
      sectionName: string;
      subjectId: string;
      subjectName: string;
      subjectCode: string;
    }[] = [];

    const yearAssignments = db.teacher_subject_assignments.filter(
      (a) => a.academicYearId === dashboardYear,
    );
    const assignedSlotMap = new Map<string, TeacherSubjectAssignment>();
    for (const a of yearAssignments) {
      assignedSlotMap.set(`${a.classId}__${a.sectionId}__${a.subjectId}`, a);
    }

    for (const cls of activeClasses) {
      const clsSubs = activeSubjects
        .filter((s) => s.classId === cls.id)
        .sort((a, b) => a.displayOrder - b.displayOrder);
      for (const sec of cls.sections.filter((s) => s.status === 'active')) {
        for (const sub of clsSubs) {
          const key = `${cls.id}__${sec.id}__${sub.id}`;
          allSlotKeys.add(key);
          if (!assignedSlotMap.has(key)) {
            unassignedSlots.push({
              classId: cls.id,
              className: cls.name,
              sectionId: sec.id,
              sectionName: sec.name,
              subjectId: sub.id,
              subjectName: sub.name,
              subjectCode: sub.code,
            });
          }
        }
      }
    }

    return {
      totalTeachers: db.teachers.length,
      activeTeachersCount: activeTeachers.length,
      totalSubjects: activeSubjects.length,
      totalAssignedInYear: yearAssignments.length,
      totalUnassignedSlots: unassignedSlots.length,
      totalClasses: activeClasses.length,
      totalSections,
      unassignedSlots,
    };
  }, [
    db.classes,
    db.subjects,
    db.teachers,
    db.teacher_subject_assignments,
    activeTeachers.length,
    dashboardYear,
  ]);

  // Existing assignments for selected (academicYearId, classId, sectionId)
  const slotAssignmentsBySubject = useMemo(() => {
    const map = new Map<string, TeacherSubjectAssignment>();
    for (const a of db.teacher_subject_assignments) {
      if (
        a.academicYearId === academicYearId &&
        a.classId === classId &&
        a.sectionId === sectionId
      ) {
        map.set(a.subjectId, a);
      }
    }
    return map;
  }, [db.teacher_subject_assignments, academicYearId, classId, sectionId]);

  // Conflict Warnings (Period / Class Teacher conflicts)
  const conflictWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (!teacherId || !academicYearId) return warnings;

    const selectedTeacher = db.teachers.find((t) => t.id === teacherId);
    const teacherName = selectedTeacher?.name || 'Selected teacher';

    if (periodSlot && periodSlot !== 'Flexible / Daily') {
      const periodConflicts = db.teacher_subject_assignments.filter(
        (a) =>
          a.academicYearId === academicYearId &&
          a.teacherId === teacherId &&
          a.periodSlot === periodSlot &&
          !(a.classId === classId && a.sectionId === sectionId),
      );
      if (periodConflicts.length > 0) {
        const first = periodConflicts[0];
        const clsName =
          db.classes.find((c) => c.id === first.classId)?.name || first.classId;
        const secName =
          db.classes
            .find((c) => c.id === first.classId)
            ?.sections.find((s) => s.id === first.sectionId)?.name || '';
        const subName =
          db.subjects.find((s) => s.id === first.subjectId)?.name || '';
        warnings.push(
          `Period Conflict: ${teacherName} is already scheduled in ${clsName} Section ${secName} (${subName}) during ${periodSlot} for ${academicYearId}.`,
        );
      }
    }

    if (assignmentType === 'class_teacher') {
      const existingClassTeacher = db.teacher_subject_assignments.find(
        (a) =>
          a.academicYearId === academicYearId &&
          a.classId === classId &&
          a.sectionId === sectionId &&
          a.assignmentType === 'class_teacher' &&
          a.teacherId !== teacherId,
      );
      if (existingClassTeacher) {
        const otherTeacher = db.teachers.find(
          (t) => t.id === existingClassTeacher.teacherId,
        );
        warnings.push(
          `Class Teacher Conflict: ${otherTeacher?.name || 'Another teacher'} is already designated as Class Teacher for this class and section in ${academicYearId}.`,
        );
      }
    }

    return warnings;
  }, [
    teacherId,
    academicYearId,
    periodSlot,
    assignmentType,
    classId,
    sectionId,
    db.teachers,
    db.teacher_subject_assignments,
    db.classes,
    db.subjects,
  ]);

  const toggleSubjectSelection = (subjectId: string) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId],
    );
  };

  const selectAllUnassignedInClass = () => {
    const unassigned = classSubjects
      .filter((sub) => !slotAssignmentsBySubject.has(sub.id))
      .map((sub) => sub.id);
    setSelectedSubjectIds(unassigned);
  };

  const handleAssignSubjects = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showFeedback('error', 'Only Admin can create or modify teacher assignments.');
      return;
    }
    if (!academicYearId || !classId || !sectionId || !teacherId) {
      showFeedback(
        'error',
        'Please select Academic Year, Class, Section, and Subject Teacher.',
      );
      return;
    }
    if (selectedSubjectIds.length === 0) {
      showFeedback('error', 'Select at least one subject to assign.');
      return;
    }

    // Duplicate validation against existing records
    const duplicates = selectedSubjectIds.filter((subId) =>
      slotAssignmentsBySubject.has(subId),
    );
    if (duplicates.length > 0) {
      const dupNames = duplicates
        .map((id) => db.subjects.find((s) => s.id === id)?.name || id)
        .join(', ');
      showFeedback(
        'error',
        `Duplicate assignment prevented for ${dupNames} in the same class, section, and academic year.`,
      );
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const newRecords: TeacherSubjectAssignment[] = selectedSubjectIds.map(
      (subId, idx) => ({
        id: `asg-${Date.now()}-${idx}`,
        academicYearId,
        teacherId,
        classId,
        sectionId,
        subjectId: subId,
        assignmentType,
        periodSlot,
        createdBy: 'Admin',
        createdDate: today,
      }),
    );

    const nextAssignments = [...db.teacher_subject_assignments, ...newRecords];
    onUpdateAssignments(nextAssignments);
    setSelectedSubjectIds([]);
    const teacherName =
      db.teachers.find((t) => t.id === teacherId)?.name || 'Teacher';
    showFeedback(
      'success',
      `Assigned ${newRecords.length} subject${newRecords.length > 1 ? 's' : ''} to ${teacherName} successfully.`,
    );
  };

  const openEditModal = (asg: TeacherSubjectAssignment) => {
    if (!isAdmin) return;
    setEditingAssignment(asg);
    setEditTeacherId(asg.teacherId);
    setEditAssignmentType(asg.assignmentType);
    setEditPeriodSlot(asg.periodSlot || PERIOD_SLOTS[0]);
    setEditAcademicYearId(asg.academicYearId);
  };

  const handleSaveAssignmentEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAssignment || !isAdmin) return;

    const duplicate = db.teacher_subject_assignments.find(
      (a) =>
        a.id !== editingAssignment.id &&
        a.academicYearId === editAcademicYearId &&
        a.classId === editingAssignment.classId &&
        a.sectionId === editingAssignment.sectionId &&
        a.subjectId === editingAssignment.subjectId,
    );
    if (duplicate) {
      showFeedback(
        'error',
        'Duplicate assignment exists for this class, section, subject, and academic year.',
      );
      return;
    }

    const updated = db.teacher_subject_assignments.map((a) =>
      a.id === editingAssignment.id
        ? {
            ...a,
            teacherId: editTeacherId,
            assignmentType: editAssignmentType,
            periodSlot: editPeriodSlot,
            academicYearId: editAcademicYearId,
          }
        : a,
    );
    onUpdateAssignments(updated);
    setEditingAssignment(null);
    showFeedback('success', 'Teacher assignment updated successfully.');
  };

  const handleDeleteAssignment = (id: string) => {
    if (!isAdmin) return;
    onUpdateAssignments(
      db.teacher_subject_assignments.filter((a) => a.id !== id),
    );
    setConfirmDeleteAssignmentId(null);
    showFeedback('success', 'Teacher assignment removed.');
  };

  // Teacher CRUD handlers
  const openAddTeacherModal = () => {
    setEditingTeacherId(null);
    setTeacherForm({
      teacherCode: `TCH-${String(db.teachers.length + 1).padStart(3, '0')}`,
      name: '',
      email: '',
      phone: '',
      qualification: '',
      specialization: '',
      joinedDate: db.settings.dateOfIssue || '2082-01-01',
      status: 'active',
    });
    setIsTeacherModalOpen(true);
  };

  const openEditTeacherModal = (teacher: Teacher) => {
    setEditingTeacherId(teacher.id);
    setTeacherForm({
      teacherCode: teacher.teacherCode,
      name: teacher.name,
      email: teacher.email,
      phone: teacher.phone,
      qualification: teacher.qualification,
      specialization: teacher.specialization,
      joinedDate: teacher.joinedDate,
      status: teacher.status,
    });
    setIsTeacherModalOpen(true);
  };

  const handleSaveTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !teacherForm.name.trim()) return;
    const payload: Teacher = {
      id: editingTeacherId || `tch-${Date.now()}`,
      teacherCode:
        teacherForm.teacherCode.trim() || `TCH-${db.teachers.length + 1}`,
      name: teacherForm.name.trim(),
      email: teacherForm.email.trim(),
      phone: teacherForm.phone.trim(),
      qualification: teacherForm.qualification.trim(),
      specialization: teacherForm.specialization.trim(),
      joinedDate: teacherForm.joinedDate.trim(),
      status: teacherForm.status,
    };

    const next = editingTeacherId
      ? db.teachers.map((t) => (t.id === editingTeacherId ? payload : t))
      : [...db.teachers, payload];

    onUpdateTeachers(next);
    if (!editingTeacherId) {
      setTeacherId(payload.id);
    }
    setIsTeacherModalOpen(false);
    showFeedback(
      'success',
      editingTeacherId
        ? `Updated teacher profile for ${payload.name}.`
        : `Registered new teacher ${payload.name}.`,
    );
  };

  const toggleTeacherStatus = (id: string) => {
    if (!isAdmin) return;
    onUpdateTeachers(
      db.teachers.map((t) =>
        t.id === id
          ? { ...t, status: t.status === 'active' ? 'inactive' : 'active' }
          : t,
      ),
    );
  };

  // Filtered Assignment Report rows
  const filterClassObj = db.classes.find((c) => c.id === filterClassId);
  const filterClassSubjects = useMemo(() => {
    if (filterClassId === 'all') {
      // Unique subject names or all active subjects
      return db.subjects.filter((s) => s.status === 'active');
    }
    return db.subjects.filter(
      (s) => s.classId === filterClassId && s.status === 'active',
    );
  }, [db.subjects, filterClassId]);

  const enrichedReportRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = db.teacher_subject_assignments
      .map((a) => {
        const cls = db.classes.find((c) => c.id === a.classId);
        const sec = cls?.sections.find((s) => s.id === a.sectionId);
        const sub = db.subjects.find((s) => s.id === a.subjectId);
        const tch = db.teachers.find((t) => t.id === a.teacherId);
        return {
          assignment: a,
          classOrder: cls?.order ?? 99,
          className: cls?.name || a.classId,
          sectionName: sec?.name || a.sectionId,
          subjectName: sub?.name || a.subjectId,
          subjectCode: sub?.code || '',
          teacherName: tch?.name || a.teacherId,
          assignmentTypeLabel:
            a.assignmentType === 'class_teacher'
              ? 'Class Teacher'
              : 'Subject Teacher',
        };
      })
      .filter((row) => {
        if (
          filterYear !== 'all' &&
          row.assignment.academicYearId !== filterYear
        ) {
          return false;
        }
        if (filterClassId !== 'all' && row.assignment.classId !== filterClassId)
          return false;
        if (
          filterSectionId !== 'all' &&
          row.assignment.sectionId !== filterSectionId
        )
          return false;
        if (
          filterSubjectId !== 'all' &&
          row.assignment.subjectId !== filterSubjectId
        )
          return false;
        if (
          filterTeacherId !== 'all' &&
          row.assignment.teacherId !== filterTeacherId
        )
          return false;
        if (q) {
          const hay =
            `${row.className} ${row.sectionName} ${row.subjectName} ${row.subjectCode} ${row.teacherName} ${row.assignment.academicYearId} ${row.assignment.id}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.assignment.academicYearId !== b.assignment.academicYearId) {
          return b.assignment.academicYearId.localeCompare(
            a.assignment.academicYearId,
          );
        }
        if (a.classOrder !== b.classOrder) return a.classOrder - b.classOrder;
        if (a.sectionName !== b.sectionName)
          return a.sectionName.localeCompare(b.sectionName);
        return a.subjectName.localeCompare(b.subjectName);
      });

    return list.map((row, idx) => ({
      ...row,
      sn: idx + 1,
    }));
  }, [
    db.teacher_subject_assignments,
    db.classes,
    db.subjects,
    db.teachers,
    filterYear,
    filterClassId,
    filterSectionId,
    filterSubjectId,
    filterTeacherId,
    searchQuery,
  ]);

  const handleExportExcel = () => {
    exportTeacherAssignmentsExcel(
      enrichedReportRows.map((r) => ({
        sn: r.sn,
        assignmentId: r.assignment.id,
        className: r.className,
        sectionName: r.sectionName,
        subjectName: r.subjectName,
        subjectCode: r.subjectCode,
        teacherName: r.teacherName,
        assignmentTypeLabel: r.assignmentTypeLabel,
        periodSlot: r.assignment.periodSlot || 'Flexible',
        academicYearId: r.assignment.academicYearId,
        createdBy: r.assignment.createdBy,
        createdDate: r.assignment.createdDate,
      })),
      filterYear === 'all' ? 'All_Years' : filterYear,
    );
  };

  const handleExportPdf = () => {
    const summaryParts = [
      `Academic Year: ${filterYear === 'all' ? 'All Years' : filterYear}`,
      filterClassId !== 'all'
        ? `Class: ${filterClassObj?.name || filterClassId}`
        : 'All Classes',
      `Total Assignments: ${enrichedReportRows.length}`,
    ];
    downloadTeacherAssignmentsPDF(
      enrichedReportRows.map((r) => ({
        sn: r.sn,
        className: r.className,
        sectionName: r.sectionName,
        subjectName: r.subjectName,
        teacherName: r.teacherName,
        assignmentTypeLabel: r.assignmentTypeLabel,
        periodSlot: r.assignment.periodSlot || 'Flexible',
        academicYearId: r.assignment.academicYearId,
      })),
      db.settings,
      summaryParts.join(' · '),
    );
  };

  return (
    <div className="space-y-5">
      {/* Pink & White Admin Header Banner */}
      <div className="bg-white border border-pink-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 no-print">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-pink-700 font-semibold mb-1">
            <span>Central Admin Authority</span>
            <span aria-hidden="true">·</span>
            <span>Academic Year {dashboardYear}</span>
            <span aria-hidden="true">·</span>
            <span>Role-Based Teacher Integration</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            Subject Teacher Assignment &amp; Management
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Assign registered teachers to class-wise &amp; section-wise subjects, prevent duplicate allocations, and automatically sync Teacher Dashboards.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center p-1 bg-pink-50 border border-pink-200 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveTab('assign_report')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'assign_report'
                  ? 'bg-pink-700 text-white'
                  : 'text-pink-900 hover:bg-pink-100'
              }`}
            >
              Assign &amp; Report
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('unassigned')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'unassigned'
                  ? 'bg-pink-700 text-white'
                  : 'text-pink-900 hover:bg-pink-100'
              }`}
            >
              Unassigned ({dashboardMetrics.totalUnassignedSlots})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('teachers')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'teachers'
                  ? 'bg-pink-700 text-white'
                  : 'text-pink-900 hover:bg-pink-100'
              }`}
            >
              Teachers ({db.teachers.length})
            </button>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={openAddTeacherModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-pink-900 bg-pink-50 border border-pink-300 hover:bg-pink-100 rounded-lg transition-colors whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4" />
              Register Teacher
            </button>
          )}
        </div>
      </div>

      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2.5 text-xs text-amber-900 font-medium no-print">
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            Read-only view: Only Admin can create, edit, or delete teacher subject assignments.
          </span>
        </div>
      )}

      {feedback && (
        <div
          className={`rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs font-semibold border no-print ${
            feedback.type === 'success'
              ? 'bg-pink-50 border-pink-300 text-pink-950'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-pink-700 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-500 hover:text-slate-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 5-Card Assignment Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 no-print">
        <div className="bg-white border border-pink-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-pink-900 mb-2">
            <span>Registered Teachers</span>
            <Users className="w-4 h-4 text-pink-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {dashboardMetrics.totalTeachers}
          </div>
          <div className="text-xs text-slate-500 mt-1 tabular-nums">
            {dashboardMetrics.activeTeachersCount} active faculty
          </div>
        </div>

        <div className="bg-white border border-pink-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-pink-900 mb-2">
            <span>Total Subjects</span>
            <BookOpen className="w-4 h-4 text-pink-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {dashboardMetrics.totalSubjects}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Configured across classes
          </div>
        </div>

        <div className="bg-white border border-pink-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-pink-900 mb-2">
            <span>Assigned Subjects</span>
            <UserCheck className="w-4 h-4 text-pink-600" />
          </div>
          <div className="text-2xl font-bold text-pink-700 font-mono tabular-nums">
            {dashboardMetrics.totalAssignedInYear}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            In {dashboardYear}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('unassigned')}
          className="text-left bg-white border border-pink-200 hover:border-pink-400 rounded-xl p-4 transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-pink-900 mb-2">
            <span>Unassigned Subjects</span>
            <ClipboardList className="w-4 h-4 text-pink-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {dashboardMetrics.totalUnassignedSlots}
          </div>
          <div className="text-xs text-pink-700 mt-1 font-medium">
            Click to review unassigned slots
          </div>
        </button>

        <div className="bg-white border border-pink-200 rounded-xl p-4 col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-xs font-semibold text-pink-900 mb-2">
            <span>Classes &amp; Sections</span>
            <Users className="w-4 h-4 text-pink-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {dashboardMetrics.totalClasses} / {dashboardMetrics.totalSections}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Nursery through Grade 12
          </div>
        </div>
      </div>

      {activeTab === 'assign_report' && (
        <>
          {/* Subject Teacher Assignment Form (Admin Only) */}
          {isAdmin && (
            <form
              onSubmit={handleAssignSubjects}
              className="bg-white border border-pink-200 rounded-xl overflow-hidden no-print"
            >
              <div className="px-5 py-3.5 bg-pink-50/80 border-b border-pink-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-pink-950">
                    Assign Subject Teacher
                  </h3>
                  <p className="text-xs text-pink-800">
                    Select Academic Year, Class, Section, Teacher, and one or multiple Subjects.
                  </p>
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-pink-700 text-white text-xs font-semibold rounded-lg hover:bg-pink-800 transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  Save Assignment ({selectedSubjectIds.length})
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Academic Year *
                    </label>
                    <select
                      value={academicYearId}
                      onChange={(e) => {
                        setAcademicYearId(e.target.value);
                        setSelectedSubjectIds([]);
                      }}
                      className="w-full px-3 py-2 text-sm border border-pink-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-pink-600"
                    >
                      {academicYearOptions.map((yr) => (
                        <option key={yr} value={yr}>
                          {yr}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Class *
                    </label>
                    <select
                      value={classId}
                      onChange={(e) => {
                        const nextCls = db.classes.find(
                          (c) => c.id === e.target.value,
                        );
                        setClassId(e.target.value);
                        setSectionId(nextCls?.sections[0]?.id || '');
                        setSelectedSubjectIds([]);
                      }}
                      className="w-full px-3 py-2 text-sm border border-pink-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-pink-600"
                    >
                      {db.classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Section *
                    </label>
                    <select
                      value={sectionId}
                      onChange={(e) => {
                        setSectionId(e.target.value);
                        setSelectedSubjectIds([]);
                      }}
                      className="w-full px-3 py-2 text-sm border border-pink-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-pink-600"
                    >
                      {selectedClassObj?.sections.map((sec) => (
                        <option key={sec.id} value={sec.id}>
                          Section {sec.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Subject Teacher *
                    </label>
                    <select
                      value={teacherId}
                      onChange={(e) => setTeacherId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-pink-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-pink-600"
                    >
                      {activeTeachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.teacherCode})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Assignment Role *
                    </label>
                    <select
                      value={assignmentType}
                      onChange={(e) =>
                        setAssignmentType(e.target.value as AssignmentType)
                      }
                      className="w-full px-3 py-2 text-sm border border-pink-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-pink-600"
                    >
                      <option value="subject_teacher">Subject Teacher</option>
                      <option value="class_teacher">Class Teacher</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Period Slot
                    </label>
                    <select
                      value={periodSlot}
                      onChange={(e) => setPeriodSlot(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-pink-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-pink-600"
                    >
                      {PERIOD_SLOTS.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Live Conflict Warnings */}
                {conflictWarnings.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                    {conflictWarnings.map((w, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 text-xs text-amber-900 font-medium"
                      >
                        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Multi-Subject Picker for Selected Class & Section */}
                <div className="border border-pink-200 rounded-lg p-3.5 bg-pink-50/40">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div>
                      <span className="text-xs font-bold text-pink-950">
                        Select Subjects for {selectedClassObj?.name} Section{' '}
                        {selectedClassObj?.sections.find((s) => s.id === sectionId)
                          ?.name || ''}{' '}
                        ({academicYearId})
                      </span>
                      <span className="text-xs text-slate-500 ml-2">
                        Already assigned subjects are locked to prevent duplicates.
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={selectAllUnassignedInClass}
                        className="px-2.5 py-1 text-xs font-medium text-pink-900 bg-white border border-pink-300 rounded hover:bg-pink-100"
                      >
                        Select Unassigned
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedSubjectIds([])}
                        className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {classSubjects.length === 0 ? (
                    <div className="text-xs text-slate-500 py-3">
                      No active subjects configured for {selectedClassObj?.name}. Add subjects in Subject Management first.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {classSubjects.map((sub) => {
                        const existingAsg = slotAssignmentsBySubject.get(sub.id);
                        const existingTeacher = existingAsg
                          ? db.teachers.find(
                              (t) => t.id === existingAsg.teacherId,
                            )
                          : undefined;
                        const checked = selectedSubjectIds.includes(sub.id);

                        return (
                          <label
                            key={sub.id}
                            className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs transition-colors ${
                              existingAsg
                                ? 'bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed'
                                : checked
                                  ? 'bg-pink-100/70 border-pink-400 text-pink-950 cursor-pointer'
                                  : 'bg-white border-pink-200 hover:border-pink-400 text-slate-900 cursor-pointer'
                            }`}
                          >
                            <input
                              type="checkbox"
                              disabled={Boolean(existingAsg)}
                              checked={checked}
                              onChange={() => toggleSubjectSelection(sub.id)}
                              className="mt-0.5 rounded border-pink-300 text-pink-700 focus:ring-pink-600"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold truncate">
                                {sub.name}
                              </div>
                              <div className="text-[11px] font-mono text-slate-500">
                                {sub.code}
                              </div>
                              {existingAsg && (
                                <div className="text-[11px] text-pink-800 font-medium mt-0.5 truncate">
                                  Assigned: {existingTeacher?.name || 'Teacher'}
                                </div>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </form>
          )}

          {/* Assignment Report & History Table */}
          <div className="bg-white border border-pink-200 rounded-xl overflow-hidden print-only-container">
            <div className="px-5 py-4 border-b border-pink-200 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 no-print">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Subject Teacher Assignment Report
                </h3>
                <p className="text-xs text-slate-500">
                  Search, filter by academic year, class, section, subject, or teacher, and export to Excel or PDF.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-pink-900 bg-pink-50 border border-pink-200 hover:bg-pink-100 rounded-lg whitespace-nowrap"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={enrichedReportRows.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-pink-900 bg-pink-50 border border-pink-200 hover:bg-pink-100 rounded-lg disabled:opacity-50 whitespace-nowrap"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Export Excel
                </button>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={enrichedReportRows.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-pink-700 hover:bg-pink-800 rounded-lg disabled:opacity-50 whitespace-nowrap"
                >
                  <FileDown className="w-4 h-4" />
                  Export PDF
                </button>
              </div>
            </div>

            {/* Print-Only Header */}
            <div className="hidden print:block text-center py-3 border-b border-slate-300">
              <div className="text-base font-bold uppercase">
                {db.settings.schoolName}
              </div>
              <div className="text-xs">
                {db.settings.address} · School IEMIS Code: {db.settings.iemisCode}
              </div>
              <div className="text-sm font-bold mt-1">
                SUBJECT TEACHER ASSIGNMENT REPORT ({filterYear === 'all' ? 'All Academic Years' : filterYear})
              </div>
            </div>

            {/* Filters Bar */}
            <div className="p-4 bg-pink-50/40 border-b border-pink-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 no-print">
              <div className="relative">
                <Search className="w-4 h-4 text-pink-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search teacher, subject, ID..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-pink-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-pink-600"
                />
              </div>

              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                aria-label="Filter by Academic Year"
                className="px-3 py-1.5 text-xs border border-pink-200 rounded-lg bg-white"
              >
                <option value="all">All Academic Years (History)</option>
                {academicYearOptions.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>

              <select
                value={filterClassId}
                onChange={(e) => {
                  setFilterClassId(e.target.value);
                  setFilterSectionId('all');
                  setFilterSubjectId('all');
                }}
                aria-label="Filter by Class"
                className="px-3 py-1.5 text-xs border border-pink-200 rounded-lg bg-white"
              >
                <option value="all">All Classes</option>
                {db.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={filterSectionId}
                onChange={(e) => setFilterSectionId(e.target.value)}
                aria-label="Filter by Section"
                className="px-3 py-1.5 text-xs border border-pink-200 rounded-lg bg-white"
              >
                <option value="all">All Sections</option>
                {(filterClassObj?.sections || []).map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    Section {sec.name}
                  </option>
                ))}
              </select>

              <select
                value={filterSubjectId}
                onChange={(e) => setFilterSubjectId(e.target.value)}
                aria-label="Filter by Subject"
                className="px-3 py-1.5 text-xs border border-pink-200 rounded-lg bg-white"
              >
                <option value="all">All Subjects</option>
                {filterClassSubjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name} ({sub.code})
                  </option>
                ))}
              </select>

              <select
                value={filterTeacherId}
                onChange={(e) => setFilterTeacherId(e.target.value)}
                aria-label="Filter by Teacher"
                className="px-3 py-1.5 text-xs border border-pink-200 rounded-lg bg-white"
              >
                <option value="all">All Teachers</option>
                {db.teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-pink-100 text-xs font-semibold text-pink-950 border-b border-pink-200">
                  <tr>
                    <th className="px-4 py-3 text-center w-14">S.N.</th>
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3 text-center">Section</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Teacher Name</th>
                    <th className="px-4 py-3">Academic Year</th>
                    <th className="px-4 py-3 text-right no-print">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pink-100">
                  {enrichedReportRows.map((row) => (
                    <tr
                      key={row.assignment.id}
                      className="hover:bg-pink-50/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-center font-mono tabular-nums text-slate-600">
                        {row.sn}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                        {row.className}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-slate-700">
                        {row.sectionName}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">
                          {row.subjectName}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {row.subjectCode}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-pink-950">
                          {row.teacherName}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {row.assignmentTypeLabel}
                          {row.assignment.periodSlot
                            ? ` · ${row.assignment.periodSlot}`
                            : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700 whitespace-nowrap">
                        {row.assignment.academicYearId}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap no-print">
                        {isAdmin ? (
                          confirmDeleteAssignmentId === row.assignment.id ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteAssignment(row.assignment.id)
                                }
                                className="px-2 py-1 text-xs font-semibold text-white bg-red-600 rounded hover:bg-red-700"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmDeleteAssignmentId(null)
                                }
                                className="px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditModal(row.assignment)}
                                aria-label={`Edit assignment ${row.subjectName}`}
                                className="p-1.5 text-slate-500 hover:text-pink-700 rounded hover:bg-pink-50"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmDeleteAssignmentId(
                                    row.assignment.id,
                                  )
                                }
                                aria-label={`Delete assignment ${row.subjectName}`}
                                className="p-1.5 text-slate-500 hover:text-red-700 rounded hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )
                        ) : (
                          <span className="text-xs text-slate-400">Locked</span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {enrichedReportRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-slate-500 text-sm"
                      >
                        No teacher subject assignments match the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Unassigned Subjects Tab */}
      {activeTab === 'unassigned' && (
        <div className="bg-white border border-pink-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-pink-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-pink-50/50">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Unassigned Subjects ({dashboardYear})
              </h3>
              <p className="text-xs text-slate-600">
                Class &amp; section subject slots that do not yet have an assigned subject teacher.
              </p>
            </div>
            <select
              value={filterYear === 'all' ? dashboardYear : filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="px-3 py-1.5 text-xs border border-pink-200 rounded-lg bg-white"
            >
              {academicYearOptions.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-pink-100 text-xs font-semibold text-pink-950 border-b border-pink-200">
                <tr>
                  <th className="px-4 py-3">S.N.</th>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Section</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pink-100">
                {dashboardMetrics.unassignedSlots.map((slot, idx) => (
                  <tr
                    key={`${slot.classId}-${slot.sectionId}-${slot.subjectId}`}
                    className="hover:bg-pink-50/50"
                  >
                    <td className="px-4 py-2.5 font-mono tabular-nums text-slate-500">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {slot.className}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-700">
                      {slot.sectionName}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-slate-900">
                      {slot.subjectName}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                      {slot.subjectCode}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            setAcademicYearId(dashboardYear);
                            setClassId(slot.classId);
                            setSectionId(slot.sectionId);
                            setSelectedSubjectIds([slot.subjectId]);
                            setActiveTab('assign_report');
                          }}
                          className="px-3 py-1 text-xs font-semibold text-white bg-pink-700 hover:bg-pink-800 rounded-md whitespace-nowrap"
                        >
                          Assign Teacher
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {dashboardMetrics.unassignedSlots.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-slate-500 text-sm"
                    >
                      All active class &amp; section subjects have assigned teachers in {dashboardYear}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Registered Teachers Tab */}
      {activeTab === 'teachers' && (
        <div className="bg-white border border-pink-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-pink-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-pink-50/50">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Registered Teachers Directory
              </h3>
              <p className="text-xs text-slate-600">
                Manage school faculty eligible for Subject Teacher &amp; Class Teacher assignments.
              </p>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={openAddTeacherModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-pink-700 hover:bg-pink-800 rounded-lg whitespace-nowrap"
              >
                <UserPlus className="w-4 h-4" />
                Add Teacher
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-pink-100 text-xs font-semibold text-pink-950 border-b border-pink-200">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Teacher Name</th>
                  <th className="px-4 py-3">Qualification &amp; Specialization</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3 text-right">
                    Assignments ({dashboardYear})
                  </th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pink-100">
                {db.teachers.map((t) => {
                  const assignedCount =
                    db.teacher_subject_assignments.filter(
                      (a) =>
                        a.teacherId === t.id &&
                        a.academicYearId === dashboardYear,
                    ).length;
                  return (
                    <tr key={t.id} className="hover:bg-pink-50/50">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-pink-900">
                        {t.teacherCode}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">
                          {t.name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {t.email}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-800 font-medium">
                          {t.qualification}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {t.specialization}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">
                        {t.phone}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-pink-700">
                        {assignedCount}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => toggleTeacherStatus(t.id)}
                          className={`text-xs font-semibold hover:underline ${
                            t.status === 'active'
                              ? 'text-emerald-700'
                              : 'text-red-700'
                          }`}
                        >
                          {t.status === 'active' ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => openEditTeacherModal(t)}
                            aria-label={`Edit ${t.name}`}
                            className="p-1.5 text-slate-500 hover:text-pink-700 rounded hover:bg-pink-50"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Assignment Modal */}
      {editingAssignment && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 no-print">
          <div className="bg-white border border-pink-200 rounded-xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-5 py-4 bg-pink-50 border-b border-pink-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-pink-950">
                Update Subject Assignment
              </h3>
              <button
                type="button"
                onClick={() => setEditingAssignment(null)}
                className="p-1 text-slate-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveAssignmentEdit} className="p-5 space-y-4">
              <div className="bg-pink-50/50 border border-pink-200 rounded-lg p-3 text-xs space-y-1">
                <div>
                  <span className="font-semibold text-slate-700">Class: </span>
                  {
                    db.classes.find((c) => c.id === editingAssignment.classId)
                      ?.name
                  }{' '}
                  Section{' '}
                  {
                    db.classes
                      .find((c) => c.id === editingAssignment.classId)
                      ?.sections.find(
                        (s) => s.id === editingAssignment.sectionId,
                      )?.name
                  }
                </div>
                <div>
                  <span className="font-semibold text-slate-700">
                    Subject:{' '}
                  </span>
                  {
                    db.subjects.find(
                      (s) => s.id === editingAssignment.subjectId,
                    )?.name
                  }
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Academic Year
                </label>
                <select
                  value={editAcademicYearId}
                  onChange={(e) => setEditAcademicYearId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-pink-200 rounded-lg bg-white"
                >
                  {academicYearOptions.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Subject Teacher
                </label>
                <select
                  value={editTeacherId}
                  onChange={(e) => setEditTeacherId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-pink-200 rounded-lg bg-white"
                >
                  {activeTeachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.teacherCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assignment Role
                  </label>
                  <select
                    value={editAssignmentType}
                    onChange={(e) =>
                      setEditAssignmentType(e.target.value as AssignmentType)
                    }
                    className="w-full px-3 py-2 text-sm border border-pink-200 rounded-lg bg-white"
                  >
                    <option value="subject_teacher">Subject Teacher</option>
                    <option value="class_teacher">Class Teacher</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Period Slot
                  </label>
                  <select
                    value={editPeriodSlot}
                    onChange={(e) => setEditPeriodSlot(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-pink-200 rounded-lg bg-white"
                  >
                    {PERIOD_SLOTS.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-pink-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingAssignment(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-pink-700 rounded-lg hover:bg-pink-800"
                >
                  Update Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register / Edit Teacher Modal */}
      {isTeacherModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 no-print">
          <div className="bg-white border border-pink-200 rounded-xl w-full max-w-lg shadow-xl overflow-hidden">
            <div className="px-5 py-4 bg-pink-50 border-b border-pink-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-pink-950">
                {editingTeacherId ? 'Edit Teacher Profile' : 'Register New Teacher'}
              </h3>
              <button
                type="button"
                onClick={() => setIsTeacherModalOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveTeacher} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Teacher Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={teacherForm.teacherCode}
                    onChange={(e) =>
                      setTeacherForm({
                        ...teacherForm,
                        teacherCode: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-pink-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={teacherForm.name}
                    onChange={(e) =>
                      setTeacherForm({ ...teacherForm, name: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-pink-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={teacherForm.email}
                    onChange={(e) =>
                      setTeacherForm({ ...teacherForm, email: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-pink-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    value={teacherForm.phone}
                    onChange={(e) =>
                      setTeacherForm({ ...teacherForm, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-pink-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Qualification
                  </label>
                  <input
                    type="text"
                    value={teacherForm.qualification}
                    onChange={(e) =>
                      setTeacherForm({
                        ...teacherForm,
                        qualification: e.target.value,
                      })
                    }
                    placeholder="M.Sc. Mathematics"
                    className="w-full px-3 py-2 text-sm border border-pink-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Specialization
                  </label>
                  <input
                    type="text"
                    value={teacherForm.specialization}
                    onChange={(e) =>
                      setTeacherForm({
                        ...teacherForm,
                        specialization: e.target.value,
                      })
                    }
                    placeholder="Mathematics & Science"
                    className="w-full px-3 py-2 text-sm border border-pink-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Joined Date (B.S.)
                  </label>
                  <input
                    type="text"
                    value={teacherForm.joinedDate}
                    onChange={(e) =>
                      setTeacherForm({
                        ...teacherForm,
                        joinedDate: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-pink-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={teacherForm.status}
                    onChange={(e) =>
                      setTeacherForm({
                        ...teacherForm,
                        status: e.target.value as ActiveStatus,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-pink-200 rounded-lg bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-pink-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTeacherModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-pink-700 rounded-lg hover:bg-pink-800"
                >
                  Save Teacher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
