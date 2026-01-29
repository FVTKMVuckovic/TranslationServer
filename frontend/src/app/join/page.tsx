'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Languages, ArrowRight } from 'lucide-react';

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanCode.length >= 6) {
      router.push(`/join/${cleanCode}`);
    } else {
      setError('Bitte gültigen Session-Code eingeben');
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-primary-400 mb-4">
            <Languages className="w-8 h-8" />
            <span className="text-xl font-bold text-white">Translation Session</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Session beitreten</h1>
          <p className="text-slate-400 mt-2">Geben Sie den Session-Code ein</p>
        </div>

        <div className="glass rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError('');
                }}
                placeholder="SESSION-CODE"
                maxLength={8}
                className="w-full px-6 py-4 bg-slate-800 border border-slate-700 rounded-xl text-white text-center text-2xl font-mono tracking-widest placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent uppercase"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              className="w-full py-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
            >
              Beitreten
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>
        </div>

        <p className="text-center text-slate-500 text-sm mt-6">
          Der Session-Code wird vom Schulungsleiter bereitgestellt
        </p>
      </div>
    </main>
  );
}
