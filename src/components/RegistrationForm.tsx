/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, CheckCircle, Navigation, Shield, Image as ImageIcon, MapPin } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { Candidate, Language } from '../types';
import { 
  translations, 
  generateCandidateId, 
  compressImage, 
  validateAadhaar, 
  validateContact,
  generateQRCode,
  generatePDFDoc
} from '../utils/helpers';

interface RegistrationFormProps {
  lang: Language;
  onSuccess: (candidate: Candidate) => void;
  darkMode: boolean;
}

export default function RegistrationForm({ lang, onSuccess, darkMode }: RegistrationFormProps) {
  const t = translations[lang];

  // Form Fields State
  const [form, setForm] = useState({
    organizationName: '',
    candidateName: '',
    dob: '',
    fatherName: '',
    fullAddress: '',
    candidateContact: '',
    candidateEmail: '',
    fatherContact: '',
    policeStationContact: '',
    emergencyContact: '',
    emergencyWhatsApp: '',
    friendContact: '',
    relativeContact: '',
    aadhaarNumber: '',
  });

  const [candidatePhoto, setCandidatePhoto] = useState<string>('');
  const [aadhaarFront, setAadhaarFront] = useState<string>('');
  const [aadhaarBack, setAadhaarBack] = useState<string>('');

  // GPS Ref State
  const [gps, setGps] = useState<{ lat?: number; lng?: number; accuracy?: number; address?: string }>({});
  const [gpsLoading, setGpsLoading] = useState(false);

  // Status State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Camera Modal/Capture states for Candid Photo
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Auto-fetch GPS on component mount
  useEffect(() => {
    requestGPS();
  }, []);

  const requestGPS = () => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          address: 'GPS Verified Location'
        });
        setGpsLoading(false);
      },
      (err) => {
        console.warn('GPS location request blocked', err);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  // Turn on/off Candidate Camera Capture
  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 400, height: 400, facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera access denied:', err);
      alert('Could not open camera. Please ensure permissions are granted.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhotoSnapshot = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 400;
      canvas.height = videoRef.current.videoHeight || 400;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        compressImage(dataUrl).then(compressed => {
          setCandidatePhoto(compressed);
          stopCamera();
        });
      }
    }
  };

  // Convert uploaded image files to base64
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const compressed = await compressImage(base64);
        setter(compressed);
      } catch (err) {
        console.error('Image compression error', err);
        setter(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    // Clear field-specific error as they type
    if (errors[name]) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  // Validate the whole model
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Required check
    if (!form.organizationName.trim()) newErrors.organizationName = 'Organization Name is required';
    if (!form.candidateName.trim()) newErrors.candidateName = 'Candidate Name is required';
    if (!form.dob.trim()) newErrors.dob = 'Date of birth is required';
    if (!form.fatherName.trim()) newErrors.fatherName = "Father's name is required";
    if (!form.fullAddress.trim()) newErrors.fullAddress = 'Address is required';
    
    if (form.candidateEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.candidateEmail.trim())) {
      newErrors.candidateEmail = 'Please provide a valid email format';
    }
    
    // Aadhaar 12-digit validator
    if (!validateAadhaar(form.aadhaarNumber)) {
      newErrors.aadhaarNumber = 'Aadhaar must be exactly 12 numerical digits';
    }

    // Phone checks
    const contacts = [
      { key: 'candidateContact', label: 'Candidate Contact' },
      { key: 'fatherContact', label: 'Father Contact' },
      { key: 'policeStationContact', label: 'Police Station Contact' },
      { key: 'emergencyContact', label: 'Emergency Contact' },
      { key: 'emergencyWhatsApp', label: 'Emergency WhatsApp' },
      { key: 'friendContact', label: 'Friend Contact' },
      { key: 'relativeContact', label: 'Relative Contact' },
    ];

    contacts.forEach(item => {
      const val = form[item.key as keyof typeof form];
      if (!validateContact(val)) {
        newErrors[item.key] = `${item.label} must be exactly 10 digits`;
      }
    });

    // Image uploads verification
    if (!candidatePhoto) newErrors.candidatePhoto = 'Candidate Photo is required';
    if (!aadhaarFront) newErrors.aadhaarFront = 'Aadhaar Front Image is required';
    if (!aadhaarBack) newErrors.aadhaarBack = 'Aadhaar Back Image is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      const firstErrorElement = document.querySelector('.text-red-500');
      firstErrorElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setIsSubmitting(true);
    try {
      const generatedId = generateCandidateId(form.organizationName);
      
      const candidateData: Candidate = {
        id: generatedId,
        organizationName: form.organizationName.trim(),
        candidateName: form.candidateName.trim(),
        dob: form.dob,
        fatherName: form.fatherName.trim(),
        fullAddress: form.fullAddress.trim(),
        candidateContact: form.candidateContact.replace(/\D/g, ''),
        candidateEmail: form.candidateEmail.trim(),
        fatherContact: form.fatherContact.replace(/\D/g, ''),
        policeStationContact: form.policeStationContact.replace(/\D/g, ''),
        emergencyContact: form.emergencyContact.replace(/\D/g, ''),
        emergencyWhatsApp: form.emergencyWhatsApp.replace(/\D/g, ''),
        friendContact: form.friendContact.replace(/\D/g, ''),
        relativeContact: form.relativeContact.replace(/\D/g, ''),
        aadhaarNumber: form.aadhaarNumber.replace(/\D/g, ''),
        candidatePhoto,
        aadhaarFront,
        aadhaarBack,
        status: 'pending',
        createdAt: new Date(),
        gpsLat: gps.lat,
        gpsLng: gps.lng,
        gpsAddress: gps.address,
        scanCount: 0
      };

      // Store in Firebase
      const path = 'candidates';
      try {
        await setDoc(doc(db, path, generatedId), candidateData);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `${path}/${generatedId}`);
      }

      // Trigger callback to parent
      onSuccess(candidateData);
    } catch (err) {
      console.error('Registration failed:', err);
      alert('Registration storage failed. Check Firestore rules or device internet status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`shadow-xl rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-100 text-slate-800'} p-6 md:p-8 max-w-4xl mx-auto transition-colors duration-300`}>
      <div className="flex items-center gap-3 border-b pb-5 mb-6 border-slate-200 dark:border-slate-800">
        <div className="p-3 rounded-xl bg-emerald-600/10 text-emerald-500 border border-emerald-500/20">
          <Shield id="shield-icon" className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">{t.register}</h2>
          <p className="text-sm text-slate-550 dark:text-slate-400">Complete multi-contact secure candidate registry</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Field Group 1: Identity & Profile Details */}
        <div className="space-y-4">
          <h3 className="text-md font-semibold text-emerald-600 dark:text-emerald-400 border-l-4 pl-2 border-emerald-500 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping"></span>
            <span>{lang === 'en' ? 'Employer / Core Identity' : 'नियोक्ता / मूल पहचान विवरण'}</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Org Name */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider mb-1 text-slate-600 dark:text-slate-300">
                {t.organizationName} *
              </label>
              <input 
                type="text" 
                name="organizationName"
                value={form.organizationName}
                onChange={handleInputChange}
                placeholder="e.g. FIA Global Services"
                className={`w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-all ${darkMode ? 'bg-slate-800 border-slate-700 text-white focus:bg-slate-750 focus:ring-2 focus:ring-indigo-500' : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500'} border`}
              />
              {errors.organizationName && <p className="text-red-500 text-xs mt-1">{errors.organizationName}</p>}
            </div>

            {/* Candidate Name */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider mb-1 text-slate-600 dark:text-slate-300">
                {t.candidateName} *
              </label>
              <input 
                type="text" 
                name="candidateName"
                value={form.candidateName}
                onChange={handleInputChange}
                placeholder="e.g. Rahul Sharma"
                className={`w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-all ${darkMode ? 'bg-slate-800 border-slate-700 text-white focus:bg-slate-750 focus:ring-2 focus:ring-indigo-500' : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500'} border`}
              />
              {errors.candidateName && <p className="text-red-500 text-xs mt-1">{errors.candidateName}</p>}
            </div>

            {/* DOB */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider mb-1 text-slate-600 dark:text-slate-300">
                {t.dob} *
              </label>
              <input 
                type="date" 
                name="dob"
                value={form.dob}
                onChange={handleInputChange}
                className={`w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-all ${darkMode ? 'bg-slate-800 border-slate-700 text-white focus:bg-slate-750 focus:ring-2 focus:ring-indigo-500' : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500'} border`}
              />
              {errors.dob && <p className="text-red-500 text-xs mt-1">{errors.dob}</p>}
            </div>

            {/* Father Name */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider mb-1 text-slate-600 dark:text-slate-300">
                {t.fatherName} *
              </label>
              <input 
                type="text" 
                name="fatherName"
                value={form.fatherName}
                onChange={handleInputChange}
                placeholder="e.g. Ramesh Sharma"
                className={`w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-all ${darkMode ? 'bg-slate-800 border-slate-700 text-white focus:bg-slate-750 focus:ring-2 focus:ring-indigo-500' : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500'} border`}
              />
              {errors.fatherName && <p className="text-red-500 text-xs mt-1">{errors.fatherName}</p>}
            </div>

            {/* Aadhaar Number */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium uppercase tracking-wider mb-1 text-slate-600 dark:text-slate-300">
                {t.aadhaarNumber} *
              </label>
              <input 
                type="text" 
                name="aadhaarNumber"
                maxLength={12}
                value={form.aadhaarNumber}
                onChange={handleInputChange}
                placeholder="12 digit Aadhaar identification"
                className={`w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-all ${darkMode ? 'bg-slate-800 border-slate-700 text-white focus:bg-slate-750 focus:ring-2 focus:ring-indigo-500' : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500'} border`}
              />
              {errors.aadhaarNumber && <p className="text-red-500 text-xs mt-1">{errors.aadhaarNumber}</p>}
            </div>

            {/* Address */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium uppercase tracking-wider mb-1 text-slate-600 dark:text-slate-300">
                {t.fullAddress} *
              </label>
              <textarea 
                name="fullAddress"
                rows={3}
                value={form.fullAddress}
                onChange={handleInputChange}
                placeholder="House No, Post, Block, District, Pin Code details..."
                className={`w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-all ${darkMode ? 'bg-slate-800 border-slate-700 text-white focus:bg-slate-750 focus:ring-2 focus:ring-indigo-500' : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500'} border`}
              />
              {errors.fullAddress && <p className="text-red-500 text-xs mt-1">{errors.fullAddress}</p>}
            </div>
          </div>
        </div>

        {/* Field Group 2: Call Actions Contact List */}
        <div className="space-y-4 pt-2">
          <h3 className="text-md font-semibold text-blue-600 dark:text-blue-400 border-l-4 pl-2 border-blue-500">
            {lang === 'en' ? 'Click-To-Contact Fields' : 'त्वरित-संपर्क मोबाइल नंबर (क्लिक-टू-कॉल विशेष)'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Candidate Contact */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider mb-1 text-slate-600 dark:text-slate-300">
                {t.candidateContact} *
              </label>
              <input 
                type="text" 
                name="candidateContact"
                maxLength={10}
                value={form.candidateContact}
                onChange={handleInputChange}
                placeholder="10 digit applicant number"
                className={`w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-all ${darkMode ? 'bg-slate-800 border-slate-700 text-white focus:bg-slate-750 focus:ring-2 focus:ring-indigo-500' : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500'} border`}
              />
              {errors.candidateContact && <p className="text-red-500 text-xs mt-1">{errors.candidateContact}</p>}
            </div>

            {/* Candidate Email */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider mb-1 text-slate-600 dark:text-slate-300">
                {t.candidateEmail}
              </label>
              <input 
                type="email" 
                name="candidateEmail"
                value={form.candidateEmail}
                onChange={handleInputChange}
                placeholder="candidate@example.com"
                className={`w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-all ${darkMode ? 'bg-slate-800 border-slate-700 text-white focus:bg-slate-750 focus:ring-2 focus:ring-indigo-500' : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500'} border`}
              />
              {errors.candidateEmail && <p className="text-red-500 text-xs mt-1">{errors.candidateEmail}</p>}
            </div>

            {/* Father Contact */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider mb-1 text-slate-600 dark:text-slate-300">
                {t.fatherContact} *
              </label>
              <input 
                type="text" 
                name="fatherContact"
                maxLength={10}
                value={form.fatherContact}
                onChange={handleInputChange}
                placeholder="Parents mobile number"
                className={`w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-all ${darkMode ? 'bg-slate-800 border-slate-700 text-white focus:bg-slate-750 focus:ring-2 focus:ring-indigo-500' : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500'} border`}
              />
              {errors.fatherContact && <p className="text-red-500 text-xs mt-1">{errors.fatherContact}</p>}
            </div>

            {/* Police Station Contact */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider mb-1 text-slate-600 dark:text-slate-300">
                {t.policeStationContact} *
              </label>
              <input 
                type="text" 
                name="policeStationContact"
                maxLength={10}
                value={form.policeStationContact}
                onChange={handleInputChange}
                placeholder="Regional police authorities"
                className={`w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-all ${darkMode ? 'bg-slate-800 border-slate-700 text-white focus:bg-slate-750 focus:ring-2 focus:ring-indigo-500' : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500'} border`}
              />
              {errors.policeStationContact && <p className="text-red-500 text-xs mt-1">{errors.policeStationContact}</p>}
            </div>

            {/* Emergency Contact */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider mb-1 text-slate-600 dark:text-slate-300">
                {t.emergencyContact} *
              </label>
              <input 
                type="text" 
                name="emergencyContact"
                maxLength={10}
                value={form.emergencyContact}
                onChange={handleInputChange}
                placeholder="SOS Contact"
                className={`w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-all ${darkMode ? 'bg-slate-800 border-slate-700 text-white focus:bg-slate-750 focus:ring-2 focus:ring-indigo-500' : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500'} border`}
              />
              {errors.emergencyContact && <p className="text-red-500 text-xs mt-1">{errors.emergencyContact}</p>}
            </div>

            {/* Emergency WhatsApp */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider mb-1 text-slate-600 dark:text-slate-300">
                {t.emergencyWhatsApp} *
              </label>
              <input 
                type="text" 
                name="emergencyWhatsApp"
                maxLength={10}
                value={form.emergencyWhatsApp}
                onChange={handleInputChange}
                placeholder="Active WhatsApp dispatch number"
                className={`w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-all ${darkMode ? 'bg-slate-800 border-slate-700 text-white focus:bg-slate-750 focus:ring-2 focus:ring-indigo-500' : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500'} border`}
              />
              {errors.emergencyWhatsApp && <p className="text-red-500 text-xs mt-1">{errors.emergencyWhatsApp}</p>}
            </div>

            {/* Friend Contact */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider mb-1 text-slate-600 dark:text-slate-300">
                {t.friendContact} *
              </label>
              <input 
                type="text" 
                name="friendContact"
                maxLength={10}
                value={form.friendContact}
                onChange={handleInputChange}
                placeholder="Colleague/Friend reference"
                className={`w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-all ${darkMode ? 'bg-slate-800 border-slate-700 text-white focus:bg-slate-750 focus:ring-2 focus:ring-indigo-500' : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500'} border`}
              />
              {errors.friendContact && <p className="text-red-500 text-xs mt-1">{errors.friendContact}</p>}
            </div>

            {/* Relative Contact */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium uppercase tracking-wider mb-1 text-slate-600 dark:text-slate-300">
                {t.relativeContact} *
              </label>
              <input 
                type="text" 
                name="relativeContact"
                maxLength={10}
                value={form.relativeContact}
                onChange={handleInputChange}
                placeholder="Kin reference contact"
                className={`w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-all ${darkMode ? 'bg-slate-800 border-slate-700 text-white focus:bg-slate-750 focus:ring-2 focus:ring-indigo-500' : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500'} border`}
              />
              {errors.relativeContact && <p className="text-red-500 text-xs mt-1">{errors.relativeContact}</p>}
            </div>
          </div>
        </div>

        {/* Field Group 3: Image Uploads & Capture Verification */}
        <div className="space-y-4 pt-2">
          <h3 className="text-md font-semibold text-emerald-600 dark:text-emerald-400 border-l-4 pl-2 border-yellow-400 flex items-center justify-between">
            <span>{lang === 'en' ? 'Biometric & Document Verifications' : 'बायोमेट्रिक और दस्तावेज़ सत्यापन'}</span>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 tracking-widest font-bold border border-yellow-500/20">Base64 Compressed</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Candidate Photo Block */}
            <div className="flex flex-col space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-slate-600 dark:text-slate-300">
                {t.candidatePhoto} *
              </label>

              {candidatePhoto ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 aspect-square">
                  <img src={candidatePhoto} alt="Candidate Profile" className="w-full h-full object-cover" />
                  <button 
                    type="button"
                    onClick={() => setCandidatePhoto('')}
                    className="absolute bottom-2 right-2 bg-red-600 hover:bg-red-700 text-white text-xs font-medium py-1 px-2.5 rounded-lg transition-all shadow-md"
                  >
                    Clear Photo
                  </button>
                </div>
              ) : isCameraActive ? (
                <div className="relative rounded-xl overflow-hidden aspect-square border border-slate-200 dark:border-slate-700 bg-black">
                  <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]"></video>
                  <div className="absolute bottom-2 inset-x-0 mx-auto w-fit flex gap-2">
                    <button 
                      type="button"
                      onClick={capturePhotoSnapshot}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-md transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      {t.takeSnapshot}
                    </button>
                    <button 
                      type="button"
                      onClick={stopCamera}
                      className="bg-slate-700 hover:bg-slate-800 text-white text-xs font-normal px-2.5 py-1.5 rounded-lg transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl aspect-square flex flex-col items-center justify-center p-4 text-center bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100/50 dark:hover:bg-slate-850 transition-all">
                  <ImageIcon className="w-8 h-8 text-slate-400 mb-2" />
                  <p className="text-[11px] font-medium text-slate-500 mb-2">{t.dragAndDrop}</p>
                  
                  <div className="flex flex-col gap-1 w-full max-w-44 px-2">
                    <label className="cursor-pointer bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-xs font-semibold py-1.5 px-3 rounded-lg text-center transition-all shadow-sm">
                      <input 
                        type="file" 
                        accept="image/*"
                        className="hidden" 
                        onChange={(e) => handleImageUpload(e, setCandidatePhoto)}
                      />
                      {t.uploadFile}
                    </label>
                    
                    <button 
                      type="button"
                      onClick={startCamera}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-1.5 px-3 rounded-lg transition-all shadow-sm flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      {t.cameraCapture}
                    </button>
                  </div>
                </div>
              )}
              {errors.candidatePhoto && <p className="text-red-500 text-xs text-center">{errors.candidatePhoto}</p>}
            </div>

            {/* Aadhaar Front Block */}
            <div className="flex flex-col space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-slate-600 dark:text-slate-300">
                {t.aadhaarFront} *
              </label>

              {aadhaarFront ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 aspect-square">
                  <img src={aadhaarFront} alt="Aadhaar Front" className="w-full h-full object-cover" />
                  <button 
                    type="button"
                    onClick={() => setAadhaarFront('')}
                    className="absolute bottom-2 right-2 bg-red-600 hover:bg-red-700 text-white text-xs font-medium py-1 px-2.5 rounded-lg transition-all shadow-md"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl aspect-square flex flex-col items-center justify-center p-4 text-center bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100/50 dark:hover:bg-slate-850 transition-all">
                  <Upload className="w-8 h-8 text-slate-400 mb-2" />
                  <p className="text-[11px] font-medium text-slate-500 mb-2">{t.dragAndDrop}</p>
                  <label className="cursor-pointer bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-xs font-semibold py-1.5 px-3 rounded-lg text-center transition-all shadow-sm">
                    <input 
                      type="file" 
                      accept="image/*"
                      className="hidden" 
                      onChange={(e) => handleImageUpload(e, setAadhaarFront)}
                    />
                    {t.uploadFile}
                  </label>
                </div>
              )}
              {errors.aadhaarFront && <p className="text-red-500 text-xs text-center">{errors.aadhaarFront}</p>}
            </div>

            {/* Aadhaar Back Block */}
            <div className="flex flex-col space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-slate-600 dark:text-slate-300">
                {t.aadhaarBack} *
              </label>

              {aadhaarBack ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 aspect-square">
                  <img src={aadhaarBack} alt="Aadhaar Back" className="w-full h-full object-cover" />
                  <button 
                    type="button"
                    onClick={() => setAadhaarBack('')}
                    className="absolute bottom-2 right-2 bg-red-600 hover:bg-red-700 text-white text-xs font-medium py-1 px-2.5 rounded-lg transition-all shadow-md"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl aspect-square flex flex-col items-center justify-center p-4 text-center bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100/50 dark:hover:bg-slate-850 transition-all">
                  <Upload className="w-8 h-8 text-slate-400 mb-2" />
                  <p className="text-[11px] font-medium text-slate-500 mb-2">{t.dragAndDrop}</p>
                  <label className="cursor-pointer bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-xs font-semibold py-1.5 px-3 rounded-lg text-center transition-all shadow-sm">
                    <input 
                      type="file" 
                      accept="image/*"
                      className="hidden" 
                      onChange={(e) => handleImageUpload(e, setAadhaarBack)}
                    />
                    {t.uploadFile}
                  </label>
                </div>
              )}
              {errors.aadhaarBack && <p className="text-red-500 text-xs text-center">{errors.aadhaarBack}</p>}
            </div>

          </div>
        </div>

        {/* GPS location notification indicator */}
        <div className={`p-4 rounded-xl flex items-center justify-between border ${gps.lat ? (darkMode ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300' : 'bg-emerald-50 border-emerald-100 text-emerald-800') : (darkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500')}`}>
          <div className="flex items-center gap-3">
            <MapPin className={`w-5 h-5 ${gps.lat ? 'text-yellow-500 animate-bounce' : 'text-slate-400'}`} />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider">{gps.lat ? t.locationCaptured : 'GPS Coordinates Inactive'}</p>
              <p className="text-xs mt-0.5 font-normal">
                {gps.lat ? `Verified: Lat: ${gps.lat.toFixed(5)}, Lng: ${gps.lng?.toFixed(5)}` : t.gpsOptional}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={requestGPS}
            disabled={gpsLoading}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-850 dark:text-emerald-400 px-3 py-1.5 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg shadow-sm cursor-pointer"
          >
            {gpsLoading ? 'Locating...' : 'Refresh GPS'}
          </button>
        </div>

        {/* Submit Buttons */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full md:w-auto bg-gradient-to-r from-emerald-600 via-blue-600 to-yellow-500 hover:from-emerald-700 hover:via-blue-700 hover:to-yellow-650 text-white font-bold tracking-wide py-3 px-8 rounded-xl transition-all shadow-md hover:shadow-lg transform active:scale-95 disabled:opacity-50 text-sm cursor-pointer"
          >
            {isSubmitting ? t.submitting : t.submit}
          </button>
        </div>

      </form>
    </div>
  );
}
