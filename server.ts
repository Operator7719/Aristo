import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  DEFAULT_AUTHORIZED_ADMIN_EMAIL,
  createDefaultAdminSecurity,
  createSeedDatabase,
  ensureDefaultExams,
  ensureRequiredSubjects,
  ensureTeacherRegistryAndAssignments,
} from './src/data/seedData.ts';
import {
  DEFAULT_PASSWORD_REQUIREMENTS,
  createSalt,
  evaluateAdminPassword,
  hashSecret,
  hashTeacherPasscode,
  verifyTeacherPassportSecret,
} from './src/utils/passwordSecurity.ts';
import type {
  AdminPasswordRequirements,
  AdminSecurityConfig,
  SchoolDatabase,
  TeacherPassport,
  TeacherSubjectAssignment,
} from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'school-db.json');
const ASSIGNMENTS_TABLE_FILE = path.join(
  DATA_DIR,
  'teacher_subject_assignments.json',
);
const PASSPORTS_TABLE_FILE = path.join(DATA_DIR, 'teacher_passports.json');

function syncAssignmentsTable(assignments: TeacherSubjectAssignment[]): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(
    ASSIGNMENTS_TABLE_FILE,
    JSON.stringify(assignments, null, 2),
    'utf-8',
  );
}

function syncPassportsTable(passports: TeacherPassport[]): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(
    PASSPORTS_TABLE_FILE,
    JSON.stringify(passports, null, 2),
    'utf-8',
  );
}

function deduplicatePassports(passports: TeacherPassport[]): TeacherPassport[] {
  const seenNum = new Set<string>();
  const seenUser = new Set<string>();
  const unique: TeacherPassport[] = [];
  for (const p of passports) {
    const numKey = (p.passportNumber || '').trim().toLowerCase();
    const userKey = (p.username || '').trim().toLowerCase();
    if (!numKey || !userKey) continue;
    if (!seenNum.has(numKey) && !seenUser.has(userKey)) {
      seenNum.add(numKey);
      seenUser.add(userKey);
      unique.push(p);
    }
  }
  return unique;
}

function validatePassportPayload(
  db: SchoolDatabase,
  item: TeacherPassport,
  ignoreId?: string,
): { error?: string; status?: number } {
  if (!item.passportNumber?.trim()) {
    return { error: 'Passport Number is required.', status: 400 };
  }
  if (!item.username?.trim()) {
    return { error: 'Username is required.', status: 400 };
  }
  if (!item.passcode?.trim() && !(item.passwordHash && item.passwordSalt)) {
    return { error: 'Passcode or password hash is required.', status: 400 };
  }
  if (item.assignedTeacherId) {
    const teacherExists = db.teachers.some((t) => t.id === item.assignedTeacherId);
    if (!teacherExists) {
      return {
        error: `Invalid Teacher ID: ${item.assignedTeacherId}`,
        status: 400,
      };
    }
  }
  const passports = db.teacher_passports || [];
  const dupNumber = passports.find(
    (p) =>
      p.id !== ignoreId &&
      p.passportNumber.trim().toLowerCase() ===
        item.passportNumber.trim().toLowerCase(),
  );
  if (dupNumber) {
    return {
      error: `Duplicate passport number prevented: ${item.passportNumber} already exists.`,
      status: 409,
    };
  }
  const dupUser = passports.find(
    (p) =>
      p.id !== ignoreId &&
      p.username.trim().toLowerCase() === item.username.trim().toLowerCase(),
  );
  if (dupUser) {
    return {
      error: `Duplicate username prevented: ${item.username} is already used by another passport.`,
      status: 409,
    };
  }
  return {};
}

