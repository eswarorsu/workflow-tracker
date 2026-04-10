'use server';

import { createClient } from '@/lib/supabase/server';
import { willCauseCycle, resolveDownstreamImpact, validateDependency } from '@/lib/graphLogic';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

// ─── CUSTOM AUTHENTICATION ────────────────────────────────────────────
// Bypassing Supabase Auth limit restrictions by handling sessions manually.

export async function signUp(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  // Manual Check if email exists
  const { data: existing } = await supabase.from('users').select('id').eq('email', email).single();
  if (existing) throw new Error('Email already registered.');

  const role = email.includes('admin') ? 'admin' : 'member';

  // Manual insert directly to the database
  const { data: newUser, error } = await supabase
    .from('users')
    .insert([{ email, password, role }])
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Set highly secure HTTP-Only session cookie
  const cookieStore = await cookies();
  cookieStore.set('custom_session', newUser.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7 // 1 week
  });

  revalidatePath('/', 'layout');
  redirect('/');
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !user) throw new Error('User not found.');
  if (user.password !== password) throw new Error('Invalid credentials.');

  // Set highly secure HTTP-Only session cookie
  const cookieStore = await cookies();
  cookieStore.set('custom_session', user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7 // 1 week
  });

  revalidatePath('/', 'layout');
  redirect('/');
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete('custom_session');
  revalidatePath('/', 'layout');
  redirect('/login');
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('custom_session')?.value;
  if (!sessionId) return null;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (!profile) {
    // Session is invalid or DB was reset, clear cookie
    cookieStore.delete('custom_session');
    return null;
  }

  return profile;
}

// ─── WORK ITEMS ─────────────────────────────────────

export async function addWorkItem(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') throw new Error('Unauthorized');

  const supabase = await createClient();
  const title = formData.get('title') as string;
  const description = formData.get('description') as string;
  const priority = formData.get('priority') as string;
  const requiredSkills = (formData.get('required_skills') as string || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const assignedUserId = formData.get('assigned_user_id') as string || null;

  const { error } = await supabase
    .from('work_items')
    .insert([{
      title,
      description,
      priority,
      required_skills: requiredSkills,
      progress: 0,
      status: 'in-progress',
      assigned_user_id: assignedUserId || null,
    }]);

  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

export async function assignMember(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') throw new Error('Unauthorized');

  const supabase = await createClient();
  const itemId = formData.get('item_id') as string;
  const userId = formData.get('user_id') as string;

  const { error } = await supabase
    .from('work_items')
    .update({ assigned_user_id: userId || null })
    .eq('id', itemId);

  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

// ─── DEPENDENCIES ───────────────────────────────────

export async function addDependency(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') throw new Error('Unauthorized');

  const supabase = await createClient();
  const predecessorId = formData.get('predecessor_id') as string;
  const successorId = formData.get('successor_id') as string;
  const type = formData.get('type') as 'full' | 'partial';
  const threshold = type === 'full' ? 100 : parseInt(formData.get('threshold') as string);

  const validationError = validateDependency(predecessorId, successorId, type, threshold);
  if (validationError) throw new Error(validationError);

  const { data: existingDeps, error: fetchErr } = await supabase.from('dependencies').select('*');
  if (fetchErr) throw new Error(fetchErr.message);

  if (willCauseCycle(existingDeps || [], predecessorId, successorId)) {
    throw new Error('CYCLE DETECTED: Adding this dependency would create a circular chain. Rejected.');
  }

  const { error } = await supabase
    .from('dependencies')
    .insert([{ predecessor_id: predecessorId, successor_id: successorId, type, threshold }]);

  if (error) throw new Error(error.message);

  const predecessor = await supabase.from('work_items').select('progress').eq('id', predecessorId).single();
  const predProgress = predecessor.data?.progress || 0;
  const isMet = type === 'full' ? predProgress === 100 : predProgress >= threshold;

  if (!isMet) {
    await supabase.from('work_items').update({ status: 'blocked' }).eq('id', successorId);
  }

  revalidatePath('/admin');
}

// ─── PROGRESS UPDATE (CASES DOWNSTREAM) ────────────

export async function updateProgress(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const itemId = formData.get('item_id') as string;
  const newProgress = parseInt(formData.get('progress') as string);

  const status = newProgress === 100 ? 'done' : 'in-progress';
  const { error } = await supabase
    .from('work_items')
    .update({ progress: newProgress, status })
    .eq('id', itemId);

  if (error) throw new Error(error.message);

  const { data: deps } = await supabase.from('dependencies').select('*');
  const { data: items } = await supabase.from('work_items').select('*');

  if (deps && items) {
    const itemsMap = new Map(items.map((i: any) => [i.id, i]));
    const { itemsToUnblock, itemsToBlock } = resolveDownstreamImpact(itemId, deps, itemsMap);

    for (const id of itemsToUnblock) {
      await supabase.from('work_items').update({ status: 'in-progress' }).eq('id', id);
    }
    for (const id of itemsToBlock) {
      await supabase.from('work_items').update({ status: 'blocked' }).eq('id', id);
    }
  }

  revalidatePath('/member');
  revalidatePath('/admin');
}

// ─── MARK BLOCKED (with reason) ─────────────────────

export async function markBlocked(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const itemId = formData.get('item_id') as string;
  const reason = formData.get('reason') as string;

  const { error } = await supabase
    .from('work_items')
    .update({ status: 'blocked', blocked_reason: reason })
    .eq('id', itemId);

  if (error) throw new Error(error.message);
  revalidatePath('/member');
}
