import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import {
  AdminSecurityConfig,
  SchoolDatabase,
  TeacherPassport,
} from '../types';
import {
  DEFAULT_AUTHORIZED_ADMIN_EMAIL,
  createDefaultAdminSecurity,
} from '../data/seedData';
import {
  DEFAULT_PASSWORD_REQUIREMENTS,
  createSalt,
  evaluateAdminPassword,
  generateCompliantAdminPassword,
  hashSecret,
  hashTeacherPasscode,
} from '../utils/passwordSecurity';

export type PasswordModalMode = 'admin' | 'teacher' | null;

interface PasswordManagementModalProps {
  mode: PasswordModalMode;
  db: SchoolDatabase;
  isAuthorizedAdmin: boolean;
  adminSessionEmail: string;
  onClose: () => void;
  onSaveAdminSecurity: (
    config: AdminSecurityConfig,
  ) => Promise<{ ok: boolean; mode: 'server' | 'local' }>;
  onSaveTeacherPassports: (
    passports: TeacherPassport[],
  ) => Promise<{ ok: boolean; mode: 'server' | 'local' }>;
  onOpenAdvancedAdminSecurity: () => void;
}

export const PasswordManagementModal: React.FC<PasswordManagementModalProps> = ({
  mode,
  db,
  isAuthorizedAdmin,
  adminSessionEmail,
  onClose,
  onSaveAdminSecurity,
  onSaveTeacherPassports,
  onOpenAdvancedAdminSecurity,
}) => {
  const adminSec = db.admin_security || createDefaultAdminSecurity();
  const activeTeachers = useMemo(
    () => db.teachers.filter((t) => t.status === 'active'),
    [db.teachers],
  );
  const passports = db.teacher_passports || [];

  const defaultTeacherId = useMemo(() => {
    const withPassport = activeTeachers.find((t) =>
      passports.some((p) => p.assignedTeacherId === t.id && p.status === 'active'),
    );
    return withPassport?.id || activeTeachers[0]?.id || '';
  }, [activeTeachers, passports]);

  const [selectedTeacherId, setSelectedTeacherId] =
    useState<string>(defaultTeacherId);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryAnswer, setRecoveryAnswer] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!mode) return;
    setSelectedTeacherId(defaultTeacherId);
    setNewPassword('');
    setConfirmPassword('');
    setRecoveryAnswer('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setFeedback(null);
    setSaving(false);
  }, [mode, defaultTeacherId]);

  const activeRequirements =
    mode === 'admin'
      ? adminSec.requirements || DEFAULT_PASSWORD_REQUIREMENTS
      : DEFAULT_PASSWORD_REQUIREMENTS;

  const evaluation = useMemo(
    () =>
      evaluateAdminPassword(newPassword, confirmPassword, activeRequirements),
    [newPassword, confirmPassword, activeRequirements],
  );

  if (!mode) return null;

  const selectedTeacher = activeTeachers.find((t) => t.id === selectedTeacherId);
  const selectedPassport = passports.find(
    (p) => p.assignedTeacherId === selectedTeacherId && p.status === 'active',
  );

  const handleGenerate = () => {
    const generated = generateCompliantAdminPassword(
      Math.max(12, activeRequirements.minLength || 8),
    );
    setNewPassword(generated);
    setConfirmPassword(generated);
    setShowNewPassword(true);
    setShowConfirmPassword(true);
    setFeedback(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!isAuthorizedAdmin) {
      setFeedback({
        type: 'error',
        message:
          'Access Denied: Only the authorized Admin user can create or change passwords.',
      });
      return;
    }

    if (!evaluation.allRequirementsMet) {
      setFeedback({
        type: 'error',
        message: !evaluation.confirmMatches
          ? 'Passwords do not match. Ensure New Password and Confirm Password are identical.'
          : 'Password does not meet all security strength requirements below.',
      });
      return;
    }

    setSaving(true);
    try {
      if (mode === 'admin') {
        const expectedEmail = (
          adminSec.authorizedAdminEmail || DEFAULT_AUTHORIZED_ADMIN_EMAIL
        )
          .trim()
          .toLowerCase();

        // Try server-side hashed persistence first
        try {
          const res = await fetch('/api/admin-security/setup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              currentEmail: adminSessionEmail || expectedEmail,
              authorizedAdminEmail: expectedEmail,
              authorizedAdminSession: true,
              adminUsername: adminSec.adminUsername || 'admin',
              adminDisplayName:
                adminSec.adminDisplayName || 'Principal / Exam Admin',
              newPassword,
              confirmPassword,
              recoveryQuestion: adminSec.recoveryQuestion,
              recoveryAnswer: recoveryAnswer.trim() || undefined,
              requireOnRoleSwitch: adminSec.requireOnRoleSwitch,
              requireOnAppStart: adminSec.requireOnAppStart,
              maxFailedAttempts: adminSec.maxFailedAttempts,
              requirements: adminSec.requirements,
            }),
          });
          if (res.ok) {
            const payload = (await res.json()) as {
              ok: boolean;
              admin_security: AdminSecurityConfig;
            };
            await onSaveAdminSecurity(payload.admin_security);
            setNewPassword('');
            setConfirmPassword('');
            setRecoveryAnswer('');
            setFeedback({
              type: 'success',
              message:
                'Admin login password hashed and saved securely. Teacher account passwords were not affected.',
            });
            return;
          }
          if (res.status === 403 || res.status === 400 || res.status === 401) {
            const errBody = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            setFeedback({
              type: 'error',
              message: errBody.error || 'Failed to save Admin password.',
            });
            return;
          }
        } catch {
          // Static / offline fallback below
        }

        const nextSalt = createSalt();
        const cleanRecovery = recoveryAnswer.trim().toLowerCase();
        const updatedAdminConfig: AdminSecurityConfig = {
          ...adminSec,
          isConfigured: true,
          authorizedAdminEmail: expectedEmail,
          strictSingleUserOnly: true,
          passwordSalt: nextSalt,
          passwordHash: hashSecret(newPassword, nextSalt),
          recoveryAnswerHash: cleanRecovery
            ? hashSecret(cleanRecovery, nextSalt)
            : adminSec.recoveryAnswerHash || '',
          updatedDate: new Date().toISOString().slice(0, 10),
          updatedBy: 'Admin',
        };
        await onSaveAdminSecurity(updatedAdminConfig);
        setNewPassword('');
        setConfirmPassword('');
        setRecoveryAnswer('');
        setFeedback({
          type: 'success',
          message:
            'Admin login password hashed and saved securely. Teacher account passwords were not affected.',
        });
        return;
      }

      // Teacher password creation / update (strictly isolated from Admin password)
      if (!selectedTeacherId || !selectedTeacher) {
        setFeedback({
          type: 'error',
          message: 'Please select an active Teacher account.',
        });
        return;
      }

      try {
        const res = await fetch('/api/teacher-password/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentEmail:
              adminSessionEmail ||
              adminSec.authorizedAdminEmail ||
              DEFAULT_AUTHORIZED_ADMIN_EMAIL,
            teacherId: selectedTeacher.id,
            passportId: selectedPassport?.id,
            newPassword,
            confirmPassword,
          }),
        });
        if (res.ok) {
          const payload = (await res.json()) as {
            ok: boolean;
            teacher_passports: TeacherPassport[];
            updatedPassport?: TeacherPassport;
          };
          await onSaveTeacherPassports(payload.teacher_passports);
          const loginId =
            payload.updatedPassport?.username ||
            selectedPassport?.username ||
            selectedTeacher.name;
          setNewPassword('');
          setConfirmPassword('');
          setFeedback({
            type: 'success',
            message: `Teacher password for ${selectedTeacher.name} (${loginId}) hashed and saved securely. Admin password was not affected.`,
          });
          return;
        }
        if (res.status === 403 || res.status === 400 || res.status === 404) {
          const errBody = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          setFeedback({
            type: 'error',
            message: errBody.error || 'Failed to save Teacher password.',
          });
          return;
        }
      } catch {
        // Static / offline fallback below
      }

      const today = new Date().toISOString().slice(0, 10);
      const { passwordSalt, passwordHash } = hashTeacherPasscode(newPassword);
      let nextPassports: TeacherPassport[];
      let loginUser = selectedPassport?.username || '';

      if (selectedPassport) {
        nextPassports = passports.map((p) =>
          p.id === selectedPassport.id
            ? {
                ...p,
                passcode: '',
                passwordSalt,
                passwordHash,
                passwordUpdatedDate: today,
                passwordUpdatedBy: 'Admin',
              }
            : p,
        );
      } else {
        const cleanBase =
          selectedTeacher.name
            .toLowerCase()
            .replace(/[^a-z\s]/g, '')
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .join('.') || selectedTeacher.teacherCode.toLowerCase();
        const usedUsernames = new Set(
          passports.map((p) => p.username.toLowerCase()),
        );
        loginUser = cleanBase;
        let idx = 2;
        while (usedUsernames.has(loginUser)) {
          loginUser = `${cleanBase}${idx}`;
          idx += 1;
        }
        const yrDigits =
          (db.settings.academicYear || '2082').replace(/[^0-9]/g, '') || '2082';
        let seq = passports.length + 1;
        let passportNumber = `ARISTO-PP-${yrDigits}-${String(seq).padStart(3, '0')}`;
        const usedNumbers = new Set(
          passports.map((p) => p.passportNumber.toLowerCase()),
        );
        while (usedNumbers.has(passportNumber.toLowerCase())) {
          seq += 1;
          passportNumber = `ARISTO-PP-${yrDigits}-${String(seq).padStart(3, '0')}`;
        }
        const createdPassport: TeacherPassport = {
          id: `pp-${Date.now()}`,
          passportNumber,
          passportTitle: 'Teacher Portal Credential',
          username: loginUser,
          passcode: '',
          passwordSalt,
          passwordHash,
          passwordUpdatedDate: today,
          passwordUpdatedBy: 'Admin',
          assignedTeacherId: selectedTeacher.id,
          issuedDate: today,
          expiryDate: '2084-12-30',
          status: 'active',
          notes: 'Created from Admin Teacher Password manager',
          createdBy: 'Admin',
          createdDate: today,
          assignedDate: today,
        };
        nextPassports = [createdPassport, ...passports];
      }

      await onSaveTeacherPassports(nextPassports);
      setNewPassword('');
      setConfirmPassword('');
      setFeedback({
        type: 'success',
        message: `Teacher password for ${selectedTeacher.name} (${loginUser}) hashed and saved securely. Admin password was not affected.`,
      });
    } finally {
      setSaving(false);
    }
  };

  const strengthColors = [
    'bg-slate-200',
    'bg-rose-500',
    'bg-amber-500',
    'bg-sky-500',
    'bg-emerald-600',
  ];

  const requirementItems = [
    {
      label: `At least ${activeRequirements.minLength || 8} characters`,
      met: evaluation.minLengthMet,
      active: true,
    },
    {
      label: 'Uppercase letter (A–Z)',
      met: evaluation.uppercaseMet,
      active: activeRequirements.requireUppercase,
    },
    {
      label: 'Lowercase letter (a–z)',
      met: evaluation.lowercaseMet,
      active: activeRequirements.requireLowercase,
    },
    {
      label: 'Numeric digit (0–9)',
      met: evaluation.numberMet,
      active: activeRequirements.requireNumber,
    },
    {
      label: 'Special character (!@#$%&*)',
      met: evaluation.specialCharMet,
      active: activeRequirements.requireSpecialChar,
    },
    {
      label: 'No spaces allowed',
      met: evaluation.noSpacesMet,
      active: true,
    },
    {
      label: 'Passwords match',
      met: evaluation.confirmMatches,
      active: true,
    },
  ].filter((item) => item.active);

  const isAdminMode = mode === 'admin';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-4 overflow-y-auto no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwd-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div
          className={`px-5 py-4 flex items-center justify-between gap-3 border-b ${
            isAdminMode
              ? 'bg-gradient-to-r from-indigo-700 to-indigo-800 text-white border-indigo-700'
              : 'bg-gradient-to-r from-pink-700 to-rose-700 text-white border-pink-700'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              {isAdminMode ? (
                <Lock className="w-5 h-5" />
              ) : (
                <UserCheck className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h2
                id="pwd-modal-title"
                className="text-base font-bold leading-tight truncate"
              >
                {isAdminMode
                  ? 'Create Admin Password'
                  : 'Create Teacher Password'}
              </h2>
              <p className="text-xs text-white/85 truncate">
                {isAdminMode
                  ? 'Create or change the Admin portal login password'
                  : 'Create or change a Teacher portal login password'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close password form"
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} noValidate className="p-5 space-y-4">
          {!isAuthorizedAdmin && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-3 flex items-start gap-2.5 text-xs font-medium text-rose-900">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>
                Access Denied: Only the authorized Admin user can create or
                change passwords.
              </span>
            </div>
          )}

          {feedback && (
            <div
              role="alert"
              className={`rounded-xl px-3.5 py-3 border flex items-start gap-2.5 text-xs font-medium ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {isAdminMode ? (
            <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <div className="font-semibold text-indigo-950">
                  Authorized Admin Account
                </div>
                <div className="font-mono text-[11px] text-indigo-800 truncate">
                  {adminSec.authorizedAdminEmail ||
                    DEFAULT_AUTHORIZED_ADMIN_EMAIL}{' '}
                  · @{adminSec.adminUsername || 'admin'}
                </div>
              </div>
              <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-white border border-indigo-200 text-indigo-700 shrink-0">
                {adminSec.isConfigured ? 'Change Password' : 'New Setup'}
              </span>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div>
                <label
                  htmlFor="teacher-account-select"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Select Teacher Account
                </label>
                <select
                  id="teacher-account-select"
                  value={selectedTeacherId}
                  onChange={(e) => {
                    setSelectedTeacherId(e.target.value);
                    setFeedback(null);
                  }}
                  disabled={!isAuthorizedAdmin || saving}
                  className="w-full px-3 py-2.5 text-xs border border-pink-200 rounded-xl bg-white focus:outline-none focus:border-pink-500"
                >
                  {activeTeachers.map((t) => {
                    const pp = passports.find(
                      (p) =>
                        p.assignedTeacherId === t.id && p.status === 'active',
                    );
                    return (
                      <option key={t.id} value={t.id}>
                        {t.name} ({pp ? `@${pp.username}` : t.teacherCode})
                      </option>
                    );
                  })}
                </select>
              </div>
              {selectedTeacher && (
                <div className="bg-pink-50/70 border border-pink-200 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <div className="font-semibold text-pink-950 truncate">
                      {selectedTeacher.name}
                    </div>
                    <div className="text-[11px] text-pink-900 font-mono truncate">
                      {selectedPassport
                        ? `Login: ${selectedPassport.username} · ${selectedPassport.passportNumber}`
                        : 'A login username & passport will be generated on save'}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-white border border-pink-200 text-pink-700 shrink-0">
                    {selectedPassport?.passwordHash ? 'Hashed' : 'Teacher'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* New Password & Confirm Password Fields */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Password Credentials (Hashed Before Storage)
              </span>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!isAuthorizedAdmin || saving}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-colors ${
                  isAdminMode
                    ? 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200'
                    : 'text-pink-700 bg-pink-50 hover:bg-pink-100 border-pink-200'
                }`}
              >
                <RefreshCw className="w-3 h-3" />
                Auto-Generate
              </button>
            </div>

            <div>
              <label
                htmlFor="modal-new-password"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                New Password
              </label>
              <div className="relative">
                <input
                  id="modal-new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  disabled={!isAuthorizedAdmin || saving}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter strong new password"
                  className={`w-full pl-3.5 pr-10 py-2.5 text-sm font-mono border rounded-xl focus:outline-none disabled:bg-slate-100 ${
                    isAdminMode
                      ? 'border-slate-300 focus:border-indigo-500'
                      : 'border-pink-200 focus:border-pink-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  aria-label={
                    showNewPassword ? 'Hide new password' : 'Show new password'
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  {showNewPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="modal-confirm-password"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="modal-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  disabled={!isAuthorizedAdmin || saving}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className={`w-full pl-3.5 pr-10 py-2.5 text-sm font-mono border rounded-xl focus:outline-none disabled:bg-slate-100 ${
                    isAdminMode
                      ? 'border-slate-300 focus:border-indigo-500'
                      : 'border-pink-200 focus:border-pink-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  aria-label={
                    showConfirmPassword
                      ? 'Hide confirm password'
                      : 'Show confirm password'
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {isAdminMode && (
              <div>
                <label
                  htmlFor="modal-recovery-answer"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Recovery Answer{' '}
                  <span className="font-normal text-slate-500">
                    (Optional — {adminSec.recoveryQuestion})
                  </span>
                </label>
                <input
                  id="modal-recovery-answer"
                  type="text"
                  disabled={!isAuthorizedAdmin || saving}
                  value={recoveryAnswer}
                  onChange={(e) => setRecoveryAnswer(e.target.value)}
                  placeholder={
                    adminSec.recoveryAnswerHash
                      ? 'Leave blank to keep existing recovery answer'
                      : 'Optional PIN/word for Forgot Password recovery'
                  }
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500 disabled:bg-slate-100"
                />
              </div>
            )}
          </div>

          {/* Password Strength Meter & Checklist */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">
                Password Strength
              </span>
              <span
                className={`font-bold ${
                  evaluation.score >= 4
                    ? 'text-emerald-700'
                    : evaluation.score === 3
                      ? 'text-sky-700'
                      : evaluation.score === 2
                        ? 'text-amber-700'
                        : evaluation.score === 1
                          ? 'text-rose-700'
                          : 'text-slate-500'
                }`}
              >
                {evaluation.strengthLabel}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[1, 2, 3, 4].map((seg) => (
                <div
                  key={seg}
                  className={`h-1.5 rounded-full transition-colors ${
                    evaluation.score >= seg
                      ? strengthColors[evaluation.score]
                      : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-0.5">
              {requirementItems.map((req) => (
                <div
                  key={req.label}
                  className={`flex items-center gap-1.5 text-[11px] ${
                    req.met ? 'text-emerald-700 font-medium' : 'text-slate-500'
                  }`}
                >
                  {req.met ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  <span>{req.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {isAdminMode ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAdvancedAdminSecurity();
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Advanced Security Policy
              </button>
            ) : (
              <span className="text-[11px] text-slate-500">
                Stored using SHA-256 salted hash
              </span>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={!isAuthorizedAdmin || saving}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-xl transition-colors disabled:opacity-50 ${
                  isAdminMode
                    ? 'bg-indigo-700 hover:bg-indigo-800'
                    : 'bg-pink-700 hover:bg-pink-800'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                {saving
                  ? 'Hashing & Saving...'
                  : isAdminMode
                    ? 'Save Admin Password'
                    : 'Save Teacher Password'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
