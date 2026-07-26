import argon2 from 'argon2';

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (password.length === 0 || password.length > 1024) return false;
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 8) throw new Error('Password must contain at least 8 characters');
  if (password.length > 1024) throw new Error('Password is too long');
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65_536,
    timeCost: 3,
    parallelism: 1,
    hashLength: 32
  });
}
