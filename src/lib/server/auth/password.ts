import argon2 from 'argon2';
import { privateConfig } from '$lib/server/config/private';

export async function verifyPassword(password: string): Promise<boolean> {
  if (password.length === 0 || password.length > 1024) return false;
  try {
    return await argon2.verify(privateConfig.authPasswordHash, password);
  } catch {
    return false;
  }
}
