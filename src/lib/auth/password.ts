import bcrypt from 'bcryptjs';

const COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Minimum 8 characters with at least one letter and one digit. */
export function passwordProblem(plain: string): string | null {
  if (plain.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(plain) || !/[0-9]/.test(plain)) return 'Password must contain a letter and a digit.';
  return null;
}

// Compared against when the email is unknown so response time does not reveal which emails exist.
let dummy: Promise<string> | undefined;
export function dummyHash(): Promise<string> {
  dummy ??= bcrypt.hash('not-a-real-password', COST);
  return dummy;
}