function validateAssignmentForeignKeys(
  db: SchoolDatabase,
  item: TeacherSubjectAssignment,
): string | null {
  if (!item.academicYearId?.trim()) return 'Academic Year ID is required.';
  const teacher = db.teachers.find((t) => t.id === item.teacherId);
  if (!teacher) return `Invalid Teacher ID: ${item.teacherId}`;
  const cls = db.classes.find((c) => c.id === item.classId);
  if (!cls) return `Invalid Class ID: ${item.classId}`;
  const sec = cls.sections.find((s) => s.id === item.sectionId);
  if (!sec) return `Invalid Section ID: ${item.sectionId} for ${cls.name}`;
  const sub = db.subjects.find(
    (s) => s.id === item.subjectId && s.classId === item.classId,
  );
  if (!sub) return `Invalid Subject ID: ${item.subjectId} for ${cls.name}`;
  return null;
}

function deduplicateAssignments(
  assignments: TeacherSubjectAssignment[],
): TeacherSubjectAssignment[] {
  const seen = new Set<string>();
  const unique: TeacherSubjectAssignment[] = [];
  for (const a of assignments) {
    const key = `${a.academicYearId.trim().toLowerCase()}__${a.classId}__${a.sectionId}__${a.subjectId}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(a);
    }
  }
  return unique;
}

function ensureDb(): SchoolDatabase {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const seed = createSeedDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), 'utf-8');
    syncAssignmentsTable(seed.teacher_subject_assignments);
    syncPassportsTable(seed.teacher_passports);
    return seed;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as SchoolDatabase;
    let changed = false;
    const ensuredExams = ensureDefaultExams(
      parsed.exams || [],
      parsed.settings?.academicYear || '2082 B.S',
      parsed.settings,
    );
    if (JSON.stringify(ensuredExams) !== JSON.stringify(parsed.exams || [])) {
      parsed.exams = ensuredExams;
      changed = true;
    }
    if (!parsed.settings.examIssueDates) {
      parsed.settings.examIssueDates = {
        first: parsed.exams.find((e) => e.term === 'first')?.dateOfIssue || '2082-04-20',
        second: parsed.exams.find((e) => e.term === 'second')?.dateOfIssue || '2082-08-15',
        third: parsed.exams.find((e) => e.term === 'third')?.dateOfIssue || '2082-12-25',
        annual: parsed.exams.find((e) => e.term === 'annual')?.dateOfIssue || '2082-12-30',
      };
      changed = true;
    }
    if (!parsed.settings.examWorkingDays) {
      parsed.settings.examWorkingDays = {
        first: parsed.exams.find((e) => e.term === 'first')?.workingDays || 68,
        second: parsed.exams.find((e) => e.term === 'second')?.workingDays || 72,
        third: parsed.exams.find((e) => e.term === 'third')?.workingDays || 80,
        annual: parsed.exams.find((e) => e.term === 'annual')?.workingDays || 210,
      };
      changed = true;
    }
    const ensuredSubjects = ensureRequiredSubjects(parsed.subjects || []);
    if (ensuredSubjects.length !== (parsed.subjects || []).length) {
      parsed.subjects = ensuredSubjects;
      changed = true;
    }
    if (!parsed.settings.phone) {
      parsed.settings.phone = '091-521456';
      changed = true;
    }
    if (!parsed.settings.email) {
      parsed.settings.email = 'info@aristohighschool.edu.np';
      changed = true;
    }

    const teacherEnsure = ensureTeacherRegistryAndAssignments(parsed);
    if (teacherEnsure.changed) {
      parsed.academicYears = teacherEnsure.academicYears;
      parsed.teachers = teacherEnsure.teachers;
      parsed.teacher_subject_assignments = deduplicateAssignments(
        teacherEnsure.teacher_subject_assignments,
      );
      parsed.teacher_passports = deduplicatePassports(
        teacherEnsure.teacher_passports,
      );
      parsed.admin_security = teacherEnsure.admin_security;
      changed = true;
    }

    // If separate tables exist and parsed had none or diverged, keep synced
    if (!fs.existsSync(ASSIGNMENTS_TABLE_FILE)) {
      syncAssignmentsTable(parsed.teacher_subject_assignments || []);
    }
    if (!fs.existsSync(PASSPORTS_TABLE_FILE)) {
      syncPassportsTable(parsed.teacher_passports || []);
    }

    if (changed) {
      saveDb(parsed);
    }
    return parsed;
  } catch {
    const seed = createSeedDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), 'utf-8');
    syncAssignmentsTable(seed.teacher_subject_assignments);
    syncPassportsTable(seed.teacher_passports);
    return seed;
  }
}

function saveDb(db: SchoolDatabase): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const sanitizedPassports = deduplicatePassports(
    db.teacher_passports || [],
  ).map((p) => (p.passwordHash && p.passwordSalt ? { ...p, passcode: '' } : p));
  const normalized: SchoolDatabase = {
    ...db,
    teacher_subject_assignments: deduplicateAssignments(
      db.teacher_subject_assignments || [],
    ),
    teacher_passports: sanitizedPassports,
  };
  fs.writeFileSync(DB_FILE, JSON.stringify(normalized, null, 2), 'utf-8');
  syncAssignmentsTable(normalized.teacher_subject_assignments);
  syncPassportsTable(normalized.teacher_passports);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/state', (_req, res) => {
    const db = ensureDb();
    res.json(db);
  });

  app.put('/api/state', (req, res) => {
    const body = req.body as SchoolDatabase;
    if (!body || !body.settings || !Array.isArray(body.classes)) {
      res.status(400).json({ error: 'Invalid database payload' });
      return;
    }
    saveDb(body);
    res.json({ ok: true });
  });

  app.post('/api/reset', (_req, res) => {
    const seed = createSeedDatabase();
    saveDb(seed);
    res.json(seed);
  });

  // Dedicated teacher_subject_assignments REST endpoints with duplicate & FK validation
  app.get('/api/teacher-subject-assignments', (req, res) => {
    const db = ensureDb();
    const { academicYearId, teacherId, classId, sectionId, subjectId } =
      req.query as Record<string, string | undefined>;
    const filtered = (db.teacher_subject_assignments || []).filter((a) => {
      if (academicYearId && a.academicYearId !== academicYearId) return false;
      if (teacherId && a.teacherId !== teacherId) return false;
      if (classId && a.classId !== classId) return false;
      if (sectionId && a.sectionId !== sectionId) return false;
      if (subjectId && a.subjectId !== subjectId) return false;
      return true;
    });
    res.json(filtered);
  });

  app.post('/api/teacher-subject-assignments', (req, res) => {
    const db = ensureDb();
    const incoming: TeacherSubjectAssignment[] = Array.isArray(req.body)
      ? req.body
      : [req.body];

    const existing = [...(db.teacher_subject_assignments || [])];
    for (const item of incoming) {
      const fkErr = validateAssignmentForeignKeys(db, item);
      if (fkErr) {
        res.status(400).json({ error: fkErr });
        return;
      }
      const dup = existing.find(
        (a) =>
          a.academicYearId.trim().toLowerCase() ===
            item.academicYearId.trim().toLowerCase() &&
          a.classId === item.classId &&
          a.sectionId === item.sectionId &&
          a.subjectId === item.subjectId,
      );
      if (dup) {
        res.status(409).json({
          error:
            'Duplicate assignment prevented: this subject is already assigned for the selected class, section, and academic year.',
        });
        return;
      }
      existing.push(item);
    }

    db.teacher_subject_assignments = existing;
    saveDb(db);
    res.status(201).json(incoming);
  });

  app.put('/api/teacher-subject-assignments/:id', (req, res) => {
    const db = ensureDb();
    const { id } = req.params;
    const item = req.body as TeacherSubjectAssignment;
    const fkErr = validateAssignmentForeignKeys(db, item);
    if (fkErr) {
      res.status(400).json({ error: fkErr });
      return;
    }
    const dup = (db.teacher_subject_assignments || []).find(
      (a) =>
        a.id !== id &&
        a.academicYearId.trim().toLowerCase() ===
          item.academicYearId.trim().toLowerCase() &&
        a.classId === item.classId &&
        a.sectionId === item.sectionId &&
        a.subjectId === item.subjectId,
    );
    if (dup) {
      res.status(409).json({
        error:
          'Duplicate assignment prevented: another teacher is already assigned to this subject in the selected class, section, and academic year.',
      });
      return;
    }
    db.teacher_subject_assignments = (
      db.teacher_subject_assignments || []
    ).map((a) => (a.id === id ? { ...item, id } : a));
    saveDb(db);
    res.json({ ...item, id });
  });

  app.delete('/api/teacher-subject-assignments/:id', (req, res) => {
    const db = ensureDb();
    const { id } = req.params;
    db.teacher_subject_assignments = (
      db.teacher_subject_assignments || []
    ).filter((a) => a.id !== id);
    saveDb(db);
    res.json({ ok: true });
  });

  // Dedicated teacher_passports REST endpoints with uniqueness & teacher assignment support
  app.get('/api/teacher-passports', (req, res) => {
    const db = ensureDb();
    const { status, assignedTeacherId, unassignedOnly } = req.query as Record<
      string,
      string | undefined
    >;
    const filtered = (db.teacher_passports || []).filter((p) => {
      if (status && p.status !== status) return false;
      if (assignedTeacherId && p.assignedTeacherId !== assignedTeacherId)
        return false;
      if (unassignedOnly === 'true' && p.assignedTeacherId !== null)
        return false;
      return true;
    });
    res.json(filtered);
  });

  app.post('/api/teacher-passports', (req, res) => {
    const db = ensureDb();
    const { replaceExisting, ...rawItem } = req.body as TeacherPassport & {
      replaceExisting?: boolean;
    };
    const item: TeacherPassport = {
      ...rawItem,
      id: rawItem.id || `pp-${Date.now()}`,
      assignedTeacherId: rawItem.assignedTeacherId || null,
      createdBy: rawItem.createdBy || 'Admin',
      createdDate:
        rawItem.createdDate || new Date().toISOString().slice(0, 10),
    };
    const validation = validatePassportPayload(db, item);
    if (validation.error) {
      res.status(validation.status || 400).json({ error: validation.error });
      return;
    }

    let passports = [...(db.teacher_passports || [])];
    if (item.assignedTeacherId && item.status === 'active') {
      const existingActive = passports.find(
        (p) =>
          p.assignedTeacherId === item.assignedTeacherId &&
          p.status === 'active',
      );
      if (existingActive && !replaceExisting) {
        res.status(409).json({
          error:
            'This teacher already holds an active passport. Enable replaceExisting or revoke/unassign the current passport first.',
        });
        return;
      }
      if (existingActive && replaceExisting) {
        passports = passports.map((p) =>
          p.id === existingActive.id ? { ...p, assignedTeacherId: null } : p,
        );
      }
    }

    passports.unshift(item);
    db.teacher_passports = passports;
    saveDb(db);
    res.status(201).json(item);
  });

  app.put('/api/teacher-passports/:id', (req, res) => {
    const db = ensureDb();
    const { id } = req.params;
    const { replaceExisting, ...item } = req.body as TeacherPassport & {
      replaceExisting?: boolean;
    };
    const validation = validatePassportPayload(db, item, id);
    if (validation.error) {
      res.status(validation.status || 400).json({ error: validation.error });
      return;
    }

    let passports = [...(db.teacher_passports || [])];
    if (item.assignedTeacherId && item.status === 'active') {
      const existingActive = passports.find(
        (p) =>
          p.id !== id &&
          p.assignedTeacherId === item.assignedTeacherId &&
          p.status === 'active',
      );
      if (existingActive && !replaceExisting) {
        res.status(409).json({
          error:
            'This teacher already holds another active passport. Enable replaceExisting to reassign.',
        });
        return;
      }
      if (existingActive && replaceExisting) {
        passports = passports.map((p) =>
          p.id === existingActive.id ? { ...p, assignedTeacherId: null } : p,
        );
      }
    }

    passports = passports.map((p) => (p.id === id ? { ...item, id } : p));
    db.teacher_passports = passports;
    saveDb(db);
    res.json({ ...item, id });
  });

  app.patch('/api/teacher-passports/:id/assign', (req, res) => {
    const db = ensureDb();
    const { id } = req.params;
    const { teacherId, replaceExisting, assignedDate } = req.body as {
      teacherId: string | null;
      replaceExisting?: boolean;
      assignedDate?: string;
    };

    const passport = (db.teacher_passports || []).find((p) => p.id === id);
    if (!passport) {
      res.status(404).json({ error: 'Passport not found.' });
      return;
    }

    if (teacherId) {
      const teacher = db.teachers.find((t) => t.id === teacherId);
      if (!teacher) {
        res.status(400).json({ error: `Invalid Teacher ID: ${teacherId}` });
        return;
      }
    }

    let passports = [...(db.teacher_passports || [])];
    if (teacherId && passport.status === 'active') {
      const existingActive = passports.find(
        (p) =>
          p.id !== id &&
          p.assignedTeacherId === teacherId &&
          p.status === 'active',
      );
      if (existingActive && !replaceExisting) {
        res.status(409).json({
          error:
            'Selected teacher already has an active passport assigned. Confirm replacement to unassign the previous passport.',
        });
        return;
      }
      if (existingActive && replaceExisting) {
        passports = passports.map((p) =>
          p.id === existingActive.id ? { ...p, assignedTeacherId: null } : p,
        );
      }
    }

    const nextDate = assignedDate || new Date().toISOString().slice(0, 10);
    passports = passports.map((p) =>
      p.id === id
        ? {
            ...p,
            assignedTeacherId: teacherId || null,
            assignedDate: teacherId ? nextDate : undefined,
          }
        : p,
    );
    db.teacher_passports = passports;
    saveDb(db);
    res.json(passports.find((p) => p.id === id));
  });

  app.delete('/api/teacher-passports/:id', (req, res) => {
    const db = ensureDb();
    const { id } = req.params;
    db.teacher_passports = (db.teacher_passports || []).filter(
      (p) => p.id !== id,
    );
    saveDb(db);
    res.json({ ok: true });
  });

  app.post('/api/teacher-auth', (req, res) => {
    const db = ensureDb();
    const { identifier, passcode } = req.body as {
      identifier?: string;
      passcode?: string;
    };
    const normId = (identifier || '').trim().toLowerCase();
    const rawPass = (passcode || '').trim();
    if (!normId || !rawPass) {
      res
        .status(400)
        .json({ error: 'Passport Number/Username and Passcode are required.' });
      return;
    }
    const passport = (db.teacher_passports || []).find(
      (p) =>
        (p.passportNumber.trim().toLowerCase() === normId ||
          p.username.trim().toLowerCase() === normId) &&
        verifyTeacherPassportSecret(p, rawPass),
    );
    if (!passport) {
      res.status(401).json({ error: 'Invalid teacher passport credentials.' });
      return;
    }
    if (passport.status !== 'active') {
      res.status(403).json({
        error: `This teacher passport is ${passport.status}. Contact School Admin.`,
      });
      return;
    }
    if (!passport.assignedTeacherId) {
      res.status(403).json({
        error:
          'This passport is not yet assigned to any individual teacher. Ask Admin to assign it.',
      });
      return;
    }
    const teacher = db.teachers.find(
      (t) => t.id === passport.assignedTeacherId && t.status === 'active',
    );
    if (!teacher) {
      res.status(403).json({
        error: 'Assigned teacher account is missing or inactive.',
      });
      return;
    }
    res.json({ passport, teacher });
  });

  // Admin Password setup, verification, and recovery endpoints
  app.post('/api/admin-security/setup', (req, res) => {
    const db = ensureDb();
    const current = db.admin_security || createDefaultAdminSecurity();
    const {
      currentEmail,
      authorizedAdminEmail,
      authorizedAdminSession,
      currentPassword,
      adminUsername,
      adminDisplayName,
      newPassword,
      confirmPassword,
      recoveryQuestion,
      recoveryAnswer,
      requireOnRoleSwitch,
      requireOnAppStart,
      maxFailedAttempts,
      requirements,
    } = req.body as {
      currentEmail?: string;
      authorizedAdminEmail?: string;
      authorizedAdminSession?: boolean;
      currentPassword?: string;
      adminUsername?: string;
      adminDisplayName?: string;
      newPassword?: string;
      confirmPassword?: string;
      recoveryQuestion?: string;
      recoveryAnswer?: string;
      requireOnRoleSwitch?: boolean;
      requireOnAppStart?: boolean;
      maxFailedAttempts?: number;
      requirements?: AdminPasswordRequirements;
    };

    const expectedEmail = (
      current.authorizedAdminEmail || DEFAULT_AUTHORIZED_ADMIN_EMAIL
    )
      .trim()
      .toLowerCase();
    if (!currentEmail || currentEmail.trim().toLowerCase() !== expectedEmail) {
      res.status(403).json({
        error:
          'Access Denied: Only the authorized Admin user can create or change passwords.',
      });
      return;
    }

    if (current.isConfigured && !authorizedAdminSession) {
      if (!currentPassword) {
        res
          .status(401)
          .json({ error: 'Current Admin Password is required to update security settings.' });
        return;
      }
      const matchesCurrent =
        hashSecret(currentPassword, current.passwordSalt) ===
        current.passwordHash;
      if (!matchesCurrent) {
        res.status(401).json({ error: 'Current Admin Password is incorrect.' });
        return;
      }
    }

    const nextReqs = requirements || current.requirements;
    const evaluation = evaluateAdminPassword(
      newPassword || '',
      confirmPassword || '',
      nextReqs,
    );
    if (!evaluation.allRequirementsMet) {
      res.status(400).json({
        error:
          'New Admin Password does not satisfy all password strength and confirmation requirements.',
      });
      return;
    }

    const salt = createSalt();
    const cleanRecoveryAns = (recoveryAnswer || '').trim().toLowerCase();
    const nextRecoveryHash = cleanRecoveryAns
      ? hashSecret(cleanRecoveryAns, salt)
      : current.recoveryAnswerHash || '';

    if (!current.isConfigured && !cleanRecoveryAns && !authorizedAdminSession) {
      res.status(400).json({
        error: 'Please set a Recovery Answer so Admin access can be recovered if needed.',
      });
      return;
    }

    const nextAuthorizedEmail = (
      authorizedAdminEmail ||
      current.authorizedAdminEmail ||
      DEFAULT_AUTHORIZED_ADMIN_EMAIL
    )
      .trim()
      .toLowerCase();

    const nextConfig: AdminSecurityConfig = {
      isConfigured: true,
      authorizedAdminEmail: nextAuthorizedEmail,
      strictSingleUserOnly: true,
      adminUsername: (adminUsername || current.adminUsername || 'admin').trim(),
      adminDisplayName: (
        adminDisplayName ||
        current.adminDisplayName ||
        'Principal / Exam Admin'
      ).trim(),
      passwordSalt: salt,
      passwordHash: hashSecret(newPassword || '', salt),
      recoveryQuestion:
        (recoveryQuestion || current.recoveryQuestion).trim(),
      recoveryAnswerHash: nextRecoveryHash,
      requireOnRoleSwitch:
        typeof requireOnRoleSwitch === 'boolean'
          ? requireOnRoleSwitch
          : current.requireOnRoleSwitch,
      requireOnAppStart:
        typeof requireOnAppStart === 'boolean'
          ? requireOnAppStart
          : current.requireOnAppStart,
      maxFailedAttempts: maxFailedAttempts || current.maxFailedAttempts || 5,
      requirements: nextReqs,
      updatedDate: new Date().toISOString().slice(0, 10),
      updatedBy: 'Admin',
    };

    db.admin_security = nextConfig;
    saveDb(db);
    res.json({ ok: true, admin_security: nextConfig });
  });

  app.post('/api/teacher-password/setup', (req, res) => {
    const db = ensureDb();
    const sec = db.admin_security || createDefaultAdminSecurity();
    const {
      currentEmail,
      teacherId,
      passportId,
      newPassword,
      confirmPassword,
    } = req.body as {
      currentEmail?: string;
      teacherId?: string;
      passportId?: string;
      newPassword?: string;
      confirmPassword?: string;
    };

    const expectedEmail = (
      sec.authorizedAdminEmail || DEFAULT_AUTHORIZED_ADMIN_EMAIL
    )
      .trim()
      .toLowerCase();
    if (!currentEmail || currentEmail.trim().toLowerCase() !== expectedEmail) {
      res.status(403).json({
        error:
          'Access Denied: Only the authorized Admin user can create or change Teacher passwords.',
      });
      return;
    }

    const evaluation = evaluateAdminPassword(
      newPassword || '',
      confirmPassword || '',
      DEFAULT_PASSWORD_REQUIREMENTS,
    );
    if (!evaluation.allRequirementsMet) {
      res.status(400).json({
        error:
          'New Teacher Password does not satisfy strength requirements or passwords do not match.',
      });
      return;
    }

    const passports = [...(db.teacher_passports || [])];
    const targetPassport = passports.find(
      (p) =>
        (passportId && p.id === passportId) ||
        (teacherId && p.assignedTeacherId === teacherId && p.status === 'active'),
    );

    const today = new Date().toISOString().slice(0, 10);
    const { passwordSalt, passwordHash } = hashTeacherPasscode(newPassword || '');
    let updatedPassport: TeacherPassport | undefined;
    let nextPassports = passports;

    if (targetPassport) {
      nextPassports = passports.map((p) => {
        if (p.id === targetPassport.id) {
          updatedPassport = {
            ...p,
            passcode: '',
            passwordSalt,
            passwordHash,
            passwordUpdatedDate: today,
            passwordUpdatedBy: 'Admin',
          };
          return updatedPassport;
        }
        return p;
      });
    } else if (teacherId) {
      const teacher = db.teachers.find((t) => t.id === teacherId);
      if (!teacher) {
        res.status(404).json({ error: 'Selected teacher account was not found.' });
        return;
      }
      const cleanBase =
        teacher.name
          .toLowerCase()
          .replace(/[^a-z\s]/g, '')
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .join('.') || teacher.teacherCode.toLowerCase();
      const usedUsernames = new Set(passports.map((p) => p.username.toLowerCase()));
      let username = cleanBase;
      let idx = 2;
      while (usedUsernames.has(username)) {
        username = `${cleanBase}${idx}`;
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
      updatedPassport = {
        id: `pp-${Date.now()}`,
        passportNumber,
        passportTitle: 'Teacher Portal Credential',
        username,
        passcode: '',
        passwordSalt,
        passwordHash,
        passwordUpdatedDate: today,
        passwordUpdatedBy: 'Admin',
        assignedTeacherId: teacher.id,
        issuedDate: today,
        expiryDate: '2084-12-30',
        status: 'active',
        notes: 'Created from Admin Teacher Password manager',
        createdBy: 'Admin',
        createdDate: today,
        assignedDate: today,
      };
      nextPassports = [updatedPassport, ...passports];
    } else {
      res.status(400).json({ error: 'Please select a Teacher account.' });
      return;
    }

    db.teacher_passports = nextPassports;
    saveDb(db);
    res.json({
      ok: true,
      teacher_passports: db.teacher_passports,
      updatedPassport,
    });
  });

  app.post('/api/admin-security/verify', (req, res) => {
    const db = ensureDb();
    const sec = db.admin_security || createDefaultAdminSecurity();
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };
    const expectedEmail = (
      sec.authorizedAdminEmail || DEFAULT_AUTHORIZED_ADMIN_EMAIL
    )
      .trim()
      .toLowerCase();
    if (!email || email.trim().toLowerCase() !== expectedEmail) {
      res.status(403).json({
        error:
          'Access Denied: Admin Panel is restricted to one authorized user only. Other users or email addresses cannot access the Admin Panel.',
      });
      return;
    }
    if (!sec.isConfigured) {
      res.json({ ok: true, configured: false });
      return;
    }
    const valid =
      Boolean(password) &&
      hashSecret(password || '', sec.passwordSalt) === sec.passwordHash;
    if (!valid) {
      res.status(401).json({ error: 'Incorrect Admin Password.' });
      return;
    }
    res.json({ ok: true, configured: true });
  });

  app.post('/api/admin-security/recover', (req, res) => {
    const db = ensureDb();
    const current = db.admin_security || createDefaultAdminSecurity();
    const { email, recoveryAnswer, newPassword, confirmPassword } = req.body as {
      email?: string;
      recoveryAnswer?: string;
      newPassword?: string;
      confirmPassword?: string;
    };
    const expectedEmail = (
      current.authorizedAdminEmail || DEFAULT_AUTHORIZED_ADMIN_EMAIL
    )
      .trim()
      .toLowerCase();
    if (!email || email.trim().toLowerCase() !== expectedEmail) {
      res.status(403).json({
        error:
          'Access Denied: Only the single authorized administrator email can recover Admin Panel access.',
      });
      return;
    }
    if (!current.isConfigured || !current.recoveryAnswerHash) {
      res
        .status(400)
        .json({ error: 'Admin password recovery is not configured.' });
      return;
    }
    const cleanAns = (recoveryAnswer || '').trim().toLowerCase();
    if (hashSecret(cleanAns, current.passwordSalt) !== current.recoveryAnswerHash) {
      res.status(401).json({ error: 'Recovery Answer does not match.' });
      return;
    }
    const evaluation = evaluateAdminPassword(
      newPassword || '',
      confirmPassword || '',
      current.requirements,
    );
    if (!evaluation.allRequirementsMet) {
      res.status(400).json({
        error: 'New password does not meet all password requirements.',
      });
      return;
    }
    const newSalt = createSalt();
    const updated: AdminSecurityConfig = {
      ...current,
      authorizedAdminEmail: expectedEmail,
      strictSingleUserOnly: true,
      passwordSalt: newSalt,
      passwordHash: hashSecret(newPassword || '', newSalt),
      recoveryAnswerHash: hashSecret(cleanAns, newSalt),
      updatedDate: new Date().toISOString().slice(0, 10),
      updatedBy: 'Admin Recovery',
    };
    db.admin_security = updated;
    saveDb(db);
    res.json({ ok: true, admin_security: updated });
  });

  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.join(__dirname, 'dist');

  if (!isProd || !fs.existsSync(distPath)) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });

    // HMR and WebSockets are disabled in this single-port middleware setup;
    // keep Vite's helper exports (updateStyle, createHotContext, ErrorOverlay)
    // while preventing @vite/client from opening a failing WebSocket to port 24678.
    app.get('/@vite/client', async (_req, res, next) => {
      try {
        const transformed = await vite.transformRequest('/@vite/client');
        if (!transformed) {
          next();
          return;
        }
        const safeCode = transformed.code.replace(
          /const transport = normalizeModuleRunnerTransport\(\(\(\) => \{[\s\S]*?\}\)\(\)\);/,
          'const transport = normalizeModuleRunnerTransport({ connect() {}, disconnect() {}, send() {} });',
        );
        res
          .status(200)
          .setHeader('Content-Type', 'application/javascript; charset=utf-8')
          .setHeader('Cache-Control', 'no-cache')
          .send(safeCode);
      } catch (err) {
        next(err);
      }
    });

    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
