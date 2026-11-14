# Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Default Deny**: All unspecified paths are denied (`allow read, write: if false;`).
2. **Single Authorized Admin Isolation**: Only the verified administrator (`request.auth.token.email == 'nirmaldahit@gmail.com' && request.auth.token.email_verified == true`) can read, list, create, update, or delete school records, PII (`students`, `teachers`, `school_settings`), or credential hashes (`admin_security`, `teacher_passports`).
3. **Identity & Ownership Integrity**: Every document must bind `ownerUid == request.auth.uid` and `ownerEmail == request.auth.token.email` on creation, and preserve `ownerUid`, `ownerEmail`, and `createdAt` immutably on updates.
4. **Temporal Integrity**: `createdAt == request.time` on creation and `updatedAt == request.time` on both creation and updates.
5. **Path ID & String Size Guarding**: All document IDs match `^[a-zA-Z0-9_\\-]+$` with length `1..128`. All strings enforce strict `.size()` bounds.
6. **Relational Integrity**:
   - `subjects` require parent `school_classes/{classId}` (`exists` or `existsAfter`).
   - `students` require parent `school_classes/{classId}` (`exists` or `existsAfter`).
   - `marks` require parent `exams/{examId}` and `students/{studentId}` (`exists` or `existsAfter`).
   - `teacher_subject_assignments` require parent `teachers/{teacherId}`, `school_classes/{classId}`, and `subjects/{subjectId}`.
7. **Zero Plain-Text Credential Storage in Cloud**: `teacher_passports` enforce `passcode == ''` when hashed (`passwordHash.size() > 0 && passwordSalt.size() > 0`).

## 2. Dirty Dozen Adversarial Payloads (Must Return `PERMISSION_DENIED`)
1. **Unauthenticated Read**: `get /students/stu-1` with `auth = null`.
2. **Unauthorized Email Read**: `get /students/stu-1` with `email = "attacker@gmail.com"`, `email_verified = true`.
3. **Email Spoof (Unverified Email)**: `get /school_settings/main` with `email = "nirmaldahit@gmail.com"`, `email_verified = false`.
4. **Blanket List Query Scraping**: `list /teachers` by non-admin or query omitting `where('ownerEmail', '==', 'nirmaldahit@gmail.com')`.
5. **Shadow / Ghost Field Injection**: `create /students/stu-999` including unexpected key `isVerified: true` or `role: "admin"`.
6. **Identity Spoofing on Create**: `create /exams/exam-99` with `ownerUid = "other-uid"` != `request.auth.uid`.
7. **Client-Spoofed Timestamp**: `create /exams/exam-99` with `createdAt = "2025-01-01T00:00:00Z"` instead of `request.time`.
8. **ID Poisoning / Path Traversal**: `create /subjects/../../evil` or 500-char ID violating `isValidId()`.
9. **Value Poisoning on Update**: `update /school_classes/cls-1` passing `name: 12345` or 5KB string.
10. **Immortal Field Mutation**: `update /students/stu-1` attempting to alter `ownerUid` or `createdAt`.
11. **Orphaned Relational Write**: `create /subjects/sub-orphan` referencing nonexistent `classId = "cls-missing"`.
12. **Privilege Escalation on `/admins`**: Non-bootstrapped user attempting `create /admins/attackerUid` with `role: "admin"`.
