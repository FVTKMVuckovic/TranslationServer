'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Languages,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  MessageSquare,
  Send,
  Mic,
  MicOff,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface Transcript {
  original: string;
  translations: Record<string, string>;
  timestamp: string;
  is_final: boolean;
}

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'sr-Cyrl', name: 'Српски', flag: '🇷🇸' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'hr', name: 'Hrvatski', flag: '🇭🇷' },
];

// UI Translations for each language
const UI_TRANSLATIONS: Record<string, {
  selectLanguage: string;
  waitingForTranslation: string;
  translationWillAppear: string;
  speakerActive: string;
  audioEnabled: string;
  askQuestion: string;
  typeQuestion: string;
  speakQuestion: string;
  send: string;
  sessionEnded: string;
  connectionError: string;
  sessionNotFound: string;
  speakingQuestion: string;
  speechRecognitionActive: string;
  speechNotSupported: string;
  microphoneDenied: string;
  tapOrClickMic: string;
  yourQuestions: string;
  questionSent: string;
  speakToLeader: string;
  speakingToLeader: string;
  stopSpeaking: string;
}> = {
  en: {
    selectLanguage: 'Select your language',
    waitingForTranslation: 'Waiting for translation...',
    translationWillAppear: 'The translation will appear here when the speaker starts',
    speakerActive: 'Speaker active',
    audioEnabled: 'Audio enabled – You will hear the translation',
    askQuestion: 'Ask a question',
    typeQuestion: 'Type your question...',
    speakQuestion: 'Tap 🎤 to speak',
    send: 'Send',
    sessionEnded: 'The session has ended',
    connectionError: 'Connection error',
    sessionNotFound: 'Session not found or not active',
    speakingQuestion: 'Speaking your question...',
    speechRecognitionActive: 'Speech recognition active...',
    speechNotSupported: 'Speech recognition is not supported. Please type your question.',
    microphoneDenied: 'Microphone access denied',
    tapOrClickMic: 'Type or tap 🎤 to speak',
    yourQuestions: 'Your questions',
    questionSent: 'Sent',
    speakToLeader: 'Tap to speak',
    speakingToLeader: 'Speaking...',
    stopSpeaking: 'Tap to stop',
  },
  'sr-Cyrl': {
    selectLanguage: 'Изаберите језик',
    waitingForTranslation: 'Чекање превода...',
    translationWillAppear: 'Превод ће се појавити овде када говорник почне',
    speakerActive: 'Говорник активан',
    audioEnabled: 'Аудио укључен – Чућете превод',
    askQuestion: 'Поставите питање',
    typeQuestion: 'Унесите питање...',
    speakQuestion: 'Додирните 🎤 за говор',
    send: 'Пошаљи',
    sessionEnded: 'Сесија је завршена',
    connectionError: 'Грешка у вези',
    sessionNotFound: 'Сесија није пронађена или није активна',
    speakingQuestion: 'Говорите питање...',
    speechRecognitionActive: 'Препознавање говора активно...',
    speechNotSupported: 'Препознавање говора није подржано. Молимо унесите питање.',
    microphoneDenied: 'Приступ микрофону одбијен',
    tapOrClickMic: 'Куцајте или додирните 🎤 за говор',
    yourQuestions: 'Ваша питања',
    questionSent: 'Послато',
    speakToLeader: 'Додирните за говор',
    speakingToLeader: 'Говорите...',
    stopSpeaking: 'Додирните за стоп',
  },
  it: {
    selectLanguage: 'Seleziona la tua lingua',
    waitingForTranslation: 'In attesa della traduzione...',
    translationWillAppear: 'La traduzione apparirà qui quando il relatore inizierà',
    speakerActive: 'Relatore attivo',
    audioEnabled: 'Audio attivato – Sentirai la traduzione',
    askQuestion: 'Fai una domanda',
    typeQuestion: 'Scrivi la tua domanda...',
    speakQuestion: 'Tocca 🎤 per parlare',
    send: 'Invia',
    sessionEnded: 'La sessione è terminata',
    connectionError: 'Errore di connessione',
    sessionNotFound: 'Sessione non trovata o non attiva',
    speakingQuestion: 'Parlando la tua domanda...',
    speechRecognitionActive: 'Riconoscimento vocale attivo...',
    speechNotSupported: 'Riconoscimento vocale non supportato. Per favore digita la domanda.',
    microphoneDenied: 'Accesso al microfono negato',
    tapOrClickMic: 'Digita o tocca 🎤 per parlare',
    yourQuestions: 'Le tue domande',
    questionSent: 'Inviato',
    speakToLeader: 'Tocca per parlare',
    speakingToLeader: 'Parlando...',
    stopSpeaking: 'Tocca per fermare',
  },
  hr: {
    selectLanguage: 'Odaberite jezik',
    waitingForTranslation: 'Čekanje prijevoda...',
    translationWillAppear: 'Prijevod će se pojaviti ovdje kada govornik počne',
    speakerActive: 'Govornik aktivan',
    audioEnabled: 'Audio uključen – Čut ćete prijevod',
    askQuestion: 'Postavi pitanje',
    typeQuestion: 'Unesite pitanje...',
    speakQuestion: 'Dodirnite 🎤 za govor',
    send: 'Pošalji',
    sessionEnded: 'Sesija je završena',
    connectionError: 'Greška u povezivanju',
    sessionNotFound: 'Sesija nije pronađena ili nije aktivna',
    speakingQuestion: 'Govorite pitanje...',
    speechRecognitionActive: 'Prepoznavanje govora aktivno...',
    speechNotSupported: 'Prepoznavanje govora nije podržano. Molimo unesite pitanje.',
    microphoneDenied: 'Pristup mikrofonu odbijen',
    tapOrClickMic: 'Upišite ili dodirnite 🎤 za govor',
    yourQuestions: 'Vaša pitanja',
    questionSent: 'Poslano',
    speakToLeader: 'Dodirnite za govor',
    speakingToLeader: 'Govorite...',
    stopSpeaking: 'Dodirnite za stop',
  },
};

