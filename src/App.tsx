import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BookOpen,
  ClipboardCheck,
  Edit3,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  KeyRound,
  Layers,
  LayoutDashboard,
  ListChecks,
  Lock,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Trophy,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  createSeedDatabase,
  ensureDefaultExams,
  ensureRequiredSubjects,
  ensureTeacherRegistryAndAssignments,
} from './data/seedData';
import {
  AdminSecurityConfig,
  Exam,
  NavPage,
  SchoolDatabase,
  SchoolSettings,
  Student,
  TeacherPassport,
  UserRole,
} from './types';
import {
  createSalt,
  evaluateAdminPassword,
  hashSecret,
} from './utils/passwordSecurity';
import { DashboardView } from './components/DashboardView';
import { StudentManagementView } from './components/StudentManagementView';
import { ClassSectionView } from './components/ClassSectionView';
import { SubjectManagementView } from './components/SubjectManagementView';
import { OptionalAssignmentView } from './components/OptionalAssignmentView';
import { TeacherAssignmentView } from './components/TeacherAssignmentView';
import { TeacherPassportView } from './components/TeacherPassportView';
import { TeacherDashboardView } from './components/TeacherDashboardView';
import { ExamManagementView } from './components/ExamManagementView';
import { MarksEntryView } from './components/MarksEntryView';
import { MarkwiseLedgerView } from './components/MarkwiseLedgerView';
import { GradewiseLedgerView } from './components/GradewiseLedgerView';
import { TopTenStudentsView } from './components/TopTenStudentsView';
import { GradeSheetView } from './components/GradeSheetView';
import { ExcelIOView } from './components/ExcelIOView';
import { SettingsView } from './components/SettingsView';
import { AdminPasswordView } from './components/AdminPasswordView';
import { MobilePortalEntry } from './components/MobilePortalEntry';
import {
  OfflineIndicator,
  PWAInstallButton,
} from './components/PWAInstallButton';

const STORAGE_KEY = 'aristo_school_db_v1';

interface NavGroup {
  label: string;
  items: { id: NavPage; label: string; icon: React.ComponentType<{ className?: string }> }[];
}

const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Academic Setup',
    items: [
      { id: 'classes', label: 'Class & Section', icon: Layers },
      { id: 'subjects', label: 'Subject Management', icon: BookOpen },
      { id: 'students', label: 'Student Management', icon: Users },
      {
        id: 'optional-assignment',
        label: 'Optional Subjects (9–12)',
        icon: ListChecks,
      },
      {
        id: 'teacher-assignments',
        label: 'Subject Teacher Assign',
        icon: UserCheck,
      },
      {
        id: 'teacher-passports',
        label: 'Teacher Passports',
        icon: KeyRound,
      },
    ],
  },
  {
    label: 'Examinations',
    items: [
      { id: 'exams', label: 'Exam Management', icon: ClipboardCheck },
      { id: 'marks-entry', label: 'Marks Entry', icon: Edit3 },
      { id: 'excel-io', label: 'Excel Import & Export', icon: FileSpreadsheet },
    ],
  },
  {
    label: 'Reports & Print',
    items: [
      { id: 'markwise-ledger', label: 'Markwise Ledger', icon: FileText },
      { id: 'gradewise-ledger', label: 'Gradewise Ledger', icon: Award },
      { id: 'top-ten', label: 'Top 10 Students', icon: Trophy },
      { id: 'grade-sheet', label: 'Grade Sheet (PDF)', icon: GraduationCap },
    ],
  },
  {
    label: 'Administration',
    items: [
      { id: 'admin-security', label: 'Admin Password', icon: Lock },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

const TEACHER_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Teacher Workspace',
    items: [
      { id: 'teacher-dashboard', label: 'My Assigned Subjects', icon: LayoutDashboard },
      { id: 'marks-entry', label: 'Enter Subject Marks', icon: Edit3 },
      { id: 'students', label: 'My Class Students', icon: Users },
    ],
  },
];

const PAGE_TITLES: Record<NavPage, string> = {
  dashboard: 'Dashboard',
  students: 'Student Management',
  classes: 'Class & Section Management',
  subjects: 'Subject Management',
  'optional-assignment': 'Optional Subject Assignment (Grades 9–12)',
  'teacher-assignments': 'Subject Teacher Assignment',
  'teacher-passports': 'Teacher Passports & Credentials',
  'teacher-dashboard': 'Teacher Dashboard',
  exams: 'Exam Management',
  'marks-entry': 'Marks Entry & Attendance',
  'markwise-ledger': 'Markwise Ledger',
  'gradewise-ledger': 'Gradewise Ledger',
  'top-ten': 'Class-Wise Top 10 Students',
  'grade-sheet': 'Printable Grade Sheet',
  'excel-io': 'Excel Import & Export',
  settings: 'System Settings',
  'admin-security': 'Admin Password & Security',
};

const ADMIN_SESSION_KEY = 'aristo_admin_unlocked';

