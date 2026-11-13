import {
  AdminSecurityConfig,
  Exam,
  ExamTerm,
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
import { hashTeacherPasscode } from '../utils/passwordSecurity';

export const DEFAULT_ACADEMIC_YEARS = ['2081 B.S', '2082 B.S', '2083 B.S'];

export function createDefaultTeachers(): Teacher[] {
  return [
    {
      id: 'tch-1',
      teacherCode: 'TCH-001',
      name: 'Ram Prasad Joshi',
      email: 'ram.joshi@aristohighschool.edu.np',
      phone: '9848021001',
      qualification: 'M.Sc. Mathematics',
      specialization: 'Mathematics & Add. Maths',
      status: 'active',
      joinedDate: '2074-01-15',
    },
    {
      id: 'tch-2',
      teacherCode: 'TCH-002',
      name: 'Sita Kumari Thapa',
      email: 'sita.thapa@aristohighschool.edu.np',
      phone: '9848021002',
      qualification: 'M.A. English',
      specialization: 'English & Grammar',
      status: 'active',
      joinedDate: '2075-02-10',
    },
    {
      id: 'tch-3',
      teacherCode: 'TCH-003',
      name: 'Hari Bahadur Bohara',
      email: 'hari.bohara@aristohighschool.edu.np',
      phone: '9848021003',
      qualification: 'M.A. Nepali',
      specialization: 'Nepali & Social Studies',
      status: 'active',
      joinedDate: '2073-04-01',
    },
    {
      id: 'tch-4',
      teacherCode: 'TCH-004',
      name: 'Gita Devi Pant',
      email: 'gita.pant@aristohighschool.edu.np',
      phone: '9848021004',
      qualification: 'M.Sc. Physics',
      specialization: 'Science & Environment Science',
      status: 'active',
      joinedDate: '2076-01-20',
    },
    {
      id: 'tch-5',
      teacherCode: 'TCH-005',
      name: 'Bikash Chandra Bhatta',
      email: 'bikash.bhatta@aristohighschool.edu.np',
      phone: '9848021005',
      qualification: 'MIT / B.Sc. CSIT',
      specialization: 'Computer Science',
      status: 'active',
      joinedDate: '2077-05-12',
    },
    {
      id: 'tch-6',
      teacherCode: 'TCH-006',
      name: 'Laxmi Kumari Saud',
      email: 'laxmi.saud@aristohighschool.edu.np',
      phone: '9848021006',
      qualification: 'MBS / M.A. Economics',
      specialization: 'Economics & Accounting',
      status: 'active',
      joinedDate: '2078-01-05',
    },
    {
      id: 'tch-7',
      teacherCode: 'TCH-007',
      name: 'Nirmala Chaudhary',
      email: 'nirmala.chaudhary@aristohighschool.edu.np',
      phone: '9848021007',
      qualification: 'B.Ed. Primary Education',
      specialization: 'Primary & Pre-Primary',
      status: 'active',
      joinedDate: '2079-02-01',
    },
    {
      id: 'tch-8',
      teacherCode: 'TCH-008',
      name: 'Dipendra Singh Dhami',
      email: 'dipendra.dhami@aristohighschool.edu.np',
      phone: '9848021008',
      qualification: 'M.Ed. Social Science',
      specialization: 'Social Studies & GK',
      status: 'active',
      joinedDate: '2080-01-12',
    },
  ];
}

export function createDefaultTeacherAssignments(): TeacherSubjectAssignment[] {
  return [
    // Current Academic Year: 2082 B.S — Grade 9 Section A
    {
      id: 'asg-2082-9a-nep',
      academicYearId: '2082 B.S',
      teacherId: 'tch-3',
      classId: 'cls-9',
      sectionId: 'sec-9-a',
      subjectId: 'sub-9-nep',
      assignmentType: 'subject_teacher',
      periodSlot: 'Period 1 (09:30–10:15)',
      createdBy: 'Admin',
      createdDate: '2082-01-10',
    },
    {
      id: 'asg-2082-9a-eng',
      academicYearId: '2082 B.S',
      teacherId: 'tch-2',
      classId: 'cls-9',
      sectionId: 'sec-9-a',
      subjectId: 'sub-9-eng',
      assignmentType: 'subject_teacher',
      periodSlot: 'Period 2 (10:15–11:00)',
      createdBy: 'Admin',
      createdDate: '2082-01-10',
    },
    {
      id: 'asg-2082-9a-math',
      academicYearId: '2082 B.S',
      teacherId: 'tch-1',
      classId: 'cls-9',
      sectionId: 'sec-9-a',
      subjectId: 'sub-9-math',
      assignmentType: 'class_teacher',
      periodSlot: 'Period 3 (11:00–11:45)',
      createdBy: 'Admin',
      createdDate: '2082-01-10',
    },
    {
      id: 'asg-2082-9a-sci',
      academicYearId: '2082 B.S',
      teacherId: 'tch-4',
      classId: 'cls-9',
      sectionId: 'sec-9-a',
      subjectId: 'sub-9-sci',
      assignmentType: 'subject_teacher',
      periodSlot: 'Period 4 (11:45–12:30)',
      createdBy: 'Admin',
      createdDate: '2082-01-10',
    },
    {
      id: 'asg-2082-9a-soc',
      academicYearId: '2082 B.S',
      teacherId: 'tch-8',
      classId: 'cls-9',
      sectionId: 'sec-9-a',
      subjectId: 'sub-9-soc',
      assignmentType: 'subject_teacher',
      periodSlot: 'Period 5 (13:00–13:45)',
      createdBy: 'Admin',
      createdDate: '2082-01-10',
    },
    {
      id: 'asg-2082-9a-eco',
      academicYearId: '2082 B.S',
      teacherId: 'tch-6',
      classId: 'cls-9',
      sectionId: 'sec-9-a',
      subjectId: 'sub-9-opt1-eco',
      assignmentType: 'subject_teacher',
      periodSlot: 'Period 6 (13:45–14:30)',
      createdBy: 'Admin',
      createdDate: '2082-01-10',
    },
    {
      id: 'asg-2082-9a-amth',
      academicYearId: '2082 B.S',
      teacherId: 'tch-1',
      classId: 'cls-9',
      sectionId: 'sec-9-a',
      subjectId: 'sub-9-opt1-amth',
      assignmentType: 'subject_teacher',
      periodSlot: 'Period 6 (13:45–14:30)',
      createdBy: 'Admin',
      createdDate: '2082-01-10',
    },
    {
      id: 'asg-2082-9a-cs',
      academicYearId: '2082 B.S',
      teacherId: 'tch-5',
      classId: 'cls-9',
      sectionId: 'sec-9-a',
      subjectId: 'sub-9-opt2-cs',
      assignmentType: 'subject_teacher',
      periodSlot: 'Period 7 (14:30–15:15)',
      createdBy: 'Admin',
      createdDate: '2082-01-10',
    },

    // Current Academic Year: 2082 B.S — Grade 6 Section A
    {
      id: 'asg-2082-6a-math',
      academicYearId: '2082 B.S',
      teacherId: 'tch-1',
      classId: 'cls-6',
      sectionId: 'sec-6-a',
      subjectId: 'sub-6-math',
      assignmentType: 'subject_teacher',
      periodSlot: 'Period 1 (09:30–10:15)',
      createdBy: 'Admin',
      createdDate: '2082-01-11',
    },
    {
      id: 'asg-2082-6a-eng',
      academicYearId: '2082 B.S',
      teacherId: 'tch-2',
      classId: 'cls-6',
      sectionId: 'sec-6-a',
      subjectId: 'sub-6-eng',
      assignmentType: 'class_teacher',
      periodSlot: 'Period 3 (11:00–11:45)',
      createdBy: 'Admin',
      createdDate: '2082-01-11',
    },
    {
      id: 'asg-2082-6a-sci',
      academicYearId: '2082 B.S',
      teacherId: 'tch-4',
      classId: 'cls-6',
      sectionId: 'sec-6-a',
      subjectId: 'sub-6-sci',
      assignmentType: 'subject_teacher',
      periodSlot: 'Period 2 (10:15–11:00)',
      createdBy: 'Admin',
      createdDate: '2082-01-11',
    },
    {
      id: 'asg-2082-6a-comp',
      academicYearId: '2082 B.S',
      teacherId: 'tch-5',
      classId: 'cls-6',
      sectionId: 'sec-6-a',
      subjectId: 'sub-6-comp',
      assignmentType: 'subject_teacher',
      periodSlot: 'Period 5 (13:00–13:45)',
      createdBy: 'Admin',
      createdDate: '2082-01-11',
    },

    // Current Academic Year: 2082 B.S — Grade 2 Section A
    {
      id: 'asg-2082-2a-nep',
      academicYearId: '2082 B.S',
      teacherId: 'tch-7',
      classId: 'cls-2',
      sectionId: 'sec-2-a',
      subjectId: 'sub-2-nep',
      assignmentType: 'class_teacher',
      periodSlot: 'Period 1 (09:30–10:15)',
      createdBy: 'Admin',
      createdDate: '2082-01-12',
    },
    {
      id: 'asg-2082-2a-eng',
      academicYearId: '2082 B.S',
      teacherId: 'tch-7',
      classId: 'cls-2',
      sectionId: 'sec-2-a',
      subjectId: 'sub-2-eng',
      assignmentType: 'subject_teacher',
      periodSlot: 'Period 2 (10:15–11:00)',
      createdBy: 'Admin',
      createdDate: '2082-01-12',
    },
    {
      id: 'asg-2082-2a-math',
      academicYearId: '2082 B.S',
      teacherId: 'tch-7',
      classId: 'cls-2',
      sectionId: 'sec-2-a',
      subjectId: 'sub-2-math',
      assignmentType: 'subject_teacher',
      periodSlot: 'Period 3 (11:00–11:45)',
      createdBy: 'Admin',
      createdDate: '2082-01-12',
    },

    // Historical Academic Year: 2081 B.S
    {
      id: 'asg-2081-9a-math',
      academicYearId: '2081 B.S',
      teacherId: 'tch-1',
      classId: 'cls-9',
      sectionId: 'sec-9-a',
      subjectId: 'sub-9-math',
      assignmentType: 'class_teacher',
      periodSlot: 'Period 3 (11:00–11:45)',
      createdBy: 'Admin',
      createdDate: '2081-01-12',
    },
    {
      id: 'asg-2081-10a-math',
      academicYearId: '2081 B.S',
      teacherId: 'tch-1',
      classId: 'cls-10',
      sectionId: 'sec-10-a',
      subjectId: 'sub-10-math',
      assignmentType: 'subject_teacher',
      periodSlot: 'Period 4 (11:45–12:30)',
      createdBy: 'Admin',
      createdDate: '2081-01-12',
    },
  ];
}

export function createDefaultTeacherPassports(): TeacherPassport[] {
  const defaults: TeacherPassport[] = [
    {
      id: 'pp-2082-001',
      passportNumber: 'ARISTO-PP-2082-001',
      passportTitle: 'Class Teacher Passport',
      username: 'ram.joshi',
      passcode: 'Aristo@001',
      assignedTeacherId: 'tch-1',
      issuedDate: '2082-01-10',
      expiryDate: '2083-12-30',
      status: 'active',
      notes: 'Grade 9A Class Teacher & Mathematics access credential',
      createdBy: 'Admin',
      createdDate: '2082-01-10',
      assignedDate: '2082-01-10',
    },
    {
      id: 'pp-2082-002',
      passportNumber: 'ARISTO-PP-2082-002',
      passportTitle: 'Class Teacher Passport',
      username: 'sita.thapa',
      passcode: 'Aristo@002',
      assignedTeacherId: 'tch-2',
      issuedDate: '2082-01-10',
      expiryDate: '2083-12-30',
      status: 'active',
      notes: 'English department & Grade 6A Class Teacher credential',
      createdBy: 'Admin',
      createdDate: '2082-01-10',
      assignedDate: '2082-01-10',
    },
    {
      id: 'pp-2082-003',
      passportNumber: 'ARISTO-PP-2082-003',
      passportTitle: 'Subject Faculty Passport',
      username: 'hari.bohara',
      passcode: 'Aristo@003',
      assignedTeacherId: 'tch-3',
      issuedDate: '2082-01-10',
      expiryDate: '2083-12-30',
      status: 'active',
      notes: 'Nepali & Social Studies subject portal access',
      createdBy: 'Admin',
      createdDate: '2082-01-10',
      assignedDate: '2082-01-10',
    },
    {
      id: 'pp-2082-004',
      passportNumber: 'ARISTO-PP-2082-004',
      passportTitle: 'Subject Faculty Passport',
      username: 'gita.pant',
      passcode: 'Aristo@004',
      assignedTeacherId: 'tch-4',
      issuedDate: '2082-01-10',
      expiryDate: '2083-12-30',
      status: 'active',
      notes: 'Science department marks entry passport',
      createdBy: 'Admin',
      createdDate: '2082-01-10',
      assignedDate: '2082-01-10',
    },
    {
      id: 'pp-2082-005',
      passportNumber: 'ARISTO-PP-2082-005',
      passportTitle: 'Subject Faculty Passport',
      username: 'bikash.bhatta',
      passcode: 'Aristo@005',
      assignedTeacherId: 'tch-5',
      issuedDate: '2082-01-10',
      expiryDate: '2083-12-30',
      status: 'active',
      notes: 'Computer Science faculty passport',
      createdBy: 'Admin',
      createdDate: '2082-01-10',
      assignedDate: '2082-01-10',
    },
    {
      id: 'pp-2082-006',
      passportNumber: 'ARISTO-PP-2082-006',
      passportTitle: 'Subject Faculty Passport',
      username: 'laxmi.saud',
      passcode: 'Aristo@006',
      assignedTeacherId: 'tch-6',
      issuedDate: '2082-01-10',
      expiryDate: '2083-12-30',
      status: 'active',
      notes: 'Economics & Accounting faculty passport',
      createdBy: 'Admin',
      createdDate: '2082-01-10',
      assignedDate: '2082-01-10',
    },
    {
      id: 'pp-2082-007',
      passportNumber: 'ARISTO-PP-2082-007',
      passportTitle: 'Primary Faculty Passport',
      username: 'faculty.slot07',
      passcode: 'Aristo@007',
      assignedTeacherId: null,
      issuedDate: '2082-01-15',
      expiryDate: '2083-12-30',
      status: 'active',
      notes: 'Pre-issued passport ready to assign to a primary teacher',
      createdBy: 'Admin',
      createdDate: '2082-01-15',
    },
    {
      id: 'pp-2082-008',
      passportNumber: 'ARISTO-PP-2082-008',
      passportTitle: 'Subject Faculty Passport',
      username: 'faculty.slot08',
      passcode: 'Aristo@008',
      assignedTeacherId: null,
      issuedDate: '2082-01-15',
      expiryDate: '2083-12-30',
      status: 'active',
      notes: 'Pre-issued passport ready for individual assignment',
      createdBy: 'Admin',
      createdDate: '2082-01-15',
    },
  ];
  return defaults.map((p) => {
    const { passwordSalt, passwordHash } = hashTeacherPasscode(p.passcode);
    return {
      ...p,
      passcode: '',
      passwordSalt,
      passwordHash,
      passwordUpdatedDate: p.createdDate,
      passwordUpdatedBy: p.createdBy,
    };
  });
}

export const DEFAULT_AUTHORIZED_ADMIN_EMAIL = 'nirmaldahit@gmail.com';

export function createDefaultAdminSecurity(): AdminSecurityConfig {
  return {
    isConfigured: false,
    authorizedAdminEmail: DEFAULT_AUTHORIZED_ADMIN_EMAIL,
    strictSingleUserOnly: true,
    adminUsername: 'admin',
    adminDisplayName: 'Principal / Exam Admin',
    passwordHash: '',
    passwordSalt: '',
    recoveryQuestion: "What is the school's founding year (B.S.)?",
    recoveryAnswerHash: '',
    requireOnRoleSwitch: true,
    requireOnAppStart: false,
    maxFailedAttempts: 5,
    requirements: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumber: true,
      requireSpecialChar: true,
    },
  };
}