export default function ParticipantPage() {
  const params = useParams();
  const sessionCode = params.code as string;

  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [connected, setConnected] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [liveText, setLiveText] = useState<string>(''); // Current interim translation
  const [error, setError] = useState('');
  const [micActive, setMicActive] = useState(false);

  // Question input
  const [showQuestionInput, setShowQuestionInput] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [isRecordingQuestion, setIsRecordingQuestion] = useState(false);
  const [questionRecognition, setQuestionRecognition] = useState<any>(null);
  const [sentQuestions, setSentQuestions] = useState<{text: string, timestamp: Date}[]>([]);
  const [questionsExpanded, setQuestionsExpanded] = useState(true);

  // Load saved data from localStorage on mount
  useEffect(() => {
    if (sessionCode) {
      const storageKey = `participant-${sessionCode}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          if (data.language) setSelectedLanguage(data.language);
          if (data.transcripts) setTranscripts(data.transcripts);
          if (data.questions) {
            // Restore questions with Date objects
            setSentQuestions(data.questions.map((q: any) => ({
              ...q,
              timestamp: new Date(q.timestamp)
            })));
          }
        } catch (e) {
          console.error('Failed to load saved data');
        }
      }
    }
  }, [sessionCode]);

  // Save data to localStorage when it changes
  useEffect(() => {
    if (sessionCode && selectedLanguage) {
      const storageKey = `participant-${sessionCode}`;
      localStorage.setItem(storageKey, JSON.stringify({
        language: selectedLanguage,
        transcripts,
        questions: sentQuestions,
        lastUpdated: new Date().toISOString(),
      }));
    }
  }, [sessionCode, selectedLanguage, transcripts, sentQuestions]);

  // Continuous microphone for speaking
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentSpeech, setCurrentSpeech] = useState('');
  const speakingRecognitionRef = useRef<any>(null);
  const isSpeakingRef = useRef(false); // To fix closure issue

  const wsRef = useRef<WebSocket | null>(null);
  const ttsWsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const transcriptsEndRef = useRef<HTMLDivElement>(null);
  const audioQueueRef = useRef<Blob[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  const wakeLockRef = useRef<any>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

  // Fetch session info
  useEffect(() => {
    fetchSessionInfo();
  }, [sessionCode]);

  // Request Wake Lock to keep screen on (mobile)
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        // Release existing lock first if any
        if (wakeLockRef.current) {
          try {
            await wakeLockRef.current.release();
          } catch (e) {
            // Ignore release errors
          }
        }

        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        console.log('Wake Lock acquired - screen will stay on');

        // Re-acquire wake lock if it's released (e.g., when switching tabs)
        wakeLockRef.current.addEventListener('release', () => {
          console.log('Wake Lock released');
          wakeLockRef.current = null;
          // Try to re-acquire if page is still visible
          if (document.visibilityState === 'visible') {
            setTimeout(() => requestWakeLock(), 100);
          }
        });
      }
    } catch (err) {
      console.log('Wake Lock not available:', err);
      wakeLockRef.current = null;
    }
  };

  // Re-acquire wake lock when page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && selectedLanguage) {
        // Always try to re-acquire when page becomes visible
        await requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedLanguage]);

  // Request Wake Lock immediately when language is restored from localStorage
  useEffect(() => {
    if (selectedLanguage) {
      requestWakeLock();
    }
  }, [selectedLanguage]);

  // Connect when language is selected
  useEffect(() => {
    if (selectedLanguage && sessionInfo) {
      connectWebSocket();
      requestWakeLock(); // Keep screen on
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (ttsWsRef.current) {
        ttsWsRef.current.close();
      }
      // Release wake lock
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
  }, [selectedLanguage, sessionInfo]);

  // No auto-scroll needed - newest messages are at top

  const fetchSessionInfo = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/sessions/join/${sessionCode}`);
      if (response.ok) {
        const data = await response.json();
        setSessionInfo(data);
      } else {
        setError('Session nicht gefunden oder nicht aktiv');
      }
    } catch (err) {
      setError('Verbindungsfehler');
    }
  };

  const connectWebSocket = () => {
    // Main transcript WebSocket
    const ws = new WebSocket(
      `${wsUrl}/ws/participant/${sessionCode}?language=${selectedLanguage}`
    );

    ws.onopen = () => {
      console.log('Connected to session');
      setConnected(true);
    };

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'connected':
          console.log('Participant connected:', data);
          break;

        case 'transcript':
          const translatedText = data.translations[selectedLanguage] || data.original;

          if (data.is_final) {
            // Final result: add to list and clear live text
            setTranscripts((prev) => [...prev, data]);
            setLiveText('');

            // Play TTS if audio is enabled
            if (audioEnabled && translatedText) {
              await playTTS(translatedText);
            }
          } else {
            // Interim result: show as live text (don't add to list)
            setLiveText(translatedText);
          }
          break;

        case 'transcript_update':
          // Update the last transcript entry (don't add new one)
          const updatedText = data.translations[selectedLanguage] || data.original;
          setTranscripts((prev) => {
            if (prev.length === 0) {
              return [data];
            }
            const updated = [...prev];
            updated[updated.length - 1] = data;
            return updated;
          });
          setLiveText('');

          // Play TTS for the updated text
          if (audioEnabled && updatedText) {
            await playTTS(updatedText);
          }
          break;

        case 'session_ended':
          // Error will be displayed with localized text via t.sessionEnded
          setError('session_ended');
          setConnected(false);
          break;

        case 'mic_state':
          setMicActive(data.enabled);
          break;

        case 'error':
          setError(data.message);
          break;
      }
    };

    ws.onclose = () => {
      console.log('Disconnected from session');
      setConnected(false);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      setError('connection_error');
    };

    wsRef.current = ws;

    // TTS WebSocket
    const ttsWs = new WebSocket(
      `${wsUrl}/ws/tts/${sessionCode}?language=${selectedLanguage}`
    );

    ttsWs.onopen = () => {
      console.log('TTS WebSocket connected');
    };

    ttsWs.onmessage = async (event) => {
      if (event.data instanceof Blob) {
        console.log('Received TTS audio, size:', event.data.size);

        // Add to queue
        audioQueueRef.current.push(event.data);

        // Start playing if not already
        playNextAudio();
      }
    };

    ttsWs.onerror = (err) => {
      console.error('TTS WebSocket error:', err);
    };

    ttsWs.onclose = () => {
      console.log('TTS WebSocket closed');
    };

    ttsWsRef.current = ttsWs;
  };

  const playTTS = async (text: string) => {
    if (!ttsWsRef.current || ttsWsRef.current.readyState !== WebSocket.OPEN) {
      console.log('TTS WebSocket not ready');
      return;
    }

    try {
      // Initialize AudioContext if needed (must be after user interaction)
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      // Resume AudioContext if suspended (browser autoplay policy)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      console.log('Requesting TTS for:', text);

      // Request TTS
      ttsWsRef.current.send(JSON.stringify({
        type: 'synthesize',
        text: text,
      }));

    } catch (err) {
      console.error('TTS error:', err);
    }
  };

  // Play next audio from queue using Web Audio API (better mobile support)
  const playNextAudio = async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) {
      return;
    }

    isPlayingRef.current = true;
    const audioBlob = audioQueueRef.current.shift()!;

    try {
      // Ensure AudioContext exists
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      // Resume if suspended (mobile browsers)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      // Decode and play through Web Audio API
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);

      source.onended = () => {
        isPlayingRef.current = false;
        // Play next in queue
        playNextAudio();
      };

      source.start(0);
      console.log('Playing TTS audio via Web Audio API, queue length:', audioQueueRef.current.length);
    } catch (err) {
      console.error('Audio playback error:', err);
      isPlayingRef.current = false;
      playNextAudio();
    }
  };


  const sendQuestion = () => {
    if (!questionText.trim() || !wsRef.current) return;

    const question = questionText.trim();

    wsRef.current.send(JSON.stringify({
      type: 'question',
      text: question,
      source_language: selectedLanguage,
    }));

    // Store sent question for display
    setSentQuestions(prev => [...prev, { text: question, timestamp: new Date() }]);

    setQuestionText('');
    setShowQuestionInput(false);
    stopQuestionRecording();
  };

  // Send speech as message to leader
  const sendSpeechToLeader = (text: string) => {
    if (!text.trim() || !wsRef.current) return;

    wsRef.current.send(JSON.stringify({
      type: 'question',
      text: text.trim(),
      source_language: selectedLanguage,
    }));

    setSentQuestions(prev => [...prev, { text: text.trim(), timestamp: new Date() }]);
  };

  // Toggle continuous speaking mode
  const toggleSpeaking = async () => {
    if (isSpeakingRef.current) {
      // Stop speaking
      isSpeakingRef.current = false;
      if (speakingRecognitionRef.current) {
        speakingRecognitionRef.current.stop();
        speakingRecognitionRef.current = null;
      }
      setIsSpeaking(false);
      setCurrentSpeech('');
    } else {
      // Start speaking
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
          const t = UI_TRANSLATIONS[selectedLanguage] || UI_TRANSLATIONS.en;
          alert(t.speechNotSupported);
          return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        // Set language
        const langMap: Record<string, string> = {
          'en': 'en-US',
          'sr-Cyrl': 'sr-RS',
          'it': 'it-IT',
          'hr': 'hr-HR',
        };
        recognition.lang = langMap[selectedLanguage] || 'en-US';

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          // Show interim text
          if (interimTranscript) {
            setCurrentSpeech(interimTranscript);
          }

          // Send final text to leader
          if (finalTranscript) {
            sendSpeechToLeader(finalTranscript);
            setCurrentSpeech('');
          }
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          if (event.error !== 'no-speech') {
            isSpeakingRef.current = false;
            setIsSpeaking(false);
          }
        };

        recognition.onend = () => {
          // Auto-restart if still speaking (using ref to avoid closure issue)
          if (isSpeakingRef.current && speakingRecognitionRef.current) {
            try {
              speakingRecognitionRef.current.start();
            } catch (e) {
              console.log('Recognition restart failed:', e);
              isSpeakingRef.current = false;
              setIsSpeaking(false);
            }
          }
        };

        recognition.start();
        speakingRecognitionRef.current = recognition;
        isSpeakingRef.current = true;
        setIsSpeaking(true);
      } catch (err) {
        console.error('Microphone error:', err);
        const t = UI_TRANSLATIONS[selectedLanguage] || UI_TRANSLATIONS.en;
        alert(t.microphoneDenied);
      }
    }
  };

  // Cleanup speaking on unmount
  useEffect(() => {
    return () => {
      isSpeakingRef.current = false;
      if (speakingRecognitionRef.current) {
        speakingRecognitionRef.current.stop();
        speakingRecognitionRef.current = null;
      }
    };
  }, []);

  // Initialize speech recognition for questions
  const initQuestionRecognition = () => {
    if (typeof window === 'undefined') return null;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech Recognition not supported');
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    // Set language based on selected language
    // Browser speech recognition language codes
    // Note: Serbian (sr-RS) has limited browser support - typing may be more reliable
    const langMap: Record<string, string> = {
      'en': 'en-US',
      'sr-Cyrl': 'sr-RS',
      'it': 'it-IT',
      'hr': 'hr-HR',
    };
    recognition.lang = langMap[selectedLanguage] || 'en-US';

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setQuestionText(transcript);
    };

    recognition.onend = () => {
      setIsRecordingQuestion(false);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecordingQuestion(false);
    };

    return recognition;
  };

  const toggleQuestionRecording = async () => {
    if (isRecordingQuestion) {
      stopQuestionRecording();
    } else {
      // Request microphone permission first
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });

        let recognition = questionRecognition;
        if (!recognition) {
          recognition = initQuestionRecognition();
          setQuestionRecognition(recognition);
        }

        if (recognition) {
          // Update language in case it changed
          const langMap: Record<string, string> = {
            'en': 'en-US',
            'sr-Cyrl': 'sr',
            'it': 'it-IT',
            'hr': 'hr-HR',
          };
          recognition.lang = langMap[selectedLanguage] || 'en-US';
          recognition.start();
          setIsRecordingQuestion(true);
        } else {
          const t = UI_TRANSLATIONS[selectedLanguage] || UI_TRANSLATIONS.en;
          alert(t.speechNotSupported);
        }
      } catch (err) {
        console.error('Microphone error:', err);
        const t = UI_TRANSLATIONS[selectedLanguage] || UI_TRANSLATIONS.en;
        alert(t.microphoneDenied);
      }
    }
  };

  const stopQuestionRecording = () => {
    if (questionRecognition) {
      try {
        questionRecognition.stop();
      } catch (e) {
        // Already stopped
      }
    }
    setIsRecordingQuestion(false);
  };

  // Language Selection Screen
  if (!selectedLanguage) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <Languages className="w-12 h-12 text-primary-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">
              {sessionInfo?.title || 'Translation Session'}
            </h1>
            <p className="text-slate-400">Wählen Sie Ihre Sprache</p>
          </div>

          {error && (
            <div className="glass rounded-xl p-6 text-center text-red-400 mb-6">
              {error}
              <Link href="/join" className="block mt-4 text-primary-400">
                Zurück
              </Link>
            </div>
          )}

          {!error && (
            <div className="space-y-4">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={async () => {
                    // Initialize AudioContext on user interaction (important for mobile)
                    if (!audioContextRef.current) {
                      audioContextRef.current = new AudioContext();
                    }
                    if (audioContextRef.current.state === 'suspended') {
                      await audioContextRef.current.resume();
                    }
                    setSelectedLanguage(lang.code);
                  }}
                  className="w-full glass rounded-xl p-6 flex items-center gap-4 hover:bg-white/15 transition-all duration-200"
                >
                  <span className="text-4xl">{lang.flag}</span>
                  <span className="text-xl text-white font-medium">{lang.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    );
  }

  // Main Participant View
  const currentLang = LANGUAGES.find((l) => l.code === selectedLanguage);
  const t = UI_TRANSLATIONS[selectedLanguage] || UI_TRANSLATIONS.en;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass-dark border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{currentLang?.flag}</span>
            <span className="font-medium text-white">{currentLang?.name}</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Connection Status */}
            {connected ? (
              <Wifi className="w-5 h-5 text-green-400" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-400" />
            )}

            {/* Audio Toggle */}
            <button
              onClick={async () => {
                // Initialize AudioContext on user interaction
                if (!audioContextRef.current) {
                  audioContextRef.current = new AudioContext();
                }
                if (audioContextRef.current.state === 'suspended') {
                  await audioContextRef.current.resume();
                }
                setAudioEnabled(!audioEnabled);
              }}
              className={`p-2 rounded-lg transition-colors ${
                audioEnabled ? 'bg-primary-600 text-white' : 'bg-slate-700 text-slate-400'
              }`}
            >
              {audioEnabled ? (
                <Volume2 className="w-5 h-5" />
              ) : (
                <VolumeX className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Audio Status Banner */}
      {audioEnabled && connected && (
        <div className="bg-primary-500/20 border-b border-primary-500/30 px-4 py-2 flex items-center justify-center gap-2 text-primary-400 text-sm">
          <Volume2 className="w-4 h-4" />
          {t.audioEnabled}
        </div>
      )}

      {/* Mic Active Indicator */}
      {micActive && (
        <div className="bg-green-500/20 border-b border-green-500/30 px-4 py-2 flex items-center justify-center gap-2 text-green-400 text-sm">
          <Mic className="w-4 h-4 animate-pulse" />
          {t.speakerActive}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/20 px-4 py-3 text-center text-red-400">
          {error === 'session_ended' ? t.sessionEnded :
           error === 'connection_error' ? t.connectionError : error}
        </div>
      )}

      {/* Transcripts */}
      <main className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full">
        {/* Live Text - Currently being spoken */}
        {liveText && (
          <div className="mb-4 glass rounded-xl p-4 border-2 border-primary-500/50 animate-pulse">
            <div className="flex items-center gap-2 text-primary-400 text-xs mb-2">
              <Mic className="w-3 h-3" />
              <span>LIVE</span>
            </div>
            <p className="text-white text-lg leading-relaxed">{liveText}</p>
          </div>
        )}

        {transcripts.length === 0 && !liveText && (
          <div className="text-center text-slate-500 py-16">
            <Volume2 className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">{t.waitingForTranslation}</p>
            <p className="text-sm mt-2">
              {t.translationWillAppear}
            </p>
          </div>
        )}

        {/* Sent Questions - Collapsible, at top */}
        {sentQuestions.length > 0 && (
          <div className="mb-4 glass rounded-xl overflow-hidden">
            <button
              onClick={() => setQuestionsExpanded(!questionsExpanded)}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
            >
              <span className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                {t.yourQuestions} ({sentQuestions.length})
              </span>
              {questionsExpanded ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>
            {questionsExpanded && (
              <div className="px-4 pb-3 space-y-2">
                {sentQuestions.map((q, i) => (
                  <div key={i} className="bg-slate-800/50 rounded-lg p-3 border-l-4 border-primary-500">
                    <p className="text-white text-sm">{q.text}</p>
                    <span className="text-xs text-green-400 mt-1 block">
                      ✓ {t.questionSent} • {q.timestamp.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Show only last 5 translations, newest first */}
        <div className="space-y-4">
          {[...transcripts].slice(-5).reverse().map((tr, i) => {
            const text = tr.translations[selectedLanguage] || tr.original;
            const time = new Date(tr.timestamp).toLocaleTimeString('de-DE', {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div key={i} className="glass rounded-xl p-4 animate-fade-in">
                <p className="text-white text-lg leading-relaxed">{text}</p>
                <span className="text-xs text-slate-500 mt-2 block">{time}</span>
              </div>
            );
          })}
        </div>

        <div ref={transcriptsEndRef} />
      </main>

      {/* Bottom Action Buttons */}
      <div className="sticky bottom-0 z-20 glass-dark border-t border-white/10 p-4">
        {/* Continuous Speaking Indicator - inside bottom bar */}
        {isSpeaking && (
          <div className="max-w-2xl mx-auto mb-3">
            <div className="bg-red-500/30 border border-red-500/50 rounded-xl p-3">
              <div className="flex items-center justify-center gap-3 text-red-400">
                <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="font-medium">{t.speakingToLeader}</span>
              </div>
              {currentSpeech && (
                <p className="text-white text-center mt-2 text-sm italic">{currentSpeech}</p>
              )}
            </div>
          </div>
        )}
        <div className="max-w-2xl mx-auto">
          {/* Main Action Buttons */}
          <div className="flex gap-3">
            {/* Speak to Leader Button */}
            <button
              onClick={toggleSpeaking}
              className={`flex-1 py-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 ${
                isSpeaking
                  ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                  : 'bg-primary-600 hover:bg-primary-700 text-white'
              }`}
            >
              {isSpeaking ? (
                <>
                  <MicOff className="w-6 h-6" />
                  <span className="font-medium">{t.stopSpeaking}</span>
                </>
              ) : (
                <>
                  <Mic className="w-6 h-6" />
                  <span className="font-medium">{t.speakToLeader}</span>
                </>
              )}
            </button>

            {/* Question Button (Text Input) */}
            <button
              onClick={() => setShowQuestionInput(!showQuestionInput)}
              className={`px-6 py-4 rounded-xl transition-colors ${
                showQuestionInput
                  ? 'bg-slate-600 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              <MessageSquare className="w-6 h-6" />
            </button>
          </div>

          {/* Text Question Input (collapsible) */}
          {showQuestionInput && (
            <div className="space-y-3 mt-3">
              {/* Recording indicator */}
              {isRecordingQuestion && (
                <div className="flex items-center justify-center gap-2 text-red-400 text-sm animate-pulse">
                  <span className="w-2 h-2 bg-red-400 rounded-full" />
                  {t.speakingQuestion}
                </div>
              )}

              <div className="flex gap-2">
                {/* Voice Input Button */}
                <button
                  onClick={toggleQuestionRecording}
                  className={`px-4 py-3 rounded-lg transition-colors ${
                    isRecordingQuestion
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                  }`}
                  title={t.speakQuestion}
                >
                  {isRecordingQuestion ? (
                    <MicOff className="w-5 h-5" />
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                </button>

                {/* Text Input */}
                <input
                  type="text"
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendQuestion()}
                  placeholder={t.typeQuestion}
                  className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  autoFocus
                  readOnly={isRecordingQuestion}
                />

                {/* Send Button */}
                <button
                  onClick={sendQuestion}
                  disabled={!questionText.trim()}
                  className="px-4 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-700 text-white rounded-lg transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>

                {/* Close Button */}
                <button
                  onClick={() => {
                    setShowQuestionInput(false);
                    stopQuestionRecording();
                    setQuestionText('');
                  }}
                  className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-slate-500 text-center">
                {t.tapOrClickMic}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
