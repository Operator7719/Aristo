import { AdminPasswordRequirements } from '../types';

export const DEFAULT_PASSWORD_REQUIREMENTS: AdminPasswordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: true,
};

export interface PasswordEvaluation {
  minLengthMet: boolean;
  uppercaseMet: boolean;
  lowercaseMet: boolean;
  numberMet: boolean;
  specialCharMet: boolean;
  noSpacesMet: boolean;
  confirmMatches: boolean;
  allRequirementsMet: boolean;
  score: number; // 0..4
  strengthLabel: 'Empty' | 'Weak' | 'Fair' | 'Good' | 'Strong';
}

export function evaluateAdminPassword(
  password: string,
  confirmPassword: string,
  requirements: AdminPasswordRequirements = DEFAULT_PASSWORD_REQUIREMENTS,
): PasswordEvaluation {
  const minLengthMet = password.length >= (requirements.minLength || 8);
  const uppercaseMet = !requirements.requireUppercase || /[A-Z]/.test(password);
  const lowercaseMet = !requirements.requireLowercase || /[a-z]/.test(password);
  const numberMet = !requirements.requireNumber || /[0-9]/.test(password);
  const specialCharMet =
    !requirements.requireSpecialChar || /[^A-Za-z0-9\s]/.test(password);
  const noSpacesMet = password.length > 0 && !/\s/.test(password);
  const confirmMatches = password.length > 0 && password === confirmPassword;

  const allRequirementsMet =
    minLengthMet &&
    uppercaseMet &&
    lowercaseMet &&
    numberMet &&
    specialCharMet &&
    noSpacesMet &&
    confirmMatches;

  let passedSignals = 0;
  if (password.length >= (requirements.minLength || 8)) passedSignals += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) passedSignals += 1;
  if (/[0-9]/.test(password)) passedSignals += 1;
  if (/[^A-Za-z0-9\s]/.test(password)) passedSignals += 1;
  if (password.length >= 12) passedSignals = Math.min(4, passedSignals + 1);

  const score = password.length === 0 ? 0 : Math.max(1, Math.min(4, passedSignals));
  const strengthLabel: PasswordEvaluation['strengthLabel'] =
    password.length === 0
      ? 'Empty'
      : score === 1
        ? 'Weak'
        : score === 2
          ? 'Fair'
          : score === 3
            ? 'Good'
            : 'Strong';

  return {
    minLengthMet,
    uppercaseMet,
    lowercaseMet,
    numberMet,
    specialCharMet,
    noSpacesMet,
    confirmMatches,
    allRequirementsMet,
    score,
    strengthLabel,
  };
}

export function generateCompliantAdminPassword(minLength = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const nums = '23456789';
  const specials = '@#$%!&*';
  const all = upper + lower + nums + specials;

  const pick = (pool: string) => pool[Math.floor(Math.random() * pool.length)];
  const chars = [pick(upper), pick(lower), pick(nums), pick(specials)];
  const targetLen = Math.max(minLength, 10);
  while (chars.length < targetLen) {
    chars.push(pick(all));
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

// Pure TypeScript SHA-256 so hashing works identically in Node and any browser origin
function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

export function sha256Hex(ascii: string): string {
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, boolean> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  let input = ascii + '\x80';
  while ((input.length % 64) - 56) input += '\x00';
  for (let i = 0; i < input.length; i++) {
    const j = input.charCodeAt(i);
    if (j >> 8) {
      // UTF-8 safe fallback
      const encoded = unescape(encodeURIComponent(ascii));
      if (encoded !== ascii) return sha256Hex(encoded);
    }
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0, 8);

    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash.unshift((temp1 + temp2) | 0);
      hash.pop();
      hash[4] = (hash[4] + temp1) | 0;
    }

    for (let i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

export function createSalt(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function hashSecret(secret: string, salt: string): string {
  return sha256Hex(`${salt}::${secret}`);
}

export function hashTeacherPasscode(rawSecret: string): {
  passwordSalt: string;
  passwordHash: string;
} {
  const passwordSalt = createSalt();
  const passwordHash = hashSecret(rawSecret.trim(), passwordSalt);
  return { passwordSalt, passwordHash };
}

export function verifyTeacherPassportSecret(
  passport: { passcode?: string; passwordHash?: string; passwordSalt?: string },
  rawSecret: string,
): boolean {
  const candidate = rawSecret.trim();
  if (!candidate) return false;
  if (passport.passwordHash && passport.passwordSalt) {
    return hashSecret(candidate, passport.passwordSalt) === passport.passwordHash;
  }
  return Boolean(passport.passcode) && passport.passcode === candidate;
}