export function createSeedDatabase(): SchoolDatabase {
  const classes: SchoolClass[] = [
    { id: 'cls-nursery', name: 'Nursery', gradeLevel: -2, conversionTier: 'none', sections: [{ id: 'sec-nur-a', name: 'A', status: 'active' }], status: 'active', order: 1 },
    { id: 'cls-lkg', name: 'LKG', gradeLevel: -1, conversionTier: 'none', sections: [{ id: 'sec-lkg-a', name: 'A', status: 'active' }], status: 'active', order: 2 },
    { id: 'cls-ukg', name: 'UKG', gradeLevel: 0, conversionTier: 'none', sections: [{ id: 'sec-ukg-a', name: 'A', status: 'active' }], status: 'active', order: 3 },
    { id: 'cls-1', name: 'Grade 1', gradeLevel: 1, conversionTier: 'none', sections: [{ id: 'sec-1-a', name: 'A', status: 'active' }], status: 'active', order: 4 },
    { id: 'cls-2', name: 'Grade 2', gradeLevel: 2, conversionTier: 'none', sections: [{ id: 'sec-2-a', name: 'A', status: 'active' }, { id: 'sec-2-b', name: 'B', status: 'active' }], status: 'active', order: 5 },
    { id: 'cls-3', name: 'Grade 3', gradeLevel: 3, conversionTier: 'none', sections: [{ id: 'sec-3-a', name: 'A', status: 'active' }], status: 'active', order: 6 },
    { id: 'cls-4', name: 'Grade 4', gradeLevel: 4, conversionTier: 'grade_4_8', sections: [{ id: 'sec-4-a', name: 'A', status: 'active' }], status: 'active', order: 7 },
    { id: 'cls-5', name: 'Grade 5', gradeLevel: 5, conversionTier: 'grade_4_8', sections: [{ id: 'sec-5-a', name: 'A', status: 'active' }], status: 'active', order: 8 },
    { id: 'cls-6', name: 'Grade 6', gradeLevel: 6, conversionTier: 'grade_4_8', sections: [{ id: 'sec-6-a', name: 'A', status: 'active' }, { id: 'sec-6-b', name: 'B', status: 'active' }], status: 'active', order: 9 },
    { id: 'cls-7', name: 'Grade 7', gradeLevel: 7, conversionTier: 'grade_4_8', sections: [{ id: 'sec-7-a', name: 'A', status: 'active' }], status: 'active', order: 10 },
    { id: 'cls-8', name: 'Grade 8', gradeLevel: 8, conversionTier: 'grade_4_8', sections: [{ id: 'sec-8-a', name: 'A', status: 'active' }], status: 'active', order: 11 },
    { id: 'cls-9', name: 'Grade 9', gradeLevel: 9, conversionTier: 'grade_9_12', sections: [{ id: 'sec-9-a', name: 'A', status: 'active' }, { id: 'sec-9-b', name: 'B', status: 'active' }], status: 'active', order: 12 },
    { id: 'cls-10', name: 'Grade 10', gradeLevel: 10, conversionTier: 'grade_9_12', sections: [{ id: 'sec-10-a', name: 'A', status: 'active' }, { id: 'sec-10-b', name: 'B', status: 'active' }], status: 'active', order: 13 },
    { id: 'cls-11', name: 'Grade 11', gradeLevel: 11, conversionTier: 'grade_9_12', sections: [{ id: 'sec-11-a', name: 'A', status: 'active' }], status: 'active', order: 14 },
    { id: 'cls-12', name: 'Grade 12', gradeLevel: 12, conversionTier: 'grade_9_12', sections: [{ id: 'sec-12-a', name: 'A', status: 'active' }], status: 'active', order: 15 },
  ];

  const baseSubjects: Subject[] = [
    // Grade 2 (No conversion - direct marks out of 100 or 80/20)
    { id: 'sub-2-nep', classId: 'cls-2', code: 'NEP-2', name: 'NEPALI', category: 'compulsory', gradingMode: 'academic', fullMarksTheory: 100, fullMarksPractical: 0, passMarksTheory: 35, passMarksPractical: 0, creditHourTheory: 4, creditHourPractical: 0, conversionRule: 'inherit', status: 'active', displayOrder: 1 },
    { id: 'sub-2-eng', classId: 'cls-2', code: 'ENG-2', name: 'ENGLISH', category: 'compulsory', gradingMode: 'academic', fullMarksTheory: 100, fullMarksPractical: 0, passMarksTheory: 35, passMarksPractical: 0, creditHourTheory: 4, creditHourPractical: 0, conversionRule: 'inherit', status: 'active', displayOrder: 2 },
    { id: 'sub-2-math', classId: 'cls-2', code: 'MTH-2', name: 'MATHEMATICS', category: 'compulsory', gradingMode: 'academic', fullMarksTheory: 100, fullMarksPractical: 0, passMarksTheory: 35, passMarksPractical: 0, creditHourTheory: 4, creditHourPractical: 0, conversionRule: 'inherit', status: 'active', displayOrder: 3 },
    { id: 'sub-2-sero', classId: 'cls-2', code: 'SER-2', name: 'HAMRO SEROFERO', category: 'compulsory', gradingMode: 'academic', fullMarksTheory: 80, fullMarksPractical: 20, passMarksTheory: 28, passMarksPractical: 7, creditHourTheory: 3, creditHourPractical: 1, conversionRule: 'inherit', status: 'active', displayOrder: 4 },

    // Grade 6 (50 TH, 40 PR -> 10% TH converted + PR = 50 PR)
    { id: 'sub-6-nep', classId: 'cls-6', code: 'NEP-6', name: 'NEPALI', category: 'compulsory', gradingMode: 'academic', fullMarksTheory: 50, fullMarksPractical: 40, passMarksTheory: 18, passMarksPractical: 14, creditHourTheory: 2.5, creditHourPractical: 2.5, conversionRule: 'inherit', status: 'active', displayOrder: 1 },
    { id: 'sub-6-eng', classId: 'cls-6', code: 'ENG-6', name: 'ENGLISH', category: 'compulsory', gradingMode: 'academic', fullMarksTheory: 50, fullMarksPractical: 40, passMarksTheory: 18, passMarksPractical: 14, creditHourTheory: 2.5, creditHourPractical: 2.5, conversionRule: 'inherit', status: 'active', displayOrder: 2 },
    { id: 'sub-6-math', classId: 'cls-6', code: 'MTH-6', name: 'MATHEMATICS', category: 'compulsory', gradingMode: 'academic', fullMarksTheory: 50, fullMarksPractical: 40, passMarksTheory: 18, passMarksPractical: 14, creditHourTheory: 2.5, creditHourPractical: 2.5, conversionRule: 'inherit', status: 'active', displayOrder: 3 },
    { id: 'sub-6-sci', classId: 'cls-6', code: 'SCI-6', name: 'SCIENCE AND TECHNOLOGY', category: 'compulsory', gradingMode: 'academic', fullMarksTheory: 50, fullMarksPractical: 40, passMarksTheory: 18, passMarksPractical: 14, creditHourTheory: 2.5, creditHourPractical: 2.5, conversionRule: 'inherit', status: 'active', displayOrder: 4 },
    { id: 'sub-6-soc', classId: 'cls-6', code: 'SOC-6', name: 'SOCIAL STUDIES', category: 'compulsory', gradingMode: 'academic', fullMarksTheory: 50, fullMarksPractical: 40, passMarksTheory: 18, passMarksPractical: 14, creditHourTheory: 2.5, creditHourPractical: 2.5, conversionRule: 'inherit', status: 'active', displayOrder: 5 },
    { id: 'sub-6-comp', classId: 'cls-6', code: 'CMP-6', name: 'COMPUTER', category: 'compulsory', gradingMode: 'academic', fullMarksTheory: 50, fullMarksPractical: 40, passMarksTheory: 18, passMarksPractical: 14, creditHourTheory: 2, creditHourPractical: 2, conversionRule: 'inherit', status: 'active', displayOrder: 6 },

    // Grade 9 (75 TH, 19 PR -> 6% TH converted + PR = 25 PR; plus Opt I & Opt II)
    { id: 'sub-9-nep', classId: 'cls-9', code: 'NEP-9', name: 'COMP. NEPALI', category: 'compulsory', fullMarksTheory: 75, fullMarksPractical: 19, passMarksTheory: 27, passMarksPractical: 7, creditHourTheory: 2.25, creditHourPractical: 0.75, conversionRule: 'inherit', status: 'active', displayOrder: 1 },
    { id: 'sub-9-eng', classId: 'cls-9', code: 'ENG-9', name: 'COMP. ENGLISH', category: 'compulsory', fullMarksTheory: 75, fullMarksPractical: 19, passMarksTheory: 27, passMarksPractical: 7, creditHourTheory: 3.0, creditHourPractical: 1.0, conversionRule: 'inherit', status: 'active', displayOrder: 2 },
    { id: 'sub-9-math', classId: 'cls-9', code: 'MTH-9', name: 'COMP. MATHEMATICS', category: 'compulsory', fullMarksTheory: 75, fullMarksPractical: 19, passMarksTheory: 27, passMarksPractical: 7, creditHourTheory: 3.75, creditHourPractical: 1.25, conversionRule: 'inherit', status: 'active', displayOrder: 3 },
    { id: 'sub-9-sci', classId: 'cls-9', code: 'SCI-9', name: 'COMP. SCIENCE AND TECHNOLOGY', category: 'compulsory', fullMarksTheory: 75, fullMarksPractical: 19, passMarksTheory: 27, passMarksPractical: 7, creditHourTheory: 3.75, creditHourPractical: 1.25, conversionRule: 'inherit', status: 'active', displayOrder: 4 },
    { id: 'sub-9-soc', classId: 'cls-9', code: 'SOC-9', name: 'COMP. SOCIAL STUDIES', category: 'compulsory', fullMarksTheory: 75, fullMarksPractical: 19, passMarksTheory: 27, passMarksPractical: 7, creditHourTheory: 3.75, creditHourPractical: 1.25, conversionRule: 'inherit', status: 'active', displayOrder: 5 },
    { id: 'sub-9-opt1-eco', classId: 'cls-9', code: 'OPT1-ECO-9', name: 'OPT.I ECONOMICS', category: 'opt_1', fullMarksTheory: 75, fullMarksPractical: 19, passMarksTheory: 27, passMarksPractical: 7, creditHourTheory: 3.75, creditHourPractical: 1.25, conversionRule: 'inherit', status: 'active', displayOrder: 6 },
    { id: 'sub-9-opt1-amth', classId: 'cls-9', code: 'OPT1-AMTH-9', name: 'OPT.I ADDITIONAL MATHEMATICS', category: 'opt_1', fullMarksTheory: 75, fullMarksPractical: 19, passMarksTheory: 27, passMarksPractical: 7, creditHourTheory: 3.75, creditHourPractical: 1.25, conversionRule: 'inherit', status: 'active', displayOrder: 6 },
    { id: 'sub-9-opt1-acc', classId: 'cls-9', code: 'OPT1-ACC-9', name: 'OPT.I ACCOUNTING', category: 'opt_1', fullMarksTheory: 75, fullMarksPractical: 19, passMarksTheory: 27, passMarksPractical: 7, creditHourTheory: 3.75, creditHourPractical: 1.25, conversionRule: 'inherit', status: 'active', displayOrder: 6 },
    { id: 'sub-9-opt2-cs', classId: 'cls-9', code: 'OPT2-CS-9', name: 'OPT.II COMPUTER SCIENCE', category: 'opt_2', fullMarksTheory: 75, fullMarksPractical: 19, passMarksTheory: 27, passMarksPractical: 7, creditHourTheory: 2.0, creditHourPractical: 2.0, conversionRule: 'inherit', status: 'active', displayOrder: 7 },
    { id: 'sub-9-opt2-env', classId: 'cls-9', code: 'OPT2-ENV-9', name: 'OPT.II ENVIRONMENT SCIENCE', category: 'opt_2', fullMarksTheory: 75, fullMarksPractical: 19, passMarksTheory: 27, passMarksPractical: 7, creditHourTheory: 3.0, creditHourPractical: 1.0, conversionRule: 'inherit', status: 'active', displayOrder: 7 },

    // Grade 10 (75 TH, 19 PR -> 6% TH converted + PR = 25 PR; plus Opt I & Opt II)
    { id: 'sub-10-nep', classId: 'cls-10', code: 'NEP-10', name: 'COMP. NEPALI', category: 'compulsory', fullMarksTheory: 75, fullMarksPractical: 19, passMarksTheory: 27, passMarksPractical: 7, creditHourTheory: 2.25, creditHourPractical: 0.75, conversionRule: 'inherit', status: 'active', displayOrder: 1 },
    { id: 'sub-10-eng', classId: 'cls-10', code: 'ENG-10', name: 'COMP. ENGLISH', category: 'compulsory', fullMarksTheory: 75, fullMarksPractical: 19, passMarksTheory: 27, passMarksPractical: 7, creditHourTheory: 3.0, creditHourPractical: 1.0, conversionRule: 'inherit', status: 'active', displayOrder: 2 },
    { id: 'sub-10-math', classId: 'cls-10', code: 'MTH-10', name: 'COMP. MATHEMATICS', category: 'compulsory', fullMarksTheory: 75, fullMarksPractical: 19, passMarksTheory: 27, passMarksPractical: 7, creditHourTheory: 3.75, creditHourPractical: 1.25, conversionRule: 'inherit', status: 'active', displayOrder: 3 },
    { id: 'sub-10-sci', classId: 'cls-10', code: 'SCI-10', name: 'COMP. SCIENCE AND TECHNOLOGY', category: 'compulsory', fullMarksTheory: 75, fullMarksPractical: 19, passMarksTheory: 27, passMarksPractical: 7, creditHourTheory: 3.75, creditHourPractical: 1.25, conversionRule: 'inherit', status: 'active', displayOrder: 4 },
    { id: 'sub-10-soc', classId: 'cls-10', code: 'SOC-10', name: 'COMP. SOCIAL STUDIES', category: 'compulsory', fullMarksTheory: 75, fullMarksPractical: 19, passMarksTheory: 27, passMarksPractical: 7, creditHourTheory: 3.75, creditHourPractical: 1.25, conversionRule: 'inherit', status: 'active', displayOrder: 5 },
    { id: 'sub-10-opt1-eco', classId: 'cls-10', code: 'OPT1-ECO-10', name: 'OPT.I ECONOMICS', category: 'opt_1', fullMarksTheory: 75, fullMarksPractical: 19, passMarksTheory: 27, passMarksPractical: 7, creditHourTheory: 3.75, creditHourPractical: 1.25, conversionRule: 'inherit', status: 'active', displayOrder: 6 },
    { id: 'sub-10-opt1-amth', classId: 'cls-10', code: 'OPT1-AMTH-10', name: 'OPT.I ADDITIONAL MATHEMATICS', category: 'opt_1', fullMarksTheory: 75, fullMarksPractical: 19, passMarksTheory: 27, passMarksPractical: 7, creditHourTheory: 3.75, creditHourPractical: 1.25, conversionRule: 'inherit', status: 'active', displayOrder: 6 },
    { id: 'sub-10-opt2-cs', classId: 'cls-10', code: 'OPT2-CS-10', name: 'OPT.II COMPUTER SCIENCE', category: 'opt_2', fullMarksTheory: 75, fullMarksPractical: 19, passMarksTheory: 27, passMarksPractical: 7, creditHourTheory: 2.0, creditHourPractical: 2.0, conversionRule: 'inherit', status: 'active', displayOrder: 7 },
  ];

  const subjects = ensureRequiredSubjects(baseSubjects);

  const students: Student[] = [
    // Grade 9 Section A (matching screenshot names)
    { id: 'stu-9-1', studentCode: '710100021-901', name: 'Aadarsh Rana', classId: 'cls-9', sectionId: 'sec-9-a', rollNo: 1, academicYear: '2082', guardianName: 'Bikram Rana', contact: '9848011201', optionalSubjects: { opt_1: 'sub-9-opt1-eco', opt_2: 'sub-9-opt2-cs' }, status: 'active' },
    { id: 'stu-9-2', studentCode: '710100021-902', name: 'Aaditya Raj Chaudhary', classId: 'cls-9', sectionId: 'sec-9-a', rollNo: 2, academicYear: '2082', guardianName: 'Ramesh Chaudhary', contact: '9848011202', optionalSubjects: { opt_1: 'sub-9-opt1-eco', opt_2: 'sub-9-opt2-cs' }, status: 'active' },
    { id: 'stu-9-3', studentCode: '710100021-903', name: 'Aaditya Rana', classId: 'cls-9', sectionId: 'sec-9-a', rollNo: 3, academicYear: '2082', guardianName: 'Kamal Rana', contact: '9848011203', optionalSubjects: { opt_1: 'sub-9-opt1-amth', opt_2: 'sub-9-opt2-cs' }, status: 'active' },
    { id: 'stu-9-4', studentCode: '710100021-904', name: 'Aaryan Chaudhary', classId: 'cls-9', sectionId: 'sec-9-a', rollNo: 4, academicYear: '2082', guardianName: 'Suresh Chaudhary', contact: '9848011204', optionalSubjects: { opt_1: 'sub-9-opt1-amth', opt_2: 'sub-9-opt2-cs' }, status: 'active' },
    { id: 'stu-9-5', studentCode: '710100021-905', name: 'Aayush Barnwar', classId: 'cls-9', sectionId: 'sec-9-a', rollNo: 5, academicYear: '2082', guardianName: 'Prakash Barnwar', contact: '9848011205', optionalSubjects: { opt_1: 'sub-9-opt1-amth', opt_2: 'sub-9-opt2-cs' }, status: 'active' },
    { id: 'stu-9-6', studentCode: '710100021-906', name: 'Aayushma Bogati', classId: 'cls-9', sectionId: 'sec-9-a', rollNo: 6, academicYear: '2082', guardianName: 'Deepak Bogati', contact: '9848011206', optionalSubjects: { opt_1: 'sub-9-opt1-amth', opt_2: 'sub-9-opt2-cs' }, status: 'active' },

    // Grade 6 Section A
    { id: 'stu-6-1', studentCode: '710100021-601', name: 'Pratiksha Joshi', classId: 'cls-6', sectionId: 'sec-6-a', rollNo: 1, academicYear: '2082', guardianName: 'Harish Joshi', contact: '9848011301', optionalSubjects: {}, status: 'active' },
    { id: 'stu-6-2', studentCode: '710100021-602', name: 'Rohan Thapa', classId: 'cls-6', sectionId: 'sec-6-a', rollNo: 2, academicYear: '2082', guardianName: 'Nabin Thapa', contact: '9848011302', optionalSubjects: {}, status: 'active' },
    { id: 'stu-6-3', studentCode: '710100021-603', name: 'Srijana Pant', classId: 'cls-6', sectionId: 'sec-6-a', rollNo: 3, academicYear: '2082', guardianName: 'Govinda Pant', contact: '9848011303', optionalSubjects: {}, status: 'active' },

    // Grade 2 Section A
    { id: 'stu-2-1', studentCode: '710100021-201', name: 'Aarav Bhatt', classId: 'cls-2', sectionId: 'sec-2-a', rollNo: 1, academicYear: '2082', guardianName: 'Keshav Bhatt', contact: '9848011401', optionalSubjects: {}, status: 'active' },
    { id: 'stu-2-2', studentCode: '710100021-202', name: 'Diya Bohara', classId: 'cls-2', sectionId: 'sec-2-a', rollNo: 2, academicYear: '2082', guardianName: 'Tek Bohara', contact: '9848011402', optionalSubjects: {}, status: 'active' },

    // Grade 10 Section A
    { id: 'stu-10-1', studentCode: '710100021-1001', name: 'Bishal Saud', classId: 'cls-10', sectionId: 'sec-10-a', rollNo: 1, academicYear: '2082', guardianName: 'Prem Saud', contact: '9848011501', optionalSubjects: { opt_1: 'sub-10-opt1-amth', opt_2: 'sub-10-opt2-cs' }, status: 'active' },
    { id: 'stu-10-2', studentCode: '710100021-1002', name: 'Kritika Dhami', classId: 'cls-10', sectionId: 'sec-10-a', rollNo: 2, academicYear: '2082', guardianName: 'Madan Dhami', contact: '9848011502', optionalSubjects: { opt_1: 'sub-10-opt1-eco', opt_2: 'sub-10-opt2-cs' }, status: 'active' },
  ];

  const exams: Exam[] = [
    { id: 'exam-1', name: 'First Terminal Examination', term: 'first', academicYear: '2082 B.S', workingDays: 68, dateOfIssue: '2082-04-20', status: 'active' },
    { id: 'exam-2', name: 'Second Terminal Examination', term: 'second', academicYear: '2082 B.S', workingDays: 72, dateOfIssue: '2082-08-15', status: 'active' },
    { id: 'exam-3', name: 'Third Terminal Examination', term: 'third', academicYear: '2082 B.S', workingDays: 80, dateOfIssue: '2082-12-25', status: 'active' },
    { id: 'exam-4', name: 'Annual Examination', term: 'annual', academicYear: '2082 B.S', workingDays: 210, dateOfIssue: '2082-12-30', status: 'active' },
  ];

  const marks: MarkRecord[] = [
    // Second Terminal Marks for Grade 9
    {
      id: 'exam-2__stu-9-1',
      examId: 'exam-2',
      studentId: 'stu-9-1',
      classId: 'cls-9',
      sectionId: 'sec-9-a',
      workingDays: 72,
      presentDays: 68,
      subjects: {
        'sub-9-nep': { theoryObtained: 61, practicalObtained: 17 },
        'sub-9-eng': { theoryObtained: 66, practicalObtained: 18 },
        'sub-9-math': { theoryObtained: 69, practicalObtained: 18 },
        'sub-9-sci': { theoryObtained: 63, practicalObtained: 17 },
        'sub-9-soc': { theoryObtained: 58, practicalObtained: 16 },
        'sub-9-opt1-eco': { theoryObtained: 64, practicalObtained: 18 },
        'sub-9-opt2-cs': { theoryObtained: 70, practicalObtained: 19 },
      },
    },
    {
      id: 'exam-2__stu-9-2',
      examId: 'exam-2',
      studentId: 'stu-9-2',
      classId: 'cls-9',
      sectionId: 'sec-9-a',
      workingDays: 72,
      presentDays: 65,
      subjects: {
        'sub-9-nep': { theoryObtained: 54, practicalObtained: 16 },
        'sub-9-eng': { theoryObtained: 58, practicalObtained: 17 },
        'sub-9-math': { theoryObtained: 52, practicalObtained: 15 },
        'sub-9-sci': { theoryObtained: 56, practicalObtained: 16 },
        'sub-9-soc': { theoryObtained: 50, practicalObtained: 15 },
        'sub-9-opt1-eco': { theoryObtained: 55, practicalObtained: 16 },
        'sub-9-opt2-cs': { theoryObtained: 62, practicalObtained: 18 },
      },
    },
    {
      id: 'exam-2__stu-9-3',
      examId: 'exam-2',
      studentId: 'stu-9-3',
      classId: 'cls-9',
      sectionId: 'sec-9-a',
      workingDays: 72,
      presentDays: 70,
      subjects: {
        'sub-9-nep': { theoryObtained: 67, practicalObtained: 18 },
        'sub-9-eng': { theoryObtained: 71, practicalObtained: 19 },
        'sub-9-math': { theoryObtained: 73, practicalObtained: 19 },
        'sub-9-sci': { theoryObtained: 68, practicalObtained: 18 },
        'sub-9-soc': { theoryObtained: 64, practicalObtained: 17 },
        'sub-9-opt1-amth': { theoryObtained: 71, practicalObtained: 19 },
        'sub-9-opt2-cs': { theoryObtained: 72, practicalObtained: 19 },
      },
    },
    {
      id: 'exam-2__stu-9-4',
      examId: 'exam-2',
      studentId: 'stu-9-4',
      classId: 'cls-9',
      sectionId: 'sec-9-a',
      workingDays: 72,
      presentDays: 61,
      subjects: {
        'sub-9-nep': { theoryObtained: 44, practicalObtained: 14 },
        'sub-9-eng': { theoryObtained: 47, practicalObtained: 15 },
        'sub-9-math': { theoryObtained: 39, practicalObtained: 13 },
        'sub-9-sci': { theoryObtained: 42, practicalObtained: 14 },
        'sub-9-soc': { theoryObtained: 46, practicalObtained: 14 },
        'sub-9-opt1-amth': { theoryObtained: 37, practicalObtained: 13 },
        'sub-9-opt2-cs': { theoryObtained: 51, practicalObtained: 16 },
      },
    },
    {
      id: 'exam-2__stu-9-5',
      examId: 'exam-2',
      studentId: 'stu-9-5',
      classId: 'cls-9',
      sectionId: 'sec-9-a',
      workingDays: 72,
      presentDays: 69,
      subjects: {
        'sub-9-nep': { theoryObtained: 59, practicalObtained: 17 },
        'sub-9-eng': { theoryObtained: 63, practicalObtained: 17 },
        'sub-9-math': { theoryObtained: 66, practicalObtained: 18 },
        'sub-9-sci': { theoryObtained: 61, practicalObtained: 17 },
        'sub-9-soc': { theoryObtained: 57, practicalObtained: 16 },
        'sub-9-opt1-amth': { theoryObtained: 64, practicalObtained: 18 },
        'sub-9-opt2-cs': { theoryObtained: 68, practicalObtained: 18 },
      },
    },
    {
      id: 'exam-2__stu-9-6',
      examId: 'exam-2',
      studentId: 'stu-9-6',
      classId: 'cls-9',
      sectionId: 'sec-9-a',
      workingDays: 72,
      presentDays: 60,
      subjects: {
        'sub-9-nep': { theoryObtained: 51, practicalObtained: 15 },
        'sub-9-eng': { theoryObtained: 49, practicalObtained: 15 },
        'sub-9-math': { theoryObtained: 22, practicalObtained: 11 }, // NG sample
        'sub-9-sci': { theoryObtained: 45, practicalObtained: 14 },
        'sub-9-soc': { theoryObtained: 48, practicalObtained: 15 },
        'sub-9-opt1-amth': { theoryObtained: 31, practicalObtained: 12 },
        'sub-9-opt2-cs': { theoryObtained: 54, practicalObtained: 16 },
      },
    },

    // Grade 6 Second Terminal Marks (50 TH, 40 PR)
    {
      id: 'exam-2__stu-6-1',
      examId: 'exam-2',
      studentId: 'stu-6-1',
      classId: 'cls-6',
      sectionId: 'sec-6-a',
      workingDays: 72,
      presentDays: 70,
      subjects: {
        'sub-6-nep': { theoryObtained: 44, practicalObtained: 37 },
        'sub-6-eng': { theoryObtained: 46, practicalObtained: 38 },
        'sub-6-math': { theoryObtained: 48, practicalObtained: 39 },
        'sub-6-sci': { theoryObtained: 45, practicalObtained: 37 },
        'sub-6-soc': { theoryObtained: 43, practicalObtained: 36 },
        'sub-6-comp': { theoryObtained: 47, practicalObtained: 39 },
      },
      nonAcademicGrades: {
        'sub-cls-6-draw': 'A+',
      },
    },
    {
      id: 'exam-2__stu-6-2',
      examId: 'exam-2',
      studentId: 'stu-6-2',
      classId: 'cls-6',
      sectionId: 'sec-6-a',
      workingDays: 72,
      presentDays: 66,
      subjects: {
        'sub-6-nep': { theoryObtained: 36, practicalObtained: 32 },
        'sub-6-eng': { theoryObtained: 39, practicalObtained: 33 },
        'sub-6-math': { theoryObtained: 41, practicalObtained: 35 },
        'sub-6-sci': { theoryObtained: 38, practicalObtained: 34 },
        'sub-6-soc': { theoryObtained: 35, practicalObtained: 31 },
        'sub-6-comp': { theoryObtained: 42, practicalObtained: 36 },
      },
      nonAcademicGrades: {
        'sub-cls-6-draw': 'A',
      },
    },
    {
      id: 'exam-2__stu-6-3',
      examId: 'exam-2',
      studentId: 'stu-6-3',
      classId: 'cls-6',
      sectionId: 'sec-6-a',
      workingDays: 72,
      presentDays: 68,
      subjects: {
        'sub-6-nep': { theoryObtained: 41, practicalObtained: 35 },
        'sub-6-eng': { theoryObtained: 43, practicalObtained: 36 },
        'sub-6-math': { theoryObtained: 39, practicalObtained: 34 },
        'sub-6-sci': { theoryObtained: 40, practicalObtained: 35 },
        'sub-6-soc': { theoryObtained: 42, practicalObtained: 36 },
        'sub-6-comp': { theoryObtained: 44, practicalObtained: 37 },
      },
      nonAcademicGrades: {
        'sub-cls-6-draw': 'B+',
      },
    },

    // Grade 2 Second Terminal Marks (Direct, no conversion)
    {
      id: 'exam-2__stu-2-1',
      examId: 'exam-2',
      studentId: 'stu-2-1',
      classId: 'cls-2',
      sectionId: 'sec-2-a',
      workingDays: 72,
      presentDays: 71,
      subjects: {
        'sub-2-nep': { theoryObtained: 88, practicalObtained: 0 },
        'sub-2-eng': { theoryObtained: 92, practicalObtained: 0 },
        'sub-2-math': { theoryObtained: 95, practicalObtained: 0 },
        'sub-2-sero': { theoryObtained: 74, practicalObtained: 19 },
      },
      nonAcademicGrades: {
        'sub-cls-2-draw': 'A+',
        'sub-cls-2-rhy': 'A+',
        'sub-cls-2-crft': 'A',
      },
    },
    {
      id: 'exam-2__stu-2-2',
      examId: 'exam-2',
      studentId: 'stu-2-2',
      classId: 'cls-2',
      sectionId: 'sec-2-a',
      workingDays: 72,
      presentDays: 67,
      subjects: {
        'sub-2-nep': { theoryObtained: 79, practicalObtained: 0 },
        'sub-2-eng': { theoryObtained: 84, practicalObtained: 0 },
        'sub-2-math': { theoryObtained: 81, practicalObtained: 0 },
        'sub-2-sero': { theoryObtained: 68, practicalObtained: 17 },
      },
      nonAcademicGrades: {
        'sub-cls-2-draw': 'A',
        'sub-cls-2-rhy': 'B+',
        'sub-cls-2-crft': 'A',
      },
    },
  ];

  return {
    settings: {
      schoolName: 'ARISTO ENGLISH BOARDING HIGH SCHOOL',
      address: 'Dhangadhi-08, Campus Road, Kailali',
      phone: '091-521456',
      email: 'info@aristohighschool.edu.np',
      estd: '2049 BS',
      iemisCode: '710100021',
      academicYear: '2082 B.S',
      dateOfIssue: '2082-08-15',
      examIssueDates: {
        first: '2082-04-20',
        second: '2082-08-15',
        third: '2082-12-25',
        annual: '2082-12-30',
      },
      examWorkingDays: {
        first: 68,
        second: 72,
        third: 80,
        annual: 210,
      },
      status: 'active',
      requirePassBothComponents: true,
      signatories: {
        classTeacher: 'Class Teacher',
        coordinator: 'Examination In-charge',
        principal: 'Principal',
      },
      gradingRules: [
        { id: 'gr-ap', minPercent: 90, maxPercent: 100, grade: 'A+', description: 'Outstanding', gradePoint: 4.0 },
        { id: 'gr-a', minPercent: 80, maxPercent: 90, grade: 'A', description: 'Excellent', gradePoint: 3.6 },
        { id: 'gr-bp', minPercent: 70, maxPercent: 80, grade: 'B+', description: 'Very Good', gradePoint: 3.2 },
        { id: 'gr-b', minPercent: 60, maxPercent: 70, grade: 'B', description: 'Good', gradePoint: 2.8 },
        { id: 'gr-cp', minPercent: 50, maxPercent: 60, grade: 'C+', description: 'Satisfactory', gradePoint: 2.4 },
        { id: 'gr-c', minPercent: 40, maxPercent: 50, grade: 'C', description: 'Acceptable', gradePoint: 2.0 },
        { id: 'gr-d', minPercent: 35, maxPercent: 40, grade: 'D', description: 'Basic', gradePoint: 1.6 },
        { id: 'gr-ng', minPercent: 0, maxPercent: 35, grade: 'NG', description: 'Not Graded', gradePoint: 0.0 },
      ],
    },
    classes,
    subjects,
    students,
    exams,
    marks,
    academicYears: DEFAULT_ACADEMIC_YEARS,
    teachers: createDefaultTeachers(),
    teacher_subject_assignments: createDefaultTeacherAssignments(),
    teacher_passports: createDefaultTeacherPassports(),
    admin_security: createDefaultAdminSecurity(),
  };
}

