import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, User, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const LoginScreen = () => {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login, error } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId || !password) return;
    
    setIsLoading(true);
    const result = await login(userId, password);
    setIsLoading(false);
    
    if (!result.success) {
      // Error is handled by AuthContext
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2300D1FF' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="inline-flex items-center justify-center w-16 h-16 mb-4 border border-accent-primary/30 bg-accent-primary/5"
          >
            <Shield className="w-8 h-8 text-accent-primary" />
          </motion.div>
          <h1 className="text-2xl font-bold text-white tracking-wider mb-2">
            SAFEDATA <span className="text-accent-primary">GOVERNANCE</span>
          </h1>
          <p className="text-sm text-gray-500">
            Privacy-Preserving Statistical Data Access Platform
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-bg-panel border border-border-panel p-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-1">System Access</h2>
            <p className="text-xs text-gray-500">Enter your credentials to access the command interface</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* User ID Field */}
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-wider text-gray-500">
                User ID
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="Enter user ID"
                  className="w-full bg-bg-primary border border-border-panel px-10 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent-primary transition-colors"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-wider text-gray-500">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full bg-bg-primary border border-border-panel px-10 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent-primary transition-colors"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-risk-warning/10 border border-risk-warning/30 text-risk-warning text-sm"
              >
                {error}
              </motion.div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !userId || !password}
              className="w-full bg-accent-primary/10 border border-accent-primary/50 text-accent-primary py-3 text-sm font-medium hover:bg-accent-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
                  AUTHENTICATING...
                </span>
              ) : (
                'ACCESS SYSTEM'
              )}
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-6 pt-6 border-t border-border-panel">
            <p className="text-xs text-gray-500 mb-3">Demo Credentials</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2 bg-bg-primary border border-border-panel">
                <div className="text-gray-400 mb-1">Admin</div>
                <div className="font-mono text-gray-300">admin / admin123</div>
              </div>
              <div className="p-2 bg-bg-primary border border-border-panel">
                <div className="text-gray-400 mb-1">Researcher</div>
                <div className="font-mono text-gray-300">researcher / researcher123</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-600">
            © 2024 SafeData Governance Orchestrator
          </p>
          <p className="text-xs text-gray-700 mt-1">
            Defense-in-Depth Privacy Architecture v2.1.0
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginScreen;