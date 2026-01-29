import Link from 'next/link'
import { Languages, Users, Mic, Globe } from 'lucide-react'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="max-w-4xl w-full text-center">
        <div className="flex justify-center mb-6">
          <Languages className="w-16 h-16 text-primary-400" />
        </div>
        
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
          Translation Session
        </h1>
        
        <p className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto">
          Echtzeit-Übersetzung für Schulungen und Präsentationen.
          Sprechen Sie Deutsch – Ihre Teilnehmer hören Englisch oder Serbisch.
        </p>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="glass rounded-xl p-6">
            <Mic className="w-10 h-10 text-primary-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Speech-to-Text</h3>
            <p className="text-slate-400 text-sm">Azure Speech Services für präzise Transkription</p>
          </div>
          
          <div className="glass rounded-xl p-6">
            <Globe className="w-10 h-10 text-primary-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Übersetzung</h3>
            <p className="text-slate-400 text-sm">Deutsch → Englisch & Serbisch in Echtzeit</p>
          </div>
          
          <div className="glass rounded-xl p-6">
            <Users className="w-10 h-10 text-primary-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Teilnehmer</h3>
            <p className="text-slate-400 text-sm">QR-Code scannen und sofort zuhören</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/login"
            className="px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-primary-600/30"
          >
            Session-Leiter Login
          </Link>
          
          <Link
            href="/join"
            className="px-8 py-4 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-all duration-200"
          >
            Als Teilnehmer beitreten
          </Link>
        </div>
      </div>
    </main>
  )
}
