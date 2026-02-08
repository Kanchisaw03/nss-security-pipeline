import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Gauge, Database, TrendingUp, AlertTriangle, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { dpAPI } from '../../services/api';

const ChartWrapper = ({ children, minHeight = '256px', fallback = null }) => {
  const containerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(true); // Set to true immediately

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setIsVisible(true);
        }
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{ height: minHeight, minHeight }} className="w-full">
      {isVisible ? children : fallback || <div className="h-full flex items-center justify-center text-gray-500">Loading...</div>}
    </div>
  );
};

const DPMonitorScreen = () => {
  const [budgetData, setBudgetData] = useState([
    { day: 'Mon', consumed: 0.5 },
    { day: 'Tue', consumed: 0.8 },
    { day: 'Wed', consumed: 0.3 },
    { day: 'Thu', consumed: 1.2 },
    { day: 'Fri', consumed: 0.6 },
    { day: 'Sat', consumed: 0.2 },
    { day: 'Sun', consumed: 0.4 },
  ]);
  const [budget, setBudget] = useState({
    total: 10.0,
    consumed: 4.2,
    remaining: 5.8,
    activeQueries: 12
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBudgetData();
  }, []);

  const fetchBudgetData = async () => {
    setLoading(true);
    try {
      const response = await dpAPI.getBudget();
      if (response.data) {
        setBudget({
          total: response.data.total || 10.0,
          consumed: response.data.consumed || 4.2,
          remaining: response.data.remaining || 5.8,
          activeQueries: response.data.activeQueries || 12
        });
        if (response.data.dailyConsumption) {
          setBudgetData(response.data.dailyConsumption);
        }
      }
    } catch (error) {
      console.error('Failed to fetch budget:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">DP Monitor</h1>
          <p className="text-sm text-gray-500">Differential privacy budget tracking and query monitoring</p>
        </div>
        <button
          onClick={fetchBudgetData}
          disabled={loading}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-bg-panel border border-border-panel p-6"
        >
          <div className="text-xs text-gray-500 mb-2">Total Budget</div>
          <div className="text-3xl font-mono text-white">{budget.total.toFixed(1)} ε</div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-bg-panel border border-border-panel p-6"
        >
          <div className="text-xs text-gray-500 mb-2">Consumed</div>
          <div className="text-3xl font-mono text-risk-warning">{budget.consumed.toFixed(1)} ε</div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-bg-panel border border-border-panel p-6"
        >
          <div className="text-xs text-gray-500 mb-2">Remaining</div>
          <div className="text-3xl font-mono text-privacy-safe">{budget.remaining.toFixed(1)} ε</div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-bg-panel border border-border-panel p-6"
        >
          <div className="text-xs text-gray-500 mb-2">Active Queries</div>
          <div className="text-3xl font-mono text-accent-primary">{budget.activeQueries}</div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-bg-panel border border-border-panel p-6"
      >
        <h3 className="text-lg font-semibold text-white mb-4">Daily Budget Consumption</h3>
        <ChartWrapper minHeight="256px">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={budgetData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2A44" />
              <XAxis dataKey="day" stroke="#627D98" tick={{ fill: '#627D98', fontSize: 11 }} />
              <YAxis stroke="#627D98" tick={{ fill: '#627D98', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#121A2B', border: '1px solid #1F2A44' }}
                itemStyle={{ color: '#00D1FF' }}
              />
              <Bar dataKey="consumed" fill="#00D1FF" />
            </BarChart>
          </ResponsiveContainer>
        </ChartWrapper>
      </motion.div>
    </div>
  );
};

export default DPMonitorScreen;
