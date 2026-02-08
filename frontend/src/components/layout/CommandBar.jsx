import React from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, 
  Bell, 
  User, 
  LogOut, 
  RefreshCw,
  Terminal,
  Clock
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSystem } from '../../contexts/SystemContext';

const CommandBar = () => {
  const { user, logout, hasRole } = useAuth();
  const { lastUpdate, refreshAll, isLoading } = useSystem();

  const getRoleBadge = (role) => {
    const roleColors = {
      admin: 'bg-risk-warning/20 text-risk-warning border-risk-warning/50',
      reviewer: 'bg-cyber-purple-500/20 text-cyber-purple-400 border-cyber-purple-500/50',
      researcher: 'bg-accent-primary/20 text-accent-primary border-accent-primary/50',
      auditor: 'bg-privacy-safe/20 text-privacy-safe border-privacy-safe/50',
    };
    
    return (
      <span className={`px-2 py-0.5 text-xs font-mono border ${roleColors[role] || roleColors.researcher}`}>
        {role?.toUpperCase()}
      </span>
    );
  };

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="h-14 bg-bg-panel border-b border-border-panel flex items-center justify-between px-4 sticky top-0 z-50"
    >
      {/* Left Section */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-accent-primary" />
          <span className="text-sm font-semibold tracking-wider text-white">
            SAFEDATA <span className="text-accent-primary">GOVERNANCE</span>
          </span>
        </div>
        
        <div className="h-6 w-px bg-border-panel" />
        
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Terminal className="w-3 h-3" />
          <span className="font-mono">v2.1.0</span>
        </div>
      </div>

      {/* Center Section - System Status */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-privacy-safe animate-pulse" />
          <span className="text-xs text-gray-400">SYSTEM OPERATIONAL</span>
        </div>
        
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          <span className="font-mono">
            {lastUpdate ? lastUpdate.toLocaleTimeString() : '--:--:--'}
          </span>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-4">
        {/* Refresh Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={refreshAll}
          disabled={isLoading('refresh')}
          className="p-2 text-gray-400 hover:text-white transition-colors"
          title="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading('refresh') ? 'animate-spin' : ''}`} />
        </motion.button>

        {/* Notifications */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          className="p-2 text-gray-400 hover:text-white transition-colors relative"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-risk-warning rounded-full" />
        </motion.button>

        <div className="h-6 w-px bg-border-panel" />

        {/* User Info */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-medium text-white">{user?.userId || 'Guest'}</div>
            <div className="text-xs text-gray-500">{user?.email || 'Not logged in'}</div>
          </div>
          
          {user && getRoleBadge(user.role)}
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={logout}
            className="p-2 text-gray-400 hover:text-risk-warning transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </motion.header>
  );
};

export default CommandBar;