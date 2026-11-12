import {
  ConversionTier,
  GradingRule,
  MarkRecord,
  SchoolClass,
  SchoolSettings,
  Student,
  Subject,
} from '../types';

export interface ComputedSubjectResult {
  subject: Subject;
  effectiveRule: ConversionTier;
  theoryObtained: number;
  practicalObtained: number;
  convertedTheory: number;
  finalPracticalMarks: number;
  finalPracticalFullMarks: number;
  totalObtained: number;
  totalFullMarks: number;
  theoryPercent: number;
  practicalPercent: number;
  totalPercent: number;
  theoryGrade: string;
  theoryGradePoint: number;
  practicalGrade: string;
  practicalGradePoint: number;
  finalGrade: string;
  finalGradePoint: number;
  remarks: string;
  absentTheory: boolean;
  absentPractical: boolean;
  hasPractical: boolean;
  hasEnteredMarks: boolean;
}

export interface ComputedGradeOnlyResult {
  subject: Subject;
  grade: string;
  remarks: string;
}

export interface ComputedStudentResult {
  student: Student;
  markRecord?: MarkRecord;
  subjectResults: ComputedSubjectResult[];
  gradeOnlyResults: ComputedGradeOnlyResult[];
  grandTotalObtained: number;
  grandTotalFullMarks: number;
  percentage: number;
  gpa: number;
  overallGrade: string;
  overallRemarks: string;
  totalCreditHours: number;
  isPassed: boolean;
  hasAnyMarks: boolean;
  workingDays: number;
  presentDays: number;
  rank: number | null;
}

export function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export function isGradeOnlySubject(subject: Subject): boolean {
  if (subject.gradingMode === 'grade_only') return true;
  if (subject.gradingMode === 'academic') return false;
  const normalized = subject.name.trim().toLowerCase();
  return (
    normalized === 'drawing' ||
    normalized === 'rhymes' ||
    normalized === 'craft'
  );
}

export function matchGradingRule(
  percent: number,
  rules: GradingRule[],
): GradingRule {
  const clamped = Math.max(0, Math.min(100, percent));
  const sorted = [...rules].sort((a, b) => b.minPercent - a.minPercent);
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    if (i === 0) {
      if (clamped >= r.minPercent && clamped <= r.maxPercent) return r;
    } else {
      if (clamped >= r.minPercent && clamped < r.maxPercent) return r;
    }
  }
  return (
    sorted[sorted.length - 1] ?? {
      id: 'ng',
      minPercent: 0,
      maxPercent: 35,
      grade: 'NG',
      description: 'Not Graded',
      gradePoint: 0,
    }
  );
}

export function getEffectiveConversionRule(
  subject: Subject,
  schoolClass?: SchoolClass,
): ConversionTier {
  if (subject.conversionRule && subject.conversionRule !== 'inherit') {
    return subject.conversionRule;
  }
  return schoolClass?.conversionTier ?? 'none';
}

export function getStudentSubjects(
  student: Student,
  classSubjects: Subject[],
  schoolClass?: SchoolClass,
): Subject[] {
  const activeSubjects = classSubjects
    .filter((s) => s.classId === student.classId && s.status === 'active')
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const isHigherTier = schoolClass ? schoolClass.gradeLevel >= 9 : false;

  if (!isHigherTier) {
    return activeSubjects.filter((s) => s.category === 'compulsory');
  }

  const compulsory = activeSubjects.filter((s) => s.category === 'compulsory');
  const opt1List = activeSubjects.filter((s) => s.category === 'opt_1');
  const opt2List = activeSubjects.filter((s) => s.category === 'opt_2');

  const selectedOpt1 =
    opt1List.find((s) => s.id === student.optionalSubjects?.opt_1) ??
    opt1List[0];
  const selectedOpt2 =
    opt2List.find((s) => s.id === student.optionalSubjects?.opt_2) ??
    opt2List[0];

  const result = [...compulsory];
  if (selectedOpt1) result.push(selectedOpt1);
  if (selectedOpt2) result.push(selectedOpt2);
  return result.sort((a, b) => a.displayOrder - b.displayOrder);
}

