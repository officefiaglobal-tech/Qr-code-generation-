# Security Specification (TDD) - Candidate Registry

This document defines the security boundaries, data invariants, and access control testing matrices for the digital smart verification platform.

## 1. Data Invariants

- **Read Access (Get)**: Anyone scanning the QR code must be able to view a single candidate's verification profile using their `id`.
- **Read Access (List)**: Only authenticated and verified administrators can query or list all candidates in the dashboard.
- **Create Access**: Anyone (unauthenticated or authenticated) can submit a new candidate registration form, but they must provide a valid 12-digit Aadhaar number and meet strict validation constraints (sizes, regexes).
- **Update/Delete Access**: Only administrators can edit candidate details, toggle QR active status, or delete candidate documents.
- **Admin Authentication**: Checked against `/databases/$(database)/documents/admins/$(request.auth.uid)`.

---

## 2. The "Dirty Dozen" Malicious Payloads

1. **Identity Spoofing**: Attempt to list all candidates as an anonymous user (Should return `PERMISSION_DENIED`).
2. **Resource Poisoning**: Create a candidate document with an ID longer than 128 characters or containing illegal characters (Should return `PERMISSION_DENIED`).
3. **Ghost Field Update**: An administrator tries to update candidate fields that aren't on the white-list (Should return `PERMISSION_DENIED`).
4. **Self-Promotion**: An authenticated user attempts to write to the `/admins` collection to make themselves an administrator (Should return `PERMISSION_DENIED`).
5. **Unauthorized Modification**: A non-admin user attempts to update a candidate's status to "verified" (Should return `PERMISSION_DENIED`).
6. **Aadhaar Overrun**: Submit an Aadhaar number that has letters or is longer than 12 characters (Should return `PERMISSION_DENIED`).
7. **Size Grenade**: Attempt to submit a raw candidate photo larger than 1MB (handled on client and verified in rules limit size <= 1500000 characters).
8. **Orphaned Write**: Create a candidate without an organization name (Should return `PERMISSION_DENIED`).
9. **Status State Lockbypass**: Attempt to edit details of a candidate with status "inactive" without admin role (Should return `PERMISSION_DENIED`).
10. **Timestamp Fraud**: Submit `createdAt` fields claiming arbitrary historical timestamps instead of using `request.time` (Should return `PERMISSION_DENIED`).
11. **Malicious Delete**: A random user attempts to delete a candidate registration (Should return `PERMISSION_DENIED`).
12. **Blanket Read Request**: Admin search queries that attempt to run without proper indexing or bypassing restrictions (Should return `PERMISSION_DENIED`).

---

## 3. Deployment Rules Draft

We will define rules utilizing standard Firestore rules v2. Users can create documents if they pass structural validator `isValidCandidate(incoming())`. Only Admins can execute list queries and updates.
