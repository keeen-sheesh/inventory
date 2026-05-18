// resources/js/Pages/Admin/Inventory/Widgets/LowStockWidget.jsx

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Package, TrendingDown, ChevronRight } from 'lucide-react';

export default function LowStockWidget({ onViewAll }) {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAlerts();
    }, []);

    const fetchAlerts = async () => {
        try {
            const response = await fetch('/admin/inventory/low-stock-alerts');
            const data = await response.json();
            if (data.success) {
                setAlerts(data.low_stock.slice(0, 5)); // Show top 5
            }
        } catch (error) {
            console.error('Failed to fetch alerts:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-xl p-6 border border-gray-200">
                <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
                    <div className="space-y-3">
                        <div className="h-10 bg-gray-100 rounded"></div>
                        <div className="h-10 bg-gray-100 rounded"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Low Stock Alerts
                </h3>
                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                    {alerts.length} items
                </span>
            </div>

            {alerts.length === 0 ? (
                <div className="text-center py-6">
                    <Package className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-500">No low stock items</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {alerts.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                            <div>
                                <p className="font-medium text-gray-900">{item.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-gray-600">
                                        Stock: <span className="font-semibold text-amber-600">{item.quantity}</span> / {item.min_stock} {item.unit}
                                    </span>
                                    <TrendingDown className="h-3 w-3 text-amber-500" />
                                </div>
                            </div>
                            <button 
                                onClick={() => onViewAll && onViewAll(item)}
                                className="p-2 hover:bg-amber-200 rounded-lg transition-colors"
                            >
                                <ChevronRight className="h-4 w-4 text-amber-700" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {alerts.length > 0 && (
                <button
                    onClick={onViewAll}
                    className="w-full mt-4 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                    View All Alerts →
                </button>
            )}
        </div>
    );
}