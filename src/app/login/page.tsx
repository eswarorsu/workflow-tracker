'use client';

import { signIn, signUp } from '@/app/actions/actions';
import { useState } from 'react';

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    try {
      setLoading(true);
      setError('');
      
      const email = formData.get('email') as string;
      const password = formData.get('password') as string;
      
      if (isSignUp) {
        const confirmPassword = formData.get('confirm_password') as string;
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match. Please tap carefully.');
        }
        await signUp(formData);
      } else {
        await signIn(formData);
      }
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0a0f1c] relative overflow-hidden">
      {/* Decorative NestUp Branding Gradient Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md mx-4 relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 mb-6 shadow-2xl shadow-blue-500/20">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">
            NestUp Core
          </h1>
          <p className="text-blue-200/60 mt-3 font-medium tracking-wide text-sm">
            WORK PROCESS MANAGEMENT SYSTEM
          </p>
        </div>

        <div className="bg-[#131b2f]/80 backdrop-blur-3xl rounded-3xl p-8 shadow-2xl border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
          
          <h2 className="text-2xl font-semibold text-white mb-8">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm flex items-start gap-3">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form action={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="text-xs text-blue-200/60 font-semibold uppercase tracking-wider block mb-2">Work Email</label>
              <input
                name="email"
                type="email"
                required
                placeholder="you@domain.com"
                className="w-full px-4 py-3.5 rounded-xl bg-black/20 border border-white/10 text-white placeholder-blue-200/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all font-medium"
              />
              {isSignUp && (
                <p className="text-[11px] text-blue-300/40 mt-2 font-medium">
                  Assignment Demo Note: Include &quot;admin&quot; in email for instant admin access (e.g. admin@nestup.com). Free of email-verification delays.
                </p>
              )}
            </div>
            
            <div>
              <label className="text-xs text-blue-200/60 font-semibold uppercase tracking-wider block mb-2">Password</label>
              <input
                name="password"
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                className="w-full px-4 py-3.5 rounded-xl bg-black/20 border border-white/10 text-white placeholder-blue-200/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all font-medium"
              />
            </div>

            {isSignUp && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="text-xs text-blue-200/60 font-semibold uppercase tracking-wider block mb-2">Confirm Password</label>
                <input
                  name="confirm_password"
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full px-4 py-3.5 rounded-xl bg-black/20 border border-white/10 text-white placeholder-blue-200/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all font-medium"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 mt-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-lg shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : isSignUp ? 'Create Account' : 'Sign in securely'}
            </button>
          </form>

          <div className="mt-8 text-center border-t border-white/5 pt-6">
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
              className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Create one directly"}
            </button>
          </div>
        </div>
        
        <p className="text-center text-xs text-blue-200/30 mt-8 font-medium">
          Protected by NestUp Framework. 100% custom database authentication.
        </p>
      </div>
    </main>
  );
}
