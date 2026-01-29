'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, Languages, Check, AlertCircle, Smartphone } from 'lucide-react';

export default function Setup2FAPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [setupData, setSetupData] = useState<{
    secret: string;
    qr_code: string;
    uri: string;
  } | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [success, setSuccess] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Check if user already has 2FA enabled
    checkUser(token);
  }, []);

  const checkUser = async (token: string) => {
    try {
      const response = await fetch(`${apiUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        localStorage.removeItem('token');
        router.push('/login');
        return;
      }

      const user = await response.json();

      if (user.totp_enabled) {
        // Already has 2FA, go to dashboard
        router.push('/dashboard');
        return;
      }

      // Setup 2FA
      await initSetup(token);
    } catch (err) {
      setError('Fehler beim Laden der Benutzerdaten');
      setLoading(false);
    }
  };

  const initSetup = async (token: string) => {
    try {
      const response = await fetch(`${apiUrl}/api/auth/setup-totp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Setup fehlgeschlagen');
      }

      const data = await response.json();
      setSetupData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    setError('');

    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/api/auth/verify-totp?code=${verifyCode}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Verifizierung fehlgeschlagen');
      }

      setSuccess(true);

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">2FA Aktiviert!</h1>
          <p className="text-slate-400">Weiterleitung zum Dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-primary-400 mb-4">
            <Languages className="w-8 h-8" />
            <span className="text-xl font-bold text-white">Translation Session</span>
          </Link>
          <h1 className="text-2xl font-bold text-white mb-2">
            <Shield className="w-6 h-6 inline mr-2" />
            2-Faktor-Authentifizierung einrichten
          </h1>
          <p className="text-slate-400">
            Für Ihre Sicherheit ist 2FA erforderlich
          </p>
        </div>

        {/* Setup Card */}
        <div className="glass rounded-2xl p-8">
          {/* Step 1: Install App */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                1
              </div>
              <h2 className="text-lg font-semibold text-white">Authenticator App installieren</h2>
            </div>
            <div className="pl-11">
              <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                <Smartphone className="w-8 h-8 text-primary-400" />
                <div>
                  <p className="text-white font-medium">Microsoft Authenticator</p>
                  <p className="text-slate-400 text-sm">Verfügbar für iOS und Android</p>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: Scan QR Code */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                2
              </div>
              <h2 className="text-lg font-semibold text-white">QR-Code scannen</h2>
            </div>
            <div className="pl-11">
              {setupData?.qr_code && (
                <div className="bg-white p-4 rounded-xl inline-block mb-4">
                  <img src={setupData.qr_code} alt="2FA QR Code" className="w-48 h-48" />
                </div>
              )}
              <p className="text-slate-400 text-sm mb-2">
                Oder manuell eingeben:
              </p>
              <code className="block p-3 bg-slate-800 rounded-lg text-primary-400 text-sm break-all font-mono">
                {setupData?.secret}
              </code>
            </div>
          </div>

          {/* Step 3: Verify */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                3
              </div>
              <h2 className="text-lg font-semibold text-white">Code verifizieren</h2>
            </div>
            <div className="pl-11">
              <form onSubmit={handleVerify} className="space-y-4">
                <input
                  type="text"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-4 bg-slate-800 border border-slate-700 rounded-lg text-white text-center text-2xl tracking-[0.5em] font-mono placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="000000"
                  maxLength={6}
                  required
                />

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={verifying || verifyCode.length !== 6}
                  className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {verifying ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Verifizieren und Aktivieren
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Warning */}
        <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <p className="text-yellow-400 text-sm text-center">
            <AlertCircle className="w-4 h-4 inline mr-2" />
            Speichern Sie den geheimen Schlüssel sicher! Sie benötigen ihn, falls Sie Ihr Gerät verlieren.
          </p>
        </div>
      </div>
    </main>
  );
}
