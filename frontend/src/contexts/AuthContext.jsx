import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, systemAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        try {
          // Verify token by checking system status
          await systemAPI.getSecurityStatus();
          setToken(storedToken);
          // Decode JWT to get user info
          const payload = JSON.parse(atob(storedToken.split('.')[1]));
          setUser(payload);
        } catch (err) {
          console.error('Token validation failed:', err);
          logout();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (userId, password) => {
    try {
      setError(null);
      const response = await authAPI.login(userId, password);
      const { token: newToken, user: userData } = response.data;
      
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(userData);
      
      return { success: true };
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
      return { success: false, error: err.response?.data?.message };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const hasRole = (role) => {
    if (!user) return false;
    const roleHierarchy = { admin: 4, reviewer: 3, researcher: 2, auditor: 1 };
    const userLevel = roleHierarchy[user.role] || 0;
    const requiredLevel = roleHierarchy[role] || 0;
    return userLevel >= requiredLevel;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      login, 
      logout, 
      loading, 
      error,
      isAuthenticated: !!token,
      hasRole 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;