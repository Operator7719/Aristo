import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  FileDown,
  FileSpreadsheet,
  KeyRound,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import {
  PassportStatus,
  SchoolDatabase,
  Teacher,
  TeacherPassport,
  UserRole,
} from '../types';
import { exportTeacherPassportsExcel } from '../utils/excelHelper';
import { downloadTeacherPassportsPDF } from '../utils/pdfGenerator';
import { hashTeacherPasscode } from '../utils/passwordSecurity';

interface TeacherPassportViewProps {
  db: SchoolDatabase;
  userRole: UserRole;
  onUpdatePassports: (passports: TeacherPassport[]) => void;
}

const PASSPORT_TITLES = [
  'Subject Faculty Passport',
  'Class Teacher Passport',
  'Primary Faculty Passport',
  'Senior Coordinator Passport',
  'Exam Duty Passport',
];

function generatePassportNumber(existing: TeacherPassport[], academicYear: string): string {
  const yrDigits = academicYear.replace(/[^0-9]/g, '') || '2082';
  let maxSeq = existing.length;
  for (const p of existing) {
    const match = p.passportNumber.match(/(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (!Number.isNaN(n) && n > maxSeq) maxSeq = n;
    }
  }
  let next = maxSeq + 1;
  let candidate = `ARISTO-PP-${yrDigits}-${String(next).padStart(3, '0')}`;
  const existingSet = new Set(existing.map((p) => p.passportNumber.toLowerCase()));
  while (existingSet.has(candidate.toLowerCase())) {
    next += 1;
    candidate = `ARISTO-PP-${yrDigits}-${String(next).padStart(3, '0')}`;
  }
  return candidate;
}

function generateStrongPasscode(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const c1 = chars[Math.floor(Math.random() * chars.length)];
  const c2 = chars[Math.floor(Math.random() * chars.length)];
  return `Aristo@${c1}${c2}${num}`;
}

function suggestUsername(teacher: Teacher, existing: TeacherPassport[]): string {
  const base = teacher.name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join('.');
  const cleanBase = base || teacher.teacherCode.toLowerCase();
  const used = new Set(existing.map((p) => p.username.toLowerCase()));
  if (!used.has(cleanBase)) return cleanBase;
  let i = 2;
  while (used.has(`${cleanBase}${i}`)) i += 1;
  return `${cleanBase}${i}`;
}

export const TeacherPassportView: React.FC<TeacherPassportViewProps> = ({
  db,
  userRole,
  onUpdatePassports,
}) => {
  const isAdmin = userRole === 'admin';
  const passports = db.teacher_passports || [];

  // Create Passport Form State
  const [passportNumber, setPassportNumber] = useState<string>(() =>
    generatePassportNumber(passports, db.settings.academicYear || '2082 B.S'),
  );
  const [passportTitle, setPassportTitle] = useState<string>(PASSPORT_TITLES[0]);
  const [username, setUsername] = useState<string>('');
  const [passcode, setPasscode] = useState<string>(() => generateStrongPasscode());
  const [showCreatePasscode, setShowCreatePasscode] = useState(false);
  const [issuedDate, setIssuedDate] = useState<string>(
    db.settings.dateOfIssue || '2082-01-15',
  );
  const [expiryDate, setExpiryDate] = useState<string>('2083-12-30');
  const [createStatus, setCreateStatus] = useState<PassportStatus>('active');
  const [createTeacherId, setCreateTeacherId] = useState<string>('');
  const [replaceOnCreate, setReplaceOnCreate] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');

  // Quick Assign Panel State
  const [assignPassportId, setAssignPassportId] = useState<string>('');
  const [assignTargetTeacherId, setAssignTargetTeacherId] = useState<string>('');
  const [replaceOnAssign, setReplaceOnAssign] = useState<boolean>(true);

  // Table Filters & UI Helpers
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAssignment, setFilterAssignment] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | PassportStatus>('all');
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Modals State
  const [editingPassport, setEditingPassport] = useState<TeacherPassport | null>(null);
  const [editForm, setEditForm] = useState<{
    passportNumber: string;
    passportTitle: string;
    username: string;
    passcode: string;
    issuedDate: string;
    expiryDate: string;
    status: PassportStatus;
    assignedTeacherId: string;
    notes: string;
  }>({
    passportNumber: '',
    passportTitle: PASSPORT_TITLES[0],
    username: '',
    passcode: '',
    issuedDate: '',
    expiryDate: '',
    status: 'active',
    assignedTeacherId: '',
    notes: '',
  });
  const [assignModalPassport, setAssignModalPassport] =
    useState<TeacherPassport | null>(null);
  const [modalTeacherId, setModalTeacherId] = useState<string>('');
  const [cardPreviewPassport, setCardPreviewPassport] =
    useState<TeacherPassport | null>(null);

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  const teacherById = useMemo(() => {
    const map = new Map<string, Teacher>();
    for (const t of db.teachers) map.set(t.id, t);
    return map;
  }, [db.teachers]);

  const activePassportByTeacher = useMemo(() => {
    const map = new Map<string, TeacherPassport>();
    for (const p of passports) {
      if (p.assignedTeacherId && p.status === 'active') {
        map.set(p.assignedTeacherId, p);
      }
    }
    return map;
  }, [passports]);

  const metrics = useMemo(() => {
    const assigned = passports.filter((p) => Boolean(p.assignedTeacherId));
    const unassigned = passports.filter((p) => !p.assignedTeacherId);
    const activeTeachers = db.teachers.filter((t) => t.status === 'active');
    const coveredTeacherIds = new Set(
      passports
        .filter((p) => p.assignedTeacherId && p.status === 'active')
        .map((p) => p.assignedTeacherId as string),
    );
    const teachersWithoutPassport = activeTeachers.filter(
      (t) => !coveredTeacherIds.has(t.id),
    );
    return {
      totalPassports: passports.length,
      assignedCount: assigned.length,
      unassignedCount: unassigned.length,
      coveredTeachersCount: coveredTeacherIds.size,
      teachersWithoutPassport,
    };
  }, [passports, db.teachers]);

  const sortedPassportsForDropdown = useMemo(() => {
    const unassigned = passports.filter((p) => !p.assignedTeacherId);
    const assigned = passports.filter((p) => Boolean(p.assignedTeacherId));
    return [...unassigned, ...assigned];
  }, [passports]);

  const effectiveAssignPassportId =
    assignPassportId && passports.some((p) => p.id === assignPassportId)
      ? assignPassportId
      : sortedPassportsForDropdown[0]?.id || '';

  const effectiveAssignTeacherId =
    assignTargetTeacherId &&
    db.teachers.some((t) => t.id === assignTargetTeacherId)
      ? assignTargetTeacherId
      : metrics.teachersWithoutPassport[0]?.id || db.teachers[0]?.id || '';

  const filteredPassports = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return passports.filter((p) => {
      if (filterAssignment === 'assigned' && !p.assignedTeacherId) return false;
      if (filterAssignment === 'unassigned' && p.assignedTeacherId) return false;
      if (filterStatus !== 'all' && p.status !== filterStatus) return false;
      if (q) {
        const teacher = p.assignedTeacherId
          ? teacherById.get(p.assignedTeacherId)
          : undefined;
        const haystack = [
          p.passportNumber,
          p.passportTitle,
          p.username,
          teacher?.name || '',
          teacher?.teacherCode || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [passports, filterAssignment, filterStatus, searchQuery, teacherById]);

  const handleCreateTeacherChange = (nextTeacherId: string) => {
    setCreateTeacherId(nextTeacherId);
    if (nextTeacherId) {
      const t = teacherById.get(nextTeacherId);
      if (t && (!username.trim() || username.startsWith('faculty.slot'))) {
        setUsername(suggestUsername(t, passports));
      }
    }
  };

  const handleCreatePassport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    const cleanNum = passportNumber.trim();
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = passcode.trim();

    if (!cleanNum || !cleanUser || !cleanPass) {
      showFeedback(
        'error',
        'Passport Number, Username, and Passcode are all required.',
      );
      return;
    }

    if (
      passports.some(
        (p) => p.passportNumber.trim().toLowerCase() === cleanNum.toLowerCase(),
      )
    ) {
      showFeedback(
        'error',
        `Passport Number "${cleanNum}" already exists. Use a unique Passport Number.`,
      );
      return;
    }

    if (
      passports.some(
        (p) => p.username.trim().toLowerCase() === cleanUser.toLowerCase(),
      )
    ) {
      showFeedback(
        'error',
        `Username "${cleanUser}" is already registered on another passport.`,
      );
      return;
    }

    const targetTeacherId = createTeacherId || null;
    if (targetTeacherId && createStatus === 'active') {
      const existingActive = activePassportByTeacher.get(targetTeacherId);
      if (existingActive && !replaceOnCreate) {
        showFeedback(
          'error',
          `${teacherById.get(targetTeacherId)?.name || 'Teacher'} already has active passport ${existingActive.passportNumber}. Enable "Replace existing active passport" to reassign.`,
        );
        return;
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const { passwordSalt, passwordHash } = hashTeacherPasscode(cleanPass);
    const newPassport: TeacherPassport = {
      id: `pp-${Date.now()}`,
      passportNumber: cleanNum,
      passportTitle: passportTitle.trim() || PASSPORT_TITLES[0],
      username: cleanUser,
      passcode: '',
      passwordSalt,
      passwordHash,
      passwordUpdatedDate: today,
      passwordUpdatedBy: 'Admin',
      assignedTeacherId: targetTeacherId,
      issuedDate: issuedDate || today,
      expiryDate: expiryDate || '2083-12-30',
      status: createStatus,
      notes: notes.trim() || undefined,
      createdBy: 'Admin',
      createdDate: today,
      assignedDate: targetTeacherId ? today : undefined,
    };

    let nextPassports = [...passports];
    if (targetTeacherId && createStatus === 'active' && replaceOnCreate) {
      nextPassports = nextPassports.map((p) =>
        p.assignedTeacherId === targetTeacherId && p.status === 'active'
          ? { ...p, assignedTeacherId: null }
          : p,
      );
    }

    nextPassports = [newPassport, ...nextPassports];
    onUpdatePassports(nextPassports);

    const assignedTeacher = targetTeacherId
      ? teacherById.get(targetTeacherId)
      : undefined;
    showFeedback(
      'success',
      assignedTeacher
        ? `Created passport ${newPassport.passportNumber} and assigned it to ${assignedTeacher.name}.`
        : `Created passport ${newPassport.passportNumber} in Unassigned Passport Pool.`,
    );

    setPassportNumber(
      generatePassportNumber(
        nextPassports,
        db.settings.academicYear || '2082 B.S',
      ),
    );
    setUsername('');
    setPasscode(generateStrongPasscode());
    setCreateTeacherId('');
    setNotes('');
  };

  const assignPassportToTeacher = (
    pId: string,
    targetTchId: string | null,
    allowReplace: boolean,
  ) => {
    if (!isAdmin) return false;
    const targetPassport = passports.find((p) => p.id === pId);
    if (!targetPassport) return false;

    if (targetTchId && targetPassport.status === 'active') {
      const existingActive = passports.find(
        (p) =>
          p.id !== pId &&
          p.assignedTeacherId === targetTchId &&
          p.status === 'active',
      );
      if (existingActive && !allowReplace) {
        showFeedback(
          'error',
          `${teacherById.get(targetTchId)?.name || 'Selected teacher'} already holds active passport ${existingActive.passportNumber}. Enable replacement to switch.`,
        );
        return false;
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const updated = passports.map((p) => {
      if (p.id === pId) {
        return {
          ...p,
          assignedTeacherId: targetTchId,
          assignedDate: targetTchId ? today : undefined,
        };
      }
      if (
        targetTchId &&
        allowReplace &&
        targetPassport.status === 'active' &&
        p.assignedTeacherId === targetTchId &&
        p.status === 'active'
      ) {
        return { ...p, assignedTeacherId: null };
      }
      return p;
    });

    onUpdatePassports(updated);
    const teacherName = targetTchId ? teacherById.get(targetTchId)?.name : null;
    showFeedback(
      'success',
      teacherName
        ? `Assigned passport ${targetPassport.passportNumber} to ${teacherName}.`
        : `Moved passport ${targetPassport.passportNumber} back to Unassigned Pool.`,
    );
    return true;
  };

  const handleQuickAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveAssignPassportId || !effectiveAssignTeacherId) {
      showFeedback('error', 'Select both a passport and an individual teacher.');
      return;
    }
    assignPassportToTeacher(
      effectiveAssignPassportId,
      effectiveAssignTeacherId,
      replaceOnAssign,
    );
  };

  const openEditModal = (p: TeacherPassport) => {
    setEditingPassport(p);
    setEditForm({
      passportNumber: p.passportNumber,
      passportTitle: p.passportTitle,
      username: p.username,
      passcode: p.passcode,
      issuedDate: p.issuedDate,
      expiryDate: p.expiryDate,
      status: p.status,
      assignedTeacherId: p.assignedTeacherId || '',
      notes: p.notes || '',
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !editingPassport) return;
    const cleanNum = editForm.passportNumber.trim();
    const cleanUser = editForm.username.trim().toLowerCase();
    const cleanPass = editForm.passcode.trim();
    if (!cleanNum || !cleanUser || (!cleanPass && !editingPassport.passwordHash)) {
      showFeedback('error', 'Passport Number, Username, and Passcode cannot be empty.');
      return;
    }
    if (
      passports.some(
        (p) =>
          p.id !== editingPassport.id &&
          p.passportNumber.trim().toLowerCase() === cleanNum.toLowerCase(),
      )
    ) {
      showFeedback('error', `Passport Number "${cleanNum}" is already in use.`);
      return;
    }
    if (
      passports.some(
        (p) =>
          p.id !== editingPassport.id &&
          p.username.trim().toLowerCase() === cleanUser.toLowerCase(),
      )
    ) {
      showFeedback('error', `Username "${cleanUser}" is already in use.`);
      return;
    }

    const nextTeacherId = editForm.assignedTeacherId || null;
    const today = new Date().toISOString().slice(0, 10);
    const nextCreds = cleanPass
      ? {
          passcode: '',
          ...hashTeacherPasscode(cleanPass),
          passwordUpdatedDate: today,
          passwordUpdatedBy: 'Admin',
        }
      : {
          passcode: '',
          passwordHash: editingPassport.passwordHash,
          passwordSalt: editingPassport.passwordSalt,
        };
    const updated = passports.map((p) => {
      if (p.id === editingPassport.id) {
        return {
          ...p,
          passportNumber: cleanNum,
          passportTitle: editForm.passportTitle,
          username: cleanUser,
          ...nextCreds,
          issuedDate: editForm.issuedDate,
          expiryDate: editForm.expiryDate,
          status: editForm.status,
          assignedTeacherId: nextTeacherId,
          assignedDate: nextTeacherId ? p.assignedDate || today : undefined,
          notes: editForm.notes.trim() || undefined,
        };
      }
      if (
        nextTeacherId &&
        editForm.status === 'active' &&
        p.assignedTeacherId === nextTeacherId &&
        p.status === 'active'
      ) {
        return { ...p, assignedTeacherId: null };
      }
      return p;
    });

    onUpdatePassports(updated);
    setEditingPassport(null);
    showFeedback('success', `Updated passport ${cleanNum}.`);
  };

  const toggleStatus = (p: TeacherPassport) => {
    if (!isAdmin) return;
    const nextStatus: PassportStatus = p.status === 'active' ? 'revoked' : 'active';
    const updated = passports.map((item) => {
      if (item.id === p.id) {
        return { ...item, status: nextStatus };
      }
      if (
        nextStatus === 'active' &&
        p.assignedTeacherId &&
        item.assignedTeacherId === p.assignedTeacherId &&
        item.status === 'active'
      ) {
        return { ...item, assignedTeacherId: null };
      }
      return item;
    });
    onUpdatePassports(updated);
    showFeedback(
      'success',
      `Passport ${p.passportNumber} marked as ${nextStatus.toUpperCase()}.`,
    );
  };

  const handleDeletePassport = (id: string) => {
    if (!isAdmin) return;
    const target = passports.find((p) => p.id === id);
    onUpdatePassports(passports.filter((p) => p.id !== id));
    setConfirmDeleteId(null);
    showFeedback(
      'success',
      `Deleted passport ${target?.passportNumber || ''}.`,
    );
  };

  const handleCopyCredentials = (p: TeacherPassport) => {
    const passInfo = p.passwordHash ? 'Hashed (Protected)' : p.passcode;
    const text = `Passport: ${p.passportNumber}\nUsername: ${p.username}\nPasscode: ${passInfo}`;
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedId(p.id);
    setTimeout(() => {
      setCopiedId((prev) => (prev === p.id ? null : prev));
    }, 2000);
  };

  const handleExportExcel = () => {
    const rows = filteredPassports.map((p, idx) => {
      const t = p.assignedTeacherId ? teacherById.get(p.assignedTeacherId) : undefined;
      return {
        sn: idx + 1,
        passportNumber: p.passportNumber,
        passportTitle: p.passportTitle,
        username: p.username,
        teacherCode: t?.teacherCode || '',
        teacherName: t?.name || 'Unassigned Pool',
        issuedDate: p.issuedDate,
        expiryDate: p.expiryDate,
        status: p.status,
        createdDate: p.createdDate,
      };
    });
    exportTeacherPassportsExcel(rows);
  };

  const handleExportPDF = () => {
    const rows = filteredPassports.map((p, idx) => {
      const t = p.assignedTeacherId ? teacherById.get(p.assignedTeacherId) : undefined;
      return {
        sn: idx + 1,
        passportNumber: p.passportNumber,
        passportTitle: p.passportTitle,
        username: p.username,
        teacherName: t ? `${t.name} (${t.teacherCode})` : 'Unassigned Pool',
        issuedDate: p.issuedDate,
        expiryDate: p.expiryDate,
        status: p.status,
      };
    });
    const summary = `Assignment: ${filterAssignment.toUpperCase()} | Status: ${filterStatus.toUpperCase()} | Total Listed: ${rows.length}`;
    downloadTeacherPassportsPDF(rows, db.settings, summary);
  };

  const selectedQuickTeacherExisting = effectiveAssignTeacherId
    ? activePassportByTeacher.get(effectiveAssignTeacherId)
    : undefined;
  const selectedCreateTeacherExisting = createTeacherId
    ? activePassportByTeacher.get(createTeacherId)
    : undefined;

  const cardPreviewTeacher = cardPreviewPassport?.assignedTeacherId
    ? teacherById.get(cardPreviewPassport.assignedTeacherId)
    : undefined;
  const cardPreviewAssignments = useMemo(() => {
    if (!cardPreviewTeacher) return [];
    return db.teacher_subject_assignments
      .filter(
        (a) =>
          a.teacherId === cardPreviewTeacher.id &&
          a.academicYearId === (db.settings.academicYear || '2082 B.S'),
      )
      .map((a) => {
        const cls = db.classes.find((c) => c.id === a.classId);
        const sec = cls?.sections.find((s) => s.id === a.sectionId);
        const sub = db.subjects.find((s) => s.id === a.subjectId);
        return `${cls?.name || ''} ${sec?.name || ''} - ${sub?.name || ''}`;
      });
  }, [cardPreviewTeacher, db]);

  return (
    <div className="space-y-5">
      {/* Admin Authority Notice / Read-Only Guard */}
      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2 text-xs font-medium text-amber-900">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            Admin Authority Required: Only School Administrators can create, assign, or revoke teacher passports.
          </span>
        </div>
      )}

      {feedback && (
        <div
          className={`rounded-xl px-4 py-3 border flex items-center justify-between gap-3 text-sm font-medium no-print ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-500 hover:text-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Pink & White Header Banner */}
      <div className="bg-white border border-pink-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-pink-700 mb-1">
            <KeyRound className="w-4 h-4" />
            <span>Central Admin Security &amp; Access Console</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Teacher Passports &amp; Individual Assignment
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Create official portal passports for faculty members, manage credentials, and assign passports to individual teachers.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-pink-300 text-pink-800 bg-pink-50/70 hover:bg-pink-100 rounded-lg"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Registry
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-pink-300 text-pink-800 bg-white hover:bg-pink-50 rounded-lg"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Export Excel
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-pink-700 hover:bg-pink-800 rounded-lg"
          >
            <FileDown className="w-3.5 h-3.5" />
            Export PDF
          </button>
        </div>
      </div>

      {/* 5-Card Passport Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 no-print">
        <div className="bg-white border border-pink-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-pink-900 mb-2">
            <span>Total Passports</span>
            <CreditCard className="w-4 h-4 text-pink-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {metrics.totalPassports}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Created in registry
          </div>
        </div>

        <div className="bg-white border border-pink-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-pink-900 mb-2">
            <span>Assigned Passports</span>
            <UserCheck className="w-4 h-4 text-pink-600" />
          </div>
          <div className="text-2xl font-bold text-pink-700 font-mono tabular-nums">
            {metrics.assignedCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Linked to teachers
          </div>
        </div>

        <div className="bg-white border border-pink-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-pink-900 mb-2">
            <span>Unassigned Pool</span>
            <KeyRound className="w-4 h-4 text-pink-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {metrics.unassignedCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Ready to assign
          </div>
        </div>

        <div className="bg-white border border-pink-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-pink-900 mb-2">
            <span>Teachers Covered</span>
            <BadgeCheck className="w-4 h-4 text-pink-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums">
            {metrics.coveredTeachersCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Holding active passport
          </div>
        </div>

        <div className="bg-white border border-pink-200 rounded-xl p-4 col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-xs font-semibold text-pink-900 mb-2">
            <span>Awaiting Passport</span>
            <Users className="w-4 h-4 text-pink-600" />
          </div>
          <div className="text-2xl font-bold text-amber-700 font-mono tabular-nums">
            {metrics.teachersWithoutPassport.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Active teachers without one
          </div>
        </div>
      </div>

      {/* Create & Assign Forms Grid */}
      {isAdmin && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 no-print">
          {/* Left: Create Passport Form (7 cols) */}
          <form
            onSubmit={handleCreatePassport}
            className="xl:col-span-7 bg-white border border-pink-200 rounded-xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-pink-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-pink-700" />
                  Create New Teacher Passport
                </h3>
                <p className="text-xs text-slate-500">
                  Issue a new passport directly to an individual teacher or save it in the Unassigned Pool.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-pink-950 mb-1">
                  Passport Number
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    required
                    value={passportNumber}
                    onChange={(e) => setPassportNumber(e.target.value)}
                    placeholder="ARISTO-PP-2082-009"
                    className="w-full px-3 py-2 text-xs font-mono border border-pink-200 rounded-lg focus:outline-none focus:border-pink-500"
                  />
                  <button
                    type="button"
                    title="Auto-generate next Passport Number"
                    onClick={() =>
                      setPassportNumber(
                        generatePassportNumber(
                          passports,
                          db.settings.academicYear || '2082 B.S',
                        ),
                      )
                    }
                    className="px-2.5 py-2 border border-pink-200 rounded-lg text-pink-700 hover:bg-pink-50 shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-pink-950 mb-1">
                  Passport Title / Category
                </label>
                <select
                  value={passportTitle}
                  onChange={(e) => setPassportTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-pink-200 rounded-lg bg-white focus:outline-none focus:border-pink-500"
                >
                  {PASSPORT_TITLES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-pink-950 mb-1">
                  Assign to Individual Teacher (Optional)
                </label>
                <select
                  value={createTeacherId}
                  onChange={(e) => handleCreateTeacherChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-pink-200 rounded-lg bg-white focus:outline-none focus:border-pink-500"
                >
                  <option value="">
                    -- Leave Unassigned (Add to Passport Pool) --
                  </option>
                  {db.teachers
                    .filter((t) => t.status === 'active')
                    .map((t) => {
                      const hasActive = activePassportByTeacher.has(t.id);
                      return (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.teacherCode}){hasActive ? ' — Has Active Passport' : ' — No Passport'}
                        </option>
                      );
                    })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-pink-950 mb-1">
                  Login Username
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. nirmala.chaudhary"
                  className="w-full px-3 py-2 text-xs font-mono border border-pink-200 rounded-lg focus:outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-pink-950 mb-1">
                  Access Passcode / Password
                </label>
                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type={showCreatePasscode ? 'text' : 'password'}
                      required
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      className="w-full pl-3 pr-8 py-2 text-xs font-mono border border-pink-200 rounded-lg focus:outline-none focus:border-pink-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreatePasscode((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pink-700"
                    >
                      {showCreatePasscode ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <button
                    type="button"
                    title="Generate strong passcode"
                    onClick={() => setPasscode(generateStrongPasscode())}
                    className="px-2.5 py-2 border border-pink-200 rounded-lg text-xs font-medium text-pink-700 hover:bg-pink-50 shrink-0"
                  >
                    Generate
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-pink-950 mb-1">
                    Issued Date
                  </label>
                  <input
                    type="text"
                    value={issuedDate}
                    onChange={(e) => setIssuedDate(e.target.value)}
                    placeholder="2082-01-15"
                    className="w-full px-2.5 py-2 text-xs font-mono border border-pink-200 rounded-lg focus:outline-none focus:border-pink-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-pink-950 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="text"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    placeholder="2083-12-30"
                    className="w-full px-2.5 py-2 text-xs font-mono border border-pink-200 rounded-lg focus:outline-none focus:border-pink-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-pink-950 mb-1">
                  Initial Status
                </label>
                <select
                  value={createStatus}
                  onChange={(e) =>
                    setCreateStatus(e.target.value as PassportStatus)
                  }
                  className="w-full px-3 py-2 text-xs border border-pink-200 rounded-lg bg-white focus:outline-none focus:border-pink-500"
                >
                  <option value="active">Active</option>
                  <option value="revoked">Revoked (Hold)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-pink-950 mb-1">
                  Admin Remarks (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Department or duty notes"
                  className="w-full px-3 py-2 text-xs border border-pink-200 rounded-lg focus:outline-none focus:border-pink-500"
                />
              </div>
            </div>

            {selectedCreateTeacherExisting && (
              <div className="bg-pink-50 border border-pink-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-pink-950">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-pink-700 shrink-0" />
                  <span>
                    Selected teacher currently holds{' '}
                    <strong className="font-mono">
                      {selectedCreateTeacherExisting.passportNumber}
                    </strong>
                    .
                  </span>
                </div>
                <label className="inline-flex items-center gap-1.5 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={replaceOnCreate}
                    onChange={(e) => setReplaceOnCreate(e.target.checked)}
                    className="accent-pink-700"
                  />
                  Replace existing active passport
                </label>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-pink-700 hover:bg-pink-800 rounded-lg"
              >
                <Plus className="w-4 h-4" />
                {createTeacherId ? 'Create & Assign Passport' : 'Create Passport'}
              </button>
            </div>
          </form>

          {/* Right: Assign Existing Passport to Individual Teacher (5 cols) */}
          <form
            onSubmit={handleQuickAssignSubmit}
            className="xl:col-span-5 bg-white border border-pink-200 rounded-xl p-5 flex flex-col justify-between space-y-4"
          >
            <div className="space-y-4">
              <div className="border-b border-pink-100 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-pink-700" />
                  Assign Passport to Individual Teacher
                </h3>
                <p className="text-xs text-slate-500">
                  Link any created passport from the pool (or reassign an existing one) to a teacher.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-pink-950 mb-1">
                  1. Select Passport
                </label>
                <select
                  value={effectiveAssignPassportId}
                  onChange={(e) => setAssignPassportId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-pink-200 rounded-lg bg-white focus:outline-none focus:border-pink-500"
                >
                  {sortedPassportsForDropdown.map((p) => {
                    const holder = p.assignedTeacherId
                      ? teacherById.get(p.assignedTeacherId)
                      : undefined;
                    return (
                      <option key={p.id} value={p.id}>
                        {p.passportNumber} ({p.username}) —{' '}
                        {holder ? `Assigned: ${holder.name}` : 'Unassigned Pool'}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-pink-950 mb-1">
                  2. Select Individual Teacher
                </label>
                <select
                  value={effectiveAssignTeacherId}
                  onChange={(e) => setAssignTargetTeacherId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-pink-200 rounded-lg bg-white focus:outline-none focus:border-pink-500"
                >
                  {db.teachers
                    .filter((t) => t.status === 'active')
                    .map((t) => {
                      const activePp = activePassportByTeacher.get(t.id);
                      return (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.teacherCode}) —{' '}
                          {activePp
                            ? `Holds ${activePp.passportNumber}`
                            : 'Needs Passport'}
                        </option>
                      );
                    })}
                </select>
              </div>

              {selectedQuickTeacherExisting &&
                selectedQuickTeacherExisting.id !== effectiveAssignPassportId && (
                  <div className="bg-pink-50 border border-pink-200 rounded-lg p-3 space-y-1.5 text-xs text-pink-950">
                    <div className="flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 text-pink-700 shrink-0" />
                      <span>
                        Teacher already holds{' '}
                        <strong className="font-mono">
                          {selectedQuickTeacherExisting.passportNumber}
                        </strong>
                        .
                      </span>
                    </div>
                    <label className="inline-flex items-center gap-1.5 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={replaceOnAssign}
                        onChange={(e) => setReplaceOnAssign(e.target.checked)}
                        className="accent-pink-700"
                      />
                      Unassign old passport &amp; assign this one
                    </label>
                  </div>
                )}

              {/* Teachers Awaiting Passport Quick Pick */}
              <div className="bg-pink-50/60 border border-pink-100 rounded-lg p-3 space-y-2">
                <div className="text-[11px] font-semibold text-pink-900">
                  Teachers Without Active Passport ({metrics.teachersWithoutPassport.length})
                </div>
                {metrics.teachersWithoutPassport.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {metrics.teachersWithoutPassport.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setAssignTargetTeacherId(t.id)}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors ${
                          effectiveAssignTeacherId === t.id
                            ? 'bg-pink-700 text-white border-pink-700'
                            : 'bg-white text-pink-900 border-pink-200 hover:bg-pink-100'
                        }`}
                      >
                        {t.name} ({t.teacherCode})
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-emerald-700 font-medium">
                    All active teachers currently have an assigned active passport.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={
                  !effectiveAssignPassportId || !effectiveAssignTeacherId
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-pink-700 hover:bg-pink-800 disabled:opacity-50 rounded-lg"
              >
                <ShieldCheck className="w-4 h-4" />
                Assign Passport to Teacher
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Teacher Passports Directory & Report Table */}
      <div className="bg-white border border-pink-200 rounded-xl overflow-hidden no-print">
        <div className="p-4 border-b border-pink-200 bg-pink-50/40 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search passport no., username, or teacher name..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-pink-200 rounded-lg bg-white focus:outline-none focus:border-pink-500"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterAssignment}
              onChange={(e) =>
                setFilterAssignment(
                  e.target.value as 'all' | 'assigned' | 'unassigned',
                )
              }
              className="px-3 py-2 text-xs border border-pink-200 rounded-lg bg-white"
            >
              <option value="all">All Assignments</option>
              <option value="assigned">Assigned to Teacher</option>
              <option value="unassigned">Unassigned Pool</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) =>
                setFilterStatus(e.target.value as 'all' | PassportStatus)
              }
              className="px-3 py-2 text-xs border border-pink-200 rounded-lg bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="revoked">Revoked Only</option>
              <option value="expired">Expired Only</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-pink-100 text-xs font-semibold text-pink-950 border-b border-pink-200">
              <tr>
                <th className="px-3.5 py-3 text-center w-12">S.N.</th>
                <th className="px-3.5 py-3">Passport No. &amp; Title</th>
                <th className="px-3.5 py-3">Portal Credentials</th>
                <th className="px-3.5 py-3">Assigned Teacher</th>
                <th className="px-3.5 py-3">Validity Period</th>
                <th className="px-3.5 py-3 text-center">Status</th>
                <th className="px-3.5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pink-100">
              {filteredPassports.map((p, idx) => {
                const holder = p.assignedTeacherId
                  ? teacherById.get(p.assignedTeacherId)
                  : undefined;
                const isRevealed = Boolean(revealedIds[p.id]);
                return (
                  <tr key={p.id} className="hover:bg-pink-50/40">
                    <td className="px-3.5 py-3 text-center font-mono tabular-nums text-slate-500">
                      {idx + 1}
                    </td>
                    <td className="px-3.5 py-3">
                      <div className="font-mono text-xs font-bold text-pink-900">
                        {p.passportNumber}
                      </div>
                      <div className="text-xs text-slate-600">
                        {p.passportTitle}
                      </div>
                    </td>
                    <td className="px-3.5 py-3">
                      <div className="text-xs font-mono font-semibold text-slate-900">
                        {p.username}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] font-mono text-slate-600">
                          {p.passwordHash
                            ? isRevealed
                              ? 'Hashed (SHA-256)'
                              : '••••••••'
                            : isRevealed
                              ? p.passcode
                              : '••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setRevealedIds((prev) => ({
                              ...prev,
                              [p.id]: !prev[p.id],
                            }))
                          }
                          title={isRevealed ? 'Hide passcode' : 'Reveal passcode'}
                          className="text-slate-400 hover:text-pink-700"
                        >
                          {isRevealed ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyCredentials(p)}
                          title="Copy credentials"
                          className="text-slate-400 hover:text-pink-700"
                        >
                          {copiedId === p.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-3.5 py-3">
                      {holder ? (
                        <div>
                          <div className="text-xs font-semibold text-slate-900">
                            {holder.name}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">
                            {holder.teacherCode} · {holder.specialization}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-amber-800 font-medium">
                            Unassigned Pool
                          </span>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                setAssignModalPassport(p);
                                setModalTeacherId(
                                  metrics.teachersWithoutPassport[0]?.id ||
                                    db.teachers[0]?.id ||
                                    '',
                                );
                              }}
                              className="px-2 py-0.5 text-[11px] font-semibold bg-pink-700 text-white rounded hover:bg-pink-800"
                            >
                              Assign
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3.5 py-3 font-mono text-xs text-slate-700 whitespace-nowrap">
                      <div>{p.issuedDate}</div>
                      <div className="text-[11px] text-slate-500">
                        to {p.expiryDate}
                      </div>
                    </td>
                    <td className="px-3.5 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded border ${
                          p.status === 'active'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : p.status === 'revoked'
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : 'bg-slate-100 text-slate-700 border-slate-300'
                        }`}
                      >
                        {p.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          title="View / Print Passport Card"
                          onClick={() => setCardPreviewPassport(p)}
                          className="p-1.5 text-pink-700 hover:bg-pink-100 rounded-md"
                        >
                          <CreditCard className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              type="button"
                              title={
                                holder
                                  ? 'Reassign / Unassign Teacher'
                                  : 'Assign to Teacher'
                              }
                              onClick={() => {
                                setAssignModalPassport(p);
                                setModalTeacherId(
                                  p.assignedTeacherId ||
                                    metrics.teachersWithoutPassport[0]?.id ||
                                    db.teachers[0]?.id ||
                                    '',
                                );
                              }}
                              className="p-1.5 text-slate-600 hover:text-pink-700 hover:bg-pink-100 rounded-md"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              title="Edit Passport"
                              onClick={() => openEditModal(p)}
                              className="p-1.5 text-slate-600 hover:text-pink-700 hover:bg-pink-100 rounded-md"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              title={
                                p.status === 'active'
                                  ? 'Revoke Passport'
                                  : 'Activate Passport'
                              }
                              onClick={() => toggleStatus(p)}
                              className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-md"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                            {confirmDeleteId === p.id ? (
                              <span className="inline-flex items-center gap-1 ml-1">
                                <button
                                  type="button"
                                  onClick={() => handleDeletePassport(p.id)}
                                  className="px-2 py-1 text-[11px] font-semibold bg-rose-600 text-white rounded"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-1.5 py-1 text-[11px] text-slate-600 border border-slate-200 rounded"
                                >
                                  Cancel
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                title="Delete Passport"
                                onClick={() => setConfirmDeleteId(p.id)}
                                className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-md"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredPassports.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm text-slate-500"
                  >
                    No teacher passports match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign / Reassign Modal */}
      {assignModalPassport && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 no-print">
          <div className="bg-white border border-pink-200 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-pink-100 pb-3">
              <div>
                <h4 className="text-base font-bold text-slate-900">
                  Assign Passport to Teacher
                </h4>
                <p className="text-xs font-mono text-pink-700">
                  {assignModalPassport.passportNumber} ({assignModalPassport.username})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalPassport(null)}
                className="p-1 text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-pink-950 mb-1">
                Select Individual Teacher
              </label>
              <select
                value={modalTeacherId}
                onChange={(e) => setModalTeacherId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-pink-200 rounded-lg bg-white"
              >
                <option value="">
                  -- Unassign (Return to Passport Pool) --
                </option>
                {db.teachers
                  .filter((t) => t.status === 'active')
                  .map((t) => {
                    const activePp = activePassportByTeacher.get(t.id);
                    return (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.teacherCode})
                        {activePp && activePp.id !== assignModalPassport.id
                          ? ` — Replace ${activePp.passportNumber}`
                          : ''}
                      </option>
                    );
                  })}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAssignModalPassport(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const ok = assignPassportToTeacher(
                    assignModalPassport.id,
                    modalTeacherId || null,
                    true,
                  );
                  if (ok) setAssignModalPassport(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-pink-700 hover:bg-pink-800 rounded-lg"
              >
                {modalTeacherId ? 'Confirm Assignment' : 'Move to Pool'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Passport Modal */}
      {editingPassport && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 no-print">
          <form
            onSubmit={handleSaveEdit}
            className="bg-white border border-pink-200 rounded-xl w-full max-w-lg p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-pink-100 pb-3">
              <h4 className="text-base font-bold text-slate-900">
                Edit Teacher Passport
              </h4>
              <button
                type="button"
                onClick={() => setEditingPassport(null)}
                className="p-1 text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-pink-950 mb-1">
                  Passport Number
                </label>
                <input
                  type="text"
                  required
                  value={editForm.passportNumber}
                  onChange={(e) =>
                    setEditForm({ ...editForm, passportNumber: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs font-mono border border-pink-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-pink-950 mb-1">
                  Title
                </label>
                <select
                  value={editForm.passportTitle}
                  onChange={(e) =>
                    setEditForm({ ...editForm, passportTitle: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-pink-200 rounded-lg bg-white"
                >
                  {PASSPORT_TITLES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-pink-950 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={editForm.username}
                  onChange={(e) =>
                    setEditForm({ ...editForm, username: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs font-mono border border-pink-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-pink-950 mb-1">
                  New Passcode (optional if keeping existing hash)
                </label>
                <input
                  type="password"
                  required={!editingPassport.passwordHash}
                  placeholder={
                    editingPassport.passwordHash
                      ? 'Leave blank to keep hashed password'
                      : 'Enter new passcode'
                  }
                  value={editForm.passcode}
                  onChange={(e) =>
                    setEditForm({ ...editForm, passcode: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs font-mono border border-pink-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-pink-950 mb-1">
                  Assigned Teacher
                </label>
                <select
                  value={editForm.assignedTeacherId}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      assignedTeacherId: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-xs border border-pink-200 rounded-lg bg-white"
                >
                  <option value="">-- Unassigned Pool --</option>
                  {db.teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.teacherCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-pink-950 mb-1">
                  Status
                </label>
                <select
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      status: e.target.value as PassportStatus,
                    })
                  }
                  className="w-full px-3 py-2 text-xs border border-pink-200 rounded-lg bg-white"
                >
                  <option value="active">Active</option>
                  <option value="revoked">Revoked</option>
                  <option value="expired">Expired</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-pink-950 mb-1">
                  Issued Date
                </label>
                <input
                  type="text"
                  value={editForm.issuedDate}
                  onChange={(e) =>
                    setEditForm({ ...editForm, issuedDate: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs font-mono border border-pink-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-pink-950 mb-1">
                  Expiry Date
                </label>
                <input
                  type="text"
                  value={editForm.expiryDate}
                  onChange={(e) =>
                    setEditForm({ ...editForm, expiryDate: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs font-mono border border-pink-200 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-pink-950 mb-1">
                Notes
              </label>
              <input
                type="text"
                value={editForm.notes}
                onChange={(e) =>
                  setEditForm({ ...editForm, notes: e.target.value })
                }
                className="w-full px-3 py-2 text-xs border border-pink-200 rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingPassport(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-pink-700 hover:bg-pink-800 rounded-lg"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Printable Official Teacher Passport Card Modal */}
      {cardPreviewPassport && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-pink-200 rounded-xl w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between no-print">
              <h4 className="text-sm font-bold text-slate-900">
                Official Faculty Access Passport Card
              </h4>
              <button
                type="button"
                onClick={() => setCardPreviewPassport(null)}
                className="p-1 text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Passport Card Frame */}
            <div className="border-2 border-pink-700 rounded-xl overflow-hidden bg-white">
              <div className="bg-pink-800 text-white px-4 py-3 flex items-center gap-3">
                <img
                  src="/assets/aistudio/2png_bb8dd55e.png"
                  alt="School Logo"
                  className="w-11 h-11 rounded-md bg-white object-contain p-0.5 shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold tracking-wide truncate">
                    {db.settings.schoolName}
                  </div>
                  <div className="text-[11px] text-pink-100 truncate">
                    {db.settings.address} · IEMIS {db.settings.iemisCode}
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-pink-200 mt-0.5">
                    {cardPreviewPassport.passportTitle}
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-4 border-b border-pink-100 pb-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-pink-700">
                      Passport Holder
                    </div>
                    <div className="text-base font-bold text-slate-900">
                      {cardPreviewTeacher?.name || 'Unassigned Passport'}
                    </div>
                    <div className="text-xs text-slate-600">
                      {cardPreviewTeacher
                        ? `${cardPreviewTeacher.teacherCode} · ${cardPreviewTeacher.qualification}`
                        : 'Pending individual teacher assignment'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-semibold uppercase text-pink-700">
                      Passport No.
                    </div>
                    <div className="text-xs font-mono font-bold text-slate-900">
                      {cardPreviewPassport.passportNumber}
                    </div>
                    <div className="text-[10px] font-semibold text-emerald-700 mt-0.5">
                      {cardPreviewPassport.status.toUpperCase()}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs bg-pink-50/60 border border-pink-100 rounded-lg p-3">
                  <div>
                    <div className="text-[10px] font-semibold text-pink-900">
                      Portal Username
                    </div>
                    <div className="font-mono font-bold text-slate-900">
                      {cardPreviewPassport.username}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-pink-900">
                      Access Passcode
                    </div>
                    <div className="font-mono font-bold text-slate-900">
                      {cardPreviewPassport.passwordHash
                        ? 'Encrypted (Hashed)'
                        : cardPreviewPassport.passcode}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-pink-900">
                      Issued Date
                    </div>
                    <div className="font-mono text-slate-800">
                      {cardPreviewPassport.issuedDate}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-pink-900">
                      Valid Until
                    </div>
                    <div className="font-mono text-slate-800">
                      {cardPreviewPassport.expiryDate}
                    </div>
                  </div>
                </div>

                {cardPreviewAssignments.length > 0 && (
                  <div className="text-[11px] text-slate-700">
                    <span className="font-semibold text-pink-900">
                      Assigned Scope:{' '}
                    </span>
                    {cardPreviewAssignments.slice(0, 4).join(' · ')}
                    {cardPreviewAssignments.length > 4
                      ? ` (+${cardPreviewAssignments.length - 4} more)`
                      : ''}
                  </div>
                )}

                <div className="pt-4 flex items-end justify-between text-[11px] text-slate-600">
                  <div>
                    <div>Authorized By: Admin</div>
                    <div className="font-mono text-[10px] text-slate-400">
                      Created {cardPreviewPassport.createdDate}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="w-32 border-t border-slate-400 pt-1 font-semibold text-slate-800">
                      {db.settings.signatories.principal}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 no-print">
              <button
                type="button"
                onClick={() => setCardPreviewPassport(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-pink-700 hover:bg-pink-800 rounded-lg"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Passport Card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
