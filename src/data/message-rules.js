export const MESSAGE_MIN_WORDS = 3;
export const MESSAGE_MAX_LENGTH = 200;

export function countMessageWords(value) {
  return typeof value === 'string' ? value.trim().split(/\s+/u).filter(word => /[\p{L}\p{N}]/u.test(word)).length : 0;
}
