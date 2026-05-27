/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { Candidate, Language } from '../types';

// 1. Image compression helper using HTML Canvas
export function compressImage(base64Str: string, maxWidth = 300, maxByteSize = 120000): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Maintain aspect ratio
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str); // Fallback if context fails
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Perform binary search to find quality that matches maxByteSize constraint
      let quality = 0.85;
      let result = canvas.toDataURL('image/jpeg', quality);
      
      while (result.length > maxByteSize * 1.33 && quality > 0.3) {
        quality -= 0.1;
        result = canvas.toDataURL('image/jpeg', quality);
      }

      resolve(result);
    };
    img.onerror = (err) => {
      reject(err);
    };
  });
}

// 2. Generate Candidate Registration ID
export function generateCandidateId(organization: string): string {
  // Normalize Org initials
  const cleanOrg = organization
    .replace(/[^\w\s]/gi, '')
    .split(/\s+/)
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .substring(0, 3) || 'ORG';

  const years = new Date().getFullYear();
  const randomSerial = Math.floor(1000 + Math.random() * 9000); // 4 digit serial
  return `${cleanOrg}-${years}-${randomSerial}`;
}

// 3. Generate QR Code Data URL
export async function generateQRCode(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      margin: 1,
      width: 250,
      color: {
        dark: '#1e293b', // Deep slate primary
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.error('QR code generation failed:', err);
    return '';
  }
}

// 4. Validate Aadhaar Card Number (12 numeric digits)
export function validateAadhaar(aadhaar: string): boolean {
  const clean = aadhaar.replace(/\D/g, '');
  return clean.length === 12;
}

// 5. Validate Indian Contact Number
export function validateContact(phone: string): boolean {
  const clean = phone.replace(/\D/g, '');
  // Standard Indian contacts are 10 digits
  return clean.length === 10;
}

