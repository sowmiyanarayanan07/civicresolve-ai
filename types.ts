export enum Role {
  CITIZEN = 'CITIZEN',
  EMPLOYEE = 'EMPLOYEE',
  ADMIN = 'ADMIN',
}

export enum Priority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  EMERGENCY = 'Emergency',
}

export enum ComplaintStatus {
  SUBMITTED = 'Submitted',
  ASSIGNED = 'Assigned',
  ON_THE_WAY = 'On the way',
  REACHED = 'Reached',
  IN_PROGRESS = 'In Progress',
  JOB_COMPLETED = 'Job Completed (Verification Pending)',
  VERIFIED = 'Resolved',
  REJECTED = 'Rejected (Fake/Incomplete)',
}

export interface Location {
  lat: number;
  lng: number;
  address?: string;
}

export interface Complaint {
  id: string;
  citizenId?: string;        // Links complaint to user
  citizenEmail?: string;     // Links complaint to citizen email
  title: string;
  description: string;
  image?: string;            // Base64 or URL
  location: Location;
  category: string;
  priority: Priority;
  status: ComplaintStatus;
  createdAt: number;
  assignedTo?: string;       // Employee ID
  employeeLocation?: Location; // Real-time tracking
  completionImage?: string;  // Proof of work
  adminComment?: string;     // Reason for rejection
  aiAnalysis?: {
    reason: string;
    department: string;
    estimatedTime: string;
  };
}

export interface User {
  id: string;
  name: string;
  email: string;             // Email (replaces mobile)
  role: Role;
  langPreference?: Language;
}

export type Language = 'en' | 'ta'; // English | Tamil

export interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  phone?: string;
  availabilityStatus?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface TrackingLog {
  complaintId: string;
  employeeId: string;
  coords: Location;
  timestamp: number;
}