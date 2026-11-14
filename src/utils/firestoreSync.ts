import { User } from 'firebase/auth';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  AdminSecurityConfig,
  Exam,
  MarkRecord,
  SchoolClass,
  SchoolDatabase,
  SchoolSettings,
  Student,
  Subject,
  Teacher,
  TeacherPassport,
  TeacherSubjectAssignment,
} from '../types';
import {
  DEFAULT_AUTHORIZED_ADMIN_EMAIL,
  createDefaultAdminSecurity,
} from '../data/seedData';
import { OperationType, firestoreDb, handleFirestoreError } from '../firebase';

function clampStr(val: string | undefined | null, maxLen: number): string {
  const clean = typeof val === 'string' ? val : '';
  return clean.length > maxLen ? clean.slice(0, maxLen) : clean;
}

function sanitizeId(raw: string | undefined | null, fallbackPrefix: string): string {
  const cleaned = (raw || '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 128);
  return cleaned.length > 0 ? cleaned : `${fallbackPrefix}_${Date.now()}`;
}

function extractCreatedAt(
  existingDoc: Record<string, unknown> | undefined,
): Timestamp | ReturnType<typeof serverTimestamp> {
  const val = existingDoc?.createdAt;
  if (val instanceof Timestamp) return val;
  return serverTimestamp();
}

const adminEnsureInFlight = new Map<string, Promise<void>>();

export async function ensureAdminDocInFirestore(user: User): Promise<void> {
  if (!user.email || !user.emailVerified) return;
  const existingPromise = adminEnsureInFlight.get(user.uid);
  if (existingPromise) {
    return existingPromise;
  }

  const task = (async () => {
    const adminPath = `admins/${user.uid}`;
    const ref = doc(firestoreDb, 'admins', user.uid);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          uid: user.uid,
          email: clampStr(user.email!.toLowerCase(), 200),
          role: 'admin',
          ownerUid: user.uid,
          ownerEmail: clampStr(user.email!.toLowerCase(), 200),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, adminPath);
    } finally {
      adminEnsureInFlight.delete(user.uid);
    }
  })();

  adminEnsureInFlight.set(user.uid, task);
  return task;
}

async function queryAdminOwnedCollection<T>(
  collectionName: string,
  ownerEmail: string,
): Promise<{ docs: T[]; metaById: Map<string, Record<string, unknown>> }> {
  try {
    const q = query(
      collection(firestoreDb, collectionName),
      where('ownerEmail', '==', ownerEmail),
    );
    const snap = await getDocs(q);
    const docs: T[] = [];
    const metaById = new Map<string, Record<string, unknown>>();
    snap.forEach((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      metaById.set(docSnap.id, data);
      const {
        ownerUid: _ownerUid,
        ownerEmail: _ownerEmail,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        ...rest
      } = data;
      docs.push(rest as T);
    });
    return { docs, metaById };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, collectionName);
  }
}

