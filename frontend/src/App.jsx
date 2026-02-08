import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, SystemProvider, NavigationProvider } from './contexts';
import { CommandBar, Navigation, ContextPanel, Workspace } from './components/layout';
import LoginScreen from './components/screens/LoginScreen';
import { useAuth } from './contexts/AuthContext';

// Main Layout with all providers
const MainLayout = () => {
  return (
    <SystemProvider>
      <NavigationProvider>
        <div className="h-screen flex flex-col bg-bg-primary overflow-hidden">
          <CommandBar />
          <div className="flex-1 flex overflow-hidden">
            <Navigation />
            <Workspace />
            <ContextPanel />
          </div>
        </div>
      </NavigationProvider>
    </SystemProvider>
  );
};

// Route validator component
const AuthenticatedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
          <span className="text-sm text-gray-500 font-mono">INITIALIZING SYSTEM...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

// Public route that redirects if already authenticated
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
          <span className="text-sm text-gray-500 font-mono">INITIALIZING SYSTEM...</span>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// App Routes Component
const AppRoutes = () => {
  return (
    <Routes>
      <Route 
        path="/login" 
        element={
          <PublicRoute>
            <LoginScreen />
          </PublicRoute>
        } 
      />
      <Route 
        path="/*" 
        element={
          <AuthenticatedRoute>
            <MainLayout />
          </AuthenticatedRoute>
        } 
      />
    </Routes>
  );
};

// App Component
const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;