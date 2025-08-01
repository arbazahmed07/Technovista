import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Signup from './components/Signup';
import Dashboard from './components/Dashboard';
import WorkspaceDetail from './components/WorkspaceDetail';
import ProtectedRoute from './components/ProtectedRoute';
import AuthRoute from './components/AuthRoute';
import './App.css';

const AuthApp = () => {
  const { isAuthenticated, loading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Dashboard />;
  }

  return isLogin ? (
    <Login onToggle={() => setIsLogin(false)} />
  ) : (
    <Signup onToggle={() => setIsLogin(true)} />
  );
};

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Router>
          <div className="App">
            <Routes>
              {/* Public routes - redirect to dashboard if already authenticated */}
              <Route 
                path="/login" 
                element={
                  <AuthRoute>
                    <Login />
                  </AuthRoute>
                } 
              />
              <Route 
                path="/register" 
                element={
                  <AuthRoute>
                    <Signup />
                  </AuthRoute>
                } 
              />
              
              {/* Protected routes */}
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/workspace/:workspaceId" 
                element={
                  <ProtectedRoute>
                    <WorkspaceDetail />
                  </ProtectedRoute>
                } 
              />
              
              {/* Default redirect */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </Router>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