export async function loadSchoolDatabaseFromFirestore(
  user: User,
): Promise<Partial<SchoolDatabase> | null> {
  const email = user.email?.trim().toLowerCase();
  if (!email || !user.emailVerified) return null;

  await ensureAdminDocInFirestore(user);

  let settingsData: (SchoolSettings & { academicYears?: string[] }) | null = null;
  try {
    const settingsSnap = await getDoc(doc(firestoreDb, 'school_settings', 'main'));
    if (settingsSnap.exists()) {
      const raw = settingsSnap.data() as Record<string, unknown>;
      const {
        ownerUid: _ownerUid,
        ownerEmail: _ownerEmail,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        ...rest
      } = raw;
      settingsData = rest as unknown as SchoolSettings & {
        academicYears?: string[];
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'school_settings/main');
  }

  let adminSecurity: AdminSecurityConfig | undefined;
  try {
    const secSnap = await getDoc(doc(firestoreDb, 'admin_security', 'primary'));
    if (secSnap.exists()) {
      const raw = secSnap.data() as Record<string, unknown>;
      const {
        ownerUid: _ownerUid,
        ownerEmail: _ownerEmail,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        ...rest
      } = raw;
      adminSecurity = rest as unknown as AdminSecurityConfig;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'admin_security/primary');
  }

  const [
    classesRes,
    subjectsRes,
    studentsRes,
    examsRes,
    marksRes,
    teachersRes,
    assignmentsRes,
    passportsRes,
  ] = await Promise.all([
    queryAdminOwnedCollection<SchoolClass>('school_classes', email),
    queryAdminOwnedCollection<Subject>('subjects', email),
    queryAdminOwnedCollection<Student>('students', email),
    queryAdminOwnedCollection<Exam>('exams', email),
    queryAdminOwnedCollection<MarkRecord>('marks', email),
    queryAdminOwnedCollection<Teacher>('teachers', email),
    queryAdminOwnedCollection<TeacherSubjectAssignment>(
      'teacher_subject_assignments',
      email,
    ),
    queryAdminOwnedCollection<TeacherPassport>('teacher_passports', email),
  ]);

  const hasRemoteData =
    Boolean(settingsData) ||
    classesRes.docs.length > 0 ||
    studentsRes.docs.length > 0;

  if (!hasRemoteData) {
    return null;
  }

  const result: Partial<SchoolDatabase> = {};
  if (settingsData) {
    const { academicYears, ...cleanSettings } = settingsData;
    result.settings = cleanSettings;
    if (Array.isArray(academicYears) && academicYears.length > 0) {
      result.academicYears = academicYears;
    }
  }
  if (adminSecurity) result.admin_security = adminSecurity;
  if (classesRes.docs.length > 0) result.classes = classesRes.docs;
  if (subjectsRes.docs.length > 0) result.subjects = subjectsRes.docs;
  if (studentsRes.docs.length > 0) result.students = studentsRes.docs;
  if (examsRes.docs.length > 0) result.exams = examsRes.docs;
  if (marksRes.docs.length > 0) result.marks = marksRes.docs;
  if (teachersRes.docs.length > 0) result.teachers = teachersRes.docs;
  if (assignmentsRes.docs.length > 0) {
    result.teacher_subject_assignments = assignmentsRes.docs;
  }
  if (passportsRes.docs.length > 0) {
    result.teacher_passports = passportsRes.docs;
  }
  return result;
}

export function subscribeFirestoreSchoolData(
  user: User,
  onPatch: (patch: Partial<SchoolDatabase>) => void,
): () => void {
  const email = user.email?.trim().toLowerCase();
  if (!email || !user.emailVerified) return () => {};

  const unsubs: (() => void)[] = [];

  unsubs.push(
    onSnapshot(
      doc(firestoreDb, 'school_settings', 'main'),
      (snap) => {
        if (!snap.exists()) return;
        const {
          ownerUid: _ownerUid,
          ownerEmail: _ownerEmail,
          createdAt: _createdAt,
          updatedAt: _updatedAt,
          academicYears,
          ...settingsRest
        } = snap.data() as Record<string, unknown>;
        const patch: Partial<SchoolDatabase> = {
          settings: settingsRest as unknown as SchoolSettings,
        };
        if (Array.isArray(academicYears) && academicYears.length > 0) {
          patch.academicYears = academicYears as string[];
        }
        onPatch(patch);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'school_settings/main');
      },
    ),
  );

  const watchCollection = <T>(
    collectionName: string,
    key: keyof SchoolDatabase,
  ) => {
    const q = query(
      collection(firestoreDb, collectionName),
      where('ownerEmail', '==', email),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (snap.empty) return;
        const items: T[] = [];
        snap.forEach((docSnap) => {
          const {
            ownerUid: _ownerUid,
            ownerEmail: _ownerEmail,
            createdAt: _createdAt,
            updatedAt: _updatedAt,
            ...rest
          } = docSnap.data() as Record<string, unknown>;
          items.push(rest as T);
        });
        onPatch({ [key]: items } as Partial<SchoolDatabase>);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, collectionName);
      },
    );
    unsubs.push(unsub);
  };

  watchCollection<SchoolClass>('school_classes', 'classes');
  watchCollection<Subject>('subjects', 'subjects');
  watchCollection<Student>('students', 'students');
  watchCollection<Exam>('exams', 'exams');
  watchCollection<MarkRecord>('marks', 'marks');
  watchCollection<Teacher>('teachers', 'teachers');
  watchCollection<TeacherSubjectAssignment>(
    'teacher_subject_assignments',
    'teacher_subject_assignments',
  );
  watchCollection<TeacherPassport>('teacher_passports', 'teacher_passports');

  return () => {
    unsubs.forEach((u) => u());
  };
}

