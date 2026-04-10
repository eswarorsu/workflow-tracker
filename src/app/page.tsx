import { getCurrentUser } from '@/app/actions/actions';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { signOut } from '@/app/actions/actions';

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) redirect('/login');
  if (user.role === 'admin') redirect('/admin');
  redirect('/member');
}