// 6. Multilingual Dictionary
export const translations = {
  en: {
    // Nav & General
    appTitle: 'Digital ID Verification System',
    register: 'Candidate Registration',
    verifyProfile: 'Digital Verification Profile',
    adminPanel: 'Admin Dashboard',
    dark: 'Dark',
    light: 'Light',
    language: 'हिन्दी',
    
    // Form fields
    organizationName: 'Organization / Company Name',
    candidateName: "Candidate's Full Name",
    dob: 'Date of Birth',
    fatherName: "Father's Name",
    fullAddress: 'Permanent Full Address',
    candidateContact: 'Candidate Mobile Number (10 digits)',
    candidateEmail: 'Candidate Email Address (Optional)',
    fatherContact: 'Father Contact Number',
    policeStationContact: 'Local Police Station Contact',
    emergencyContact: 'Emergency Contact Number',
    emergencyWhatsApp: 'Emergency WhatsApp Number',
    friendContact: 'Friend Contact Number',
    relativeContact: 'Relative Contact Number',
    aadhaarNumber: 'Aadhaar Card Number (12 digits)',
    candidatePhoto: 'Candidate Photo Upload / Camera',
    aadhaarFront: 'Aadhaar Front Card Image',
    aadhaarBack: 'Aadhaar Back Card Image',
    
    // Buttons & Prompts
    submit: 'Register Candidate',
    submitting: 'Processing submission...',
    photoInstructions: 'Upload or capture candidate profile picture',
    cameraCapture: 'Capture from Camera',
    stopCamera: 'Stop Camera',
    takeSnapshot: 'Take Photo',
    uploadFile: 'Upload File',
    dragAndDrop: 'Drag & drop image, or click to browse',
    locationCaptured: 'GPS Location Captured Successfully',
    gpsOptional: 'Enabling GPS location (highly recommended)',
    
    // Verification Screen
    verifiedCandidate: 'VERIFIED DIGITAL IDENTITY',
    activeQR: 'ACTIVE ID CARD',
    inactiveQR: 'INACTIVE / REVOKED ID CARD',
    verificationStatus: 'Verification Status',
    regDate: 'Registration Date',
    verifiedOn: 'Verified On',
    directContact: 'Quick Contact Directory',
    whatsappQuickMsg: 'WhatsApp Instant Message',
    callContact: 'Call Mobile Number',
    downloadPdf: 'Download Official PDF',
    downloadQr: 'Download QR Image',
    scanCountLabel: 'Verification Scans',
    openCandidateRecord: 'Open Saved File',
    verifiedBadge: 'Verified Securely',
    
    // PDF terms & Footer
    certifyTitle: 'DIGITAL IDENTITY CARD & PROFILE',
    issuedBy: 'ISSUED BY',
    signatureArea: 'Authorized Signature',
    digitalVerificationSystem: 'Digital Smart ID Platform - Secure Profile Document',
    
    // Success Messages
    successTitle: 'Registration Successful!',
    successDesc: 'The candidate profile was saved successfully, and a unique ID has been allocated.',
    candidateIdAllocated: 'Candidate ID:',
    pdfDownloadedText: 'PDF registration card downloaded successfully!',
    whatsappSendPrompt: 'Verify or Resend WhatsApp message',
    whatsappInstructions: 'Click below to dispatch the digital credentials, profile PDF link, and QR Code directly on WhatsApp.'
  },
  hi: {
    // Nav & General
    appTitle: 'डिजिटल आईडी सत्यापन प्रणाली',
    register: 'उम्मीदवार पंजीकरण',
    verifyProfile: 'डिजिटल सत्यापन प्रोफ़ाइल',
    adminPanel: 'एडमिन डैशबोर्ड',
    dark: 'डार्क मोड',
    light: 'लाइट मोड',
    language: 'English',
    
    // Form fields
    organizationName: 'संस्था / कंपनी का नाम',
    candidateName: 'उम्मीदवार का पूरा नाम',
    dob: 'जन्म तिथि (DOB)',
    fatherName: 'पिता का नाम',
    fullAddress: 'स्थायी पूरा पता',
    candidateContact: 'उम्मीदवार का मोबाइल नंबर (10 अंक)',
    candidateEmail: 'उम्मीदवार का ईमेल पता (वैकल्पिक)',
    fatherContact: 'पिता का संपर्क सूत्र',
    policeStationContact: 'स्थानीय पुलिस स्टेशन संपर्क',
    emergencyContact: 'आपातकालीन संपर्क नंबर',
    emergencyWhatsApp: 'आपातकालीन व्हाट्सएप नंबर',
    friendContact: 'मित्र का संपर्क नंबर',
    relativeContact: 'रिश्तेदार का संपर्क नंबर',
    aadhaarNumber: 'आधार कार्ड नंबर (12 अंक)',
    candidatePhoto: 'उम्मीदवार का फोटो / कैमरा कैप्चर',
    aadhaarFront: 'आधार कार्ड फ्रंट इमेज',
    aadhaarBack: 'आधार कार्ड बैक इमेज',
    
    // Buttons & Prompts
    submit: 'उम्मीदवार पंजीकरण करें',
    submitting: 'सत्यापन हो रहा है...',
    photoInstructions: 'उम्मीदवार की प्रोफ़ाइल स्थिति अपलोड करें या कैमरा चालू करें',
    cameraCapture: 'कैमरा से कैप्चर करें',
    stopCamera: 'कैमरा बंद करें',
    takeSnapshot: 'फ़ोटो खींचें',
    uploadFile: 'फ़ाइल अपलोड करें',
    dragAndDrop: 'छवि खींचें और डंप करें, या ब्राउज़ करें',
    locationCaptured: 'जीपीएस लोकेशन सफलतापूर्वक प्राप्त हुई',
    gpsOptional: 'जीपीएस लोकेशन सक्रिय करना (सिफारिश की जाती है)',
    
    // Verification Screen
    verifiedCandidate: 'सत्यापित डिजिटल पहचान',
    activeQR: 'सक्रिय आईडी कार्ड',
    inactiveQR: 'निष्क्रिय / निरस्त आईडी कार्ड',
    verificationStatus: 'सत्यापन स्थिति',
    regDate: 'पंजीकरण तिथि',
    verifiedOn: 'सत्यापन तिथि',
    directContact: 'त्वरित संपर्क निर्देशिका',
    whatsappQuickMsg: 'व्हाट्सएप त्वरित संदेश',
    callContact: 'सीधे कॉल करें',
    downloadPdf: 'आधिकारिक पीडीएफ डाउनलोड करें',
    downloadQr: 'क्यूआर छवि डाउनलोड करें',
    scanCountLabel: 'सत्यापन स्कैन संख्या',
    openCandidateRecord: 'सुरक्षित प्रोफ़ाइल फ़ाइल',
    verifiedBadge: 'पूरी तरह सत्यापित',
    
    // PDF terms & Footer
    certifyTitle: 'डिजिटल पहचान पत्र एवं प्रोफ़ाइल',
    issuedBy: 'द्वारा जारी',
    signatureArea: 'प्राधिकृत हस्ताक्षर',
    digitalVerificationSystem: 'डिजिटल स्मार्ट आईडी प्लेटफॉर्म - सुरक्षित प्रोफ़ाइल दस्तावेज',
    
    // Success Messages
    successTitle: 'पंजीकरण सफल रहा!',
    successDesc: 'उम्मीदवार का व्यक्तिगत विवरण और आईडी सफलतापूर्वक सहेज लिया गया है।',
    candidateIdAllocated: 'उम्मीदवार आईडी:',
    pdfDownloadedText: 'पंजीकरण पीडीएफ डाउनलोड कर ली गई है!',
    whatsappSendPrompt: 'व्हाट्सएप संदेश भेजें या पुनः भेजें',
    whatsappInstructions: 'डिजिटल क्रेडेंशियल, पीडीएफ लिंक और क्यूआर कार्ड को व्हाट्सएप पर भेजने के लिए नीचे बटन पर क्लिक करें।'
  }
};

