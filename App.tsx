import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Role, User, Language, Complaint, ComplaintStatus, Location } from './types';
import { subscribeToComplaints, addComplaint as dbAddComplaint, updateComplaint, deleteAllComplaints as dbDeleteAllComplaints, updateUserAvatar as dbUpdateUserAvatar, subscribeToCrisisMode, setCrisisModeDB } from './services/dbService';
import { signOut, restoreSession } from './services/authService';
import Login from './components/Login';
import CitizenDashboard from './components/CitizenDashboard';
import EmployeeDashboard from './components/EmployeeDashboard';
import AdminDashboard from './components/AdminDashboard';
import AboutUs from './components/AboutUs';
import CommunityHub from './components/CommunityHub';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [lang, setLang] = useState<Language>('en');
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [crisisMode, setCrisisModeState] = useState<boolean>(() => {
    try { return localStorage.getItem('civic_crisis_mode') === 'true'; } catch { return false; }
  });

  const setCrisisMode = async (val: boolean) => {
    setCrisisModeState(val);
    await setCrisisModeDB(val);
    // Apply/remove body class for global CSS hooks
    if (val) document.body.classList.add('crisis-active');
    else document.body.classList.remove('crisis-active');
  };

  // Subscribe to real-time crisis mode
  useEffect(() => {
    const unsub = subscribeToCrisisMode((active) => {
        setCrisisModeState(active);
        if (active) document.body.classList.add('crisis-active');
        else document.body.classList.remove('crisis-active');
    });
    return unsub;
  }, []);

  // Sync body class on initial load
  React.useEffect(() => {
    if (crisisMode) document.body.classList.add('crisis-active');
  }, []);

  // Restore session on mount
  useEffect(() => {
    const unsub = restoreSession(u => { setUser(u); setAuthLoading(false); });
    return unsub;
  }, []);

  // Subscribe to real-time complaints
  useEffect(() => {
    const unsub = subscribeToComplaints(setComplaints);
    return unsub;
  }, []);

  // ---- Complaint Actions ----
  const addComplaint = async (c: Complaint) => {
    await dbAddComplaint(c);
  };

  const assignEmployee = async (complaintId: string, empId: string) => {
    await updateComplaint(complaintId, { assignedTo: empId, status: ComplaintStatus.ASSIGNED });
    const dups = complaints.filter(c => c.parentId === complaintId);
    for (const d of dups) await updateComplaint(d.id, { status: ComplaintStatus.ASSIGNED });
  };

  const submitFeedback = async (complaintId: string, rating: number, comments?: string) => {
    await updateComplaint(complaintId, { feedbackRating: rating, feedbackComments: comments });
  };

  const updateStatus = async (complaintId: string, status: ComplaintStatus) => {
    await updateComplaint(complaintId, { status });
    const dups = complaints.filter(c => c.parentId === complaintId);
    for (const d of dups) await updateComplaint(d.id, { status });
  };

  const completeTask = async (complaintId: string, proofImage: string, aiVerification?: { isResolved: boolean; reason: string }) => {
    await updateComplaint(complaintId, { status: ComplaintStatus.JOB_COMPLETED, completionImage: proofImage, aiVerification });
    const dups = complaints.filter(c => c.parentId === complaintId);
    for (const d of dups) await updateComplaint(d.id, { status: ComplaintStatus.JOB_COMPLETED, completionImage: proofImage });
  };

  const adminVerify = async (complaintId: string) => {
    const resolvedAt = Date.now();
    await updateComplaint(complaintId, { status: ComplaintStatus.VERIFIED, resolvedAt });
    const dups = complaints.filter(c => c.parentId === complaintId);
    for (const d of dups) await updateComplaint(d.id, { status: ComplaintStatus.VERIFIED, resolvedAt });
  };

  const adminReject = async (complaintId: string, reason: string) => {
    await updateComplaint(complaintId, { status: ComplaintStatus.REJECTED, adminComment: reason });
    const dups = complaints.filter(c => c.parentId === complaintId);
    for (const d of dups) await updateComplaint(d.id, { status: ComplaintStatus.REJECTED, adminComment: reason });
  };

  const clearAllComplaints = async () => {
    await dbDeleteAllComplaints();
  };

  const updateEmployeeLocation = async (complaintId: string, loc: Location) => {
    await updateComplaint(complaintId, { employeeLocation: loc });
  };

  const handleUpdateAvatar = async (avatarData: string) => {
    if (!user) return;
    await dbUpdateUserAvatar(user.id, avatarData);
    const updatedUser = { ...user, avatar: avatarData };
    setUser(updatedUser);
    localStorage.setItem('civic_current_user', JSON.stringify(updatedUser));
  };

  const handleLogout = async () => {
    await signOut();
    setUser(null);
  };

  // Show loading screen while restoring auth session
  if (authLoading) {
    return (
      <div className="min-h-screen hero-gradient flex items-center justify-center flex-col gap-4">
        <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/20">
          <i className="fas fa-city text-white text-3xl"></i>
        </div>
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }}></div>
        <p className="text-white/70 text-sm">Loading CivicResolve AI...</p>
      </div>
    );
  }

  // Employee sees only their assigned complaints (matched by user.id or user.email)
  const employeeComplaints = user?.role === Role.EMPLOYEE
    ? complaints.filter(c => c.assignedTo === user.id || c.assignedTo === user.email)
    : complaints;

  return (
    <HashRouter>
      <div className="font-sans text-gray-800">
        <Routes>
          <Route path="/"
            element={
              !user
                ? <Login onLogin={setUser} lang={lang} setLang={setLang} />
                : <Navigate to={user.role === Role.CITIZEN ? '/citizen' : user.role === Role.EMPLOYEE ? '/employee' : '/admin'} />
            }
          />

          <Route path="/about" element={<AboutUs />} />

          {/* Community Hub — accessible to all logged-in users */}
          <Route path="/community"
            element={
              user
                ? <CommunityHub user={user} onBack={() => window.history.back()} />
                : <Navigate to="/" />
            }
          />

          <Route path="/citizen"
            element={
              user?.role === Role.CITIZEN
                ? <CitizenDashboard
                  user={user} lang={lang} setLang={setLang}
                  complaints={complaints.filter(c =>
                    // Email is the primary reliable key; fall back to id
                    (c.citizenEmail && c.citizenEmail.toLowerCase() === user.email.toLowerCase())
                    || c.citizenId === user.id
                  )}
                  addComplaint={addComplaint}
                  submitFeedback={submitFeedback}
                  updateUserAvatar={handleUpdateAvatar}
                  crisisMode={crisisMode}
                  onLogout={handleLogout}
                />
                : <Navigate to="/" />
            }
          />

          <Route path="/employee"
            element={
              user?.role === Role.EMPLOYEE
                ? <EmployeeDashboard
                  user={user} lang={lang} setLang={setLang}
                  complaints={employeeComplaints}
                  updateStatus={updateStatus}
                  updateLocation={updateEmployeeLocation}
                  completeTask={completeTask}
                  updateUserAvatar={handleUpdateAvatar}
                  crisisMode={crisisMode}
                  onLogout={handleLogout}
                />
                : <Navigate to="/" />
            }
          />

          <Route path="/admin"
            element={
              user?.role === Role.ADMIN
                ? <AdminDashboard
                  lang={lang} setLang={setLang}
                  complaints={complaints}
                  assignEmployee={assignEmployee}
                  adminVerify={adminVerify}
                  adminReject={adminReject}
                  clearAllComplaints={clearAllComplaints}
                  crisisMode={crisisMode}
                  setCrisisMode={setCrisisMode}
                  onLogout={handleLogout}
                />
                : <Navigate to="/" />
            }
          />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </HashRouter>
  );
};

export default App;