export function ensureRequiredSubjects(existing: Subject[]): Subject[] {
  const result = [...existing];
  const hasSubject = (classId: string, nameUpper: string) =>
    result.some(
      (s) =>
        s.classId === classId && s.name.trim().toUpperCase() === nameUpper,
    );

  // Nursery to Grade 3: Drawing, Rhymes, Craft (Grade-only)
  const lowerClasses: { id: string; tag: string }[] = [
    { id: 'cls-nursery', tag: 'NUR' },
    { id: 'cls-lkg', tag: 'LKG' },
    { id: 'cls-ukg', tag: 'UKG' },
    { id: 'cls-1', tag: '1' },
    { id: 'cls-2', tag: '2' },
    { id: 'cls-3', tag: '3' },
  ];

  for (const cls of lowerClasses) {
    const gradeOnlyItems = [
      { key: 'draw', code: `DRW-${cls.tag}`, name: 'DRAWING', order: 20 },
      { key: 'rhy', code: `RHY-${cls.tag}`, name: 'RHYMES', order: 21 },
      { key: 'crft', code: `CRF-${cls.tag}`, name: 'CRAFT', order: 22 },
    ];
    for (const item of gradeOnlyItems) {
      if (!hasSubject(cls.id, item.name)) {
        result.push({
          id: `sub-${cls.id}-${item.key}`,
          classId: cls.id,
          code: item.code,
          name: item.name,
          category: 'compulsory',
          gradingMode: 'grade_only',
          fullMarksTheory: 0,
          fullMarksPractical: 0,
          passMarksTheory: 0,
          passMarksPractical: 0,
          creditHourTheory: 0,
          creditHourPractical: 0,
          conversionRule: 'none',
          status: 'active',
          displayOrder: item.order,
        });
      }
    }
  }

  // Class 4 to 8: Grammar, General Knowledge (GK), Drawing
  for (let g = 4; g <= 8; g++) {
    const classId = `cls-${g}`;
    if (!hasSubject(classId, 'GRAMMAR')) {
      result.push({
        id: `sub-${classId}-gram`,
        classId,
        code: `GRM-${g}`,
        name: 'GRAMMAR',
        category: 'compulsory',
        gradingMode: 'academic',
        fullMarksTheory: 50,
        fullMarksPractical: 0,
        passMarksTheory: 18,
        passMarksPractical: 0,
        creditHourTheory: 2,
        creditHourPractical: 0,
        conversionRule: 'none',
        status: 'active',
        displayOrder: 7,
      });
    }
    if (
      !hasSubject(classId, 'GENERAL KNOWLEDGE (GK)') &&
      !hasSubject(classId, 'GENERAL KNOWLEDGE') &&
      !hasSubject(classId, 'GK')
    ) {
      result.push({
        id: `sub-${classId}-gk`,
        classId,
        code: `GK-${g}`,
        name: 'GENERAL KNOWLEDGE (GK)',
        category: 'compulsory',
        gradingMode: 'academic',
        fullMarksTheory: 50,
        fullMarksPractical: 0,
        passMarksTheory: 18,
        passMarksPractical: 0,
        creditHourTheory: 2,
        creditHourPractical: 0,
        conversionRule: 'none',
        status: 'active',
        displayOrder: 8,
      });
    }
    if (!hasSubject(classId, 'DRAWING')) {
      result.push({
        id: `sub-${classId}-draw`,
        classId,
        code: `DRW-${g}`,
        name: 'DRAWING',
        category: 'compulsory',
        gradingMode: 'grade_only',
        fullMarksTheory: 0,
        fullMarksPractical: 0,
        passMarksTheory: 0,
        passMarksPractical: 0,
        creditHourTheory: 0,
        creditHourPractical: 0,
        conversionRule: 'none',
        status: 'active',
        displayOrder: 20,
      });
    }
  }

  return result;
}

