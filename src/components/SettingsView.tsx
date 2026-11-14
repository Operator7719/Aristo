import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, Cloud, RotateCcw, Save } from 'lucide-react';
import {
  ActiveStatus,
  Exam,
  ExamTerm,
  GradingRule,
  SchoolDatabase,
  SchoolSettings,
} from '../types';
import { DEFAULT_AUTHORIZED_ADMIN_EMAIL } from '../data/seedData';
import { useFirebase } from '../context/FirebaseContext';

export interface SaveResult {
  ok: boolean;
  mode: 'server' | 'local';
}

interface SettingsViewProps {
  db: SchoolDatabase;
  onSaveSettingsAndExams: (
    settings: SchoolSettings,
    exams: Exam[],
  ) => Promise<SaveResult> | SaveResult | void;
  onResetDemo: () => void;
}

const TERM_OPTIONS: {
  term: ExamTerm;
  label: string;
  fallbackDate: string;
  fallbackDays: number;
}[] = [
  { term: 'first', label: 'First Terminal Examination', fallbackDate: '2082-04-20', fallbackDays: 68 },
  { term: 'second', label: 'Second Terminal Examination', fallbackDate: '2082-08-15', fallbackDays: 72 },
  { term: 'third', label: 'Third Terminal Examination', fallbackDate: '2082-12-25', fallbackDays: 80 },
  { term: 'annual', label: 'Annual Examination', fallbackDate: '2082-12-30', fallbackDays: 210 },
];

const buildInitialForm = (db: SchoolDatabase): SchoolSettings => {
  const base: SchoolSettings = JSON.parse(JSON.stringify(db.settings));
  base.examIssueDates = {
    first:
      db.exams.find((e) => e.term === 'first')?.dateOfIssue ||
      base.examIssueDates?.first ||
      '2082-04-20',
    second:
      db.exams.find((e) => e.term === 'second')?.dateOfIssue ||
      base.examIssueDates?.second ||
      '2082-08-15',
    third:
      db.exams.find((e) => e.term === 'third')?.dateOfIssue ||
      base.examIssueDates?.third ||
      '2082-12-25',
    annual:
      db.exams.find((e) => e.term === 'annual')?.dateOfIssue ||
      base.examIssueDates?.annual ||
      '2082-12-30',
  };
  base.examWorkingDays = {
    first:
      db.exams.find((e) => e.term === 'first')?.workingDays ||
      base.examWorkingDays?.first ||
      68,
    second:
      db.exams.find((e) => e.term === 'second')?.workingDays ||
      base.examWorkingDays?.second ||
      72,
    third:
      db.exams.find((e) => e.term === 'third')?.workingDays ||
      base.examWorkingDays?.third ||
      80,
    annual:
      db.exams.find((e) => e.term === 'annual')?.workingDays ||
      base.examWorkingDays?.annual ||
      210,
  };
  return base;
};

