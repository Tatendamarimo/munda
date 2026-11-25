import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';
const f = vi.hoisted(() => ({ auth: { currentUser: null as User | null }, anonymous: vi.fn(), create: vi.fn(), signIn: vi.fn(), link: vi.fn(), token: vi.fn(), reset: vi.fn(), verify: vi.fn() }));
vi.mock('../src/data/firebase', () => ({ firebase: () => ({ auth: f.auth }) }));
vi.mock('firebase/auth', () => ({ createUserWithEmailAndPassword: f.create, signInWithEmailAndPassword: f.signIn, linkWithCredential: f.link, signInAnonymously: f.anonymous, getIdTokenResult: f.token, sendPasswordResetEmail: f.reset, sendEmailVerification: f.verify, onAuthStateChanged: vi.fn(), EmailAuthProvider: { credential: (email: string,password: string) => ({email,password}) } }));
import { account, authIssue, session } from '../src/data/session';
import { group } from '../src/data/group';
const user = (uid:string,isAnonymous:boolean) => ({uid,isAnonymous,email:isAnonymous ? null : 'farmer@example.test',emailVerified:false,reload:vi.fn()}) as unknown as User;
const storage = new Map<string,string>();
beforeEach(() => {
 vi.clearAllMocks(); storage.clear();
 vi.stubGlobal('localStorage',{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)});
 f.auth.currentUser=null;f.token.mockResolvedValue({claims:{}});session.set({kind:'needsActivation'});account.set({kind:'signedOut'});group.set(null);
});
describe('guest ownership and account recovery', () => {
 it('reuses a guest identity rather than creating a fresh farm',async()=>{
  const guest=user('g1',true);f.anonymous.mockImplementation(async()=>{f.auth.currentUser=guest;return {user:guest};});
  await session.activate();await session.activate();expect(f.anonymous).toHaveBeenCalledTimes(1);expect(session.ready?.orgId).toBe('u-g1');
 });
 it('links credentials without replacing the guest UID or calling sign-in',async()=>{
  f.auth.currentUser=user('g1',true);f.link.mockResolvedValue({user:user('g1',false)});
  await session.createEmail(' farmer@example.test ','password123');expect(f.link).toHaveBeenCalledWith(expect.objectContaining({uid:'g1'}),{email:'farmer@example.test',password:'password123'});
  expect(f.create).not.toHaveBeenCalled();expect(f.signIn).not.toHaveBeenCalled();expect(session.ready?.orgId).toBe('u-g1');expect(account.value.kind).toBe('member');
 });
 it('leaves the guest unchanged after an existing-email collision',async()=>{
  const guest=user('g1',true);f.auth.currentUser=guest;account.set({kind:'guest',uid:'g1'});session.set({kind:'ready',uid:'g1',orgId:'u-g1'});f.link.mockRejectedValue({code:'auth/email-already-in-use'});
  await expect(session.createEmail('taken@example.test','password123')).rejects.toMatchObject({code:'auth/email-already-in-use'});
  expect(f.auth.currentUser).toBe(guest);expect(account.value.kind).toBe('guest');expect(session.ready?.uid).toBe('g1');expect(f.signIn).not.toHaveBeenCalled();
 });
 it('blocks replacing a guest through existing-account sign-in',async()=>{
  f.auth.currentUser=user('g1',true);await expect(session.signInEmail('x@example.test','password123')).rejects.toMatchObject({code:'munda/protect-first'});expect(f.signIn).not.toHaveBeenCalled();
 });
 it('restores a signed-in user without requiring a device farm cache',async()=>{
  f.signIn.mockResolvedValue({user:user('member1',false)});await session.signInEmail('x@example.test','password123');expect(session.ready?.orgId).toBe('u-member1');
 });
 it('rejects another UID’s organization cache when offline',async()=>{
  storage.set('munda.sessionUid','old');storage.set('munda.orgId','old-coop');f.token.mockRejectedValue({code:'auth/network-request-failed'});f.auth.currentUser=user('new',true);await session.activate();expect(session.ready?.orgId).toBe('u-new');
 });
 it('retains the same identity’s cached farm offline',async()=>{
  storage.set('munda.sessionUid','same');storage.set('munda.orgId','my-coop');f.token.mockRejectedValue({code:'auth/network-request-failed'});f.auth.currentUser=user('same',false);await session.activate();expect(session.ready?.orgId).toBe('my-coop');
 });
 it('sends verification mail only on an explicit request',async()=>{
  f.create.mockResolvedValue({user:user('new',false)});await session.createEmail('x@example.test','password123');expect(f.verify).not.toHaveBeenCalled();f.auth.currentUser=user('new',false);await session.verifyEmail();expect(f.verify).toHaveBeenCalledTimes(1);
 });
 it('does not reveal whether a failed sign-in email exists',()=>{expect(authIssue({code:'auth/user-not-found'})).toBe(authIssue({code:'auth/wrong-password'}));});
});
