// Sessions already verified in this tab (token -> identity): a remembered session is checked once per tab,
// whether the editor or the comments asked first.
import type { Identity } from '@platform/contracts';

const verified = new Map<string, Identity>();

export const rememberVerified = (token: string, identity: Identity): void => { verified.set(token, identity); };
export const verifiedIdentity = (token: string): Identity | undefined => verified.get(token);
export const forgetVerifiedSessions = (): void => { verified.clear(); };
