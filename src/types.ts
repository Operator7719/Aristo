export type ActiveStatus = 'active' | 'inactive';

export type ConversionTier = 'none' | 'grade_4_8' | 'grade_9_12';

export type SubjectCategory = 'compulsory' | 'opt_1' | 'opt_2';

export interface GradingRule {
  id: string;
  minPercent: number;
  maxPercent: number;
  grade: string;
  description: string;
  gradePoint: number;
}

export interface SchoolSettings {
  schoolName: string;
  address: string;
  phone?: string;
  email?: string;
  estd: string;
  iemisCode: string;
  academicYear: string;
  dateOfIssue: string;
  examIssueDates?: Partial<Record<ExamTerm, string>>;
  examWorkingDays?: Partial<Record<ExamTerm, number>>;
  status: ActiveStatus;
  requirePassBothComponents: boolean;
  signatories: {
    classTeacher: string;
    coordinator: string;
    principal: string;
  };
  gradingRules: GradingRule[];
}

export interface ClassSection {
  id: string;
  name: string;
  status: ActiveStatus;
}

export interface SchoolClass {
  id: string;
  name: string;
  gradeLevel: number; // -2 Nursery, -1 LKG, 0 UKG, 1..12 Grades 1..12
  conversionTier: ConversionTier;
  sections: ClassSection[];
  status: ActiveStatus;
  order: number;
}

export type SubjectGradingMode = 'academic' | 'grade_only';

export interface Subject {
  id: string;
  classId: string;
  code: string;
  name: string;
  category: SubjectCategory;
  gradingMode?: SubjectGradingMode;
  fullMarksTheory: number;
  fullMarksPractical: number;
  passMarksTheory: number;
  passMarksPractical: number;
  creditHourTheory: number;
  creditHourPractical: number;
  conversionRule: 'inherit' | ConversionTier;
  status: ActiveStatus;
  displayOrder: number;
}

export interface Student {
  id: string;
  studentCode: string;
  name: string;
  classId: string;
  sectionId: string;
  rollNo: number;
  academicYear: string;
  dob?: string;
  guardianName: string;
  contact: string;
  optionalSubjects: {
    opt_1?: string;
    opt_2?: string;
  };
  status: ActiveStatus;
}

export type ExamTerm = 'first' | 'second' | 'third' | 'annual';

export interface Exam {
  id: string;
  name: string;
  term: ExamTerm;
  academicYear: string;
  workingDays: number;
  dateOfIssue: string;
  status: ActiveStatus;
}

export interface SubjectMarkInput {
  theoryObtained: number | null;
  practicalObtained: number | null;
  absentTheory?: boolean;
  absentPractical?: boolean;
}

export interface MarkRecord {
  id: string; // `${examId}__${studentId}`
  examId: string;
  studentId: string;
  classId: string;
  sectionId: string;
  workingDays: number;
  presentDays: number;
  subjects: Record<string, SubjectMarkInput>;
  nonAcademicGrades?: Record<string, string>;
  teacherRemarks?: string;
}

export type AssignmentType = 'class_teacher' | 'subject_teacher';

export type UserRole = 'admin' | 'teacher';

export type PassportStatus = 'active' | 'revoked' | 'expired';

export interface TeacherPassport {
  id: string;
  passportNumber: string;
  passportTitle: string;
  username: string;
  passcode: string;
  assignedTeacherId: string | null;
  issuedDate: string;
  expiryDate: string;
  status: PassportStatus;
  notes?: string;
  createdBy: string;
  createdDate: string;
  assignedDate?: string;
}

export interface Teacher {
  id: string;
  teacherCode: string;
  name: string;
  email: string;
  phone: string;
  qualification: string;
  specialization: string;
  status: ActiveStatus;
  joinedDate: string;
}

export interface TeacherSubjectAssignment {
  id: string;
  academicYearId: string;
  teacherId: string;
  classId: string;
  sectionId: string;
  subjectId: string;
  assignmentType: AssignmentType;
  periodSlot?: string;
  createdBy: string;
  createdDate: string;
}

export interface AdminPasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecialChar: boolean;
}

export interface AdminSecurityConfig {
  isConfigured: boolean;
  adminUsername: string;
  adminDisplayName: string;
  passwordHash: string;
  passwordSalt: string;
  recoveryQuestion: string;
  recoveryAnswerHash: string;
  requireOnRoleSwitch: boolean;
  requireOnAppStart: boolean;
  maxFailedAttempts: number;
  requirements: AdminPasswordRequirements;
  updatedDate?: string;
  updatedBy?: string;
}

export interface SchoolDatabase {
  settings: SchoolSettings;
  classes: SchoolClass[];
  subjects: Subject[];
  students: Student[];
  exams: Exam[];
  marks: MarkRecord[];
  academicYears?: string[];
  teachers: Teacher[];
  teacher_subject_assignments: TeacherSubjectAssignment[];
  teacher_passports: TeacherPassport[];
  admin_security?: AdminSecurityConfig;
}

export type NavPage =
  | 'dashboard'
  | 'students'
  | 'classes'
  | 'subjects'
  | 'optional-assignment'
  | 'teacher-assignments'
  | 'teacher-passports'
  | 'teacher-dashboard'
  | 'exams'
  | 'marks-entry'
  | 'markwise-ledger'
  | 'gradewise-ledger'
  | 'top-ten'
  | 'grade-sheet'
  | 'excel-io'
  | 'settings'
  | 'admin-security';
