import type { PasswordPolicyPublic } from '@/lib/models';

const SPECIAL_RE = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

export function validatePasswordAgainstPolicy(
  password: string,
  policy: PasswordPolicyPublic | null | undefined
): string | null {
  const minLen = policy?.min_password_length ?? 8;
  if (!password) return 'Password is required';
  if (password.length < minLen) {
    return `Password must be at least ${minLen} characters`;
  }
  if (policy?.require_uppercase && !/[A-Z]/.test(password)) {
    return 'Password must include at least one uppercase letter';
  }
  if (policy?.require_lowercase && !/[a-z]/.test(password)) {
    return 'Password must include at least one lowercase letter';
  }
  if (policy?.require_numbers && !/[0-9]/.test(password)) {
    return 'Password must include at least one number';
  }
  if (policy?.require_special && !SPECIAL_RE.test(password)) {
    return 'Password must include at least one special character';
  }
  return null;
}

export function passwordPolicyHint(policy: PasswordPolicyPublic | null | undefined): string {
  const parts = [`At least ${policy?.min_password_length ?? 8} characters`];
  if (policy?.require_uppercase !== false) parts.push('uppercase');
  if (policy?.require_lowercase !== false) parts.push('lowercase');
  if (policy?.require_numbers !== false) parts.push('a number');
  if (policy?.require_special) parts.push('a special character');
  return parts.join(', ');
}