// 7. PDF Exporter
export function generatePDFDoc(candidate: Candidate, qrDataUrl: string) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryCol = '#0f172a'; // Deep slate
  const borderCol = '#cbd5e1';  // Light slate border

  // Beautiful outer border
  doc.setDrawColor(15, 23, 42); // Navy border color
  doc.setLineWidth(1);
  doc.rect(5, 5, 200, 287); // Page margin outline
  
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.rect(8, 8, 194, 281); // Inner border line

  // Elegant Title Block Header
  doc.setFillColor(15, 23, 42); 
  doc.rect(8, 8, 194, 25, 'F'); // Solid Header background

  doc.setTextColor('#ffffff');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(candidate.organizationName.toUpperCase(), 105, 17, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('Helvetica', 'normal');
  doc.text('OFFICIAL SMART ID IDENTITY FILE & VERIFICATION INDEX', 105, 24, { align: 'center' });

  // Add Candidate Photo
  if (candidate.candidatePhoto) {
    try {
      doc.addImage(candidate.candidatePhoto, 'JPEG', 15, 42, 45, 50);
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.5);
      doc.rect(15, 42, 45, 50); // Photo Frame Border
    } catch (e) {
      console.warn('Error rendering image in PDF', e);
    }
  }

  // Profile Details Blocks
  doc.setTextColor('#0f172a');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(candidate.candidateName, 70, 48);
  
  doc.setFontSize(10);
  doc.setTextColor('#475569');
  doc.setFont('Helvetica', 'normal');
  doc.text(`ID Reference: ${candidate.id}`, 70, 54);
  doc.text(`Aadhaar: XXXX-XXXX-${candidate.aadhaarNumber.substring(8)} (Masked)`, 70, 60);
  doc.text(`DOB (Age Ref): ${candidate.dob}`, 70, 66);
  doc.text(`Father Name: ${candidate.fatherName}`, 70, 72);
  
  const statusUpper = candidate.status.toUpperCase();
  doc.setFont('Helvetica', 'bold');
  if (candidate.status === 'verified') {
    doc.setTextColor('#16a34a'); // Green
  } else if (candidate.status === 'pending') {
    doc.setTextColor('#ca8a04'); // Yellow
  } else {
    doc.setTextColor('#dc2626'); // Red
  }
  doc.text(`STATUS: ${statusUpper}`, 70, 78);

  // Divider Line
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(15, 98, 195, 98);

  // Main Info Grid
  doc.setTextColor('#0f172a');
  doc.setFontSize(12);
  doc.setFont('Helvetica', 'bold');
  doc.text('PRIMARY CONTACTS & INFORMATION DIRECTORY', 15, 106);

  doc.setFontSize(9.5);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor('#334155');

  const leftX = 15;
  const rightX = 110;
  
  // Left Column Details
  let currentY = 116;
  doc.text(`Candidate Contact: +91 ${candidate.candidateContact}`, leftX, currentY);
  currentY += 8;
  doc.text(`Father Contact: +91 ${candidate.fatherContact}`, leftX, currentY);
  currentY += 8;
  doc.text(`Emergency Contact: +91 ${candidate.emergencyContact}`, leftX, currentY);
  currentY += 8;
  doc.text(`Emergency WhatsApp: +91 ${candidate.emergencyWhatsApp}`, leftX, currentY);
  currentY += 8;
  doc.text(`Local Police Station: +91 ${candidate.policeStationContact}`, leftX, currentY);
  
  // Right Column Details
  currentY = 116;
  doc.text(`Friend Connection: +91 ${candidate.friendContact}`, rightX, currentY);
  currentY += 8;
  doc.text(`Relative Connection: +91 ${candidate.relativeContact}`, rightX, currentY);
  currentY += 8;
  doc.text(`Registration Time: ${new Date(candidate.createdAt?.seconds ? candidate.createdAt.seconds * 1000 : candidate.createdAt || Date.now()).toLocaleString()}`, rightX, currentY);
  currentY += 8;
  if (candidate.gpsLat && candidate.gpsLng) {
    doc.text(`Verification Coordinates: ${candidate.gpsLat.toFixed(5)}, ${candidate.gpsLng.toFixed(5)}`, rightX, currentY);
  } else {
    doc.text('Verification Coordinates: N/A', rightX, currentY);
  }
  currentY += 8;
  doc.text(`Full Address: ${candidate.fullAddress.substring(0, 50)}...`, rightX, currentY);

  // Address paragraph wrapper
  currentY = 162;
  doc.setFont('Helvetica', 'bold');
  doc.text('Complete Registered Profile Address:', 15, currentY);
  doc.setFont('Helvetica', 'normal');
  const splitAddress = doc.splitTextToSize(candidate.fullAddress, 180);
  doc.text(splitAddress, 15, currentY + 6);

  // Embed QR Code and Verification flow
  const lowerBoxY = 195;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.rect(15, lowerBoxY, 180, 50, 'F'); // Highlight box for QR Code section
  doc.rect(15, lowerBoxY, 180, 50, 'S');

  if (qrDataUrl) {
    try {
      doc.addImage(qrDataUrl, 'PNG', 20, lowerBoxY + 5, 40, 40);
    } catch (e) {
      console.warn('Error placing QR code on PDF', e);
    }
  }

  doc.setFontSize(10.5);
  doc.setTextColor('#0f172a');
  doc.setFont('Helvetica', 'bold');
  doc.text('DYNAMIC QR ACCREDITATION', 65, lowerBoxY + 12);
  doc.setFontSize(8.5);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor('#475569');
  
  const rulesText = [
    '1. Scan this QR code to verify live candidate registration status.',
    '2. Call or WhatsApp contacts are pre-mapped for rapid action.',
    '3. For changes, Admin authorization is mandatory.',
    '4. Secure encryption masking is applied to candidate record details.'
  ];
  doc.text(rulesText, 65, lowerBoxY + 20);

  // Signature and Date area at the very bottom
  const bottomSignY = 262;
  doc.line(15, bottomSignY, 70, bottomSignY);
  doc.line(140, bottomSignY, 195, bottomSignY);
  
  doc.setFontSize(9);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor('#475569');
  doc.text('Candidate Fingerprint / Sign', 42, bottomSignY + 5, { align: 'center' });
  doc.text('Authorizing Registrar Stamp', 167, bottomSignY + 5, { align: 'center' });

  // Web Info Page Footer
  doc.setFillColor(15, 23, 42);
  doc.rect(8, 279, 194, 10, 'F');
  doc.setTextColor('#ffffff');
  doc.setFontSize(8);
  doc.text('Digital Verification Registry System Engine. All rights reserved by authorized registrars.', 105, 285, { align: 'center' });

  // Save/Download 
  doc.save(`ID-CARD-${candidate.id}.pdf`);
}