export default function App() {
  const [db, setDb] = useState<SchoolDatabase | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('admin');
  const [activeTeacherId, setActiveTeacherId] = useState<string>('tch-1');
  const [authenticatedPassportId, setAuthenticatedPassportId] = useState<
    string | null
  >(null);
  const [passportLoginId, setPassportLoginId] = useState('');
  const [passportLoginCode, setPassportLoginCode] = useState('');
  const [passportLoginError, setPassportLoginError] = useState<string | null>(
    null,
  );

  // Admin Password Lock & Recovery State
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(true);
  const [adminUnlockPassword, setAdminUnlockPassword] = useState('');
  const [showAdminUnlockPwd, setShowAdminUnlockPwd] = useState(false);
  const [adminUnlockError, setAdminUnlockError] = useState<string | null>(null);
  const [failedAdminAttempts, setFailedAdminAttempts] = useState(0);
  const [lockoutUntilMs, setLockoutUntilMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [showRecoveryMode, setShowRecoveryMode] = useState(false);
  const [recoveryAnswerInput, setRecoveryAnswerInput] = useState('');
  const [recoveryNewPwd, setRecoveryNewPwd] = useState('');
  const [recoveryConfirmPwd, setRecoveryConfirmPwd] = useState('');

  const [portalAuthenticated, setPortalAuthenticated] = useState(false);
  const [entryOption, setEntryOption] = useState<'select' | 'teacher' | 'admin'>(
    'select',
  );
  const [activePage, setActivePage] = useState<NavPage>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navContext, setNavContext] = useState<{
    examId?: string;
    classId?: string;
    sectionId?: string;
    studentId?: string;
  }>({});

  useEffect(() => {
    let mounted = true;
    const applyStartupLock = (data: SchoolDatabase) => {
      const sec = data.admin_security;
      if (
        sec?.isConfigured &&
        sec.requireOnAppStart &&
        sessionStorage.getItem(ADMIN_SESSION_KEY) !== '1'
      ) {
        setIsAdminUnlocked(false);
      }
    };
    async function loadInitial() {
      try {
        const res = await fetch('/api/state');
        if (res.ok) {
          const data = (await res.json()) as SchoolDatabase;
          if (mounted) {
            setDb(data);
            applyStartupLock(data);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            return;
          }
        }
      } catch {
        // Fallback to localStorage or seed
      }
      if (!mounted) return;
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as SchoolDatabase;
          parsed.subjects = ensureRequiredSubjects(parsed.subjects || []);
          parsed.exams = ensureDefaultExams(
            parsed.exams || [],
            parsed.settings?.academicYear || '2082 B.S',
            parsed.settings,
          );
          const teacherEnsure = ensureTeacherRegistryAndAssignments(parsed);
          parsed.academicYears = teacherEnsure.academicYears;
          parsed.teachers = teacherEnsure.teachers;
          parsed.teacher_subject_assignments =
            teacherEnsure.teacher_subject_assignments;
          parsed.teacher_passports = teacherEnsure.teacher_passports;
          parsed.admin_security = teacherEnsure.admin_security;
          setDb(parsed);
          applyStartupLock(parsed);
          return;
        } catch {
          // ignore corrupt localStorage
        }
      }
      const seed = createSeedDatabase();
      setDb(seed);
      applyStartupLock(seed);
    }
    loadInitial();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!lockoutUntilMs) return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNowMs(t);
      if (t >= lockoutUntilMs) {
        setLockoutUntilMs(null);
        setFailedAdminAttempts(0);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [lockoutUntilMs]);

  const persistDb = async (
    nextDb: SchoolDatabase,
  ): Promise<{ ok: boolean; mode: 'server' | 'local' }> => {
    setDb(nextDb);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDb));
    } catch {
      // ignore storage quota errors
    }
    try {
      const res = await fetch('/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextDb),
      });
      if (res.ok) {
        return { ok: true, mode: 'server' };
      }
    } catch {
      // ignore network offline errors; localStorage retains state
    }
    return { ok: true, mode: 'local' };
  };

  const navigate = (
    page: NavPage,
    context?: {
      examId?: string;
      classId?: string;
      sectionId?: string;
      studentId?: string;
    },
  ) => {
    if (context) setNavContext(context);
    setActivePage(page);
    setMobileMenuOpen(false);
  };

  const handleViewStudentGradeSheet = (stu: Student) => {
    navigate('grade-sheet', {
      classId: stu.classId,
      sectionId: stu.sectionId,
      studentId: stu.id,
    });
  };

  const handleResetDemo = async () => {
    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      if (res.ok) {
        const fresh = (await res.json()) as SchoolDatabase;
        setDb(fresh);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
        return;
      }
    } catch {
      // fallback
    }
    const seed = createSeedDatabase();
    persistDb(seed);
  };

  if (!db) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-full max-w-md space-y-3 p-6">
          <div className="h-6 bg-slate-200 rounded animate-pulse w-2/3" />
          <div className="h-4 bg-slate-200 rounded animate-pulse w-full" />
          <div className="h-32 bg-slate-200 rounded animate-pulse w-full" />
        </div>
      </div>
    );
  }

  const navGroups = userRole === 'admin' ? ADMIN_NAV_GROUPS : TEACHER_NAV_GROUPS;
  const activePassport: TeacherPassport | null =
    authenticatedPassportId
      ? (db.teacher_passports || []).find(
          (p) =>
            p.id === authenticatedPassportId &&
            p.status === 'active' &&
            Boolean(p.assignedTeacherId),
        ) || null
      : null;

  const activeTeacher =
    userRole === 'teacher'
      ? activePassport
        ? db.teachers.find(
            (t) =>
              t.id === activePassport.assignedTeacherId &&
              t.status === 'active',
          ) || null
        : null
      : db.teachers.find((t) => t.id === activeTeacherId) || db.teachers[0];

  const handlePassportLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normId = passportLoginId.trim().toLowerCase();
    const rawPass = passportLoginCode.trim();
    if (!normId || !rawPass) {
      setPassportLoginError(
        'Enter your Passport Number (or Username) and Passcode.',
      );
      return;
    }
    const match = (db.teacher_passports || []).find(
      (p) =>
        (p.passportNumber.trim().toLowerCase() === normId ||
          p.username.trim().toLowerCase() === normId) &&
        p.passcode === rawPass,
    );
    if (!match) {
      setPassportLoginError('Invalid teacher passport credentials.');
      return;
    }
    if (match.status !== 'active') {
      setPassportLoginError(
        `This passport is ${match.status.toUpperCase()}. Contact School Admin.`,
      );
      return;
    }
    if (!match.assignedTeacherId) {
      setPassportLoginError(
        'This passport has not been assigned to any individual teacher yet.',
      );
      return;
    }
    const holder = db.teachers.find(
      (t) => t.id === match.assignedTeacherId && t.status === 'active',
    );
    if (!holder) {
      setPassportLoginError('Assigned teacher profile is inactive or missing.');
      return;
    }
    setPassportLoginError(null);
    setAuthenticatedPassportId(match.id);
    setActiveTeacherId(holder.id);
    setNavContext({});
    setActivePage('teacher-dashboard');
  };

  const adminSecurity = db.admin_security;
  const adminLockActive = Boolean(
    userRole === 'admin' && adminSecurity?.isConfigured && !isAdminUnlocked,
  );
  const lockoutRemainingSec =
    lockoutUntilMs && lockoutUntilMs > nowMs
      ? Math.ceil((lockoutUntilMs - nowMs) / 1000)
      : 0;

  const lockAdminSession = () => {
    if (!adminSecurity?.isConfigured) return;
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setIsAdminUnlocked(false);
    setAdminUnlockPassword('');
    setAdminUnlockError(null);
    setShowRecoveryMode(false);
    setMobileMenuOpen(false);
  };

  const handleAdminUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminSecurity?.isConfigured) {
      setIsAdminUnlocked(true);
      return;
    }
    if (lockoutRemainingSec > 0) return;

    const valid =
      Boolean(adminUnlockPassword) &&
      hashSecret(adminUnlockPassword, adminSecurity.passwordSalt) ===
        adminSecurity.passwordHash;
    if (!valid) {
      const nextFails = failedAdminAttempts + 1;
      const maxFails = adminSecurity.maxFailedAttempts || 5;
      setFailedAdminAttempts(nextFails);
      if (nextFails >= maxFails) {
        setLockoutUntilMs(Date.now() + 30000);
        setNowMs(Date.now());
        setAdminUnlockError(
          `Too many failed attempts (${nextFails}/${maxFails}). Locked for 30 seconds.`,
        );
      } else {
        setAdminUnlockError(
          `Incorrect Admin Password (${nextFails}/${maxFails} attempts).`,
        );
      }
      return;
    }

    sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
    setIsAdminUnlocked(true);
    setAdminUnlockPassword('');
    setAdminUnlockError(null);
    setFailedAdminAttempts(0);
    setLockoutUntilMs(null);
  };

  const handleAdminRecoverySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminSecurity?.isConfigured) return;
    const cleanAns = recoveryAnswerInput.trim().toLowerCase();
    if (
      hashSecret(cleanAns, adminSecurity.passwordSalt) !==
      adminSecurity.recoveryAnswerHash
    ) {
      setAdminUnlockError('Recovery answer does not match our records.');
      return;
    }
    const evalRes = evaluateAdminPassword(
      recoveryNewPwd,
      recoveryConfirmPwd,
      adminSecurity.requirements,
    );
    if (!evalRes.allRequirementsMet) {
      setAdminUnlockError(
        `New password must satisfy all policy rules (min ${adminSecurity.requirements.minLength} chars, complexity, and match).`,
      );
      return;
    }
    const nextSalt = createSalt();
    const updated: AdminSecurityConfig = {
      ...adminSecurity,
      passwordSalt: nextSalt,
      passwordHash: hashSecret(recoveryNewPwd, nextSalt),
      recoveryAnswerHash: hashSecret(cleanAns, nextSalt),
      updatedDate: new Date().toISOString().slice(0, 10),
      updatedBy: 'Admin Recovery',
    };
    persistDb({ ...db, admin_security: updated });
    sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
    setIsAdminUnlocked(true);
    setShowRecoveryMode(false);
    setRecoveryAnswerInput('');
    setRecoveryNewPwd('');
    setRecoveryConfirmPwd('');
    setAdminUnlockError(null);
    setFailedAdminAttempts(0);
  };

  const switchRole = (nextRole: UserRole) => {
    const prevRole = userRole;
    setUserRole(nextRole);
    setNavContext({});
    setPassportLoginError(null);
    setAdminUnlockError(null);
    if (nextRole === 'teacher') {
      setActivePage('teacher-dashboard');
    } else {
      if (
        prevRole === 'teacher' &&
        adminSecurity?.isConfigured &&
        adminSecurity.requireOnRoleSwitch
      ) {
        sessionStorage.removeItem(ADMIN_SESSION_KEY);
        setIsAdminUnlocked(false);
      }
      setActivePage('dashboard');
    }
    setMobileMenuOpen(false);
  };

  const teacherAllowedClassSectionPairs =
    userRole === 'teacher' && activeTeacher
      ? db.teacher_subject_assignments
          .filter((a) => a.teacherId === activeTeacher.id)
          .map((a) => ({ classId: a.classId, sectionId: a.sectionId }))
      : undefined;

  const signOutToPortalEntry = (
    nextOption: 'select' | 'teacher' | 'admin' = 'select',
  ) => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setPortalAuthenticated(false);
    setEntryOption(nextOption);
    setAuthenticatedPassportId(null);
    setPassportLoginId('');
    setPassportLoginCode('');
    setPassportLoginError(null);
    setAdminUnlockPassword('');
    setAdminUnlockError(null);
    setShowRecoveryMode(false);
    setMobileMenuOpen(false);
  };

  if (!portalAuthenticated) {
    return (
      <>
        <MobilePortalEntry
          db={db}
          initialOption={entryOption}
          onTeacherAuthenticated={(passport, teacher) => {
            setUserRole('teacher');
            setAuthenticatedPassportId(passport.id);
            setActiveTeacherId(teacher.id);
            setNavContext({});
            setActivePage('teacher-dashboard');
            setPortalAuthenticated(true);
          }}
          onAdminAuthenticated={(goToPasswordSetup) => {
            sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
            setUserRole('admin');
            setIsAdminUnlocked(true);
            setNavContext({});
            setActivePage(goToPasswordSetup ? 'admin-security' : 'dashboard');
            setPortalAuthenticated(true);
          }}
          onUpdateAdminSecurity={(admin_security) =>
            persistDb({ ...db, admin_security })
          }
        />
        <OfflineIndicator />
      </>
    );
  }

  const renderRoleSwitcher = () => (
    <div className="p-3 border-t border-slate-200 bg-pink-50/50 space-y-2.5">
      <div className="text-[11px] font-semibold text-pink-900 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-pink-700" />
        <span>Portal Access Mode</span>
      </div>
      <div className="grid grid-cols-2 gap-1 p-1 bg-white border border-pink-200 rounded-lg">
        <button
          type="button"
          onClick={() => switchRole('admin')}
          className={`px-2 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            userRole === 'admin'
              ? 'bg-indigo-700 text-white'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Admin
        </button>
        <button
          type="button"
          onClick={() => switchRole('teacher')}
          className={`px-2 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            userRole === 'teacher'
              ? 'bg-pink-700 text-white'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Teacher
        </button>
      </div>
      {userRole === 'admin' && (
        <div className="space-y-1.5">
          {adminSecurity?.isConfigured ? (
            isAdminUnlocked ? (
              <button
                type="button"
                onClick={lockAdminSession}
                className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-800 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-md"
              >
                <Lock className="w-3 h-3" />
                Lock Admin Portal
              </button>
            ) : (
              <div className="text-[11px] font-medium text-indigo-900 bg-white border border-indigo-200 rounded-md px-2.5 py-1.5 text-center">
                Admin Screen Locked
              </div>
            )
          ) : (
            <button
              type="button"
              onClick={() => navigate('admin-security')}
              className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md"
            >
              <KeyRound className="w-3 h-3" />
              Create Admin Password
            </button>
          )}
        </div>
      )}
      {userRole === 'teacher' && (
        <div className="space-y-1.5">
          {activeTeacher && activePassport ? (
            <div className="bg-white border border-pink-200 rounded-lg p-2.5 space-y-1.5">
              <div className="text-xs font-semibold text-pink-900">
                Teacher Session Active
              </div>
              <button
                type="button"
                onClick={() => signOutToPortalEntry('teacher')}
                className="w-full inline-flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-semibold text-pink-800 bg-pink-50 hover:bg-pink-100 border border-pink-200 rounded"
              >
                <LogOut className="w-3 h-3" />
                Switch Teacher Login
              </button>
            </div>
          ) : (
            <div className="text-[11px] text-pink-900 bg-white border border-pink-200 rounded-lg p-2">
              Sign in with your Teacher Passport to unlock Teacher Workspace.
            </div>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => signOutToPortalEntry('select')}
        className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-md"
      >
        <LogOut className="w-3 h-3" />
        Sign Out to Login Screen
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-white border-r border-slate-200 no-print">
        <div className="h-16 px-5 border-b border-slate-200 flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-lg text-white flex items-center justify-center font-bold text-sm shrink-0 ${
              userRole === 'teacher' ? 'bg-pink-700' : 'bg-indigo-700'
            }`}
          >
            A
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-900 truncate">
              Aristo Ledger
            </div>
            <div className="text-[11px] text-slate-500 font-mono truncate">
              IEMIS {db.settings.iemisCode}
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-5">
          {adminLockActive ? (
            <div className="p-3 rounded-lg border border-indigo-200 bg-indigo-50/70 text-xs text-indigo-950 space-y-1.5">
              <div className="font-semibold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-indigo-700" />
                Admin Session Locked
              </div>
              <p className="text-[11px] text-indigo-800">
                Enter your Admin Password to access school administration tools.
              </p>
            </div>
          ) : (
            navGroups.map((group) => (
              <div key={group.label}>
                <div className="px-3 mb-1.5 text-[11px] font-semibold text-slate-400 tracking-wide">
                  {group.label}
                </div>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = activePage === item.id;
                    const activeClass =
                      userRole === 'teacher' ||
                      item.id === 'teacher-assignments' ||
                      item.id === 'teacher-passports'
                        ? 'bg-pink-50 text-pink-700'
                        : 'bg-indigo-50 text-indigo-700';
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigate(item.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                          active
                            ? activeClass
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </nav>

        {renderRoleSwitcher()}
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-white h-full border-r border-slate-200 flex flex-col z-10">
            <div className="h-16 px-4 border-b border-slate-200 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">
                Aristo Ledger
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-5">
              {adminLockActive ? (
                <div className="p-3 rounded-lg border border-indigo-200 bg-indigo-50/70 text-xs text-indigo-950 space-y-1.5">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-indigo-700" />
                    Admin Session Locked
                  </div>
                  <p className="text-[11px] text-indigo-800">
                    Unlock Admin Portal with your password or switch to Teacher mode below.
                  </p>
                </div>
              ) : (
                navGroups.map((group) => (
                  <div key={group.label}>
                    <div className="px-3 mb-1.5 text-[11px] font-semibold text-slate-400">
                      {group.label}
                    </div>
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const active = activePage === item.id;
                        const activeClass =
                          userRole === 'teacher' ||
                          item.id === 'teacher-assignments' ||
                          item.id === 'teacher-passports'
                            ? 'bg-pink-50 text-pink-700'
                            : 'bg-indigo-50 text-indigo-700';
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => navigate(item.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg ${
                              active
                                ? activeClass
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <Icon className="w-4 h-4 shrink-0" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </nav>

            {renderRoleSwitcher()}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb/Title — Context — 1 Primary Action */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-6 flex items-center justify-between gap-8 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base font-bold text-slate-900 truncate whitespace-nowrap">
              {adminLockActive
                ? 'Admin Portal Authentication'
                : userRole === 'teacher' && activePage === 'students'
                  ? 'My Assigned Class Students'
                  : PAGE_TITLES[activePage]}
            </h1>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 whitespace-nowrap shrink-0">
            <span>{db.settings.schoolName}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{db.settings.academicYear}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton compact />
            {adminLockActive ? (
              <button
                type="button"
                onClick={() => switchRole('teacher')}
                className="px-3.5 py-2 text-xs font-medium text-pink-800 bg-pink-50 hover:bg-pink-100 border border-pink-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Teacher Sign-In
              </button>
            ) : userRole === 'teacher' ? (
              activePage !== 'marks-entry' ? (
                <button
                  type="button"
                  onClick={() => navigate('marks-entry')}
                  className="px-3.5 py-2 text-xs font-medium text-white bg-pink-700 hover:bg-pink-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  Enter Subject Marks
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('teacher-dashboard')}
                  className="px-3.5 py-2 text-xs font-medium text-white bg-pink-700 hover:bg-pink-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  My Dashboard
                </button>
              )
            ) : activePage !== 'grade-sheet' ? (
              <button
                type="button"
                onClick={() => navigate('grade-sheet')}
                className="px-3.5 py-2 text-xs font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                View Grade Sheet
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('marks-entry')}
                className="px-3.5 py-2 text-xs font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Edit Marks
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6 max-w-[1440px] w-full mx-auto">
          {userRole === 'teacher' ? (
            activeTeacher && activePassport ? (
              <>
                {(activePage === 'teacher-dashboard' ||
                  (activePage !== 'marks-entry' &&
                    activePage !== 'students')) && (
                  <TeacherDashboardView
                    db={db}
                    teacher={activeTeacher}
                    passport={activePassport}
                    onNavigate={navigate}
                  />
                )}
                {activePage === 'marks-entry' && (
                  <MarksEntryView
                    db={db}
                    initialExamId={navContext.examId}
                    initialClassId={navContext.classId}
                    initialSectionId={navContext.sectionId}
                    activeTeacherId={activeTeacher.id}
                    onSaveMarks={(marks) => persistDb({ ...db, marks })}
                  />
                )}
                {activePage === 'students' && (
                  <StudentManagementView
                    db={db}
                    readOnly
                    allowedClassSectionPairs={teacherAllowedClassSectionPairs}
                    onUpdateStudents={(students) => persistDb({ ...db, students })}
                    onViewGradeSheet={handleViewStudentGradeSheet}
                  />
                )}
              </>
            ) : (
              <div className="max-w-lg mx-auto mt-6 bg-white border border-pink-200 rounded-xl p-6 space-y-5">
                <div className="flex items-center gap-3 border-b border-pink-100 pb-4">
                  <div className="w-10 h-10 rounded-lg bg-pink-700 text-white flex items-center justify-center shrink-0">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Teacher Passport Sign-In
                    </h2>
                    <p className="text-xs text-slate-600">
                      Enter the Teacher Passport assigned to you by School Admin.
                    </p>
                  </div>
                </div>

                {passportLoginError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium rounded-lg px-3 py-2.5">
                    {passportLoginError}
                  </div>
                )}

                <form onSubmit={handlePassportLoginSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-pink-950 mb-1">
                      Passport Number or Username
                    </label>
                    <input
                      type="text"
                      value={passportLoginId}
                      onChange={(e) => setPassportLoginId(e.target.value)}
                      placeholder="Enter Passport Number or Username"
                      className="w-full px-3 py-2 text-xs font-mono border border-pink-200 rounded-lg focus:outline-none focus:border-pink-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-pink-950 mb-1">
                      Access Passcode
                    </label>
                    <input
                      type="password"
                      value={passportLoginCode}
                      onChange={(e) => setPassportLoginCode(e.target.value)}
                      placeholder="Enter assigned passcode"
                      className="w-full px-3 py-2 text-xs font-mono border border-pink-200 rounded-lg focus:outline-none focus:border-pink-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 text-xs font-semibold text-white bg-pink-700 hover:bg-pink-800 rounded-lg"
                  >
                    Sign In with Teacher Passport
                  </button>
                </form>
              </div>
            )
          ) : adminLockActive && adminSecurity ? (
            <div className="max-w-md mx-auto mt-6 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                <div className="w-10 h-10 rounded-lg bg-indigo-700 text-white flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-900">
                    {showRecoveryMode
                      ? 'Recover Admin Password'
                      : 'Admin Password Required'}
                  </h2>
                  <p className="text-xs text-slate-600 truncate">
                    {adminSecurity.adminDisplayName} ({adminSecurity.adminUsername})
                  </p>
                </div>
              </div>

              {adminUnlockError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium rounded-lg px-3 py-2.5 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{adminUnlockError}</span>
                </div>
              )}

              {!showRecoveryMode ? (
                <form onSubmit={handleAdminUnlockSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Admin Username
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={adminSecurity.adminUsername}
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg bg-slate-50 text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Admin Password
                    </label>
                    <div className="relative">
                      <input
                        type={showAdminUnlockPwd ? 'text' : 'password'}
                        required
                        disabled={lockoutRemainingSec > 0}
                        value={adminUnlockPassword}
                        onChange={(e) => setAdminUnlockPassword(e.target.value)}
                        placeholder="Enter Admin Password"
                        className="w-full pl-3 pr-9 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500 disabled:bg-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminUnlockPwd((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      >
                        {showAdminUnlockPwd ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={lockoutRemainingSec > 0}
                    className="w-full py-2.5 text-xs font-semibold text-white bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 rounded-lg"
                  >
                    {lockoutRemainingSec > 0
                      ? `Locked (${lockoutRemainingSec}s remaining)`
                      : 'Unlock Admin Panel'}
                  </button>
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setShowRecoveryMode(true);
                        setAdminUnlockError(null);
                      }}
                      className="text-indigo-700 font-semibold hover:underline"
                    >
                      Forgot Password?
                    </button>
                    <button
                      type="button"
                      onClick={() => switchRole('teacher')}
                      className="text-pink-700 font-semibold hover:underline"
                    >
                      Go to Teacher Portal
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleAdminRecoverySubmit} className="space-y-3.5">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
                    <div className="font-semibold text-slate-700 mb-0.5">
                      Security Question
                    </div>
                    <div className="text-slate-900">
                      {adminSecurity.recoveryQuestion}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Recovery Answer
                    </label>
                    <input
                      type="text"
                      required
                      value={recoveryAnswerInput}
                      onChange={(e) => setRecoveryAnswerInput(e.target.value)}
                      placeholder="Enter your recovery answer"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      New Admin Password (min {adminSecurity.requirements.minLength} chars)
                    </label>
                    <input
                      type="password"
                      required
                      value={recoveryNewPwd}
                      onChange={(e) => setRecoveryNewPwd(e.target.value)}
                      placeholder="Enter new strong password"
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={recoveryConfirmPwd}
                      onChange={(e) => setRecoveryConfirmPwd(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowRecoveryMode(false);
                        setAdminUnlockError(null);
                      }}
                      className="px-3 py-2 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg"
                    >
                      Back to Sign-In
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-semibold text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg"
                    >
                      Reset &amp; Unlock Admin
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <>
              {activePage === 'dashboard' && (
                <DashboardView db={db} onNavigate={navigate} />
              )}
              {activePage === 'students' && (
                <StudentManagementView
                  db={db}
                  onUpdateStudents={(students) => persistDb({ ...db, students })}
                  onViewGradeSheet={handleViewStudentGradeSheet}
                />
              )}
              {activePage === 'classes' && (
                <ClassSectionView
                  db={db}
                  onUpdateClasses={(classes) => persistDb({ ...db, classes })}
                />
              )}
              {activePage === 'subjects' && (
                <SubjectManagementView
                  db={db}
                  onUpdateSubjects={(subjects) => persistDb({ ...db, subjects })}
                />
              )}
              {activePage === 'optional-assignment' && (
                <OptionalAssignmentView
                  db={db}
                  onUpdateStudents={(students) => persistDb({ ...db, students })}
                />
              )}
              {activePage === 'teacher-assignments' && (
                <TeacherAssignmentView
                  db={db}
                  userRole={userRole}
                  onUpdateTeachers={(teachers) => persistDb({ ...db, teachers })}
                  onUpdateAssignments={(teacher_subject_assignments) =>
                    persistDb({ ...db, teacher_subject_assignments })
                  }
                />
              )}
              {activePage === 'teacher-passports' && (
                <TeacherPassportView
                  db={db}
                  userRole={userRole}
                  onUpdatePassports={(teacher_passports) =>
                    persistDb({ ...db, teacher_passports })
                  }
                />
              )}
              {activePage === 'teacher-dashboard' && activeTeacher && (
                <TeacherDashboardView
                  db={db}
                  teacher={activeTeacher}
                  onNavigate={navigate}
                />
              )}
              {activePage === 'exams' && (
                <ExamManagementView
                  db={db}
                  onUpdateExams={(exams: Exam[]) => {
                    const examIssueDates = { ...(db.settings.examIssueDates || {}) };
                    const examWorkingDays = { ...(db.settings.examWorkingDays || {}) };
                    const workingDaysByExamId = new Map<string, number>();
                    for (const ex of exams) {
                      examIssueDates[ex.term] = ex.dateOfIssue;
                      examWorkingDays[ex.term] = ex.workingDays;
                      workingDaysByExamId.set(ex.id, ex.workingDays);
                    }
                    const marks = db.marks.map((m) => {
                      const nextDays = workingDaysByExamId.get(m.examId);
                      return nextDays ? { ...m, workingDays: nextDays } : m;
                    });
                    persistDb({
                      ...db,
                      exams,
                      marks,
                      settings: { ...db.settings, examIssueDates, examWorkingDays },
                    });
                  }}
                  onEnterMarks={(examId) => navigate('marks-entry', { examId })}
                />
              )}
              {activePage === 'marks-entry' && (
                <MarksEntryView
                  db={db}
                  initialExamId={navContext.examId}
                  initialClassId={navContext.classId}
                  initialSectionId={navContext.sectionId}
                  onSaveMarks={(marks) => persistDb({ ...db, marks })}
                />
              )}
              {activePage === 'markwise-ledger' && (
                <MarkwiseLedgerView
                  db={db}
                  initialExamId={navContext.examId}
                  initialClassId={navContext.classId}
                  initialSectionId={navContext.sectionId}
                />
              )}
              {activePage === 'gradewise-ledger' && (
                <GradewiseLedgerView
                  db={db}
                  initialExamId={navContext.examId}
                  initialClassId={navContext.classId}
                  initialSectionId={navContext.sectionId}
                  onUpdateMarks={(marks) => persistDb({ ...db, marks })}
                />
              )}
              {activePage === 'top-ten' && (
                <TopTenStudentsView
                  db={db}
                  initialExamId={navContext.examId}
                  initialClassId={navContext.classId}
                  onViewGradeSheet={(stu, exId) =>
                    navigate('grade-sheet', {
                      examId: exId,
                      classId: stu.classId,
                      sectionId: stu.sectionId,
                      studentId: stu.id,
                    })
                  }
                />
              )}
              {activePage === 'grade-sheet' && (
                <GradeSheetView
                  db={db}
                  initialExamId={navContext.examId}
                  initialClassId={navContext.classId}
                  initialSectionId={navContext.sectionId}
                  initialStudentId={navContext.studentId}
                  onUpdateMarks={(marks) => persistDb({ ...db, marks })}
                />
              )}
              {activePage === 'excel-io' && (
                <ExcelIOView
                  db={db}
                  onUpdateStudents={(students) => persistDb({ ...db, students })}
                  onUpdateMarks={(marks) => persistDb({ ...db, marks })}
                />
              )}
              {activePage === 'admin-security' && (
                <AdminPasswordView
                  db={db}
                  userRole={userRole}
                  onUpdateAdminSecurity={(admin_security) => {
                    persistDb({ ...db, admin_security });
                    if (admin_security.isConfigured) {
                      sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
                      setIsAdminUnlocked(true);
                    } else {
                      sessionStorage.removeItem(ADMIN_SESSION_KEY);
                      setIsAdminUnlocked(true);
                    }
                  }}
                  onLockAdminSession={lockAdminSession}
                />
              )}
              {activePage === 'settings' && (
                <SettingsView
                  db={db}
                  onSaveSettingsAndExams={async (
                    settings: SchoolSettings,
                    exams: Exam[],
                  ) => {
                    const workingDaysByExamId = new Map<string, number>();
                    for (const ex of exams) {
                      workingDaysByExamId.set(ex.id, ex.workingDays);
                    }
                    const marks = db.marks.map((m) => {
                      const nextDays = workingDaysByExamId.get(m.examId);
                      return nextDays ? { ...m, workingDays: nextDays } : m;
                    });
                    const academicYears = Array.from(
                      new Set([
                        ...(db.academicYears || []),
                        settings.academicYear,
                      ]),
                    ).filter(Boolean);
                    return persistDb({
                      ...db,
                      settings,
                      exams,
                      marks,
                      academicYears,
                    });
                  }}
                  onResetDemo={handleResetDemo}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Mobile App Bottom Navigation Bar */}
      {!adminLockActive && (
        <nav
          aria-label="Mobile bottom navigation"
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 px-1 py-1 no-print"
        >
          {userRole === 'teacher' ? (
            <div className="grid grid-cols-4 gap-1">
              <button
                type="button"
                onClick={() => navigate('teacher-dashboard')}
                className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-[11px] font-semibold min-h-[48px] ${
                  activePage === 'teacher-dashboard'
                    ? 'text-pink-700 bg-pink-50'
                    : 'text-slate-600'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 mb-0.5" />
                <span>Subjects</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('marks-entry')}
                className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-[11px] font-semibold min-h-[48px] ${
                  activePage === 'marks-entry'
                    ? 'text-pink-700 bg-pink-50'
                    : 'text-slate-600'
                }`}
              >
                <Edit3 className="w-4 h-4 mb-0.5" />
                <span>Marks</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('students')}
                className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-[11px] font-semibold min-h-[48px] ${
                  activePage === 'students'
                    ? 'text-pink-700 bg-pink-50'
                    : 'text-slate-600'
                }`}
              >
                <Users className="w-4 h-4 mb-0.5" />
                <span>Students</span>
              </button>
              <button
                type="button"
                onClick={() => signOutToPortalEntry('select')}
                className="flex flex-col items-center justify-center py-1.5 rounded-lg text-[11px] font-semibold min-h-[48px] text-slate-600 hover:text-pink-700"
              >
                <LogOut className="w-4 h-4 mb-0.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-1">
              <button
                type="button"
                onClick={() => navigate('dashboard')}
                className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-[11px] font-semibold min-h-[48px] ${
                  activePage === 'dashboard'
                    ? 'text-indigo-700 bg-indigo-50'
                    : 'text-slate-600'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 mb-0.5" />
                <span>Home</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('marks-entry')}
                className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-[11px] font-semibold min-h-[48px] ${
                  activePage === 'marks-entry'
                    ? 'text-indigo-700 bg-indigo-50'
                    : 'text-slate-600'
                }`}
              >
                <Edit3 className="w-4 h-4 mb-0.5" />
                <span>Marks</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('teacher-passports')}
                className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-[11px] font-semibold min-h-[48px] ${
                  activePage === 'teacher-passports'
                    ? 'text-pink-700 bg-pink-50'
                    : 'text-slate-600'
                }`}
              >
                <KeyRound className="w-4 h-4 mb-0.5" />
                <span>Passports</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('grade-sheet')}
                className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-[11px] font-semibold min-h-[48px] ${
                  activePage === 'grade-sheet'
                    ? 'text-indigo-700 bg-indigo-50'
                    : 'text-slate-600'
                }`}
              >
                <GraduationCap className="w-4 h-4 mb-0.5" />
                <span>Grades</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="flex flex-col items-center justify-center py-1.5 rounded-lg text-[11px] font-semibold min-h-[48px] text-slate-600"
              >
                <Menu className="w-4 h-4 mb-0.5" />
                <span>Menu</span>
              </button>
            </div>
          )}
        </nav>
      )}

      <OfflineIndicator />
    </div>
  );
}
