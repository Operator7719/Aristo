import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  Lock,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import {
  AdminSecurityConfig,
  SchoolDatabase,
  Teacher,
  TeacherPassport,
} from '../types';
import {
  createSalt,
  evaluateAdminPassword,
  hashSecret,
} from '../utils/passwordSecurity';
import { PWAInstallButton } from './PWAInstallButton';

interface MobilePortalEntryProps {
  db: SchoolDatabase;
  initialOption?: 'select' | 'teacher' | 'admin';
  onTeacherAuthenticated: (passport: TeacherPassport, teacher: Teacher) => void;
  onAdminAuthenticated: (goToPasswordSetup?: boolean) => void;
  onUpdateAdminSecurity: (config: AdminSecurityConfig) => void;
}

export const MobilePortalEntry: React.FC<MobilePortalEntryProps> = ({
  db,
  initialOption = 'select',
  onTeacherAuthenticated,
  onAdminAuthenticated,
  onUpdateAdminSecurity,
}) => {
  const [selectedOption, setSelectedOption] = useState<
    'select' | 'teacher' | 'admin'
  >(initialOption);

  // Teacher Login state
  const [passportInput, setPassportInput] = useState('');
  const [passcodeInput, setPasscodeInput] = useState('');
  const [showTeacherCode, setShowTeacherCode] = useState(false);
  const [teacherError, setTeacherError] = useState<string | null>(null);

  // Admin Login state
  const adminSec = db.admin_security;
  const [adminUserInput, setAdminUserInput] = useState(
    adminSec?.adminUsername || 'admin',
  );
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showAdminPwd, setShowAdminPwd] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntilMs, setLockoutUntilMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [setupPasswordAfterLogin, setSetupPasswordAfterLogin] = useState(false);

  // Recovery state
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryAnswer, setRecoveryAnswer] = useState('');
  const [recoveryNewPwd, setRecoveryNewPwd] = useState('');
  const [recoveryConfirmPwd, setRecoveryConfirmPwd] = useState('');

  useEffect(() => {
    setSelectedOption(initialOption);
  }, [initialOption]);

  useEffect(() => {
    if (!lockoutUntilMs) return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNowMs(t);
      if (t >= lockoutUntilMs) {
        setLockoutUntilMs(null);
        setFailedAttempts(0);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [lockoutUntilMs]);

  const lockoutRemainingSec =
    lockoutUntilMs && lockoutUntilMs > nowMs
      ? Math.ceil((lockoutUntilMs - nowMs) / 1000)
      : 0;

  const handleTeacherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normId = passportInput.trim().toLowerCase();
    const rawPass = passcodeInput.trim();
    if (!normId || !rawPass) {
      setTeacherError('Please enter your Passport Number (or Username) and Passcode.');
      return;
    }
    const match = (db.teacher_passports || []).find(
      (p) =>
        (p.passportNumber.trim().toLowerCase() === normId ||
          p.username.trim().toLowerCase() === normId) &&
        p.passcode === rawPass,
    );
    if (!match) {
      setTeacherError('Invalid teacher passport number/username or passcode.');
      return;
    }
    if (match.status !== 'active') {
      setTeacherError(
        `This passport is ${match.status.toUpperCase()}. Contact School Admin.`,
      );
      return;
    }
    if (!match.assignedTeacherId) {
      setTeacherError(
        'This passport is not yet assigned to an individual teacher.',
      );
      return;
    }
    const holder = db.teachers.find(
      (t) => t.id === match.assignedTeacherId && t.status === 'active',
    );
    if (!holder) {
      setTeacherError('Assigned teacher account is inactive or missing.');
      return;
    }
    setTeacherError(null);
    onTeacherAuthenticated(match, holder);
  };

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutRemainingSec > 0) return;

    if (!adminSec?.isConfigured) {
      setAdminError(null);
      onAdminAuthenticated(setupPasswordAfterLogin);
      return;
    }

    const expectedUser = (adminSec.adminUsername || 'admin').trim().toLowerCase();
    if (adminUserInput.trim().toLowerCase() !== expectedUser) {
      setAdminError('Incorrect Admin Username.');
      return;
    }

    const valid =
      Boolean(adminPasswordInput) &&
      hashSecret(adminPasswordInput, adminSec.passwordSalt) ===
        adminSec.passwordHash;

    if (!valid) {
      const nextFails = failedAttempts + 1;
      const maxFails = adminSec.maxFailedAttempts || 5;
      setFailedAttempts(nextFails);
      if (nextFails >= maxFails) {
        setLockoutUntilMs(Date.now() + 30000);
        setNowMs(Date.now());
        setAdminError(
          `Too many failed attempts (${nextFails}/${maxFails}). Locked for 30 seconds.`,
        );
      } else {
        setAdminError(
          `Incorrect Admin Password (${nextFails}/${maxFails} attempts).`,
        );
      }
      return;
    }

    setAdminError(null);
    setFailedAttempts(0);
    setLockoutUntilMs(null);
    onAdminAuthenticated(false);
  };

  const handleRecoverySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminSec?.isConfigured) return;

    const cleanAns = recoveryAnswer.trim().toLowerCase();
    if (
      hashSecret(cleanAns, adminSec.passwordSalt) !==
      adminSec.recoveryAnswerHash
    ) {
      setAdminError('Recovery answer does not match our records.');
      return;
    }

    const evalRes = evaluateAdminPassword(
      recoveryNewPwd,
      recoveryConfirmPwd,
      adminSec.requirements,
    );
    if (!evalRes.allRequirementsMet) {
      setAdminError(
        `Password must be at least ${adminSec.requirements.minLength} characters with uppercase, lowercase, number, special character, and matching confirmation.`,
      );
      return;
    }

    const nextSalt = createSalt();
    const updated: AdminSecurityConfig = {
      ...adminSec,
      passwordSalt: nextSalt,
      passwordHash: hashSecret(recoveryNewPwd, nextSalt),
      recoveryAnswerHash: hashSecret(cleanAns, nextSalt),
      updatedDate: new Date().toISOString().slice(0, 10),
      updatedBy: 'Admin Recovery',
    };
    onUpdateAdminSecurity(updated);
    setAdminError(null);
    setRecoveryMode(false);
    onAdminAuthenticated(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-indigo-50/60 flex flex-col justify-between p-4 sm:p-6">
      {/* Top App Status / Install Row */}
      <div className="w-full max-w-md mx-auto flex items-center justify-between gap-3 pt-1">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-pink-900">
          <Smartphone className="w-3.5 h-3.5 text-pink-700" />
          <span>Aristo Mobile Portal</span>
        </div>
        <PWAInstallButton compact />
      </div>

      {/* Main Mobile App Card */}
      <div className="w-full max-w-md mx-auto my-6">
        {/* School Identity Header */}
        <div className="text-center mb-6 space-y-2">
          <img
            src="/assets/aistudio/2png_bb8dd55e.png"
            alt="Aristo English Boarding High School Logo"
            className="w-16 h-16 mx-auto rounded-2xl bg-white border border-pink-200 p-1 object-contain shadow-sm"
          />
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              {db.settings.schoolName}
            </h1>
            <p className="text-xs text-slate-600">
              {db.settings.address} · IEMIS {db.settings.iemisCode}
            </p>
          </div>
        </div>

        {/* STEP 1: TWO LOGIN OPTIONS (TEACHER LOGIN & ADMIN LOGIN) */}
        {selectedOption === 'select' && (
          <div className="bg-white border border-pink-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="text-center space-y-1 pb-1">
              <h2 className="text-base font-bold text-slate-900">
                Select Login Option
              </h2>
              <p className="text-xs text-slate-500">
                Choose your portal role below to sign in and access the system.
              </p>
            </div>

            <div className="space-y-3">
              {/* Teacher Login Option */}
              <button
                type="button"
                onClick={() => {
                  setTeacherError(null);
                  setSelectedOption('teacher');
                }}
                className="w-full text-left p-4 rounded-xl border-2 border-pink-200 bg-pink-50/50 hover:bg-pink-50 hover:border-pink-400 active:scale-[0.99] transition-all flex items-center justify-between gap-3 min-h-[76px]"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-pink-700 text-white flex items-center justify-center shrink-0">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900">
                      Teacher Login
                    </div>
                    <div className="text-xs text-slate-600 leading-snug mt-0.5">
                      Sign in with your Teacher Passport for marks entry &amp; assigned classes
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-pink-700 shrink-0" />
              </button>

              {/* Admin Login Option */}
              <button
                type="button"
                onClick={() => {
                  setAdminError(null);
                  setRecoveryMode(false);
                  setSelectedOption('admin');
                }}
                className="w-full text-left p-4 rounded-xl border-2 border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50 hover:border-indigo-400 active:scale-[0.99] transition-all flex items-center justify-between gap-3 min-h-[76px]"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-indigo-700 text-white flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900">
                      Admin Login
                    </div>
                    <div className="text-xs text-slate-600 leading-snug mt-0.5">
                      Manage exams, students, grade sheets, teacher passports &amp; settings
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-indigo-700 shrink-0" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2A: TEACHER LOGIN FORM */}
        {selectedOption === 'teacher' && (
          <div className="bg-white border border-pink-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <button
              type="button"
              onClick={() => {
                setTeacherError(null);
                setSelectedOption('select');
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-pink-800 hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Login Options
            </button>

            <div className="flex items-center gap-3 border-b border-pink-100 pb-3.5">
              <div className="w-11 h-11 rounded-xl bg-pink-700 text-white flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Teacher Login
                </h2>
                <p className="text-xs text-slate-600">
                  Enter your Admin-assigned Teacher Passport credentials.
                </p>
              </div>
            </div>

            {teacherError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium rounded-xl px-3.5 py-2.5 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{teacherError}</span>
              </div>
            )}

            <form onSubmit={handleTeacherSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-pink-950 mb-1">
                  Passport Number or Username
                </label>
                <input
                  type="text"
                  autoComplete="username"
                  value={passportInput}
                  onChange={(e) => setPassportInput(e.target.value)}
                  placeholder="Enter Passport Number or Username"
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-pink-200 rounded-xl focus:outline-none focus:border-pink-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-pink-950 mb-1">
                  Access Passcode
                </label>
                <div className="relative">
                  <input
                    type={showTeacherCode ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={passcodeInput}
                    onChange={(e) => setPasscodeInput(e.target.value)}
                    placeholder="Enter assigned passcode"
                    className="w-full pl-3.5 pr-10 py-2.5 text-sm font-mono border border-pink-200 rounded-xl focus:outline-none focus:border-pink-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTeacherCode((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pink-700"
                  >
                    {showTeacherCode ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-3 text-sm font-semibold text-white bg-pink-700 hover:bg-pink-800 rounded-xl transition-colors"
              >
                Sign In to Teacher Portal
              </button>
            </form>
          </div>
        )}

        {/* STEP 2B: ADMIN LOGIN FORM */}
        {selectedOption === 'admin' && (
          <div className="bg-white border border-indigo-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <button
              type="button"
              onClick={() => {
                setAdminError(null);
                setRecoveryMode(false);
                setSelectedOption('select');
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Login Options
            </button>

            <div className="flex items-center gap-3 border-b border-slate-200 pb-3.5">
              <div className="w-11 h-11 rounded-xl bg-indigo-700 text-white flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {recoveryMode ? 'Recover Admin Password' : 'Admin Login'}
                </h2>
                <p className="text-xs text-slate-600">
                  {adminSec?.isConfigured
                    ? `${adminSec.adminDisplayName} (${adminSec.adminUsername})`
                    : 'Administrator workspace access'}
                </p>
              </div>
            </div>

            {adminError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium rounded-xl px-3.5 py-2.5 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{adminError}</span>
              </div>
            )}

            {!recoveryMode ? (
              <form onSubmit={handleAdminSubmit} className="space-y-3.5">
                {adminSec?.isConfigured ? (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Admin Username
                      </label>
                      <input
                        type="text"
                        required
                        autoComplete="username"
                        value={adminUserInput}
                        onChange={(e) => setAdminUserInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Admin Password
                      </label>
                      <div className="relative">
                        <input
                          type={showAdminPwd ? 'text' : 'password'}
                          required
                          autoComplete="current-password"
                          disabled={lockoutRemainingSec > 0}
                          value={adminPasswordInput}
                          onChange={(e) =>
                            setAdminPasswordInput(e.target.value)
                          }
                          placeholder="Enter Admin Password"
                          className="w-full pl-3.5 pr-10 py-2.5 text-sm font-mono border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500 disabled:bg-slate-100"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAdminPwd((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                        >
                          {showAdminPwd ? (
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
                      className="w-full py-3 text-sm font-semibold text-white bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 rounded-xl transition-colors"
                    >
                      {lockoutRemainingSec > 0
                        ? `Locked (${lockoutRemainingSec}s remaining)`
                        : 'Sign In to Admin Portal'}
                    </button>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setRecoveryMode(true);
                          setAdminError(null);
                        }}
                        className="text-xs font-semibold text-indigo-700 hover:underline"
                      >
                        Forgot Admin Password?
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950 space-y-1">
                      <div className="font-semibold">
                        Admin Password Not Set Yet
                      </div>
                      <p className="text-[11px] text-amber-900">
                        You can enter the Admin Portal right now and create a strong Admin Password under Administration → Admin Password.
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={setupPasswordAfterLogin}
                        onChange={(e) =>
                          setSetupPasswordAfterLogin(e.target.checked)
                        }
                        className="accent-indigo-700"
                      />
                      <span>Open Create Admin Password screen right after sign-in</span>
                    </label>
                    <button
                      type="submit"
                      className="w-full py-3 text-sm font-semibold text-white bg-indigo-700 hover:bg-indigo-800 rounded-xl transition-colors"
                    >
                      Continue to Admin Portal
                    </button>
                  </>
                )}
              </form>
            ) : (
              <form onSubmit={handleRecoverySubmit} className="space-y-3.5">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
                  <div className="font-semibold text-slate-700 mb-0.5">
                    Security Question
                  </div>
                  <div className="text-slate-900">
                    {adminSec?.recoveryQuestion}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Recovery Answer
                  </label>
                  <input
                    type="text"
                    required
                    value={recoveryAnswer}
                    onChange={(e) => setRecoveryAnswer(e.target.value)}
                    placeholder="Enter recovery answer"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    New Admin Password
                  </label>
                  <input
                    type="password"
                    required
                    value={recoveryNewPwd}
                    onChange={(e) => setRecoveryNewPwd(e.target.value)}
                    placeholder="Enter strong password"
                    className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-xl"
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
                    className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-xl"
                  />
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setRecoveryMode(false);
                      setAdminError(null);
                    }}
                    className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-xl"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2.5 text-xs font-semibold text-white bg-indigo-700 hover:bg-indigo-800 rounded-xl"
                  >
                    Reset &amp; Sign In
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Footer Note */}
      <div className="text-center text-[11px] text-slate-500 pb-2">
        Academic Year {db.settings.academicYear} · Estd. {db.settings.estd}
      </div>
    </div>
  );
};