export const DEFAULT_EXAM_DEFINITIONS: Record<
  ExamTerm,
  { id: string; name: string; workingDays: number; dateOfIssue: string }
> = {
  first: {
    id: 'exam-1',
    name: 'First Terminal Examination',
    workingDays: 68,
    dateOfIssue: '2082-04-20',
  },
  second: {
    id: 'exam-2',
    name: 'Second Terminal Examination',
    workingDays: 72,
    dateOfIssue: '2082-08-15',
  },
  third: {
    id: 'exam-3',
    name: 'Third Terminal Examination',
    workingDays: 80,
    dateOfIssue: '2082-12-25',
  },
  annual: {
    id: 'exam-4',
    name: 'Annual Examination',
    workingDays: 210,
    dateOfIssue: '2082-12-30',
  },
};

export function ensureDefaultExams(
  existing: Exam[],
  academicYear: string,
  settings?: Partial<SchoolSettings>,
): Exam[] {
  const termOrder: ExamTerm[] = ['first', 'second', 'third', 'annual'];
  const normalized = (existing || []).map((ex) => {
    const def = DEFAULT_EXAM_DEFINITIONS[ex.term];
    const configuredDays = settings?.examWorkingDays?.[ex.term];
    const validWorkingDays =
      typeof ex.workingDays === 'number' && ex.workingDays > 0
        ? ex.workingDays
        : configuredDays && configuredDays > 0
          ? configuredDays
          : def.workingDays;
    return {
      ...ex,
      workingDays: validWorkingDays,
      dateOfIssue:
        ex.dateOfIssue ||
        settings?.examIssueDates?.[ex.term] ||
        def.dateOfIssue,
    };
  });

  for (const term of termOrder) {
    if (!normalized.some((e) => e.term === term)) {
      const def = DEFAULT_EXAM_DEFINITIONS[term];
      normalized.push({
        id: def.id,
        name: def.name,
        term,
        academicYear: academicYear || '2082 B.S',
        workingDays:
          settings?.examWorkingDays?.[term] && settings.examWorkingDays[term]! > 0
            ? settings.examWorkingDays[term]!
            : def.workingDays,
        dateOfIssue: settings?.examIssueDates?.[term] || def.dateOfIssue,
        status: 'active',
      });
    }
  }

  return normalized;
}

