import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    ChevronLeft,
    ChevronRight,
    Database,
    Loader2,
    Table,
    AlertCircle
} from 'lucide-react';
import { ingestionAPI } from '../../services/api';

const DataPreviewTable = ({ datasetId, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [columns, setColumns] = useState([]);
    const [data, setData] = useState([]);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 25,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
    });

    useEffect(() => {
        if (datasetId) {
            fetchData(1);
        }
    }, [datasetId]);

    const fetchData = async (page) => {
        setLoading(true);
        setError(null);

        try {
            const response = await ingestionAPI.getDatasetData(datasetId, page, pagination.limit);

            if (response.data && response.data.success) {
                setColumns(response.data.columns || []);
                setData(response.data.data || []);
                setPagination(response.data.pagination || pagination);
            } else {
                setError('Failed to load data');
            }
        } catch (err) {
            console.error('Error fetching dataset data:', err);
            setError(err.response?.data?.error || err.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            fetchData(newPage);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
                <span className="ml-3 text-gray-400">Loading dataset...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-risk-warning">
                <AlertCircle className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm">{error}</p>
                <button
                    onClick={() => fetchData(1)}
                    className="mt-4 px-4 py-2 text-sm border border-risk-warning/50 hover:bg-risk-warning/10 transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Database className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">No data available</p>
            </div>
        );
    }

    // Limit visible columns for readability
    const visibleColumns = columns.slice(0, 8);
    const hasMoreColumns = columns.length > 8;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Table className="w-5 h-5 text-accent-primary" />
                    <span className="text-sm font-medium text-white">Data Preview</span>
                    <span className="text-xs text-gray-500">
                        ({pagination.total.toLocaleString()} rows, {columns.length} columns)
                    </span>
                </div>
                {hasMoreColumns && (
                    <span className="text-xs text-gray-500">
                        Showing {visibleColumns.length} of {columns.length} columns
                    </span>
                )}
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto border border-border-panel bg-bg-primary">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border-panel bg-bg-panel">
                            {visibleColumns.map((col, idx) => (
                                <th
                                    key={idx}
                                    className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap"
                                >
                                    {col}
                                </th>
                            ))}
                            {hasMoreColumns && (
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">
                                    +{columns.length - visibleColumns.length} more
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-panel">
                        {data.map((row, rowIdx) => (
                            <tr
                                key={rowIdx}
                                className="hover:bg-accent-primary/5 transition-colors"
                            >
                                {visibleColumns.map((col, colIdx) => (
                                    <td
                                        key={colIdx}
                                        className="px-3 py-2 text-gray-300 whitespace-nowrap max-w-[200px] truncate"
                                        title={String(row[col] ?? '')}
                                    >
                                        {row[col] !== null && row[col] !== undefined ? String(row[col]) : '-'}
                                    </td>
                                ))}
                                {hasMoreColumns && (
                                    <td className="px-3 py-2 text-gray-600">...</td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <div className="text-xs text-gray-500">
                        Page {pagination.page} of {pagination.totalPages}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handlePageChange(pagination.page - 1)}
                            disabled={!pagination.hasPrev}
                            className="flex items-center gap-1 px-3 py-1 text-sm border border-border-panel hover:bg-bg-panel disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Prev
                        </button>
                        <button
                            onClick={() => handlePageChange(pagination.page + 1)}
                            disabled={!pagination.hasNext}
                            className="flex items-center gap-1 px-3 py-1 text-sm border border-border-panel hover:bg-bg-panel disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            Next
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </motion.div>
    );
};

export default DataPreviewTable;