interface BatchOp {
  type: 'set' | 'delete';
  collection: string;
  id: string;
  data?: Record<string, unknown>;
}

async function commitBatchOps(
  ops: BatchOp[],
  chunkSize = 400,
  parallel = false,
): Promise<void> {
  if (ops.length === 0) return;
  const chunks: BatchOp[][] = [];
  for (let i = 0; i < ops.length; i += chunkSize) {
    chunks.push(ops.slice(i, i + chunkSize));
  }

  const runChunk = async (chunk: BatchOp[]) => {
    const batch = writeBatch(firestoreDb);
    for (const op of chunk) {
      const ref = doc(firestoreDb, op.collection, op.id);
      if (op.type === 'delete') {
        batch.delete(ref);
      } else if (op.data) {
        batch.set(ref, op.data);
      }
    }
    try {
      await batch.commit();
    } catch (error) {
      const firstPath = chunk[0]
        ? `${chunk[0].collection}/${chunk[0].id}`
        : null;
      handleFirestoreError(error, OperationType.WRITE, firstPath);
    }
  };

  if (parallel) {
    await Promise.all(chunks.map((c) => runChunk(c)));
  } else {
    for (const chunk of chunks) {
      await runChunk(chunk);
    }
  }
}

const syncQueueByUid = new Map<string, Promise<void>>();

export function syncSchoolDatabaseToFirestore(
  user: User,
  db: SchoolDatabase,
): Promise<void> {
  const prev = syncQueueByUid.get(user.uid) || Promise.resolve();
  const next = prev
    .catch(() => {})
    .then(() => runSyncSchoolDatabaseToFirestore(user, db));
  syncQueueByUid.set(user.uid, next);
  return next;
}

