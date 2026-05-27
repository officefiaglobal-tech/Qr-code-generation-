/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Shield, Sun, Moon, Globe, UserCheck, LayoutDashboard } from 'lucide-react';
import RegistrationForm from './components/RegistrationForm';
import VerificationPage from './components/VerificationPage';
import AdminPanel from './components/AdminPanel';
import { Candidate, Language } from './types';
import { translations } from './utils/helpers';

export default function App() {
  const [lang, setLang] = useState<Language>('en');
  const [darkMode, setDarkMode] = useState<boolean>(true);
  
  // Navigation tabs: 'register' | 'verify' | 'admin'
  const [activeTab, setActiveTab] = useState<'register' | 'verify' | 'admin'>('register');
  
  // Handlers for deep-linked lookups
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [newlyRegisteredCandidate, setNewlyRegisteredCandidate] = useState<Candidate | null>(null);

  // Monitor URL Search parameters to handle scannable dynamic QR deep-links (e.g., /?id=CAND-2026-XXXX)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const page = params.get('page');

    if (id) {
      setSelectedCandidateId(id);
      setActiveTab('verify');
    } else if (page === 'admin') {
      setActiveTab('admin');
    }
  }, []);

  const handleLanguageToggle = () => {
    setLang(prev => prev === 'en' ? 'hi' : 'en');
  };

  const handleRegistrationSuccess = (candidate: Candidate) => {
    setNewlyRegisteredCandidate(candidate);
    setSelectedCandidateId(candidate.id);
    setActiveTab('verify');
  };

  const handleSelectAdminCandidate = (candidate: Candidate) => {
    setNewlyRegisteredCandidate(null);
    setSelectedCandidateId(candidate.id);
    setActiveTab('verify');
  };

  const handleReturnHome = () => {
    // Clear lookups and parameters
    setSelectedCandidateId(null);
    setNewlyRegisteredCandidate(null);
    setActiveTab('register');
    window.history.pushState({}, '', window.location.origin);
  };

  const t = translations[lang];

  return (
    <div className={`min-h-screen font-sans transition-all duration-300 ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-950'}`}>
      
      {/* 1. Universal Top Navigation Header Bar */}
      <header className={`sticky top-0 z-40 backdrop-blur-md border-b transition-colors ${darkMode ? 'bg-slate-950/70 border-slate-800' : 'bg-white/70 border-slate-250/60'}`}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          
          {/* Logo Brand Brand */}
          <div 
            onClick={handleReturnHome}
            className="flex items-center gap-2 cursor-pointer group flex-shrink-0"
          >
            <div className="p-1 px-2 rounded-lg bg-emerald-600/10 text-emerald-500 border border-emerald-500/20 group-hover:bg-emerald-600 group-hover:text-white transition-all">
              <Shield className="w-5 h-5" />
            </div>
            <strong className="text-sm font-black uppercase tracking-wider hidden sm:block text-emerald-500 group-hover:text-emerald-400 transition-colors">FIA Registry</strong>
          </div>

          {/* Quick tab switch buttons */}
          <nav className="flex items-center gap-1.5 rounded-lg bg-slate-500/10 p-1">
            <button 
              onClick={handleReturnHome}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'register' ? (darkMode ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30' : 'bg-white text-emerald-700 shadow-sm') : 'text-slate-500 hover:text-slate-650'}`}
            >
              {t.register}
            </button>
            <button 
              onClick={() => setActiveTab('admin')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${activeTab === 'admin' ? (darkMode ? 'bg-slate-800 text-blue-400 border border-blue-500/30' : 'bg-white text-blue-700 shadow-sm') : 'text-slate-500 hover:text-slate-650'}`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>{t.adminPanel}</span>
            </button>
          </nav>

          {/* Control widgets (Language & Dark Mode toggles) */}
          <div className="flex items-center gap-2">
            
            {/* Language Selection */}
            <button 
              onClick={handleLanguageToggle}
              className={`p-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition-all ${darkMode ? 'border-slate-800 hover:bg-slate-900 text-slate-300' : 'border-slate-200 hover:bg-slate-50 text-slate-700'}`}
              title="Change Language / भाषा बदलें"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-500 animate-spin-slow" />
              <span>{t.language}</span>
            </button>

            {/* Dark Mode Switch */}
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className={`p-1.5 rounded-lg border transition-all ${darkMode ? 'border-slate-805 hover:bg-slate-900 text-yellow-400' : 'border-slate-200 hover:bg-slate-100 text-blue-600'}`}
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {darkMode ? <Sun className="w-4 h-4 animate-pulse" /> : <Moon className="w-4 h-4" />}
            </button>

          </div>

        </div>
      </header>

      {/* 2. Main Body Content Slot */}
      <main className="max-w-7xl mx-auto px-4 py-8 relative">
        {activeTab === 'register' && (
          <RegistrationForm 
            lang={lang} 
            onSuccess={handleRegistrationSuccess}
            darkMode={darkMode} 
          />
        )}

        {activeTab === 'verify' && (
          <VerificationPage 
            candidateId={selectedCandidateId || undefined}
            initialCandidate={newlyRegisteredCandidate}
            lang={lang}
            onNavigateHome={handleReturnHome}
            darkMode={darkMode}
          />
        )}

        {activeTab === 'admin' && (
          <AdminPanel 
            lang={lang}
            onNavigateHome={handleReturnHome}
            onSelectCandidate={handleSelectAdminCandidate}
            darkMode={darkMode}
          />
        )}
      </main>

      {/* 3. Global Decorative Footer */}
      <footer className={`border-t py-6 mt-12 text-center text-[11px] font-normal leading-relaxed opacity-60 ${darkMode ? 'border-slate-900 text-slate-500 bg-slate-950' : 'border-slate-150 text-slate-600 bg-slate-50'}`}>
        <p className="max-w-md mx-auto">
          {t.digitalVerificationSystem}
        </p>
        <p className="mt-1">
          Registered with active-verification secure firestore blueprints. Authorized Registrars Only.
        </p>
      </footer>

    </div>
  );
}
