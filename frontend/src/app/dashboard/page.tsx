'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Languages,
  Plus,
  Play,
  Pause,
  StopCircle,
  Users,
  Clock,
  LogOut,
  Settings,
  QrCode,
  Copy,
  Check,
  Shield
} from 'lucide-react';

interface Session {
  id: string;
  title: string;
  session_code: string;
  status: string;
  created_at: string;
  participant_count: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    fetchUser(token);
    fetchSessions(token);
  }, []);

  const fetchUser = async (token: string) => {
    try {
      const response = await fetch(`${apiUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();

        // Check if 2FA is enabled - required for all session leaders
        if (!data.totp_enabled) {
          router.push('/setup-2fa');
          return;
        }

        setUser(data);
      } else {
        localStorage.removeItem('token');
        router.push('/login');
      }
    } catch (err) {
      console.error('Failed to fetch user:', err);
    }
  };

  const fetchSessions = async (token: string) => {
    try {
      const response = await fetch(`${apiUrl}/api/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions);
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const createSession = async () => {
    setCreating(true);
    const token = localStorage.getItem('token');

    try {
      const response = await fetch(`${apiUrl}/api/sessions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: `Session ${new Date().toLocaleDateString('de-DE')}` }),
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/dashboard/session/${data.id}`);
      }
    } catch (err) {
      console.error('Failed to create session:', err);
    } finally {
      setCreating(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="glass-dark border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Languages className="w-8 h-8 text-primary-400" />
            <span className="text-xl font-bold text-white">Translation Session</span>
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-2 text-slate-300">
                <span className="hidden sm:inline">{user.username}</span>
                {user.totp_enabled && (
                  <span title="2FA aktiviert">
                    <Shield className="w-4 h-4 text-green-400" />
                  </span>
                )}
              </div>
            )}
            <button
              onClick={logout}
              className="p-2 text-slate-400 hover:text-white transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Welcome & New Session */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Willkommen, {user?.username}!
            </h1>
            <p className="text-slate-400">
              Verwalten Sie Ihre Übersetzungs-Sessions
            </p>
          </div>

          <button
            onClick={createSession}
            disabled={creating}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 text-white font-semibold rounded-xl transition-all duration-200 flex items-center gap-2 shadow-lg shadow-primary-600/30"
          >
            {creating ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Plus className="w-5 h-5" />
            )}
            Neue Session starten
          </button>
        </div>

        {/* Sessions List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Ihre Sessions</h2>

          {sessions.length === 0 ? (
            <div className="glass rounded-xl p-12 text-center">
              <Languages className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-400">
                Keine Sessions vorhanden. Starten Sie Ihre erste Session!
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {sessions.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          )}
        </div>

        {/* 2FA Setup Section */}
        {user && !user.totp_enabled && (
          <div className="mt-8 glass rounded-xl p-6 border-yellow-500/30 border">
            <div className="flex items-start gap-4">
              <Shield className="w-8 h-8 text-yellow-400 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  2FA empfohlen
                </h3>
                <p className="text-slate-400 mb-4">
                  Aktivieren Sie Zwei-Faktor-Authentifizierung für zusätzliche Sicherheit.
                </p>
                <Link
                  href="/dashboard/settings"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  2FA einrichten
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function SessionCard({ session }: { session: Session }) {
  const [copied, setCopied] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'paused':
        return 'bg-yellow-500';
      case 'ended':
        return 'bg-slate-500';
      default:
        return 'bg-slate-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Aktiv';
      case 'paused':
        return 'Pausiert';
      case 'ended':
        return 'Beendet';
      default:
        return status;
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(session.session_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedDate = new Date(session.created_at).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="glass rounded-xl p-6 hover:bg-white/15 transition-all duration-200">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-white">{session.title}</h3>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium text-white ${getStatusColor(session.status)}`}
            >
              {getStatusText(session.status)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {formattedDate}
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {session.participant_count} Teilnehmer
            </div>
            <div className="flex items-center gap-1">
              <QrCode className="w-4 h-4" />
              <span className="font-mono">{session.session_code}</span>
              <button
                onClick={copyCode}
                className="p-1 hover:bg-white/10 rounded transition-colors"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {session.status === 'active' && (
            <Link
              href={`/dashboard/session/${session.id}`}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Öffnen
            </Link>
          )}
          {session.status === 'ended' && (
            <span className="px-4 py-2 text-slate-500">Beendet</span>
          )}
        </div>
      </div>
    </div>
  );
}