async function runSyncSchoolDatabaseToFirestore(
  user: User,
  db: SchoolDatabase,
): Promise<void> {
  const email = user.email?.trim().toLowerCase();
  if (!email || !user.emailVerified) {
    throw new Error(
      'Verified authorized Admin Google account is required to sync with Cloud Firestore.',
    );
  }

  await ensureAdminDocInFirestore(user);

  // Fetch existing metadata so createdAt is preserved immutably on updates and deleted docs are pruned
  const [
    settingsSnap,
    secSnap,
    classesExisting,
    subjectsExisting,
    studentsExisting,
    examsExisting,
    marksExisting,
    teachersExisting,
    assignmentsExisting,
    passportsExisting,
  ] = await Promise.all([
    getDoc(doc(firestoreDb, 'school_settings', 'main')).catch((err) =>
      handleFirestoreError(err, OperationType.GET, 'school_settings/main'),
    ),
    getDoc(doc(firestoreDb, 'admin_security', 'primary')).catch((err) =>
      handleFirestoreError(err, OperationType.GET, 'admin_security/primary'),
    ),
    queryAdminOwnedCollection<SchoolClass>('school_classes', email),
    queryAdminOwnedCollection<Subject>('subjects', email),
    queryAdminOwnedCollection<Student>('students', email),
    queryAdminOwnedCollection<Exam>('exams', email),
    queryAdminOwnedCollection<MarkRecord>('marks', email),
    queryAdminOwnedCollection<Teacher>('teachers', email),
    queryAdminOwnedCollection<TeacherSubjectAssignment>(
      'teacher_subject_assignments',
      email,
    ),
    queryAdminOwnedCollection<TeacherPassport>('teacher_passports', email),
  ]);

  const ownerMetaCreate = (
    existingMap: Map<string, Record<string, unknown>> | undefined,
    id: string,
  ) => ({
    ownerUid: user.uid,
    ownerEmail: email,
    createdAt: extractCreatedAt(existingMap?.get(id)),
    updatedAt: serverTimestamp(),
  });

  // Phase 1: Parent / root collections (settings, security, classes, exams, teachers)
  const parentOps: BatchOp[] = [];

  const s = db.settings;
  parentOps.push({
    type: 'set',
    collection: 'school_settings',
    id: 'main',
    data: {
      schoolName: clampStr(s.schoolName || 'ARISTO ENGLISH BOARDING SCHOOL', 200),
      address: clampStr(s.address, 250),
      phone: clampStr(s.phone, 60),
      email: clampStr(s.email, 200),
      estd: clampStr(s.estd, 40),
      iemisCode: clampStr(s.iemisCode, 40),
      academicYear: clampStr(s.academicYear || '2082 B.S', 40),
      dateOfIssue: clampStr(s.dateOfIssue, 40),
      status: s.status === 'inactive' ? 'inactive' : 'active',
      requirePassBothComponents: Boolean(s.requirePassBothComponents),
      signatories: {
        classTeacher: clampStr(s.signatories?.classTeacher, 100),
        coordinator: clampStr(s.signatories?.coordinator, 100),
        principal: clampStr(s.signatories?.principal, 100),
      },
      gradingRules: (s.gradingRules || []).slice(0, 20),
      examIssueDates: {
        ...(s.examIssueDates?.first !== undefined ? { first: clampStr(s.examIssueDates.first, 40) } : {}),
        ...(s.examIssueDates?.second !== undefined ? { second: clampStr(s.examIssueDates.second, 40) } : {}),
        ...(s.examIssueDates?.third !== undefined ? { third: clampStr(s.examIssueDates.third, 40) } : {}),
        ...(s.examIssueDates?.annual !== undefined ? { annual: clampStr(s.examIssueDates.annual, 40) } : {}),
      },
      examWorkingDays: {
        ...(s.examWorkingDays?.first !== undefined ? { first: Number(s.examWorkingDays.first) || 0 } : {}),
        ...(s.examWorkingDays?.second !== undefined ? { second: Number(s.examWorkingDays.second) || 0 } : {}),
        ...(s.examWorkingDays?.third !== undefined ? { third: Number(s.examWorkingDays.third) || 0 } : {}),
        ...(s.examWorkingDays?.annual !== undefined ? { annual: Number(s.examWorkingDays.annual) || 0 } : {}),
      },
      academicYears: (db.academicYears || ['2082 B.S']).slice(0, 30),
      ownerUid: user.uid,
      ownerEmail: email,
      createdAt: extractCreatedAt(
        settingsSnap.exists()
          ? (settingsSnap.data() as Record<string, unknown>)
          : undefined,
      ),
      updatedAt: serverTimestamp(),
    },
  });

  const sec = db.admin_security || createDefaultAdminSecurity();
  parentOps.push({
    type: 'set',
    collection: 'admin_security',
    id: 'primary',
    data: {
      isConfigured: Boolean(sec.isConfigured),
      authorizedAdminEmail: clampStr(
        sec.authorizedAdminEmail || DEFAULT_AUTHORIZED_ADMIN_EMAIL,
        200,
      ).toLowerCase(),
      strictSingleUserOnly: sec.strictSingleUserOnly ?? true,
      adminUsername: clampStr(sec.adminUsername || 'admin', 80),
      adminDisplayName: clampStr(sec.adminDisplayName, 120),
      passwordHash: clampStr(sec.passwordHash, 256),
      passwordSalt: clampStr(sec.passwordSalt, 128),
      recoveryQuestion: clampStr(sec.recoveryQuestion, 300),
      recoveryAnswerHash: clampStr(sec.recoveryAnswerHash, 256),
      requireOnRoleSwitch: Boolean(sec.requireOnRoleSwitch),
      requireOnAppStart: Boolean(sec.requireOnAppStart),
      maxFailedAttempts: Math.max(1, Math.min(20, sec.maxFailedAttempts || 5)),
      requirements: {
        minLength: sec.requirements?.minLength || 8,
        requireUppercase: Boolean(sec.requirements?.requireUppercase ?? true),
        requireLowercase: Boolean(sec.requirements?.requireLowercase ?? true),
        requireNumber: Boolean(sec.requirements?.requireNumber ?? true),
        requireSpecialChar: Boolean(sec.requirements?.requireSpecialChar ?? true),
      },
      updatedDate: clampStr(sec.updatedDate, 40),
      updatedBy: clampStr(sec.updatedBy, 80),
      ownerUid: user.uid,
      ownerEmail: email,
      createdAt: extractCreatedAt(
        secSnap.exists()
          ? (secSnap.data() as Record<string, unknown>)
          : undefined,
      ),
      updatedAt: serverTimestamp(),
    },
  });

  const classIds = new Set<string>();
  for (const cls of db.classes) {
    const id = sanitizeId(cls.id, 'cls');
    classIds.add(id);
    parentOps.push({
      type: 'set',
      collection: 'school_classes',
      id,
      data: {
        id,
        name: clampStr(cls.name, 100),
        gradeLevel: Number(cls.gradeLevel) || 0,
        conversionTier: cls.conversionTier || 'none',
        sections: (cls.sections || []).slice(0, 20),
        status: cls.status === 'inactive' ? 'inactive' : 'active',
        order: Number(cls.order) || 0,
        ...ownerMetaCreate(classesExisting.metaById, id),
      },
    });
  }

  const examIds = new Set<string>();
  for (const exam of db.exams) {
    const id = sanitizeId(exam.id, 'exam');
    examIds.add(id);
    parentOps.push({
      type: 'set',
      collection: 'exams',
      id,
      data: {
        id,
        name: clampStr(exam.name, 150),
        term: exam.term || 'first',
        academicYear: clampStr(exam.academicYear, 40),
        workingDays: Number(exam.workingDays) || 0,
        dateOfIssue: clampStr(exam.dateOfIssue, 40),
        status: exam.status === 'inactive' ? 'inactive' : 'active',
        ...ownerMetaCreate(examsExisting.metaById, id),
      },
    });
  }

  const teacherIds = new Set<string>();
  for (const tch of db.teachers) {
    const id = sanitizeId(tch.id, 'tch');
    teacherIds.add(id);
    parentOps.push({
      type: 'set',
      collection: 'teachers',
      id,
      data: {
        id,
        teacherCode: clampStr(tch.teacherCode, 60),
        name: clampStr(tch.name, 150),
        email: clampStr(tch.email, 200),
        phone: clampStr(tch.phone, 60),
        qualification: clampStr(tch.qualification, 150),
        specialization: clampStr(tch.specialization, 150),
        status: tch.status === 'inactive' ? 'inactive' : 'active',
        joinedDate: clampStr(tch.joinedDate, 40),
        ...ownerMetaCreate(teachersExisting.metaById, id),
      },
    });
  }

  await commitBatchOps(parentOps);

  // Phase 2: Direct class children (subjects, students, passports)
  // Keep chunkSize <= 8 so total exists() calls per batch stay well below Firestore's 20-call batch limit.
  const phase2Ops: BatchOp[] = [];
  const phase3Ops: BatchOp[] = [];

  const subjectIds = new Set<string>();
  for (const sub of db.subjects) {
    const id = sanitizeId(sub.id, 'sub');
    const classId = sanitizeId(sub.classId, 'cls');
    if (!classIds.has(classId)) continue;
    subjectIds.add(id);
    phase2Ops.push({
      type: 'set',
      collection: 'subjects',
      id,
      data: {
        id,
        classId,
        code: clampStr(sub.code, 60),
        name: clampStr(sub.name, 150),
        category: sub.category || 'compulsory',
        gradingMode: sub.gradingMode || 'academic',
        fullMarksTheory: Number(sub.fullMarksTheory) || 0,
        fullMarksPractical: Number(sub.fullMarksPractical) || 0,
        passMarksTheory: Number(sub.passMarksTheory) || 0,
        passMarksPractical: Number(sub.passMarksPractical) || 0,
        creditHourTheory: Number(sub.creditHourTheory) || 0,
        creditHourPractical: Number(sub.creditHourPractical) || 0,
        conversionRule: sub.conversionRule || 'inherit',
        status: sub.status === 'inactive' ? 'inactive' : 'active',
        displayOrder: Number(sub.displayOrder) || 0,
        ...ownerMetaCreate(subjectsExisting.metaById, id),
      },
    });
  }

  const studentIds = new Set<string>();
  for (const stu of db.students) {
    const id = sanitizeId(stu.id, 'stu');
    const classId = sanitizeId(stu.classId, 'cls');
    if (!classIds.has(classId)) continue;
    studentIds.add(id);
    phase2Ops.push({
      type: 'set',
      collection: 'students',
      id,
      data: {
        id,
        studentCode: clampStr(stu.studentCode, 60),
        name: clampStr(stu.name, 150),
        classId,
        sectionId: sanitizeId(stu.sectionId, 'sec'),
        rollNo: Number(stu.rollNo) || 0,
        academicYear: clampStr(stu.academicYear, 40),
        dob: clampStr(stu.dob, 40),
        guardianName: clampStr(stu.guardianName, 150),
        contact: clampStr(stu.contact, 60),
        optionalSubjects: {
          ...(stu.optionalSubjects?.opt_1
            ? { opt_1: clampStr(stu.optionalSubjects.opt_1, 128) }
            : {}),
          ...(stu.optionalSubjects?.opt_2
            ? { opt_2: clampStr(stu.optionalSubjects.opt_2, 128) }
            : {}),
        },
        status: stu.status === 'inactive' ? 'inactive' : 'active',
        ...ownerMetaCreate(studentsExisting.metaById, id),
      },
    });
  }

  const passportIds = new Set<string>();
  for (const p of db.teacher_passports || []) {
    const id = sanitizeId(p.id, 'pp');
    passportIds.add(id);
    phase2Ops.push({
      type: 'set',
      collection: 'teacher_passports',
      id,
      data: {
        id,
        passportNumber: clampStr(p.passportNumber, 80),
        passportTitle: clampStr(p.passportTitle, 120),
        username: clampStr(p.username, 80),
        passcode: '',
        ...(p.passwordHash
          ? { passwordHash: clampStr(p.passwordHash, 256) }
          : {}),
        ...(p.passwordSalt
          ? { passwordSalt: clampStr(p.passwordSalt, 128) }
          : {}),
        ...(p.passwordUpdatedDate
          ? { passwordUpdatedDate: clampStr(p.passwordUpdatedDate, 40) }
          : {}),
        ...(p.passwordUpdatedBy
          ? { passwordUpdatedBy: clampStr(p.passwordUpdatedBy, 80) }
          : {}),
        assignedTeacherId: p.assignedTeacherId
          ? sanitizeId(p.assignedTeacherId, 'tch')
          : null,
        issuedDate: clampStr(p.issuedDate, 40),
        expiryDate: clampStr(p.expiryDate, 40),
        status: p.status || 'active',
        ...(p.notes !== undefined ? { notes: clampStr(p.notes, 300) } : {}),
        createdBy: clampStr(p.createdBy || 'Admin', 80),
        createdDate: clampStr(p.createdDate, 40),
        ...(p.assignedDate
          ? { assignedDate: clampStr(p.assignedDate, 40) }
          : {}),
        ...ownerMetaCreate(passportsExisting.metaById, id),
      },
    });
  }

  await commitBatchOps(phase2Ops, 8, true);

  // Phase 3: Dependent marks & subject assignments (each checks up to 3 parent docs)
  const markIds = new Set<string>();
  for (const m of db.marks) {
    const id = sanitizeId(m.id, 'mrk');
    const examId = sanitizeId(m.examId, 'exam');
    const studentId = sanitizeId(m.studentId, 'stu');
    if (!examIds.has(examId) || !studentIds.has(studentId)) continue;
    markIds.add(id);
    phase3Ops.push({
      type: 'set',
      collection: 'marks',
      id,
      data: {
        id,
        examId,
        studentId,
        classId: sanitizeId(m.classId, 'cls'),
        sectionId: sanitizeId(m.sectionId, 'sec'),
        workingDays: Number(m.workingDays) || 0,
        presentDays: Number(m.presentDays) || 0,
        subjects: m.subjects || {},
        ...(m.nonAcademicGrades ? { nonAcademicGrades: m.nonAcademicGrades } : {}),
        ...(m.teacherRemarks !== undefined
          ? { teacherRemarks: clampStr(m.teacherRemarks, 500) }
          : {}),
        ...ownerMetaCreate(marksExisting.metaById, id),
      },
    });
  }

  const assignmentIds = new Set<string>();
  for (const a of db.teacher_subject_assignments || []) {
    const id = sanitizeId(a.id, 'asg');
    const teacherId = sanitizeId(a.teacherId, 'tch');
    const classId = sanitizeId(a.classId, 'cls');
    const subjectId = sanitizeId(a.subjectId, 'sub');
    if (
      !teacherIds.has(teacherId) ||
      !classIds.has(classId) ||
      !subjectIds.has(subjectId)
    ) {
      continue;
    }
    assignmentIds.add(id);
    phase3Ops.push({
      type: 'set',
      collection: 'teacher_subject_assignments',
      id,
      data: {
        id,
        academicYearId: clampStr(a.academicYearId, 40),
        teacherId,
        classId,
        sectionId: sanitizeId(a.sectionId, 'sec'),
        subjectId,
        assignmentType: a.assignmentType || 'subject_teacher',
        ...(a.periodSlot !== undefined
          ? { periodSlot: clampStr(a.periodSlot, 80) }
          : {}),
        createdBy: clampStr(a.createdBy || 'Admin', 80),
        createdDate: clampStr(a.createdDate, 40),
        ...ownerMetaCreate(assignmentsExisting.metaById, id),
      },
    });
  }

  await commitBatchOps(phase3Ops, 3, true);

  // Phase 4: Delete removed records cleanly (children before parents)
  const addDeletes = (
    existingMap: Map<string, Record<string, unknown>>,
    keepIds: Set<string>,
    collectionName: string,
    targetOps: BatchOp[],
  ) => {
    for (const oldId of existingMap.keys()) {
      if (!keepIds.has(oldId)) {
        targetOps.push({ type: 'delete', collection: collectionName, id: oldId });
      }
    }
  };

  const deleteChildOps: BatchOp[] = [];
  addDeletes(passportsExisting.metaById, passportIds, 'teacher_passports', deleteChildOps);
  addDeletes(
    assignmentsExisting.metaById,
    assignmentIds,
    'teacher_subject_assignments',
    deleteChildOps,
  );
  addDeletes(marksExisting.metaById, markIds, 'marks', deleteChildOps);
  addDeletes(studentsExisting.metaById, studentIds, 'students', deleteChildOps);
  addDeletes(subjectsExisting.metaById, subjectIds, 'subjects', deleteChildOps);
  await commitBatchOps(deleteChildOps);

  const deleteParentOps: BatchOp[] = [];
  addDeletes(teachersExisting.metaById, teacherIds, 'teachers', deleteParentOps);
  addDeletes(examsExisting.metaById, examIds, 'exams', deleteParentOps);
  addDeletes(classesExisting.metaById, classIds, 'school_classes', deleteParentOps);
  await commitBatchOps(deleteParentOps);
}