export function computeSubjectResult(
  subject: Subject,
  schoolClass: SchoolClass | undefined,
  markRecord: MarkRecord | undefined,
  settings: SchoolSettings,
): ComputedSubjectResult {
  const effectiveRule = getEffectiveConversionRule(subject, schoolClass);
  const entry = markRecord?.subjects?.[subject.id];

  const hasPractical = subject.fullMarksPractical > 0;
  const absentTheory = Boolean(entry?.absentTheory);
  const absentPractical = Boolean(entry?.absentPractical);

  const rawTh = entry?.theoryObtained;
  const rawPr = entry?.practicalObtained;
  const hasEnteredMarks =
    (rawTh !== null && rawTh !== undefined) ||
    (rawPr !== null && rawPr !== undefined) ||
    absentTheory ||
    absentPractical;

  const theoryObtained = absentTheory
    ? 0
    : Math.max(0, Math.min(subject.fullMarksTheory, Number(rawTh ?? 0)));
  const practicalObtained =
    !hasPractical || absentPractical
      ? 0
      : Math.max(0, Math.min(subject.fullMarksPractical, Number(rawPr ?? 0)));

  let convertedTheory = 0;
  let finalPracticalMarks = practicalObtained;
  let finalPracticalFullMarks = subject.fullMarksPractical;

  if (hasPractical) {
    if (effectiveRule === 'grade_4_8') {
      // Grade 4–8: 50 TH, 40 PR -> convert TH into 10% (× 10 ÷ fullMarksTheory) and add to PR (out of 50)
      convertedTheory = round2(
        (theoryObtained * 10) / (subject.fullMarksTheory || 50),
      );
      finalPracticalMarks = round2(convertedTheory + practicalObtained);
      finalPracticalFullMarks = 10 + subject.fullMarksPractical;
    } else if (effectiveRule === 'grade_9_12') {
      // Grade 9–12: 75 TH, 19 PR -> convert TH into 6% (× 6 ÷ fullMarksTheory) and add to PR (out of 25)
      convertedTheory = round2(
        (theoryObtained * 6) / (subject.fullMarksTheory || 75),
      );
      finalPracticalMarks = round2(convertedTheory + practicalObtained);
      finalPracticalFullMarks = 6 + subject.fullMarksPractical;
    }
  }

  const totalObtained = round2(theoryObtained + finalPracticalMarks);
  const totalFullMarks = round2(
    subject.fullMarksTheory + finalPracticalFullMarks,
  );

  const theoryPercent =
    subject.fullMarksTheory > 0
      ? round2((theoryObtained / subject.fullMarksTheory) * 100)
      : 0;
  const practicalPercent =
    hasPractical && finalPracticalFullMarks > 0
      ? round2((finalPracticalMarks / finalPracticalFullMarks) * 100)
      : 100;
  const totalPercent =
    totalFullMarks > 0 ? round2((totalObtained / totalFullMarks) * 100) : 0;

  const thRule = absentTheory
    ? { grade: 'AB', description: 'Absent', gradePoint: 0 }
    : matchGradingRule(theoryPercent, settings.gradingRules);

  const prRule = !hasPractical
    ? { grade: '-', description: '-', gradePoint: 0 }
    : absentPractical
      ? { grade: 'AB', description: 'Absent', gradePoint: 0 }
      : matchGradingRule(practicalPercent, settings.gradingRules);

  let combinedRule = matchGradingRule(totalPercent, settings.gradingRules);

  if (
    settings.requirePassBothComponents &&
    (thRule.grade === 'NG' ||
      thRule.grade === 'AB' ||
      (hasPractical && (prRule.grade === 'NG' || prRule.grade === 'AB')))
  ) {
    const ngRule = settings.gradingRules.find((r) => r.grade === 'NG') ?? {
      grade: 'NG',
      description: 'Not Graded',
      gradePoint: 0,
    };
    combinedRule = { ...ngRule, id: 'ng', minPercent: 0, maxPercent: 35 };
  }

  return {
    subject,
    effectiveRule,
    theoryObtained,
    practicalObtained,
    convertedTheory,
    finalPracticalMarks,
    finalPracticalFullMarks,
    totalObtained,
    totalFullMarks,
    theoryPercent,
    practicalPercent,
    totalPercent,
    theoryGrade: thRule.grade,
    theoryGradePoint: thRule.gradePoint,
    practicalGrade: prRule.grade,
    practicalGradePoint: prRule.gradePoint,
    finalGrade: combinedRule.grade,
    finalGradePoint: combinedRule.gradePoint,
    remarks: combinedRule.description,
    absentTheory,
    absentPractical,
    hasPractical,
    hasEnteredMarks,
  };
}

