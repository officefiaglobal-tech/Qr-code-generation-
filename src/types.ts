/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Candidate {
  id: string; // Unique generated ID (e.g., ORG-2026-XXXX)
  organizationName: string;
  candidateName: string;
  dob: string;
  fatherName: string;
  fullAddress: string;
  candidateContact: string;
  candidateEmail?: string;
  fatherContact: string;
  policeStationContact: string;
  emergencyContact: string;
  emergencyWhatsApp: string;
  friendContact: string;
  relativeContact: string;
  aadhaarNumber: string;
  candidatePhoto: string; // Base64 compressed image
  aadhaarFront: string;   // Base64 compressed image
  aadhaarBack: string;    // Base64 compressed image
  createdAt: any;         // Firestore Timestamp or IsoString
  status: 'pending' | 'verified' | 'inactive';
  gpsLat?: number;
  gpsLng?: number;
  gpsAddress?: string;
  scanCount?: number;
}

export type Language = 'en' | 'hi';

export interface AdminUser {
  uid: string;
  email: string | null;
  role: string;
}