export function ensureTeacherRegistryAndAssignments(
  db: Partial<SchoolDatabase>,
): {
  academicYears: string[];
  teachers: Teacher[];
  teacher_subject_assignments: TeacherSubjectAssignment[];
  teacher_passports: TeacherPassport[];
  admin_security: AdminSecurityConfig;
  changed: boolean;
} {
  let changed = false;
  const academicYears =
    Array.isArray(db.academicYears) && db.academicYears.length > 0
      ? db.academicYears
      : [...DEFAULT_ACADEMIC_YEARS];
  if (!Array.isArray(db.academicYears) || db.academicYears.length === 0) {
    changed = true;
  }

  const teachers =
    Array.isArray(db.teachers) && db.teachers.length > 0
      ? db.teachers
      : createDefaultTeachers();
  if (!Array.isArray(db.teachers) || db.teachers.length === 0) {
    changed = true;
  }

  const teacher_subject_assignments = Array.isArray(
    db.teacher_subject_assignments,
  )
    ? db.teacher_subject_assignments
    : createDefaultTeacherAssignments();
  if (!Array.isArray(db.teacher_subject_assignments)) {
    changed = true;
  }

  const rawPassports = Array.isArray(db.teacher_passports)
    ? db.teacher_passports
    : createDefaultTeacherPassports();
  if (!Array.isArray(db.teacher_passports)) {
    changed = true;
  }

  const teacher_passports = rawPassports.map((p) => {
    if (p.passcode && (!p.passwordHash || !p.passwordSalt)) {
      const { passwordSalt, passwordHash } = hashTeacherPasscode(p.passcode);
      changed = true;
      return {
        ...p,
        passcode: '',
        passwordSalt,
        passwordHash,
      };
    }
    if (p.passcode && p.passwordHash && p.passwordSalt) {
      changed = true;
      return { ...p, passcode: '' };
    }
    return p;
  });

  const rawSec = db.admin_security;
  const admin_security: AdminSecurityConfig =
    rawSec && typeof rawSec === 'object'
      ? {
          ...rawSec,
          authorizedAdminEmail:
            rawSec.authorizedAdminEmail?.trim().toLowerCase() ||
            DEFAULT_AUTHORIZED_ADMIN_EMAIL,
          strictSingleUserOnly: rawSec.strictSingleUserOnly ?? true,
        }
      : createDefaultAdminSecurity();
  if (
    !rawSec ||
    !rawSec.authorizedAdminEmail ||
    rawSec.strictSingleUserOnly === undefined
  ) {
    changed = true;
  }

  return {
    academicYears,
    teachers,
    teacher_subject_assignments,
    teacher_passports,
    admin_security,
    changed,
  };
}

