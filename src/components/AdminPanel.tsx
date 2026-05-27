/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  auth, 
  db, 
  handleFirestoreError, 
  OperationType 
} from '../lib/firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged, 
  User as AuthUser 
} from 'firebase/auth';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  setDoc,
  getDoc
} from 'firebase/firestore';
import { 
  Search, 
  Filter, 
  CheckCircle, 
  XCircle, 
  Trash2, 
  Edit3, 
  Download, 
  LogOut, 
  Printer, 
  RefreshCw, 
  Key, 
  Settings, 
  Phone, 
  MessageSquare, 
  UserCheck, 
  QrCode,
  ShieldAlert,
  ArrowUpDown,
  ExternalLink,
  Users,
  Clock,
  FileText,
  Mail
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Candidate, Language } from '../types';
import { 
  translations, 
  generateQRCode, 
  generatePDFDoc 
} from '../utils/helpers';

const PrintAllQRImage = ({ candidate }: { candidate: Candidate }) => {
  const [url, setUrl] = useState<string>('');
  useEffect(() => {
    const verificationLink = `${window.location.origin}/?id=${candidate.id}`;
    generateQRCode(verificationLink).then(setUrl).catch(console.error);
  }, [candidate.id]);

  if (!url) {
    return (
      <div className="w-12 h-12 bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-[7px] text-slate-400 border border-slate-200 dark:border-slate-800 rounded">
        QR...
      </div>
    );
  }
  return <img src={url} alt="QR Code" className="w-12 h-12 object-contain border border-slate-100 dark:border-slate-800 p-0.5 rounded bg-white" />;
};

interface AdminPanelProps {
  lang: Language;
  onNavigateHome: () => void;
  onSelectCandidate: (candidate: Candidate) => void;
  darkMode: boolean;
}

