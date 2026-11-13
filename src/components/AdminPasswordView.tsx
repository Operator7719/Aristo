import React, { useMemo, useState } from 'react';
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
  Unlock,
  X,
} from 'lucide-react';
import {
  AdminPasswordRequirements,
  AdminSecurityConfig,
  SchoolDatabase,
  UserRole,
} from '../types';
import {
  DEFAULT_AUTHORIZED_ADMIN_EMAIL,
  createDefaultAdminSecurity,
} from '../data/seedData';
import {
  createSalt,
  evaluateAdminPassword,
  generateCompliantAdminPassword,
  hashSecret,
} from '../utils/passwordSecurity';

interface AdminPasswordViewProps {
  db: SchoolDatabase;
  userRole: UserRole;
  onUpdateAdminSecurity: (config: AdminSecurityConfig) => void;
  onLockAdminSession: () => void;
}

const RECOVERY_QUESTIONS = [
  "What is the school's founding year (B.S.)?",
  "What is the Principal's office security word?",
  'What is the school IEMIS emergency PIN word?',
  'In which city/municipality is the school located?',
];

export const AdminPasswordView: React.FC<AdminPasswordViewProps> = ({
  db,
  userRole,
  onUpdateAdminSecurity,
  onLockAdminSession,
}) => {
  const isAdmin = userRole === 'admin';
  const currentConfig: AdminSecurityConfig =
    db.admin_security || createDefaultAdminSecurity();

  const [authorizedAdminEmail, setAuthorizedAdminEmail] = useState(
    currentConfig.authorizedAdminEmail || DEFAULT_AUTHORIZED_ADMIN_EMAIL,
  );
  const [adminUsername, setAdminUsername] = useState(
    currentConfig.adminUsername || 'admin',
  );
  const [adminDisplayName, setAdminDisplayName] = useState(
    currentConfig.adminDisplayName || 'Principal / Exam Admin',
  );
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [recoveryQuestion, setRecoveryQuestion] = useState(
    currentConfig.recoveryQuestion || RECOVERY_QUESTIONS[0],
  );
  const [recoveryAnswer, setRecoveryAnswer] = useState('');

  const [requirements, setRequirements] = useState<AdminPasswordRequirements>(
    currentConfig.requirements || createDefaultAdminSecurity().requirements,
  );
  const [requireOnRoleSwitch, setRequireOnRoleSwitch] = useState<boolean>(
    currentConfig.requireOnRoleSwitch ?? true,
  );
  const [requireOnAppStart, setRequireOnAppStart] = useState<boolean>(
    currentConfig.requireOnAppStart ?? false,
  );
  const [maxFailedAttempts, setMaxFailedAttempts] = useState<number>(
    currentConfig.maxFailedAttempts || 5,
  );

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [confirmDisable, setConfirmDisable] = useState(false);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  const evaluation = useMemo(
    () => evaluateAdminPassword(newPassword, confirmPassword, requirements),
    [newPassword, confirmPassword, requirements],
  );

  const handleGenerateStrong = () => {
    const generated = generateCompliantAdminPassword(
      Math.max(12, requirements.minLength),
    );
    setNewPassword(generated);
    setConfirmPassword(generated);
    setShowNew(true);
    setShowConfirm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    const cleanAuthorizedEmail = authorizedAdminEmail.trim().toLowerCase();
    if (
      !cleanAuthorizedEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanAuthorizedEmail)
    ) {
      showFeedback(
        'error',
        'A valid single Authorized Admin Email is required.',
      );
      return;
    }

    if (!adminUsername.trim()) {
      showFeedback('error', 'Admin Username is required.');
      return;
    }

    if (currentConfig.isConfigured) {
      if (!currentPassword) {
        showFeedback(
          'error',
          'Enter your Current Admin Password to verify authorization.',
        );
        return;
      }
      const currentValid =
        hashSecret(currentPassword, currentConfig.passwordSalt) ===
        currentConfig.passwordHash;
      if (!currentValid) {
        showFeedback('error', 'Current Admin Password is incorrect.');
        return;
      }
    }

    const wantsPasswordChange =
      !currentConfig.isConfigured || newPassword.length > 0 || confirmPassword.length > 0;

    if (wantsPasswordChange && !evaluation.allRequirementsMet) {
      showFeedback(
        'error',
        'Please satisfy all required Admin Password rules and confirm matching passwords.',
      );
      return;
    }

    const cleanRecovery = recoveryAnswer.trim().toLowerCase();
    if (!currentConfig.isConfigured && !cleanRecovery) {
      showFeedback(
        'error',
        'Recovery Answer is required when creating an Admin Password so you can reset access if forgotten.',
      );
      return;
    }

    const today = new Date().toISOString().slice(0, 10);

    if (wantsPasswordChange) {
      const nextSalt = createSalt();
      const nextPasswordHash = hashSecret(newPassword, nextSalt);
      const nextRecoveryHash = cleanRecovery
        ? hashSecret(cleanRecovery, nextSalt)
        : currentConfig.recoveryAnswerHash
          ? (() => {
              showFeedback(
                'error',
                'Re-enter your Recovery Answer when setting a new Admin Password.',
              );
              return '';
            })()
          : '';

      if (!nextRecoveryHash) return;

      const updated: AdminSecurityConfig = {
        isConfigured: true,
        authorizedAdminEmail: cleanAuthorizedEmail,
        strictSingleUserOnly: true,
        adminUsername: adminUsername.trim(),
        adminDisplayName: adminDisplayName.trim() || 'Principal / Exam Admin',
        passwordSalt: nextSalt,
        passwordHash: nextPasswordHash,
        recoveryQuestion: recoveryQuestion.trim() || RECOVERY_QUESTIONS[0],
        recoveryAnswerHash: nextRecoveryHash,
        requireOnRoleSwitch,
        requireOnAppStart,
        maxFailedAttempts,
        requirements,
        updatedDate: today,
        updatedBy: 'Admin',
      };
      onUpdateAdminSecurity(updated);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setRecoveryAnswer('');
      showFeedback(
        'success',
        currentConfig.isConfigured
          ? 'Admin Password and single-user security policy updated successfully.'
          : 'Admin Password created and single-user Admin Portal protection is now active.',
      );
      return;
    }

    // Policy-only update when password already configured and newPassword left blank
    const nextRecoveryHash = cleanRecovery
      ? hashSecret(cleanRecovery, currentConfig.passwordSalt)
      : currentConfig.recoveryAnswerHash;

    onUpdateAdminSecurity({
      ...currentConfig,
      authorizedAdminEmail: cleanAuthorizedEmail,
      strictSingleUserOnly: true,
      adminUsername: adminUsername.trim(),
      adminDisplayName: adminDisplayName.trim() || 'Principal / Exam Admin',
      recoveryQuestion: recoveryQuestion.trim() || currentConfig.recoveryQuestion,
      recoveryAnswerHash: nextRecoveryHash,
      requireOnRoleSwitch,
      requireOnAppStart,
      maxFailedAttempts,
      requirements,
      updatedDate: today,
      updatedBy: 'Admin',
    });
    setCurrentPassword('');
    setRecoveryAnswer('');
    showFeedback('success', 'Admin security policy settings updated.');
  };

  const handleDisableAdminLock = () => {
    if (!isAdmin || !currentConfig.isConfigured) return;
    if (!currentPassword) {
      showFeedback(
        'error',
        'Enter your Current Admin Password above before disabling Admin Password protection.',
      );
      setConfirmDisable(false);
      return;
    }
    const valid =
      hashSecret(currentPassword, currentConfig.passwordSalt) ===
      currentConfig.passwordHash;
    if (!valid) {
      showFeedback('error', 'Current Admin Password is incorrect.');
      setConfirmDisable(false);
      return;
    }

    onUpdateAdminSecurity({
      ...createDefaultAdminSecurity(),
      authorizedAdminEmail:
        authorizedAdminEmail.trim().toLowerCase() ||
        DEFAULT_AUTHORIZED_ADMIN_EMAIL,
      strictSingleUserOnly: true,
      adminUsername: adminUsername.trim() || 'admin',
      adminDisplayName: adminDisplayName.trim() || 'Principal / Exam Admin',
      updatedDate: new Date().toISOString().slice(0, 10),
    });
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setRecoveryAnswer('');
    setConfirmDisable(false);
    showFeedback(
      'success',
      'Admin Password removed. Admin Portal is currently unlocked.',
    );
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
      label: `Minimum ${requirements.minLength} characters`,
      met: evaluation.minLengthMet,
      active: true,
    },
    {
      label: 'At least 1 uppercase letter (A–Z)',
      met: evaluation.uppercaseMet,
      active: requirements.requireUppercase,
    },
    {
      label: 'At least 1 lowercase letter (a–z)',
      met: evaluation.lowercaseMet,
      active: requirements.requireLowercase,
    },
    {
      label: 'At least 1 numeric digit (0–9)',
      met: evaluation.numberMet,
      active: requirements.requireNumber,
    },
    {
      label: 'At least 1 special character (! @ # $ % & *)',
      met: evaluation.specialCharMet,
      active: requirements.requireSpecialChar,
    },
    {
      label: 'No spaces allowed',
      met: evaluation.noSpacesMet,
      active: true,
    },
    {
      label: 'Confirm password matches',
      met: evaluation.confirmMatches,
      active: true,
    },
  ].filter((item) => item.active);

  return (
    <div className="space-y-5">
      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2 text-xs font-medium text-amber-900">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            Admin Authority Required: Only Administrators can configure Admin Password security.
          </span>
        </div>
      )}

      {feedback && (
        <div
          className={`rounded-xl px-4 py-3 border flex items-center justify-between gap-3 text-sm font-medium ${
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

      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Administrator Access Control</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            {currentConfig.isConfigured
              ? 'Manage Admin Password & Security Policy'
              : 'Create Admin Password'}
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Protect school grading records, teacher passports, and system settings with a strong Admin Password and recovery policy.
          </p>
        </div>
        {currentConfig.isConfigured && isAdmin && (
          <button
            type="button"
            onClick={onLockAdminSession}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg whitespace-nowrap shrink-0"
          >
            <Lock className="w-3.5 h-3.5" />
            Lock Admin Screen Now
          </button>
        )}
      </div>

      {/* 4 KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-2">
            <span>Protection Status</span>
            {currentConfig.isConfigured ? (
              <Lock className="w-4 h-4 text-emerald-600" />
            ) : (
              <Unlock className="w-4 h-4 text-amber-600" />
            )}
          </div>
          <div
            className={`text-lg font-bold ${
              currentConfig.isConfigured ? 'text-emerald-700' : 'text-amber-700'
            }`}
          >
            {currentConfig.isConfigured ? 'Password Active' : 'Not Configured'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">
            Only: <span className="font-mono">{currentConfig.authorizedAdminEmail || DEFAULT_AUTHORIZED_ADMIN_EMAIL}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-2">
            <span>Role Switch Guard</span>
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-lg font-bold text-slate-900">
            {currentConfig.requireOnRoleSwitch ? 'Required' : 'Off'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Teacher to Admin switch
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-2">
            <span>Startup Lock</span>
            <KeyRound className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-lg font-bold text-slate-900">
            {currentConfig.requireOnAppStart ? 'Locked on Open' : 'Session Open'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Max attempts: <span className="font-mono tabular-nums">{currentConfig.maxFailedAttempts}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-2">
            <span>Last Updated</span>
            <CheckCircle2 className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono">
            {currentConfig.updatedDate || 'Pending'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Min length: <span className="font-mono tabular-nums">{requirements.minLength}</span> chars
          </div>
        </div>
      </div>

      {/* Main Form + Policy Sidebar */}
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 xl:grid-cols-12 gap-5"
      >
        {/* Left: Password Setup & Requirements Checklist */}
        <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {currentConfig.isConfigured
                  ? 'Update Admin Credentials'
                  : 'Set Up Admin Password'}
              </h3>
              <p className="text-xs text-slate-500">
                {currentConfig.isConfigured
                  ? 'Enter your current password to set a new password or update security rules.'
                  : 'Create a strong Admin Password meeting all security requirements below.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleGenerateStrong}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Auto-Generate
            </button>
          </div>

          <div className="bg-indigo-50/70 border border-indigo-200 rounded-lg p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-indigo-950">
                Single Authorized Admin Email (Exclusive Access)
              </label>
              <span className="text-[11px] font-semibold text-indigo-700">
                1 User Only
              </span>
            </div>
            <input
              type="email"
              required
              value={authorizedAdminEmail}
              onChange={(e) => setAuthorizedAdminEmail(e.target.value)}
              placeholder="nirmaldahit@gmail.com"
              className="w-full px-3 py-2 text-xs font-mono border border-indigo-200 rounded-lg bg-white focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[11px] text-indigo-900">
              Only this single email address can open or unlock the Admin Panel. Other users and other email addresses are strictly blocked.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Admin Login Username
              </label>
              <input
                type="text"
                required
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                placeholder="admin"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Administrator Title
              </label>
              <input
                type="text"
                value={adminDisplayName}
                onChange={(e) => setAdminDisplayName(e.target.value)}
                placeholder="Principal / Exam Admin"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {currentConfig.isConfigured && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Current Admin Password (Required to save changes)
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current Admin Password"
                  className="w-full pl-3 pr-9 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  {showCurrent ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {currentConfig.isConfigured
                  ? 'New Admin Password (optional if updating policy)'
                  : 'New Admin Password'}
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  required={!currentConfig.isConfigured}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter strong password"
                  className="w-full pl-3 pr-9 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  {showNew ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirm Admin Password
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required={!currentConfig.isConfigured}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full pl-3 pr-9 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  {showConfirm ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Strength Meter & Live Requirements Checklist */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-3">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
              {requirementItems.map((req) => (
                <div
                  key={req.label}
                  className={`flex items-center gap-1.5 text-xs ${
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

          {/* Password Recovery Setup */}
          <div className="border-t border-slate-200 pt-3.5 space-y-3">
            <div>
              <h4 className="text-xs font-bold text-slate-800">
                Emergency Password Recovery
              </h4>
              <p className="text-[11px] text-slate-500">
                Used to reset Admin access if the Admin Password is forgotten.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Security Question
                </label>
                <select
                  value={recoveryQuestion}
                  onChange={(e) => setRecoveryQuestion(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {RECOVERY_QUESTIONS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Recovery Answer / PIN{' '}
                  {currentConfig.isConfigured && '(Enter to update)'}
                </label>
                <input
                  type="text"
                  required={!currentConfig.isConfigured}
                  value={recoveryAnswer}
                  onChange={(e) => setRecoveryAnswer(e.target.value)}
                  placeholder={
                    currentConfig.isConfigured
                      ? 'Leave blank to keep existing'
                      : 'e.g. 2049'
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            {currentConfig.isConfigured ? (
              confirmDisable ? (
                <div className="inline-flex items-center gap-2 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg text-xs">
                  <span className="text-rose-900 font-medium">
                    Remove Admin Password lock?
                  </span>
                  <button
                    type="button"
                    onClick={handleDisableAdminLock}
                    className="px-2.5 py-1 bg-rose-600 text-white font-semibold rounded hover:bg-rose-700"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDisable(false)}
                    className="px-2 py-1 bg-white border border-slate-300 text-slate-700 rounded"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDisable(true)}
                  className="text-xs font-semibold text-rose-700 hover:underline"
                >
                  Remove Admin Password Protection
                </button>
              )
            ) : (
              <span />
            )}

            <button
              type="submit"
              disabled={!isAdmin}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 rounded-lg"
            >
              <ShieldCheck className="w-4 h-4" />
              {currentConfig.isConfigured
                ? 'Save Admin Password & Policy'
                : 'Create Admin Password'}
            </button>
          </div>
        </div>

        {/* Right: Security & Password Policy Configuration */}
        <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-base font-bold text-slate-900">
              Password &amp; Access Requirements
            </h3>
            <p className="text-xs text-slate-500">
              Customize complexity rules and when the Admin Password is enforced.
            </p>
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-2.5 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={requireOnRoleSwitch}
                onChange={(e) => setRequireOnRoleSwitch(e.target.checked)}
                className="mt-0.5 accent-indigo-700"
              />
              <div>
                <div className="text-xs font-semibold text-slate-900">
                  Require Password on Teacher to Admin Switch
                </div>
                <div className="text-[11px] text-slate-500">
                  Prevents teachers from switching into Admin mode without entering the Admin Password.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={requireOnAppStart}
                onChange={(e) => setRequireOnAppStart(e.target.checked)}
                className="mt-0.5 accent-indigo-700"
              />
              <div>
                <div className="text-xs font-semibold text-slate-900">
                  Lock Admin Portal on Startup
                </div>
                <div className="text-[11px] text-slate-500">
                  Prompts for the Admin Password immediately whenever the portal opens in a new browser session.
                </div>
              </div>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Min Password Length
              </label>
              <select
                value={requirements.minLength}
                onChange={(e) =>
                  setRequirements({
                    ...requirements,
                    minLength: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono"
              >
                <option value={8}>8 characters</option>
                <option value={10}>10 characters</option>
                <option value={12}>12 characters</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Lockout After Failures
              </label>
              <select
                value={maxFailedAttempts}
                onChange={(e) => setMaxFailedAttempts(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono"
              >
                <option value={3}>3 attempts</option>
                <option value={5}>5 attempts</option>
                <option value={10}>10 attempts</option>
              </select>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3 space-y-2">
            <div className="text-xs font-bold text-slate-800">
              Enforced Character Requirements
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={requirements.requireUppercase}
                onChange={(e) =>
                  setRequirements({
                    ...requirements,
                    requireUppercase: e.target.checked,
                  })
                }
                className="accent-indigo-700"
              />
              <span>Require uppercase letters (A–Z)</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={requirements.requireLowercase}
                onChange={(e) =>
                  setRequirements({
                    ...requirements,
                    requireLowercase: e.target.checked,
                  })
                }
                className="accent-indigo-700"
              />
              <span>Require lowercase letters (a–z)</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={requirements.requireNumber}
                onChange={(e) =>
                  setRequirements({
                    ...requirements,
                    requireNumber: e.target.checked,
                  })
                }
                className="accent-indigo-700"
              />
              <span>Require numeric digits (0–9)</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={requirements.requireSpecialChar}
                onChange={(e) =>
                  setRequirements({
                    ...requirements,
                    requireSpecialChar: e.target.checked,
                  })
                }
                className="accent-indigo-700"
              />
              <span>Require special characters (! @ # $ % &amp; *)</span>
            </label>
          </div>
        </div>
      </form>
    </div>
  );
};
