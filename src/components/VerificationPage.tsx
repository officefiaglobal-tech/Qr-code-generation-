/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Download, 
  Phone, 
  Share2, 
  MessageCircle, 
  Building2, 
  User, 
  Calendar, 
  FileText, 
  MapPin, 
  ExternalLink 
} from 'lucide-react';
import { Candidate, Language } from '../types';
import { translations, generateQRCode, generatePDFDoc } from '../utils/helpers';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

interface VerificationPageProps {
  candidateId?: string; // If passed, fetch from DB
  initialCandidate?: Candidate | null; // If passed (from form submission), use directly
  lang: Language;
  onNavigateHome: () => void;
  darkMode: boolean;
}

export default function VerificationPage({ candidateId, initialCandidate, lang, onNavigateHome, darkMode }: VerificationPageProps) {
  const t = translations[lang];
  const [candidate, setCandidate] = useState<Candidate | null>(initialCandidate || null);
  const [loading, setLoading] = useState<boolean>(!initialCandidate && !!candidateId);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [qrUrl, setQrUrl] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);
  const hasIncremented = React.useRef<boolean>(false);

  // Authenticate & subscription logic to check if current user has Admin context 
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const adminRef = doc(db, 'admins', user.uid);
          const adminSnap = await getDoc(adminRef);
          setIsAdmin(adminSnap.exists());
        } catch (err) {
          console.warn('Could not read admin record on verification page:', err);
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleToggleStatus = async () => {
    if (!candidate || !isAdmin || updatingStatus) return;
    setUpdatingStatus(true);
    const newStatus = candidate.status === 'inactive' ? 'verified' : 'inactive';
    try {
      const docRef = doc(db, 'candidates', candidate.id);
      await updateDoc(docRef, { status: newStatus });
      
      // Update local state so UI updates in real-time
      setCandidate(prev => prev ? { ...prev, status: newStatus } : null);
    } catch (err) {
      console.error('Failed to toggle candidate status:', err);
      alert('Failed to update candidate status on high-security database.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDownloadQR = () => {
    if (!qrUrl) return;
    const downloadLink = document.createElement('a');
    downloadLink.href = qrUrl;
    downloadLink.download = `QR_${candidate?.candidateName ? candidate.candidateName.replace(/\s+/g, '_') : 'candidate'}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  // Auto-generate QR card & trigger PDF download on new registrations
  useEffect(() => {
    if (candidate) {
      // Create verification profile link
      const verificationLink = `${window.location.origin}/?id=${candidate.id}`;
      generateQRCode(verificationLink).then(dataUrl => {
        setQrUrl(dataUrl);

        // If it was just newly registered, trigger auto-download of PDF
        if (initialCandidate) {
          try {
            generatePDFDoc(candidate, dataUrl);
          } catch(err) {
            console.error('Auto pdf download trigger failed:', err);
          }
        }
      });
    }
  }, [candidate, initialCandidate]);

  // Fetch candidate if ID is supplied
  useEffect(() => {
    if (candidateId && !initialCandidate) {
      setLoading(true);
      const docRef = doc(db, 'candidates', candidateId);
      getDoc(docRef)
        .then((snapshot) => {
          if (snapshot.exists()) {
            setCandidate(snapshot.data() as Candidate);
          } else {
            setErrorMsg('Candidate profile not found or archive removed.');
          }
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setErrorMsg('Failed to fetch candidate record securely.');
          setLoading(false);
        });
    }
  }, [candidateId, initialCandidate]);

  // Increment scan count whenever candidate profile is loaded or scanned
  useEffect(() => {
    if (candidate && !hasIncremented.current) {
      hasIncremented.current = true;
      const docRef = doc(db, 'candidates', candidate.id);
      updateDoc(docRef, { scanCount: increment(1) })
        .then(() => {
          setCandidate(prev => prev ? { ...prev, scanCount: (prev.scanCount || 0) + 1 } : null);
        })
        .catch((err) => {
          console.warn('Silent scanCount increment failed:', err);
          try {
            handleFirestoreError(err, OperationType.UPDATE, `candidates/${candidate.id}`);
          } catch (error) {
            console.error('Handled increment error:', error);
          }
        });
    }
  }, [candidate]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-550 mb-4"></div>
        <p className="text-sm font-medium">Securing profile index and loading credentials...</p>
      </div>
    );
  }

  if (errorMsg || !candidate) {
    return (
      <div className={`p-6 max-w-md mx-auto text-center rounded-2xl border ${darkMode ? 'bg-slate-900 border-red-900/30 text-white' : 'bg-red-50 border-red-100 text-red-900'}`}>
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="font-bold text-lg mb-2">Verification Failed</h3>
        <p className="text-sm mb-6 opacity-80">{errorMsg || 'No candidate record loaded.'}</p>
        <button 
          onClick={onNavigateHome}
          className="bg-emerald-600 text-white font-bold text-xs py-2 px-6 rounded-lg shadow hover:bg-emerald-700 cursor-pointer"
        >
          Return to Registry Form
        </button>
      </div>
    );
  }

  // Generate pre-filled dispatch link
  const cleanPhone = (p: string) => p.replace(/\D/g, '');
  const smsUrl = `https://wa.me/91${cleanPhone(candidate.emergencyWhatsApp || candidate.candidateContact)}?text=${encodeURIComponent(
    `*DIGITAL ID ACCREDITATION DEPLOYED*\n\nCandidate: ${candidate.candidateName}\nID: ${candidate.id}\nOrganization: ${candidate.organizationName}\n\nScan QR Code or visit below live verification portal link to verify profile instantly:\n🔗 ${window.location.origin}/?id=${candidate.id}`
  )}`;

  // Multi-contact clickable directory layout
  const contactDirectory = [
    { label: lang === 'en' ? 'Candidate Contact' : 'उम्मीदवार मोबाइल', num: candidate.candidateContact, role: 'Candidate' },
    { label: lang === 'en' ? "Father's Contact" : 'पिता का मोबाइल', num: candidate.fatherContact, role: 'Father' },
    { label: lang === 'en' ? 'Police Station Contact' : 'पुलिस स्टेशन संपर्क', num: candidate.policeStationContact, role: 'PS' },
    { label: lang === 'en' ? 'Emergency Contact' : 'आपातकालीन नंबर', num: candidate.emergencyContact, role: 'SOS' },
    { label: lang === 'en' ? 'Emergency WhatsApp' : 'आपातकालीन व्हाट्सएप', num: candidate.emergencyWhatsApp, role: 'WhatsApp' },
    { label: lang === 'en' ? 'Friend Connection' : 'मित्र / सहयोगी', num: candidate.friendContact, role: 'Friend' },
    { label: lang === 'en' ? 'Relative Connection' : 'रिश्तेदार संपर्क', num: candidate.relativeContact, role: 'Relative' },
  ];

  const handleDownloadPdf = () => {
    generatePDFDoc(candidate, qrUrl);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 pb-12">
      
      {/* Registration Success Banner (only displays immediately on form register) */}
      {initialCandidate && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 text-center text-emerald-800 dark:text-emerald-300">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold">{t.successTitle}</h2>
          <p className="text-sm mt-1 max-w-lg mx-auto opacity-90">{t.successDesc}</p>
          
          <div className="mt-4 inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-4 py-1.5 rounded-full text-xs font-bold font-mono">
            <span>{t.candidateIdAllocated}</span>
            <span>{candidate.id}</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 italic">{t.pdfDownloadedText}</p>
        </div>
      )}

      {/* Main Grid: Card detail + QR Frame */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Column 1 & 2: Candidate ID Profile Details */}
        <div className={`md:col-span-2 shadow-lg rounded-2xl border p-6 md:p-8 flex flex-col justify-between ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-100 text-slate-800'}`}>
          <div>
            <div className="flex flex-col md:flex-row gap-6 items-start pb-6 border-b border-slate-100 dark:border-slate-850">
              
              {/* Photo */}
              <div className="relative w-32 h-32 md:w-36 md:h-36 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 flex-shrink-0 mx-auto md:mx-0">
                {candidate.candidatePhoto ? (
                  <img src={candidate.candidatePhoto} alt="Candidate Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300"><User className="w-14 h-14" /></div>
                )}
              </div>

              {/* Header Texts */}
              <div className="space-y-2 mt-4 md:mt-0 text-center md:text-left w-full">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest ${candidate.status === 'verified' ? 'bg-emerald-500/10 text-emerald-500' : candidate.status === 'pending' ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'}`}>
                    {candidate.status === 'verified' ? t.verifiedCandidate : candidate.status === 'pending' ? 'PENDING VERIFICATION' : 'CARD INACTIVE'}
                  </span>
                  {candidate.scanCount !== undefined && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-blue-500/10 text-blue-500 dark:text-blue-400 font-mono" title="Number of profile lookups/scans">
                      {t.scanCountLabel || 'Verification Scans'}: {candidate.scanCount}
                    </span>
                  )}
                </div>
                
                <h1 className="text-xl md:text-2xl font-black tracking-tight">{candidate.candidateName}</h1>
                
                <p className="text-sm font-semibold text-slate-500 flex items-center gap-1.5 justify-center md:justify-start">
                  <Building2 className="w-4 h-4 flex-shrink-0" />
                  <span>{candidate.organizationName}</span>
                </p>

                <p className="text-xs text-slate-400 font-mono">
                  Registry Acc: {candidate.id}
                </p>
              </div>
            </div>

            {/* Profile Information Indices */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 py-6 border-b border-slate-100 dark:border-slate-850">
              
              {/* DOB */}
              <div className="flex items-start gap-2.5">
                <Calendar className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t.dob}</p>
                  <p className="text-sm font-semibold">{candidate.dob}</p>
                </div>
              </div>

              {/* Father */}
              <div className="flex items-start gap-2.5">
                <User className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t.fatherName}</p>
                  <p className="text-sm font-semibold">{candidate.fatherName}</p>
                </div>
              </div>

              {/* Aadhaar Number */}
              <div className="flex items-start gap-2.5">
                <FileText className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t.aadhaarNumber}</p>
                  <p className="text-sm font-mono font-semibold">
                    XXXX-XXXX-{candidate.aadhaarNumber.substring(8)} 
                    <span className="text-[10px] text-green-500 font-sans ml-1.5"> (Secure Masked)</span>
                  </p>
                </div>
              </div>

              {/* GPS Coordinates */}
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Registry Geo</p>
                  <p className="text-sm font-semibold">
                    {candidate.gpsLat && candidate.gpsLng ? (
                      <span className="font-mono text-xs">{candidate.gpsLat.toFixed(5)}, {candidate.gpsLng.toFixed(5)}</span>
                    ) : (
                      <span className="text-slate-400 italic text-xs">No Geo Record</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Address */}
              <div className="sm:col-span-2 flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t.fullAddress}</p>
                  <p className="text-xs font-semibold leading-relaxed mt-0.5">{candidate.fullAddress}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row gap-3">
            <button 
              onClick={handleDownloadPdf}
              className="flex-1 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              <Download className="w-4 h-4" />
              {t.downloadPdf}
            </button>
            <button 
              onClick={onNavigateHome}
              className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850 transition-all font-semibold text-sm cursor-pointer"
            >
              Return Home
            </button>
          </div>
        </div>

        {/* Column 3: Live QR and Instant Dispatch Controls */}
        <div className="space-y-6">
          
          {/* Active QR Code View */}
          <div className={`shadow-lg rounded-2xl border p-6 text-center transition-all ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-100 text-slate-800'}`}>
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center justify-center gap-1.5">
              {candidate.status === 'inactive' ? (
                <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0 animate-pulse" />
              ) : (
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 animate-pulse" />
              )}
              <span>{candidate.status === 'inactive' ? t.inactiveQR : t.activeQR}</span>
            </h3>

            {qrUrl ? (
              <div className="space-y-4">
                <div className="relative p-3.5 rounded-2xl border-2 border-dashed border-emerald-500/40 bg-emerald-500/[0.02] dark:bg-slate-950/40 max-w-[210px] mx-auto text-center shadow-md">
                  {/* Top Border Label text */}
                  <div className="text-[7px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2 truncate max-w-full" title="Business Employment in support of Technical Company">
                    Business Employment in support of Technical Company
                  </div>
                  
                  {/* QR Code container */}
                  <div className="relative w-36 h-36 bg-white p-2 rounded-xl mx-auto shadow-inner border border-slate-200">
                    <img src={qrUrl} alt="Verification QR Code" className="w-full h-full" />
                  </div>

                  {/* Bottom Border Label info */}
                  <div className="text-[8.5px] font-extrabold tracking-widest text-slate-700 dark:text-slate-200 mt-2">
                    TEL: 6266055353
                  </div>
                  <div className="text-[6.5px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-500 mt-0.5">
                    Secure Identity QR
                  </div>
                </div>

                {/* Download QR Button */}
                <button
                  id="download-qr-btn"
                  type="button"
                  onClick={handleDownloadQR}
                  className="w-full max-w-[210px] mx-auto py-2 px-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black transition-all shadow-sm flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-800 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>{t.downloadQr}</span>
                </button>
              </div>
            ) : (
              <div className="w-40 h-40 bg-slate-100 dark:bg-slate-800 rounded-xl mx-auto flex items-center justify-center text-slate-400 text-xs">Generating...</div>
            )}

            {isAdmin && (
              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                <p className="text-[10px] uppercase tracking-wider text-emerald-500 dark:text-yellow-400 font-extrabold mb-2.5 flex items-center justify-center gap-1">
                   <span>🛠️ Admin Status Control</span>
                </p>
                
                <button
                  id="admin-status-toggle"
                  type="button"
                  onClick={handleToggleStatus}
                  disabled={updatingStatus}
                  className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 border cursor-pointer ${
                    updatingStatus
                      ? 'bg-slate-100 dark:bg-slate-850 text-slate-400 dark:text-slate-500 border-transparent cursor-not-allowed'
                      : candidate.status === 'inactive'
                      ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 border-emerald-500 text-white hover:shadow'
                      : 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 border-rose-500 text-white hover:shadow'
                  }`}
                >
                  {updatingStatus ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-slate-400 dark:border-slate-500 border-t-transparent rounded-full animate-spin"></span>
                      <span>Updating Status...</span>
                    </>
                  ) : candidate.status === 'inactive' ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-emerald-100 flex-shrink-0 animate-pulse" />
                      <span>{lang === 'en' ? 'Click to Set Active (Enable Card)' : 'सक्रिय करने के लिए क्लिक करें'}</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-rose-100 flex-shrink-0" />
                      <span>{lang === 'en' ? 'Click to Set Inactive (Revoke Card)' : 'निष्क्रिय करने के लिए क्लिक करें'}</span>
                    </>
                  )}
                </button>

                {/* Visual Status Icons Guide */}
                <div className="mt-2.5 flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/50 dark:border-slate-800/80 text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 select-none font-mono">Status Keys:</span>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                    <span>Active (Green)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <XCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                    <span>Inactive (Red)</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick WhatsApp Dispatch Card (Only shown contextually on registration or success) */}
          {initialCandidate && (
            <div className={`shadow-lg rounded-2xl border-2 p-6 transition-all ${darkMode ? 'bg-amber-500/[0.02] border-amber-500/20 text-amber-200' : 'bg-amber-500/[0.01] border-amber-200 text-amber-900'}`}>
              <div className="flex items-center gap-2.5 mb-2.5">
                <MessageCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <h3 className="font-bold text-sm text-amber-600 dark:text-amber-400">{t.whatsappSendPrompt}</h3>
              </div>
              <p className="text-xs leading-relaxed opacity-90 mb-4 text-slate-500 dark:text-slate-400">{t.whatsappInstructions}</p>
              
              <a 
                href={smsUrl}
                target="_blank"
                rel="noreferrer referrer"
                className="w-full py-2.5 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 hover:from-indigo-950 hover:to-slate-950 text-amber-400 border border-amber-500/30 hover:border-amber-400 font-extrabold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
              >
                <Share2 className="w-3.5 h-3.5" />
                Send Credentials over WhatsApp
              </a>
            </div>
          )}

        </div>
      </div>

      {/* Full Call Actions Contact Directory (Interactive clickable buttons) */}
      <div className={`shadow-lg rounded-2xl border p-6 md:p-8 transition-all ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-100 text-slate-800'}`}>
        <h3 className="text-md font-bold text-slate-600 dark:text-slate-300 mb-5 pb-3 border-b border-slate-100 dark:border-slate-850 flex items-center gap-2">
          <Phone className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
          <span>{t.directContact}</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {contactDirectory.map((contact, idx) => {
            if (!contact.num) return null;
            return (
              <div key={idx} className={`p-4 rounded-xl border flex flex-col justify-between ${darkMode ? 'bg-slate-850 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                <div>
                  <span className="text-[10px] font-bold tracking-widest uppercase font-mono text-slate-400">{contact.role}</span>
                  <h4 className="text-sm font-extrabold text-slate-700 dark:text-slate-200 mt-0.5">{contact.label}</h4>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 font-mono">
                    +91 XXXXX-XX{contact.num ? contact.num.slice(-3) : 'XXX'} 
                    <span className="text-[9px] text-emerald-500 font-sans ml-1.5 font-bold"> (Secure Protected)</span>
                  </p>
                </div>

                <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                  {/* Call Button */}
                  <a 
                    href={`tel:+91${contact.num}`}
                    className="flex-1 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 rounded-lg text-center font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Phone className="w-3 h-3" />
                    Call
                  </a>
                  {/* WhatsApp Button */}
                  <a 
                    href={`https://wa.me/91${contact.num}?text=Verification ID: ${candidate.id}`}
                    target="_blank"
                    referrerPolicy="no-referrer"
                    className="flex-1 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 rounded-lg text-center font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    <MessageCircle className="w-3" />
                    WhatsApp
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