export default function AdminPanel({ lang, onNavigateHome, onSelectCandidate, darkMode }: AdminPanelProps) {
  const t = translations[lang];

  // Auth state
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Candidates state
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingRecords, setLoadingRecords] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [orgFilter, setOrgFilter] = useState<string>('all');
  const [dateSort, setDateSort] = useState<'asc' | 'desc'>('desc');

  // Edit State Modal
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [editForm, setEditForm] = useState<Partial<Candidate>>({});

  // ID Print Modal State
  const [printingCandidate, setPrintingCandidate] = useState<Candidate | null>(null);
  const [printQrUrl, setPrintQrUrl] = useState<string>('');
  const [isPrintingAll, setIsPrintingAll] = useState<boolean>(false);

  // Email Notification State
  const [notifiedCandidate, setNotifiedCandidate] = useState<Candidate | null>(null);
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailBody, setEmailBody] = useState<string>('');
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);

  // Watch Auth Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        checkAdminStatus(currentUser.uid);
      } else {
        setIsAdmin(false);
        setAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const checkAdminStatus = async (uid: string) => {
    try {
      const docRef = doc(db, 'admins', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    } catch (err) {
      console.warn('Could not read admin record:', err);
      setIsAdmin(false);
    } finally {
      setAuthLoading(false);
    }
  };

  // Google Login popup
  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('Google Sign-In Failed:', err);
    }
  };

  // Register Current User as Admin (Bootstrapping for sandboxed tests)
  const bootstrapAdmin = async () => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'admins', user.uid), {
        email: user.email,
        role: 'administrator',
        bootstrappedAt: new Date()
      });
      setIsAdmin(true);
    } catch (err) {
      console.error('Bootstrapping error:', err);
      alert('Error creating Admin role context. Ensure Firestore is deployed.');
    }
  };

  const handleSignOut = () => {
    signOut(auth).then(() => {
      setUser(null);
      setIsAdmin(false);
    });
  };

  // Loads Candidates Listing (Admins only)
  const loadCandidates = async () => {
    if (!isAdmin) return;
    setLoadingRecords(true);
    const path = 'candidates';
    try {
      const colRef = collection(db, path);
      const querySnapshot = await getDocs(colRef);
      const list: Candidate[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          ...data,
          // Support Firestore Timestamp to normal dates
          createdAt: data.createdAt?.seconds 
            ? new Date(data.createdAt.seconds * 1000).toISOString() 
            : data.createdAt || new Date().toISOString()
        } as Candidate);
      });
      setCandidates(list);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    } finally {
      setLoadingRecords(false);
    }
  };

  // Reload candidates list once admin has loaded
  useEffect(() => {
    if (isAdmin) {
      loadCandidates();
    }
  }, [isAdmin]);

  // Handle Candidate Deletion
  const deleteCandidate = async (id: string) => {
    if (!window.confirm('Are you absolutely sure you want to delete this candidate record permanently?')) return;
    
    const path = `candidates/${id}`;
    try {
      await deleteDoc(doc(db, 'candidates', id));
      setCandidates(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // Toggle candidate QR/Registration Active Status (verified / pending / inactive)
  const toggleCandidateStatus = async (id: string, newStatus: 'verified' | 'pending' | 'inactive') => {
    const path = `candidates/${id}`;
    try {
      await updateDoc(doc(db, 'candidates', id), { status: newStatus });
      setCandidates(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  // Save Candidate Profile Modifications
  const saveCandidateEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCandidate) return;

    const path = `candidates/${editingCandidate.id}`;
    try {
      await updateDoc(doc(db, 'candidates', editingCandidate.id), editForm);
      setCandidates(prev => prev.map(c => c.id === editingCandidate.id ? { ...c, ...editForm } as Candidate : c));
      setEditingCandidate(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  // CSV Report Generator (Client side Excel export)
  const exportCSVReport = () => {
    if (candidates.length === 0) return;
    
    // Header
    const headers = [
      'ID', 'Organization', 'Candidate Name', 'Aadhaar', 'Date of Birth', 
      'Father Name', 'Contact', 'Father contact', 'Emergency Contact', 'Status', 'Registered At'
    ];
    
    const rows = candidates.map(c => [
      c.id,
      `"${c.organizationName.replace(/"/g, '""')}"`,
      `"${c.candidateName.replace(/"/g, '""')}"`,
      `'${c.aadhaarNumber}`, // Single quote forces excel not to trim leading zeros
      c.dob,
      `"${c.fatherName.replace(/"/g, '""')}"`,
      c.candidateContact,
      c.fatherContact,
      c.emergencyContact,
      c.status,
      new Date(c.createdAt).toLocaleDateString()
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `REGISTRY_REPORT_${new Date().getFullYear()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PDF Report Director for current filtered list of candidates
  const exportPDFSummaryReport = () => {
    if (filteredCandidates.length === 0) return;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Helper to draw pages background border & running title
    const drawPageBordersAndFooter = (pageNum: number, totalPages: number) => {
      // Elegant page margins
      doc.setDrawColor(15, 23, 42); // Deep slate
      doc.setLineWidth(0.6);
      doc.rect(8, 8, 194, 281); // Solid border frame

      doc.setDrawColor(203, 213, 225); // Light separator border
      doc.setLineWidth(0.25);
      doc.rect(10, 10, 190, 277);

      // Footer
      doc.setFillColor(15, 23, 42);
      doc.rect(10, 281, 190, 6, 'F');
      doc.setTextColor('#ffffff');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(`REGISTRY ADMINISTRATION CONSOLE REPORT  |  CONFIDENTIAL`, 15, 285.2);
      doc.text(`Page ${pageNum} of ${totalPages}`, 195, 285.2, { align: 'right' });
    };

    // Helper to draw main header block (first page only)
    const drawFirstPageHeader = () => {
      // Header graphic bar
      doc.setFillColor(15, 23, 42);
      doc.rect(12, 12, 186, 26, 'F');

      // Title
      doc.setTextColor('#ffffff');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('CANDIDATE REGISTRY SUMMARY REPORT', 105, 20.5, { align: 'center' });

      doc.setFontSize(7.5);
      doc.setFont('Helvetica', 'normal');
      doc.text('OFFICIAL FILTERED PORTAL METRICS INDEX', 105, 26.5, { align: 'center' });

      // Metadata layout block
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.rect(12, 42, 186, 22, 'F');
      doc.rect(12, 42, 186, 22, 'S');

      // Meta text
      doc.setTextColor('#0f172a');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      
      doc.text(`GENERATED TIME:`, 16, 48);
      doc.text(`RECORDS COUNT:`, 16, 54);
      doc.text(`ACTIVE FILTER:`, 16, 60);

      doc.text(`SEARCH QUERY:`, 105, 48);
      doc.text(`AUTHORIZATION:`, 105, 54);
      doc.text(`STATION:`, 105, 60);

      // Values text
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor('#334155');
      doc.text(new Date().toLocaleString(), 48, 48);
      doc.text(`${filteredCandidates.length} Candidates (Filtered from ${candidates.length})`, 48, 54);
      const activeFilterMsg = `${statusFilter.toUpperCase() === 'ALL' ? 'ALL' : statusFilter.toUpperCase()} | ORG: ${orgFilter.toUpperCase() === 'ALL' ? 'ALL' : orgFilter}`;
      // Truncate filter message to prevent border spill if org name is too long
      const finalMsg = activeFilterMsg.length > 50 ? `${activeFilterMsg.substring(0, 47)}...` : activeFilterMsg;
      doc.text(finalMsg, 48, 60);

      doc.text(searchTerm ? `"${searchTerm}"` : 'None Specified', 135, 48);
      doc.text(user?.email || 'N/A', 135, 54);
      doc.text('Central Registry Hub', 135, 60);
    };

    // Helper to draw table header rows
    const drawTableHeader = (startY: number) => {
      doc.setFillColor(30, 41, 59); // Slate-800
      doc.rect(12, startY, 186, 8, 'F');

      doc.setTextColor('#ffffff');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);

      doc.text('S.No', 15, startY + 5.5);
      doc.text('Candidate ID / Org', 28, startY + 5.5);
      doc.text('Candidate Name', 68, startY + 5.5);
      doc.text('Contact No.', 115, startY + 5.5);
      doc.text('Parent / Father', 145, startY + 5.5);
      doc.text('Status', 178, startY + 5.5);
    };

    // Calculate pagination pages
    const rowHeight = 9.2;
    const itemsPerPageFirst = 20;
    const itemsPerPageSubsequent = 25;

    let totalPages = 1;
    let remainingItems = filteredCandidates.length - itemsPerPageFirst;
    while (remainingItems > 0) {
      totalPages++;
      remainingItems -= itemsPerPageSubsequent;
    }

    let currentPage = 1;
    let currentY = 76;

    // Draw page 1 structure
    drawFirstPageHeader();
    drawTableHeader(68);

    filteredCandidates.forEach((cand, idx) => {
      // Check if we need a new page
      const limitY = currentPage === 1 ? 260 : 265;
      if (currentY > limitY) {
        // Complete current page with borders & footer
        drawPageBordersAndFooter(currentPage, totalPages);
        
        // Setup next page
        doc.addPage();
        currentPage++;
        
        // Compact subsequent page title
        doc.setDrawColor(15, 23, 42);
        doc.setFillColor(15, 23, 42);
        doc.rect(12, 12, 186, 11, 'F');
        doc.setTextColor('#ffffff');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`CANDIDATE REGISTRY REPORT SUMMARY (CONTINUED) - PAGE ${currentPage}`, 105, 19.1, { align: 'center' });

        // Table Header again
        drawTableHeader(26);
        currentY = 34;
      }

      // Draw Grid Divider Line
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.15);
      doc.line(12, currentY + rowHeight, 198, currentY + rowHeight);

      // Print row values
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor('#1e293b');

      // Backplate color for alternating rows
      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(12.5, currentY + 0.1, 185, rowHeight - 0.2, 'F');
      }

      // S.No
      doc.text((idx + 1).toString(), 15, currentY + 5.5);

      // ID and Short Org Name
      doc.setFont('Helvetica', 'bold');
      const cleanId = cand.id.substring(0, 15);
      doc.text(cleanId, 28, currentY + 4);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor('#64748b');
      const cleanOrg = cand.organizationName.length > 28 ? `${cand.organizationName.substring(0, 26)}...` : cand.organizationName;
      doc.text(cleanOrg, 28, currentY + 7.2);
      doc.setFontSize(7.5);
      doc.setTextColor('#1e293b');

      // Candidate Name
      doc.setFont('Helvetica', 'bold');
      const cleanName = cand.candidateName.length > 24 ? `${cand.candidateName.substring(0, 22)}...` : cand.candidateName;
      doc.text(cleanName, 68, currentY + 5.5);
      doc.setFont('Helvetica', 'normal');

      // Contact No
      doc.text(`+91 ${cand.candidateContact || 'N/A'}`, 115, currentY + 5.5);

      // Parent/Father
      const cleanFather = cand.fatherName.length > 20 ? `${cand.fatherName.substring(0, 18)}...` : cand.fatherName;
      doc.text(cleanFather, 145, currentY + 5.5);

      // Status
      const statusText = cand.status.toUpperCase();
      doc.setFont('Helvetica', 'bold');
      if (cand.status === 'verified') {
        doc.setTextColor('#16a34a'); // Green
      } else if (cand.status === 'pending') {
        doc.setTextColor('#ca8a04'); // Yellow
      } else {
        doc.setTextColor('#dc2626'); // Red
      }
      doc.text(statusText, 178, currentY + 5.5);

      // Update Y coordinate
      currentY += rowHeight;
    });

    // Complete the final page borders & footer
    drawPageBordersAndFooter(currentPage, totalPages);

    // Save final report
    doc.save(`REGISTRY_REPORT_${new Date().toISOString().split('T')[0]}_FILTERED.pdf`);
  };

  // Trigger Individual Candidate ID Card pop up layout
  const handlePrintIdCard = (cand: Candidate) => {
    setPrintingCandidate(cand);
    const verificationLink = `${window.location.origin}/?id=${cand.id}`;
    generateQRCode(verificationLink).then(res => setPrintQrUrl(res));
  };

  // Initialize email template with professional defaults and open composer
  const handleInitEmailComposer = (cand: Candidate) => {
    setNotifiedCandidate(cand);
    setEmailSubject(`[Accreditation UPDATE] Official Verification Status: ${cand.id}`);
    
    const plainBody = `Dear ${cand.candidateName},

We are pleased to provide an official update regarding your secure digital credentials registration with ${cand.organizationName}.

Registration Reference ID: ${cand.id}
Accreditation Status: ${cand.status === 'verified' ? 'SECURELY VERIFIED' : cand.status.toUpperCase()}

You can instantly check your live record or present your digital credentials securely by visiting the direct verification portal link below:
${window.location.origin}/?id=${cand.id}

If you have any questions or require administrative assistance, please do not hesitate to contact our desk.

Sincerely,
Central Accreditation & Registry Desk
${cand.organizationName}`;

    setEmailBody(plainBody);
  };

  // Launch pre-filled email draft and optional network simulator
  const handleSendNotificationEmail = async () => {
    if (!notifiedCandidate) return;
    
    setIsSendingEmail(true);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      // Safely launch default local system mail composer
      const to = notifiedCandidate.candidateEmail || '';
      const subjectEncoded = encodeURIComponent(emailSubject);
      const bodyEncoded = encodeURIComponent(emailBody);
      window.open(`mailto:${to}?subject=${subjectEncoded}&body=${bodyEncoded}`, '_self');
      
      setNotifiedCandidate(null);
    } catch (e) {
      console.error(e);
      alert('Failed to launch mail client. Please check the email address formatting.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Generate individual PDF on custom download click
  const downloadCandidatePdf = (cand: Candidate) => {
    const link = `${window.location.origin}/?id=${cand.id}`;
    generateQRCode(link).then(qrData => {
      generatePDFDoc(cand, qrData);
    });
  };

  // Get unique list of organization names for dropdown selection
  const uniqueOrganizations = React.useMemo(() => {
    return Array.from(new Set(candidates.map(c => c.organizationName).filter(Boolean))).sort();
  }, [candidates]);

  // Filter & Sort Candidate Matrix
  const filteredCandidates = candidates.filter(cand => {
    const query = searchTerm.toLowerCase();
    const matchesSearch = 
      cand.candidateName.toLowerCase().includes(query) ||
      cand.id.toLowerCase().includes(query) ||
      cand.organizationName.toLowerCase().includes(query) ||
      cand.aadhaarNumber.includes(query);
      
    const matchesFilter = statusFilter === 'all' || cand.status === statusFilter;
    const matchesOrg = orgFilter === 'all' || cand.organizationName === orgFilter;
    return matchesSearch && matchesFilter && matchesOrg;
  }).sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateSort === 'desc' ? dateB - dateA : dateA - dateB;
  });

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500 mb-4"></div>
        <p className="text-sm text-slate-500 font-medium">Authorizing system gates...</p>
      </div>
    );
  }

  // Admin Verification Gate UI
  if (!user || !isAdmin) {
    return (
      <div className={`p-6 max-w-lg mx-auto rounded-3xl border shadow-2xl overflow-hidden ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-100 text-slate-800'}`}>
        <div className="p-8 text-center space-y-6">
          <div className="p-4 mx-auto w-fit rounded-2xl bg-emerald-600/10 text-emerald-500">
            <ShieldAlert className="w-10 h-10" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-black tracking-tight">Admin Gateway</h2>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">Authorize sign-in credentials to access candidate profiles database.</p>
          </div>

          {!user ? (
            <button 
              onClick={signInWithGoogle}
              className="w-full py-3 px-6 bg-slate-900 hover:bg-black text-white dark:bg-emerald-600 dark:hover:bg-emerald-700 font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-3.5 text-sm cursor-pointer"
            >
              <Key className="w-5 h-5" />
              Sign In with Google Admin
            </button>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="bg-yellow-505/10 border border-yellow-500/20 rounded-xl p-4 text-left">
                <p className="text-xs font-bold text-yellow-500 uppercase tracking-widest mb-1">Developer Admin Sandbox Mode Available</p>
                <p className="text-xs text-slate-550 dark:text-slate-400 leading-relaxed mb-3">
                  Your Google sign-in was verified, but matching admin permissions were not configured inside Firestore. For review purposes, you can click verify below to instantly add your profile `{user.email}` to the Admins list.
                </p>
                <button 
                  onClick={bootstrapAdmin}
                  className="w-full py-2 bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-bold text-xs rounded-lg transition-all cursor-pointer"
                >
                  Configure My Profile as Admin
                </button>
              </div>
              <button onClick={handleSignOut} className="text-xs text-slate-400 underline hover:text-slate-300 font-normal">Sign Out</button>
            </div>
          )}

          <button onClick={onNavigateHome} className="text-xs block mx-auto text-slate-400 underline hover:text-emerald-500 mt-2">Return to Public Homepage</button>
        </div>
      </div>
    );
  }

  // Authenticated Admin Dashboard Layout
  return (
    <div className={`space-y-6 max-w-7xl mx-auto px-4 pb-12`}>
      
      {/* Top Header Card */}
      <div className={`shadow-md rounded-2xl p-6 flex flex-col md:flex-row justify-between items-center gap-4 ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-100'}`}>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="p-2.5 rounded-xl bg-blue-600/10 text-blue-500">
            <RefreshCw className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">Records Directory</h2>
            <p className="text-xs text-slate-400 font-medium">Verify, coordinate, and export secure credentials files</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3.5 w-full md:w-auto justify-end">
          <button 
            onClick={exportCSVReport}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export Excel (CSV)
          </button>

          <button 
            onClick={exportPDFSummaryReport}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850 transition-all cursor-pointer shadow-sm"
          >
            <FileText className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
            PDF Summary ({filteredCandidates.length})
          </button>

          <button 
            onClick={() => setIsPrintingAll(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850 transition-all cursor-pointer shadow-sm"
          >
            <Printer className="w-3.5 h-3.5 text-blue-500 dark:text-blue-450" />
            Print All ({filteredCandidates.length})
          </button>
          
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-[11px] font-mono">
            <strong>Admin:</strong> {user.email}
          </div>

          <button 
            onClick={handleSignOut}
            className="flex items-center gap-1.5 bg-red-650 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg text-xs transition-all shadow-sm cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Admin Dashboard Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Candidates Card */}
        <div className={`p-4 sm:p-5 rounded-2xl shadow-sm border flex items-center justify-between transition-all ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
        }`}>
          <div className="space-y-1">
            <p className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase font-mono">
              Total Candidates
            </p>
            <p className="text-2xl font-black tracking-tight text-slate-800 dark:text-white">
              {candidates.length}
            </p>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold">Registered database size</p>
          </div>
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500 flex-shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Active Candidates Card */}
        <div className={`p-4 sm:p-5 rounded-2xl shadow-sm border flex items-center justify-between transition-all ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
        }`}>
          <div className="space-y-1">
            <p className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase font-mono">
              Active Documents
            </p>
            <p className="text-2xl font-black tracking-tight text-emerald-500">
              {candidates.filter(c => c.status === 'verified').length}
            </p>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold">Verified & Live QR codes</p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500 flex-shrink-0">
            <CheckCircle className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        {/* Pending Candidates Card */}
        <div className={`p-4 sm:p-5 rounded-2xl shadow-sm border flex items-center justify-between transition-all ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
        }`}>
          <div className="space-y-1">
            <p className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase font-mono">
              Pending Candidates
            </p>
            <p className="text-2xl font-black tracking-tight text-amber-500">
              {candidates.filter(c => c.status === 'pending').length}
            </p>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold">Awaiting admin action</p>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500 flex-shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Inactive Candidates Card */}
        <div className={`p-4 sm:p-5 rounded-2xl shadow-sm border flex items-center justify-between transition-all ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
        }`}>
          <div className="space-y-1">
            <p className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase font-mono">
              Inactive Cards
            </p>
            <p className="text-2xl font-black tracking-tight text-rose-500">
              {candidates.filter(c => c.status === 'inactive').length}
            </p>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold">Revoked / Suspended IDs</p>
          </div>
          <div className="p-3 rounded-xl bg-rose-500/10 text-rose-500 flex-shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar Card */}
      <div className={`shadow-md rounded-2xl p-4 gap-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 items-center ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-100'}`}>
        
        {/* Search Input */}
        <div className="sm:col-span-2 lg:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search by ID, name, Aadhaar, or company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 text-xs rounded-xl outline-none border transition-all ${darkMode ? 'bg-slate-800 border-slate-700 text-white focus:ring-1 focus:ring-emerald-500' : 'bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-1 focus:ring-emerald-500'}`}
          />
        </div>

        {/* Status Filter */}
        <div className="relative">
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`w-full px-3.5 py-2 text-xs rounded-xl outline-none border transition-all appearance-none ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50/50 border-slate-200'}`}
          >
            <option value="all">🔍 All Verification States</option>
            <option value="pending">🟡 Pending Status</option>
            <option value="verified">🟢 Verified ID</option>
            <option value="inactive">🔴 Inactive / Revoked</option>
          </select>
        </div>

        {/* Organization Name Filter */}
        <div className="relative">
          <select 
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
            className={`w-full px-3.5 py-2 text-xs rounded-xl outline-none border transition-all appearance-none ${darkMode ? 'bg-slate-800 border-slate-700 text-white focus:ring-1 focus:ring-emerald-500' : 'bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-1 focus:ring-emerald-500'}`}
          >
            <option value="all">🏢 All Organizations</option>
            {uniqueOrganizations.map(org => (
              <option key={org} value={org}>
                {org}
              </option>
            ))}
          </select>
        </div>

        {/* Date Sort Toggle */}
        <button 
          onClick={() => setDateSort(prev => prev === 'desc' ? 'asc' : 'desc')}
          className={`flex items-center justify-between w-full px-4 py-2 text-xs rounded-xl border font-semibold transition-all ${darkMode ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-50'}`}
        >
          <span>Date Registered: {dateSort === 'desc' ? 'Latest' : 'Oldest'}</span>
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
        </button>

      </div>

      {/* Database Listing Grid */}
      {loadingRecords ? (
        <div className="p-12 text-center text-slate-500">
          <p className="text-sm font-medium animate-pulse">Querying cloud documents database...</p>
        </div>
      ) : filteredCandidates.length === 0 ? (
        <div className={`p-12 text-center rounded-2xl ${darkMode ? 'bg-slate-900 border border-slate-850' : 'bg-slate-50'}`}>
          <p className="text-sm text-slate-500 font-semibold">No candidate registrations match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredCandidates.map((cand) => (
            <div key={cand.id} className={`shadow-md rounded-2xl border p-5 flex flex-col md:flex-row gap-5 transition-all justify-between ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-100 text-slate-800'}`}>
              
              <div className="flex gap-4 items-start">
                <div className="w-20 h-20 bg-slate-50 border dark:border-slate-700 rounded-lg overflow-hidden flex-shrink-0">
                  {cand.candidatePhoto ? (
                    <img src={cand.candidatePhoto} alt="Candid face" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">No Photo</div>
                  )}
                </div>

                <div className="space-y-1 max-w-[210px] sm:max-w-xs md:max-w-none">
                  <span className={`inline-block px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${cand.status === 'verified' ? 'bg-green-500/15 text-green-500' : cand.status === 'pending' ? 'bg-amber-500/15 text-amber-500' : 'bg-red-500/15 text-red-500'}`}>
                    {cand.status.toUpperCase()}
                  </span>
                  
                  <h3 className="font-extrabold text-sm tracking-tight">{cand.candidateName}</h3>
                  <p className="text-xs text-slate-500 font-medium truncate">{cand.organizationName}</p>
                  
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5 select-all">ID: {cand.id}</p>
                  <p className="text-[10px] text-slate-400 mt-1">Reg: {new Date(cand.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Action Toolbar Column */}
              <div className="flex flex-row md:flex-col justify-end gap-2.5 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800 flex-wrap">
                
                {/* Secondary Toggles */}
                <div className="flex items-center gap-1">
                  
                  {/* Verify Toggle */}
                  {cand.status !== 'verified' && (
                    <button 
                      onClick={() => toggleCandidateStatus(cand.id, 'verified')}
                      title="Mark as Verified Candidate"
                      className="p-1.5 hover:bg-green-500/10 text-slate-400 hover:text-green-500 transition-all rounded-lg"
                    >
                      <UserCheck className="w-4 h-4" />
                    </button>
                  )}
                  {/* Deactivate/Cancel Verify Toggle */}
                  {cand.status !== 'inactive' && (
                    <button 
                      onClick={() => toggleCandidateStatus(cand.id, 'inactive')}
                      title="Deactivate / Block card"
                      className="p-1.5 hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-all rounded-lg"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                  {cand.status === 'inactive' && (
                    <button 
                      onClick={() => toggleCandidateStatus(cand.id, 'pending')}
                      title="Restore to Pending"
                      className="p-1.5 hover:bg-amber-500/10 text-slate-400 hover:text-amber-500 transition-all rounded-lg"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}

                  {/* Email Notification */}
                  <button 
                    onClick={() => handleInitEmailComposer(cand)}
                    title={cand.candidateEmail ? `Send verification update to ${cand.candidateEmail}` : "Add email & send verification update"}
                    className={`p-1.5 rounded-lg transition-all ${
                      cand.candidateEmail 
                        ? 'hover:bg-violet-500/10 text-slate-400 hover:text-violet-500' 
                        : 'hover:bg-slate-500/10 text-slate-400 hover:text-slate-500 opacity-50'
                    }`}
                  >
                    <Mail className="w-4 h-4" />
                  </button>

                  {/* Edit Core Profile */}
                  <button 
                    onClick={() => {
                      setEditingCandidate(cand);
                      setEditForm(cand);
                    }}
                    title="Edit Candidate Profile Data"
                    className="p-1.5 hover:bg-blue-500/10 text-slate-400 hover:text-blue-500 transition-all rounded-lg"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  {/* Print Modal */}
                  <button 
                    onClick={() => handlePrintIdCard(cand)}
                    title="Render Smart Physical ID"
                    className="p-1.5 hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-500 transition-all rounded-lg"
                  >
                    <Printer className="w-4 h-4" />
                  </button>

                  {/* Print QR */}
                  <button 
                    onClick={() => downloadCandidatePdf(cand)}
                    title="Download registration summary PDF"
                    className="p-1.5 hover:bg-yellow-500/10 text-slate-404 hover:text-yellow-500 transition-all rounded-lg"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  {/* Permanent Trash Delete */}
                  <button 
                    onClick={() => deleteCandidate(cand.id)}
                    title="Delete record permanently"
                    className="p-1.5 hover:bg-red-500/15 text-slate-400 hover:text-red-650 transition-all rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                </div>

                {/* Open verification profile */}
                <button 
                  onClick={() => onSelectCandidate(cand)}
                  className="w-full text-center py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  Verify Page View
                  <ExternalLink className="w-3 h-3" />
                </button>

              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL 1: EDIT CANDIDATE WINDOW */}
      {editingCandidate && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center bg-black/60 p-4">
          <div className={`p-6 md:p-8 rounded-2xl max-w-2xl w-full border ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-100 text-slate-800'}`}>
            <h3 className="text-lg font-extrabold pb-3 border-b mb-4">Edit Candidate Profile Form - {editingCandidate.id}</h3>
            
            <form onSubmit={saveCandidateEdit} className="space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase font-extrabold tracking-wider text-slate-400 mb-1 block">Full Name</label>
                  <input 
                    type="text" 
                    value={editForm.candidateName || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, candidateName: e.target.value }))}
                    className={`w-full p-2 text-xs rounded-lg border outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50'}`} 
                  />
                </div>
                <div>
                  <label className="text-xs uppercase font-extrabold tracking-wider text-slate-400 mb-1 block">Father Name</label>
                  <input 
                    type="text" 
                    value={editForm.fatherName || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, fatherName: e.target.value }))}
                    className={`w-full p-2 text-xs rounded-lg border outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50'}`} 
                  />
                </div>
                <div>
                  <label className="text-xs uppercase font-extrabold tracking-wider text-slate-400 mb-1 block">Candidate Contact</label>
                  <input 
                    type="text" 
                    value={editForm.candidateContact || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, candidateContact: e.target.value }))}
                    className={`w-full p-2 text-xs rounded-lg border outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50'}`} 
                  />
                </div>
                <div>
                  <label className="text-xs uppercase font-extrabold tracking-wider text-slate-400 mb-1 block">Candidate Email</label>
                  <input 
                    type="email" 
                    value={editForm.candidateEmail || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, candidateEmail: e.target.value }))}
                    className={`w-full p-2 text-xs rounded-lg border outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50'}`} 
                    placeholder="candidate@example.com"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase font-extrabold tracking-wider text-slate-400 mb-1 block">Father Contact</label>
                  <input 
                    type="text" 
                    value={editForm.fatherContact || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, fatherContact: e.target.value }))}
                    className={`w-full p-2 text-xs rounded-lg border outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50'}`} 
                  />
                </div>
                <div>
                  <label className="text-xs uppercase font-extrabold tracking-wider text-slate-400 mb-1 block">Local Police Station Contact</label>
                  <input 
                    type="text" 
                    value={editForm.policeStationContact || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, policeStationContact: e.target.value }))}
                    className={`w-full p-2 text-xs rounded-lg border outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50'}`} 
                  />
                </div>
                <div>
                  <label className="text-xs uppercase font-extrabold tracking-wider text-slate-400 mb-1 block">Emergency WhatsApp Contact</label>
                  <input 
                    type="text" 
                    value={editForm.emergencyWhatsApp || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, emergencyWhatsApp: e.target.value }))}
                    className={`w-full p-2 text-xs rounded-lg border outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50'}`} 
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs uppercase font-extrabold tracking-wider text-slate-400 mb-1 block">Full Address</label>
                  <textarea 
                    value={editForm.fullAddress || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, fullAddress: e.target.value }))}
                    rows={2}
                    className={`w-full p-2 text-xs rounded-lg border outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50'}`} 
                  />
                </div>
              </div>

              <div className="flex gap-2.5 justify-end pt-4 border-t">
                <button 
                  type="button" 
                  onClick={() => setEditingCandidate(null)}
                  className="px-4 py-2 bg-slate-500 text-white rounded-lg text-xs font-semibold hover:bg-slate-650 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all shadow cursor-pointer"
                >
                  Save Modifications
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PRINT SMART CARD BADGE WINDOW */}
      {printingCandidate && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center bg-black/60 p-4">
          <div className={`p-6 rounded-2xl max-w-sm w-full border ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-100 text-slate-800'}`}>
            <h3 className="font-extrabold text-sm border-b pb-2.5 text-center">Smart ID Badge Template</h3>
            
            {/* Front of ID Card */}
            <div className="mt-4 p-4 rounded-xl border border-emerald-500/10 bg-slate-950 text-slate-200 shadow-inner space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <strong className="text-[10px] text-blue-400 font-black tracking-wider uppercase truncate max-w-36">{printingCandidate.organizationName}</strong>
                <span className="text-[9px] uppercase tracking-widest font-mono text-emerald-500 font-extrabold">VERIFIED</span>
              </div>

              <div className="flex gap-3">
                <div className="w-16 h-18 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex-shrink-0">
                  <img src={printingCandidate.candidatePhoto} alt="Candid user ID" className="w-full h-full object-cover" />
                </div>
                <div className="space-y-1 my-auto">
                  <h4 className="text-xs font-black tracking-tight">{printingCandidate.candidateName}</h4>
                  <p className="text-[9px] text-slate-400">{printingCandidate.fatherName} (Father)</p>
                  <p className="text-[9px] text-slate-400">DOB: {printingCandidate.dob}</p>
                  <p className="text-[9px] font-mono font-bold text-emerald-400">ID: {printingCandidate.id}</p>
                </div>
              </div>
            </div>

            {/* Back of ID Card */}
            <div className="pt-2">
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 text-slate-200 shadow-inner flex gap-3">
                <div className="flex-shrink-0 flex flex-col items-center">
                  <div className="text-[5px] font-extrabold uppercase text-emerald-400 max-w-[64px] truncate text-center mb-0.5" title="Business Employment in support of Technical Company">
                    B.E.S.T. Company
                  </div>
                  <div className="w-16 h-16 bg-white p-1 rounded-lg border border-emerald-500/30">
                    <img src={printQrUrl} alt="QR verified scanner" className="w-full h-full" />
                  </div>
                  <div className="text-[5px] font-extrabold text-slate-300 mt-0.5 text-center tracking-wider">
                    6266055353
                  </div>
                </div>
                <div className="text-[9px] text-slate-400 space-y-0.5 my-auto flex-1">
                  <p className="font-medium text-[8px] text-slate-500 font-mono tracking-tight">DYNAMIC SCANNABLE PROFILE</p>
                  <p><strong>Candidate:</strong> +91 {printingCandidate.candidateContact}</p>
                  <p><strong>Emergency:</strong> +91 {printingCandidate.emergencyContact}</p>
                  <p className="text-[8px] italic truncate max-w-44 mt-1 text-emerald-400">Security: Verified Registry</p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex gap-2.5">
              <button 
                onClick={() => window.print()}
                className="flex-1 py-1.5 bg-gradient-to-r from-emerald-600 via-blue-600 to-yellow-500 hover:from-emerald-700 hover:via-blue-700 hover:to-yellow-600 text-white font-bold rounded-lg text-xs cursor-pointer"
              >
                Print Badge Front-Back
              </button>
              <button 
                onClick={() => setPrintingCandidate(null)}
                className="py-1.5 px-4 bg-slate-650 hover:bg-slate-700 text-white rounded-lg text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: EMAIL NOTIFICATION COMPOSER */}
      {notifiedCandidate && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className={`p-6 md:p-8 rounded-2xl max-w-2xl w-full border ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-100 text-slate-800'} shadow-2xl`}>
            
            {/* Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-805 mb-5">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl">
                <Mail className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight">Accreditation Notification System</h3>
                <p className="text-xs text-slate-400 font-medium">Send official verification credentials to the candidate</p>
              </div>
            </div>

            {/* Candidate Details */}
            <div className={`p-4 rounded-xl mb-5 text-xs ${darkMode ? 'bg-slate-800/50 text-slate-300' : 'bg-slate-50 text-slate-705'} border dark:border-slate-800`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
                <p><strong>Candidate Name:</strong> {notifiedCandidate.candidateName}</p>
                <p><strong>Registration ID:</strong> {notifiedCandidate.id}</p>
                <p><strong>Organization:</strong> {notifiedCandidate.organizationName}</p>
                <p><strong>Current Status:</strong> <span className={`font-black uppercase text-[10px] px-2 py-0.5 rounded ${notifiedCandidate.status === 'verified' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>{notifiedCandidate.status}</span></p>
              </div>

              {/* Handle Inline Email Editing if missing or to change */}
              <div className="mt-3.5 pt-3 border-t dark:border-slate-800">
                <label className="block text-[10px] uppercase font-bold tracking-wide text-slate-400 mb-1.5">Recipient Email Address</label>
                <div className="flex gap-2">
                  <input 
                    type="email" 
                    value={notifiedCandidate.candidateEmail || ''}
                    onChange={async (e) => {
                      const newEmail = e.target.value;
                      // Update active target candidate state
                      setNotifiedCandidate(prev => prev ? { ...prev, candidateEmail: newEmail } : null);
                      // Update overall candidates list store
                      setCandidates(prev => prev.map(c => c.id === notifiedCandidate.id ? { ...c, candidateEmail: newEmail } : c));
                      // Save directly to Firestore
                      try {
                        await updateDoc(doc(db, 'candidates', notifiedCandidate.id), { candidateEmail: newEmail });
                      } catch (err) {
                        console.warn('Failed saving email value to db:', err);
                      }
                    }}
                    placeholder="Provide candidate email to enable dispatch..."
                    className={`flex-1 p-2 text-xs rounded-lg border outline-none ${darkMode ? 'bg-slate-850 border-slate-700 text-white' : 'bg-white border-slate-200 focus:border-indigo-500'}`}
                  />
                  {!notifiedCandidate.candidateEmail && (
                    <span className="text-[10px] text-amber-505 font-bold self-center">⚠️ Email Required</span>
                  )}
                </div>
              </div>
            </div>

            {/* Email Form Fields */}
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-black tracking-wider text-slate-400 mb-1 block">Subject Line</label>
                <input 
                  type="text" 
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  disabled={!notifiedCandidate.candidateEmail}
                  className={`w-full p-2.5 text-xs rounded-lg border outline-none ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'} focus:ring-1 focus:ring-indigo-500`}
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-black tracking-wider text-slate-400 mb-1 block">Custom Template Body (Plain Text)</label>
                <textarea 
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  disabled={!notifiedCandidate.candidateEmail}
                  rows={8}
                  className={`w-full p-2.5 font-mono text-xs rounded-lg border outline-none ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'} focus:ring-1 focus:ring-indigo-500`}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 pt-4 border-t border-slate-205 dark:border-slate-800 flex flex-col sm:flex-row gap-2.5 sm:justify-end">
              <button 
                type="button" 
                onClick={() => setNotifiedCandidate(null)}
                className={`py-2 px-4 rounded-xl text-xs font-bold ${darkMode ? 'bg-slate-850 hover:bg-slate-755 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'} transition-all`}
              >
                Cancel
              </button>
              
              <button 
                type="button" 
                onClick={handleSendNotificationEmail}
                disabled={!notifiedCandidate.candidateEmail || isSendingEmail}
                className="flex items-center justify-center gap-2 py-2 px-5 bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-700 hover:to-indigo-755 disabled:from-slate-700 disabled:to-slate-800 text-white font-bold rounded-xl text-xs shadow-md transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSendingEmail ? (
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Preparing Draft...
                  </span>
                ) : (
                  <>
                    <Mail className="w-3.5 h-3.5" />
                    Launch System Mail Draft
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 3: PRINT ALL FILTERED PROFILES GRID FOR A4 */}
      {isPrintingAll && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 overflow-hidden flex flex-col print:relative print:z-0 print:bg-white print:overflow-visible">
          
          {/* Print Preview Header Bar - Hidden during actual print */}
          <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800 flex-shrink-0 text-slate-100 print:hidden">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black tracking-tight flex items-center gap-1.5">
                  Registry Printable Summary Layout <span className="text-xs bg-slate-800 text-slate-300 font-normal px-2 py-0.5 rounded-full font-mono">A4 Portrait Grid</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Total filtered candidate sheets: <span className="font-bold text-white">{filteredCandidates.length} profiles</span> matching current selection
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-600 via-blue-600 to-yellow-500 hover:from-emerald-700 hover:via-blue-700 hover:to-yellow-600 text-white font-black rounded-xl text-xs transition-all shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Trigger A4 Print / Save PDF
              </button>
              <button 
                onClick={() => setIsPrintingAll(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-755 cursor-pointer"
              >
                Exit Print Preview
              </button>
            </div>
          </div>

          {/* Scrollable Desk holding simulated A4 sheets */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-900/40 print:bg-white print:p-0 print:overflow-visible flex flex-col items-center">
            
            {/* The Print Layout Area */}
            <div 
              id="print-all-area" 
              className="w-full max-w-[210mm] bg-white text-slate-900 p-[10mm] shadow-2xl relative select-none flex flex-col gap-6 print:shadow-none print:p-0 print:m-0"
            >
              {/* Document Header block */}
              <div className="border-b-4 border-slate-900 pb-4 flex justify-between items-end">
                <div>
                  <h1 className="text-lg md:text-xl font-black uppercase tracking-tight text-slate-900">
                    Candidate Verification Registry Index
                  </h1>
                  <p className="text-[10px] sm:text-xs text-slate-500 font-bold tracking-wide">
                    OFFICIAL DIRECTORY REPORT  |  CENTRAL REGISTRY CONSOLE
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase">
                    Generated Date:
                  </div>
                  <div className="text-slate-850 font-mono text-[11px] sm:text-xs font-black">
                    {new Date().toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Filtering metadata summary block */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs font-medium">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-[10px] uppercase tracking-wider text-slate-400">Status Selection:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                    statusFilter === 'all' ? 'bg-slate-200 text-slate-850' :
                    statusFilter === 'verified' ? 'bg-emerald-100 text-emerald-800' :
                    'bg-amber-100 text-amber-800'
                  }`}>
                    {statusFilter === 'all' ? 'All' : statusFilter}
                  </span>
                </div>
                
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-[10px] uppercase tracking-wider text-slate-400">Organization:</span>
                  <span className="font-bold text-slate-800 uppercase">{orgFilter === 'all' ? 'All Organizations' : orgFilter}</span>
                </div>

                {searchTerm && (
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-[10px] uppercase tracking-wider text-slate-400">Query:</span>
                    <span className="font-bold text-rose-600">"{searchTerm}"</span>
                  </div>
                )}

                <div className="text-right text-slate-500 font-bold">
                  Total Matches: <span className="text-slate-950 font-black font-mono bg-slate-200/50 px-2 py-0.5 rounded">{filteredCandidates.length} Records</span>
                </div>
              </div>

              {/* Candidates Grid */}
              {filteredCandidates.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-medium my-8">
                  No filtered candidate profile found matching the search criteria.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2">
                  {filteredCandidates.map((cand, idx) => (
                    <div 
                      key={cand.id} 
                      className="print-card-item border border-slate-250 rounded-xl p-4 flex flex-col justify-between h-[210px] relative overflow-hidden bg-white shadow-sm"
                    >
                      {/* Card inner top ribbon */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                        <span className="text-[10px] font-black uppercase text-blue-600 truncate max-w-[170px]" title={cand.organizationName}>
                          {cand.organizationName}
                        </span>
                        <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded font-mono ${
                          cand.status === 'verified' ? 'bg-emerald-100 text-emerald-800' :
                          cand.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                          'bg-rose-100 text-rose-800'
                        }`}>
                          {cand.status.toUpperCase()}
                        </span>
                      </div>

                      {/* Card contents info */}
                      <div className="flex gap-4 items-start flex-1 min-w-0">
                        {/* Profile photo and QR */}
                        <div className="flex flex-col gap-2 items-center flex-shrink-0">
                          <div className="w-16 h-18 bg-slate-50 border border-slate-200 rounded-lg overflow-hidden relative shadow-inner flex-shrink-0">
                            {cand.candidatePhoto ? (
                              <img src={cand.candidatePhoto} alt={cand.candidateName} className="w-full h-full object-cover animate-fade-in" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[8px] text-slate-400">No Photo</div>
                            )}
                          </div>
                          <PrintAllQRImage candidate={cand} />
                        </div>

                        {/* Text fields list */}
                        <div className="flex-1 min-w-0 space-y-1 text-left">
                          <h4 className="text-xs font-black tracking-tight text-slate-900 uppercase truncate pb-0.5 border-b border-slate-105" title={cand.candidateName}>
                            {cand.candidateName}
                          </h4>
                          
                          <div className="text-[10px] text-slate-600 space-y-0.5">
                            <p className="truncate"><strong className="text-slate-400 font-bold uppercase text-[8px] tracking-wider">Father:</strong> {cand.fatherName}</p>
                            <p><strong className="text-slate-400 font-bold uppercase text-[8px] tracking-wider">Contact:</strong> +91 {cand.candidateContact || 'N/A'}</p>
                            <p><strong className="text-slate-400 font-bold uppercase text-[8px] tracking-wider">DOB:</strong> {cand.dob}</p>
                            <p className="truncate"><strong className="text-slate-400 font-bold uppercase text-[8px] tracking-wider">Gov ID:</strong> {cand.aadhaarNumber}</p>
                            <p className="text-[9px] font-mono font-black text-slate-500 truncate pt-0.5 border-t border-slate-50">REG: {cand.id}</p>
                          </div>
                        </div>
                      </div>

                      {/* Card footer details line */}
                      <div className="flex items-center justify-between border-t border-slate-100 pt-2 mt-2 text-[9px] text-slate-400 font-mono">
                        <span>Record Order: #{idx + 1}</span>
                        {cand.scanCount !== undefined && (
                          <span>Scans Count: {cand.scanCount}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Document footer running line info */}
              <div className="mt-8 border-t-2 border-slate-200 pt-3 flex justify-between items-center text-[9px] text-slate-400 font-medium">
                <span>PORTAL SYSTEM INTEGRITY ACQUISITION DOCUMENT</span>
                <span>Page 1 of {Math.ceil(filteredCandidates.length / 6) || 1}</span>
              </div>
            </div>

          </div>

          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              html, body {
                background: white !important;
                color: black !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              body * {
                visibility: hidden !important;
              }
              #print-all-area, #print-all-area * {
                visibility: visible !important;
              }
              #print-all-area {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                height: auto !important;
                background: white !important;
                color: black !important;
                box-shadow: none !important;
                padding: 0 !important;
                margin: 0 !important;
              }
              .print-card-item {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                border-color: #cbd5e1 !important;
              }
              @page {
                size: A4 portrait;
                margin: 10mm 10mm 10mm 10mm;
              }
            }
          `}} />
        </div>
      )}

    </div>
  );
}
