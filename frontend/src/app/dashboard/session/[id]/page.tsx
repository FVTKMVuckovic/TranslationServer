'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import {
  Languages,
  Mic,
  MicOff,
  StopCircle,
  Users,
  Copy,
  Check,
  ArrowLeft,
  Volume2,
  MessageSquare,
  Send,
  Download,
  Trash2
} from 'lucide-react';

interface Transcript {
  original: string;
  translations: Record<string, string>;
  timestamp: string;
  is_final: boolean;
}

interface ParticipantQuestion {
  text: string;
  source_language: string;
  participant_id: string;
  timestamp: string;
}

export default function SessionPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.id as string;

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [micEnabled, setMicEnabled] = useState(false);
  const [connected, setConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  const [participantCount, setParticipantCount] = useState(0);
  const [languageCounts, setLanguageCounts] = useState<Record<string, number>>({});
  const [questions, setQuestions] = useState<ParticipantQuestion[]>([]);

  const [manualText, setManualText] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const transcriptsEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

  // Load transcripts from localStorage on mount
  useEffect(() => {
    if (sessionId) {
      const saved = localStorage.getItem(`session-${sessionId}`);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          if (data.transcripts) setTranscripts(data.transcripts);
          if (data.questions) setQuestions(data.questions);
        } catch (e) {
          console.error('Failed to load saved transcripts');
        }
      }
    }
  }, [sessionId]);

  // Save transcripts to localStorage when they change
  useEffect(() => {
    if (sessionId && (transcripts.length > 0 || questions.length > 0)) {
      localStorage.setItem(`session-${sessionId}`, JSON.stringify({
        transcripts,
        questions,
        lastUpdated: new Date().toISOString(),
      }));
    }
  }, [sessionId, transcripts, questions]);

  // Audio streaming uses Azure Speech Translation on the server
  // No browser speech recognition needed - just capture and send audio

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    fetchSession(token);

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [sessionId]);

  // No auto-scroll needed - newest messages are at top

  const fetchSession = async (token: string) => {
    try {
      const response = await fetch(`${apiUrl}/api/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setSession(data);
        connectWebSocket(token);
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('Failed to fetch session:', err);
    } finally {
      setLoading(false);
    }
  };

  const connectWebSocket = (token: string) => {
    const ws = new WebSocket(`${wsUrl}/ws/leader/${sessionId}?token=${token}`);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'connected':
          console.log('Leader connected to session');
          break;

        case 'transcript':
          if (data.is_final) {
            setTranscripts((prev) => [...prev, data]);
            setCurrentTranscript('');
          } else {
            setCurrentTranscript(data.original);
          }
          break;

        case 'interim_transcript':
          // Live text from Azure Speech Translation
          setCurrentTranscript(data.text);
          break;

        case 'transcript_sent':
          setTranscripts((prev) => [
            ...prev,
            {
              original: data.original,
              translations: data.translations,
              timestamp: new Date().toISOString(),
              is_final: true,
            },
          ]);
          setCurrentTranscript('');
          break;

        case 'transcript_updated':
          // Update the last transcript entry instead of adding a new one
          setTranscripts((prev) => {
            if (prev.length === 0) {
              // No previous entry, create new one
              return [{
                original: data.original,
                translations: data.translations,
                timestamp: new Date().toISOString(),
                is_final: true,
              }];
            }
            // Replace the last entry
            const updated = [...prev];
            updated[updated.length - 1] = {
              original: data.original,
              translations: data.translations,
              timestamp: new Date().toISOString(),
              is_final: true,
            };
            return updated;
          });
          setCurrentTranscript('');
          break;

        case 'participant_count':
          setParticipantCount(data.total);
          setLanguageCounts(data.by_language || {});
          break;

        case 'participant_question':
          setQuestions((prev) => [
            ...prev,
            {
              ...data,
              timestamp: new Date().toISOString(),
            },
          ]);
          break;

        case 'mic_state':
          setMicEnabled(data.enabled);
          break;
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    wsRef.current = ws;
  };

  const toggleMic = async () => {
    const newState = !micEnabled;

    if (newState) {
      // Start audio streaming to server (Azure Speech Translation)
      try {
        // Get microphone access
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          }
        });
        audioStreamRef.current = stream;

        // Create AudioContext for raw PCM extraction
        const audioContext = new AudioContext({ sampleRate: 16000 });
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);

        // ScriptProcessorNode to get raw audio samples
        // Buffer size 4096 = ~256ms at 16kHz
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        // Tell server to start Azure Speech Translation
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'start_streaming' }));
        }

        processor.onaudioprocess = (e) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            // Get float32 audio data
            const float32Data = e.inputBuffer.getChannelData(0);

            // Convert float32 (-1 to 1) to int16 (-32768 to 32767)
            const int16Data = new Int16Array(float32Data.length);
            for (let i = 0; i < float32Data.length; i++) {
              const s = Math.max(-1, Math.min(1, float32Data[i]));
              int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }

            // Send as binary data
            wsRef.current.send(int16Data.buffer);
          }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);

        setMicEnabled(true);

        // Notify server about mic state
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'mic_state', enabled: true }));
        }
      } catch (err) {
        console.error('Microphone access error:', err);
        alert('Mikrofon-Zugriff wurde verweigert. Bitte erlauben Sie den Zugriff.');
      }
    } else {
      // Stop audio streaming
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }

      // Tell server to stop Azure Speech Translation
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'stop_streaming' }));
        wsRef.current.send(JSON.stringify({ type: 'mic_state', enabled: false }));
      }

      setMicEnabled(false);
      setCurrentTranscript('');
    }
  };

  const sendManualText = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && manualText.trim()) {
      wsRef.current.send(
        JSON.stringify({
          type: 'text_input',
          text: manualText.trim(),
        })
      );
      setManualText('');
    }
  };

  const endSession = async () => {
    if (!confirm('Session wirklich beenden?')) return;

    const token = localStorage.getItem('token');
    try {
      await fetch(`${apiUrl}/api/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      // Clear localStorage for this session
      localStorage.removeItem(`session-${sessionId}`);
      router.push('/dashboard');
    } catch (err) {
      console.error('Failed to end session:', err);
    }
  };

  const clearTranscripts = () => {
    if (!confirm('Alle Transkripte löschen?')) return;
    setTranscripts([]);
    setQuestions([]);
    localStorage.removeItem(`session-${sessionId}`);
  };

  const copyCode = () => {
    if (session) {
      navigator.clipboard.writeText(session.session_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyFullLink = () => {
    if (joinUrl) {
      navigator.clipboard.writeText(joinUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const exportTranscript = () => {
    const exportData = {
      session: {
        title: session?.title,
        code: session?.session_code,
        date: new Date().toISOString(),
      },
      transcripts: transcripts.map(t => ({
        original: t.original,
        translations: t.translations,
        timestamp: t.timestamp,
      })),
      questions: questions.map(q => ({
        text: q.text,
        sourceLanguage: q.source_language,
        timestamp: q.timestamp,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${session?.session_code}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/join/${session?.session_code}`
    : '';

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass-dark border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="p-2 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Languages className="w-6 h-6 text-primary-400" />
              <span className="font-semibold text-white">{session?.title}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Connection Status */}
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`}
              />
              <span className="text-sm text-slate-400">
                {connected ? 'Verbunden' : 'Getrennt'}
              </span>
            </div>

            {/* Participant Count */}
            <div className="flex items-center gap-2 text-slate-300">
              <Users className="w-5 h-5" />
              <span>{participantCount}</span>
            </div>

            {/* Export Transcript */}
            <button
              onClick={exportTranscript}
              className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
              title="Transkript exportieren"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Clear Transcripts */}
            <button
              onClick={clearTranscripts}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              title="Transkripte löschen"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* End Session */}
            <button
              onClick={endSession}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
            >
              <StopCircle className="w-4 h-4" />
              Beenden
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex">
        {/* Left Panel - Transcripts */}
        <div className="flex-1 flex flex-col">
          {/* Mic Controls */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={toggleMic}
                disabled={!connected}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
                  micEnabled
                    ? 'bg-red-500 hover:bg-red-600 mic-recording'
                    : 'bg-primary-500 hover:bg-primary-600 disabled:bg-slate-700 disabled:opacity-50'
                }`}
              >
                {micEnabled ? (
                  <Mic className="w-10 h-10 text-white" />
                ) : (
                  <MicOff className="w-10 h-10 text-white" />
                )}
              </button>
            </div>
            <p className="text-center text-slate-400 mt-4">
              {!connected
                ? 'Warte auf Verbindung...'
                : micEnabled
                  ? 'Mikrofon aktiv – Sprechen Sie jetzt'
                  : 'Mikrofon aktivieren um zu sprechen'
              }
            </p>
          </div>

          {/* Manual Text Input */}
          <div className="p-4 border-b border-white/10">
            <div className="flex gap-2">
              <input
                type="text"
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendManualText()}
                placeholder="Text eingeben zum Übersetzen..."
                className="flex-1 px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                onClick={sendManualText}
                disabled={!manualText.trim()}
                className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors font-medium"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Transcripts - newest first */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {transcripts.length === 0 && !currentTranscript && (
              <div className="text-center text-slate-500 py-12">
                <Volume2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Noch keine Übersetzungen</p>
                <p className="text-sm">Aktivieren Sie das Mikrofon oder geben Sie Text ein</p>
              </div>
            )}

            {/* Current transcript at top */}
            {currentTranscript && (
              <div className="glass rounded-lg p-4 animate-pulse border border-primary-400/30">
                <p className="text-slate-300 italic">{currentTranscript}...</p>
              </div>
            )}

            {/* Transcripts in reverse order (newest first) */}
            {[...transcripts].reverse().map((t, i) => (
              <TranscriptCard key={transcripts.length - 1 - i} transcript={t} />
            ))}

            <div ref={transcriptsEndRef} />
          </div>
        </div>

        {/* Right Panel - QR & Info */}
        <div className="w-80 glass-dark border-l border-white/10 p-6 flex flex-col">
          {/* QR Code */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-400 mb-4">TEILNEHMER-LINK</h3>
            <div className="bg-white p-4 rounded-xl flex justify-center">
              <QRCodeSVG value={joinUrl} size={180} />
            </div>
          </div>

          {/* Session Code */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-400 mb-2">SESSION-CODE</h3>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-mono font-bold text-white tracking-wider">
                {session?.session_code}
              </span>
              <button
                onClick={copyCode}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Code kopieren"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-green-400" />
                ) : (
                  <Copy className="w-5 h-5 text-slate-400" />
                )}
              </button>
            </div>
          </div>

          {/* Full Link */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-400 mb-2">DIREKTER LINK</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-300 break-all bg-slate-800/50 p-2 rounded-lg flex-1">
                {joinUrl}
              </span>
              <button
                onClick={copyFullLink}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
                title="Link kopieren"
              >
                {linkCopied ? (
                  <Check className="w-5 h-5 text-green-400" />
                ) : (
                  <Copy className="w-5 h-5 text-slate-400" />
                )}
              </button>
            </div>
          </div>

          {/* Language Stats */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-400 mb-2">TEILNEHMER</h3>
            <div className="space-y-2">
              {Object.entries(languageCounts).map(([lang, count]) => {
                const langNames: Record<string, string> = {
                  'en': '🇬🇧 Englisch',
                  'sr-Cyrl': '🇷🇸 Serbisch',
                  'it': '🇮🇹 Italienisch',
                  'hr': '🇭🇷 Kroatisch',
                };
                return (
                  <div key={lang} className="flex justify-between text-sm">
                    <span className="text-slate-300">
                      {langNames[lang] || lang}
                    </span>
                    <span className="text-white font-medium">{count}</span>
                  </div>
                );
              })}
              {Object.keys(languageCounts).length === 0 && (
                <p className="text-slate-500 text-sm">Noch keine Teilnehmer</p>
              )}
            </div>
          </div>

          {/* Questions */}
          {questions.length > 0 && (
            <div className="flex-1 overflow-y-auto">
              <h3 className="text-sm font-semibold text-slate-400 mb-2 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                FRAGEN ({questions.length})
              </h3>
              <div className="space-y-2">
                {[...questions].reverse().map((q, i) => {
                  const flagMap: Record<string, string> = {
                    'en': '🇬🇧',
                    'sr-Cyrl': '🇷🇸',
                    'it': '🇮🇹',
                    'hr': '🇭🇷',
                  };
                  return (
                    <div key={i} className="glass rounded-lg p-3 text-sm">
                      <p className="text-white">{q.text}</p>
                      <p className="text-slate-500 text-xs mt-1">
                        {flagMap[q.source_language] || '🌍'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function TranscriptCard({ transcript }: { transcript: Transcript }) {
  const time = new Date(transcript.timestamp).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="glass rounded-xl p-4 animate-fade-in">
      <div className="flex justify-between items-start">
        <p className="text-white font-medium text-lg">{transcript.original}</p>
        <span className="text-xs text-slate-500 ml-3 whitespace-nowrap">{time}</span>
      </div>
    </div>
  );
}