export function computeClassResults(
  students: Student[],
  subjects: Subject[],
  schoolClass: SchoolClass | undefined,
  marks: MarkRecord[],
  examId: string,
  settings: SchoolSettings,
  defaultWorkingDays = 72,
): ComputedStudentResult[] {
  const results: ComputedStudentResult[] = students.map((student) => {
    const record = marks.find(
      (m) => m.examId === examId && m.studentId === student.id,
    );
    const allStudentSubjects = getStudentSubjects(student, subjects, schoolClass);

    // Separate academic subjects (included in Marks Entry, Markwise Ledger, Total, GPA)
    // from grade-only subjects (Drawing, Rhymes, Craft)
    const academicSubjects = allStudentSubjects.filter(
      (s) => !isGradeOnlySubject(s),
    );
    const gradeOnlySubjects = allStudentSubjects.filter((s) =>
      isGradeOnlySubject(s),
    );

    const subjectResults = academicSubjects.map((sub) =>
      computeSubjectResult(sub, schoolClass, record, settings),
    );

    const gradeOnlyResults: ComputedGradeOnlyResult[] = gradeOnlySubjects.map(
      (sub) => {
        const assignedGrade =
          record?.nonAcademicGrades?.[sub.id] || '';
        const matchedRule = settings.gradingRules.find(
          (r) => r.grade === assignedGrade,
        );
        return {
          subject: sub,
          grade: assignedGrade || '-',
          remarks: matchedRule?.description || (assignedGrade ? 'Graded' : '-'),
        };
      },
    );

    const evaluatedAcademic = subjectResults.filter((sr) => sr.hasEnteredMarks);
    const hasAnyMarks = evaluatedAcademic.length > 0;

    // Only aggregate entered academic subjects so newly added class subjects don't disturb existing student totals/GPAs
    const grandTotalObtained = round2(
      evaluatedAcademic.reduce((sum, sr) => sum + sr.totalObtained, 0),
    );
    const grandTotalFullMarks = round2(
      evaluatedAcademic.reduce((sum, sr) => sum + sr.totalFullMarks, 0),
    );
    const percentage =
      grandTotalFullMarks > 0
        ? round2((grandTotalObtained / grandTotalFullMarks) * 100)
        : 0;

    let weightedPoints = 0;
    let totalCreditHours = 0;

    for (const sr of evaluatedAcademic) {
      const chTh = sr.subject.creditHourTheory || 0;
      const chPr = sr.hasPractical ? sr.subject.creditHourPractical || 0 : 0;
      weightedPoints += chTh * sr.theoryGradePoint;
      totalCreditHours += chTh;
      if (sr.hasPractical && chPr > 0) {
        weightedPoints += chPr * sr.practicalGradePoint;
        totalCreditHours += chPr;
      }
    }

    const isPassed =
      hasAnyMarks &&
      evaluatedAcademic.every(
        (sr) =>
          sr.finalGrade !== 'NG' &&
          sr.theoryGrade !== 'NG' &&
          sr.theoryGrade !== 'AB' &&
          (!sr.hasPractical ||
            (sr.practicalGrade !== 'NG' && sr.practicalGrade !== 'AB')),
      );

    const rawGpa =
      totalCreditHours > 0 ? round2(weightedPoints / totalCreditHours) : 0;
    const gpa =
      settings.requirePassBothComponents && !isPassed && hasAnyMarks
        ? 0
        : rawGpa;

    const overallRule =
      !hasAnyMarks || (settings.requirePassBothComponents && !isPassed)
        ? (settings.gradingRules.find((r) => r.grade === 'NG') ?? {
            grade: 'NG',
            description: 'Not Graded',
            gradePoint: 0,
          })
        : matchGradingRule(percentage, settings.gradingRules);

    return {
      student,
      markRecord: record,
      subjectResults,
      gradeOnlyResults,
      grandTotalObtained,
      grandTotalFullMarks,
      percentage,
      gpa,
      overallGrade: hasAnyMarks ? overallRule.grade : '-',
      overallRemarks: hasAnyMarks ? overallRule.description : 'Pending',
      totalCreditHours: round2(totalCreditHours),
      isPassed,
      hasAnyMarks,
      workingDays: defaultWorkingDays > 0 ? defaultWorkingDays : (record?.workingDays ?? 72),
      presentDays: record?.presentDays ?? 0,
      rank: null,
    };
  });

  // Assign dense/competition rank among passed students with marks
  const ranked = [...results]
    .filter((r) => r.hasAnyMarks && r.isPassed)
    .sort((a, b) => b.grandTotalObtained - a.grandTotalObtained);

  let currentRank = 1;
  for (let i = 0; i < ranked.length; i++) {
    if (
      i > 0 &&
      ranked[i].grandTotalObtained < ranked[i - 1].grandTotalObtained
    ) {
      currentRank = i + 1;
    }
    ranked[i].rank = currentRank;
  }

  return results.sort((a, b) => a.student.rollNo - b.student.rollNo);
}