export const SettingsView: React.FC<SettingsViewProps> = ({
  db,
  onSaveSettingsAndExams,
  onResetDemo,
}) => {
  const [form, setForm] = useState<SchoolSettings>(() => buildInitialForm(db));
  const [syncExamYear, setSyncExamYear] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudFeedback, setCloudFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const { firebaseUser, signInAdminWithGoogle, syncToFirestore } = useFirebase();
  const expectedEmail = (
    db.admin_security?.authorizedAdminEmail || DEFAULT_AUTHORIZED_ADMIN_EMAIL
  )
    .trim()
    .toLowerCase();
  const isCloudConnected =
    Boolean(firebaseUser?.emailVerified) &&
    firebaseUser?.email?.trim().toLowerCase() === expectedEmail;

  const handleCloudSync = async () => {
    setCloudBusy(true);
    setCloudFeedback(null);
    try {
      if (!isCloudConnected) {
        const res = await signInAdminWithGoogle(expectedEmail);
        if (!res.ok) {
          setCloudFeedback({
            type: 'error',
            message:
              res.error || 'Could not authenticate Google Admin account.',
          });
          return;
        }
      }
      await syncToFirestore(db);
      setCloudFeedback({
        type: 'success',
        message: 'School database synced to Cloud Firestore successfully.',
      });
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Cloud Firestore sync failed.';
      setCloudFeedback({
        type: 'error',
        message: msg.includes('Quota exceeded')
          ? 'Firestore daily free tier quota exceeded. Quota resets tomorrow.'
          : msg,
      });
    } finally {
      setCloudBusy(false);
    }
  };

  useEffect(() => {
    setForm(buildInitialForm(db));
  }, [db.settings, db.exams]);

  const updateRule = (
    idx: number,
    field: keyof GradingRule,
    val: string | number,
  ) => {
    setForm((prev) => ({
      ...prev,
      gradingRules: prev.gradingRules.map((r, i) =>
        i === idx ? { ...r, [field]: val } : r,
      ),
    }));
  };

  const updateExamIssueDate = (term: ExamTerm, value: string) => {
    setForm((prev) => ({
      ...prev,
      examIssueDates: {
        ...(prev.examIssueDates || {}),
        [term]: value,
      },
    }));
  };

  const updateExamWorkingDays = (term: ExamTerm, value: number) => {
    const safeDays = Math.max(1, Math.round(value || 1));
    setForm((prev) => ({
      ...prev,
      examWorkingDays: {
        ...(prev.examWorkingDays || {}),
        [term]: safeDays,
      },
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveMessage(null);

    if (!form.schoolName.trim()) {
      setSaveError('School Name cannot be empty.');
      return;
    }
    if (!form.iemisCode.trim()) {
      setSaveError('School IEMIS Code cannot be empty.');
      return;
    }
    if (!form.academicYear.trim()) {
      setSaveError('Academic Year cannot be empty.');
      return;
    }
    if (form.email && form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setSaveError('Please enter a valid School Email address or leave it blank.');
      return;
    }

    const cleanedForm: SchoolSettings = {
      ...form,
      schoolName: form.schoolName.trim(),
      address: form.address.trim(),
      iemisCode: form.iemisCode.trim(),
      estd: form.estd.trim(),
      phone: form.phone?.trim() || '',
      email: form.email?.trim() || '',
      academicYear: form.academicYear.trim(),
      dateOfIssue: form.dateOfIssue.trim(),
    };

    const issueMap = cleanedForm.examIssueDates || {};
    const daysMap = cleanedForm.examWorkingDays || {};
    const updatedExams: Exam[] = db.exams.map((ex) => ({
      ...ex,
      academicYear: syncExamYear ? cleanedForm.academicYear : ex.academicYear,
      dateOfIssue: issueMap[ex.term] ?? ex.dateOfIssue,
      workingDays:
        daysMap[ex.term] && daysMap[ex.term]! > 0
          ? daysMap[ex.term]!
          : ex.workingDays,
    }));

    setIsSaving(true);
    try {
      const result = await onSaveSettingsAndExams(cleanedForm, updatedExams);
      const msg =
        result && result.mode === 'local'
          ? 'Settings saved locally (browser storage).'
          : 'Settings saved and applied across examinations & reports.';
      setSaveMessage(msg);
      setTimeout(() => setSaveMessage(null), 4000);
    } catch {
      setSaveError('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} noValidate className="space-y-6">
      {/* School Profile & Status */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              School Details & Configuration
            </h2>
            <p className="text-xs text-slate-500">
              Appears on printed Grade Sheets, Markwise Ledgers, and PDF exports.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {saveMessage && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <Check className="w-4 h-4" />
                {saveMessage}
              </span>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-700 text-white text-xs font-semibold rounded-lg hover:bg-indigo-800 disabled:opacity-50 whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>

        {saveError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium rounded-lg px-3.5 py-2.5 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              School Name
            </label>
            <input
              type="text"
              value={form.schoolName}
              onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              School IEMIS Code
            </label>
            <input
              type="text"
              value={form.iemisCode}
              onChange={(e) => setForm({ ...form, iemisCode: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              School Address
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Established (Estd.)
            </label>
            <input
              type="text"
              value={form.estd}
              onChange={(e) => setForm({ ...form, estd: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Contact Phone
            </label>
            <input
              type="text"
              value={form.phone || ''}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="091-521456"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              School Email
            </label>
            <input
              type="email"
              value={form.email || ''}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="info@aristohighschool.edu.np"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Academic Year (B.S.)
            </label>
            <input
              type="text"
              value={form.academicYear}
              onChange={(e) =>
                setForm({ ...form, academicYear: e.target.value })
              }
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
            />
            <label className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={syncExamYear}
                onChange={(e) => setSyncExamYear(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-700"
              />
              <span>Apply this Academic Year to all examinations on save</span>
            </label>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Fallback Date of Issue
            </label>
            <input
              type="text"
              value={form.dateOfIssue}
              onChange={(e) =>
                setForm({ ...form, dateOfIssue: e.target.value })
              }
              placeholder="2082-08-15"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              School System Status
            </label>
            <select
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as ActiveStatus })
              }
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Exam-Wise Working Days & Date of Issue */}
        <div className="pt-4 border-t border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">
            Examination-Wise Working Days &amp; Date of Issue
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            Configure total Working Days and the specific Date of Issue for First Term, Second Term, Third Term, and Annual Examination.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TERM_OPTIONS.map((item) => (
              <div key={item.term} className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-2.5">
                <div className="text-xs font-semibold text-slate-900">
                  {item.label}
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Working Days
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={form.examWorkingDays?.[item.term] ?? item.fallbackDays}
                    onChange={(e) =>
                      updateExamWorkingDays(item.term, Number(e.target.value))
                    }
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md font-mono tabular-nums bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Date of Issue
                  </label>
                  <input
                    type="text"
                    value={form.examIssueDates?.[item.term] ?? item.fallbackDate}
                    onChange={(e) => updateExamIssueDate(item.term, e.target.value)}
                    placeholder={item.fallbackDate}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md font-mono bg-white"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Signatory 1 Label
            </label>
            <input
              type="text"
              value={form.signatories.classTeacher}
              onChange={(e) =>
                setForm({
                  ...form,
                  signatories: {
                    ...form.signatories,
                    classTeacher: e.target.value,
                  },
                })
              }
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Signatory 2 Label
            </label>
            <input
              type="text"
              value={form.signatories.coordinator}
              onChange={(e) =>
                setForm({
                  ...form,
                  signatories: {
                    ...form.signatories,
                    coordinator: e.target.value,
                  },
                })
              }
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Signatory 3 Label
            </label>
            <input
              type="text"
              value={form.signatories.principal}
              onChange={(e) =>
                setForm({
                  ...form,
                  signatories: {
                    ...form.signatories,
                    principal: e.target.value,
                  },
                })
              }
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-sm text-slate-700 pt-2">
          <input
            type="checkbox"
            checked={form.requirePassBothComponents}
            onChange={(e) =>
              setForm({
                ...form,
                requirePassBothComponents: e.target.checked,
              })
            }
            className="w-4 h-4 rounded border-slate-300 text-indigo-700"
          />
          <span>
            Require passing grade (≥ 35%) in both Theory and Practical/Internal components for subject Final Grade (CDC rule)
          </span>
        </label>
      </div>

      {/* Grading System Rules */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">
            Exam Grading Rules
          </h2>
          <p className="text-xs text-slate-500">
            Configure percentage intervals, letter grades, descriptions, and GPA points.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Min %</th>
                <th className="px-4 py-3">Max %</th>
                <th className="px-4 py-3">Grade</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Grade Point</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {form.gradingRules.map((rule, idx) => (
                <tr key={rule.id}>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={rule.minPercent}
                      onChange={(e) =>
                        updateRule(idx, 'minPercent', Number(e.target.value))
                      }
                      className="w-20 px-2.5 py-1.5 text-sm border border-slate-300 rounded font-mono tabular-nums"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={rule.maxPercent}
                      onChange={(e) =>
                        updateRule(idx, 'maxPercent', Number(e.target.value))
                      }
                      className="w-20 px-2.5 py-1.5 text-sm border border-slate-300 rounded font-mono tabular-nums"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={rule.grade}
                      onChange={(e) => updateRule(idx, 'grade', e.target.value)}
                      className="w-20 px-2.5 py-1.5 text-sm border border-slate-300 rounded font-mono font-bold"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={rule.description}
                      onChange={(e) =>
                        updateRule(idx, 'description', e.target.value)
                      }
                      className="w-44 px-2.5 py-1.5 text-sm border border-slate-300 rounded"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      max={4}
                      value={rule.gradePoint}
                      onChange={(e) =>
                        updateRule(idx, 'gradePoint', Number(e.target.value))
                      }
                      className="w-24 px-2.5 py-1.5 text-sm border border-slate-300 rounded font-mono tabular-nums"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cloud Firestore Database Sync */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Firebase Cloud Firestore
            </h3>
            <p className="text-xs text-slate-500">
              Back up and synchronize school settings, classes, subjects, students, exams, marks, and faculty records to Cloud Firestore.
            </p>
          </div>
          <button
            type="button"
            disabled={cloudBusy}
            onClick={handleCloudSync}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg disabled:opacity-50 shrink-0"
          >
            <Cloud className="w-4 h-4" />
            {cloudBusy
              ? 'Syncing Firestore...'
              : isCloudConnected
                ? 'Sync Now to Cloud Firestore'
                : 'Connect Google & Sync Firestore'}
          </button>
        </div>
        {cloudFeedback && (
          <div
            className={`rounded-lg px-3.5 py-2.5 border text-xs font-medium flex items-center gap-2 ${
              cloudFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            {cloudFeedback.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{cloudFeedback.message}</span>
          </div>
        )}
      </div>

      {/* Actions Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          {confirmReset ? (
            <div className="inline-flex items-center gap-2 bg-red-50 border border-red-200 px-3 py-2 rounded-lg text-xs">
              <span className="text-red-800 font-medium">
                Reset all classes, students, and marks to demo data?
              </span>
              <button
                type="button"
                onClick={() => {
                  onResetDemo();
                  setConfirmReset(false);
                }}
                className="px-2.5 py-1 bg-red-600 text-white rounded font-medium hover:bg-red-700"
              >
                Confirm Reset
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 rounded font-medium"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-red-700 bg-white border border-slate-200 rounded-lg"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restore Demo Dataset
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {saveMessage && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <Check className="w-4 h-4" />
              {saveMessage}
            </span>
          )}
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-700 text-white text-sm font-medium rounded-lg hover:bg-indigo-800 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </form>
  );
};
