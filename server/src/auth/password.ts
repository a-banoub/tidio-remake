import { hash, verify, Algorithm } from '@node-rs/argon2';

const OPTIONS = { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

export async function hashPassword(password: string, pepper: string): Promise<string> {
  return hash(password + pepper, OPTIONS);
}

export async function verifyPassword(password: string, hashStr: string, pepper: string): Promise<boolean> {
  try { return await verify(hashStr, password + pepper); } catch { return false; }
}
