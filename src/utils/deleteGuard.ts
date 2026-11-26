import { en } from './jalali';

export interface DeleteAuthSubject {
  fullName?: string | null;
  email?: string | null;
  username?: string | null;
}

export const DELETE_FORBIDDEN_MESSAGE =
  'امکان حذف در سامانه منحصراً در اختیار حساب کاربری «میلاد نظری» است.';

export const DELETE_WRONG_PASSWORD_MESSAGE =
  'رمز تایید حذف اشتباه است. لطفاً رمز صحیح را وارد کنید.';

const DELETE_CONFIRM_CODE = '1234';

function normalizeIdentityText(value: string | null | undefined): string {
  return String(value || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, ' ')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Checks whether the active logged-in member belongs exclusively to the "Milad Nazari" account.
 */
export function isMiladNazariAccount(member?: DeleteAuthSubject | null): boolean {
  if (!member) return false;

  const fullName = normalizeIdentityText(member.fullName);
  const compactName = fullName.replace(/\s+/g, '');
  const email = normalizeIdentityText(member.email);
  const username = normalizeIdentityText(member.username);

  if (
    fullName === 'میلاد نظری' ||
    compactName === 'میلادنظری' ||
    fullName === 'milad nazari' ||
    compactName === 'miladnazari'
  ) {
    return true;
  }

  if (email === 'miladn46@gmail.com') {
    return true;
  }

  if (
    username === 'miladnazari' ||
    username === 'milad_nazari' ||
    username === 'milad.nazari' ||
    username === 'miladn46'
  ) {
    return true;
  }

  return false;
}

/**
 * Verifies the deletion confirmation password ("1234"), supporting Persian & English digits.
 */
export function verifyDeletePassword(input: string): boolean {
  return en(String(input || '').trim()) === DELETE_CONFIRM_CODE;
}
