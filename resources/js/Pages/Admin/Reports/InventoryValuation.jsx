import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { 
    ArrowLeft, Package, DollarSign, Filter, Download, Search, 
    RefreshCw, TrendingUp, PieChart, BarChart3, Layers 
} from 'lucide-react';
import { 
    BarChart, Bar, PieChart as RePieChart, Pie, Cell, 
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, AreaChart, Area
} from 'recharts';

const formatPeso = (amount) => {
    return `₱${parseFloat(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

export default function InventoryValuation({ items, summary, filters, categories, pools, charts }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(filters?.category_id || '');
    const [selectedPool, setSelectedPool] = useState(filters?.pool_id || '');
    const [viewMode, setViewMode] = useState('dashboard'); // 'dashboard' or 'table'

    const handleBack = () => {
        router.get('/admin/reports');
    };

    const handleFilter = () => {
        router.get('/admin/reports/inventory-valuation', {
            category_id: selectedCategory || null,
            pool_id: selectedPool || null,
        });
    };

    const handleReset = () => {
        setSelectedCategory('');
        setSelectedPool('');
        setSearchTerm('');
        router.get('/admin/reports/inventory-valuation');
    };

    const handleExport = () => {
        router.get('/admin/reports/inventory-valuation/export', {
            category_id: selectedCategory || null,
            pool_id: selectedPool || null,
        });
    };

    // Filter items by search term
    const filteredItems = (items || []).filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    // Prepare data for category pie chart
    const categoryData = (charts?.by_category || []).map(item => ({
        name: item.category,
        value: parseFloat(item.total_value),
        items: item.item_count
    }));

    // Prepare data for pool comparison
    const poolData = (charts?.by_pool || []).map(item => ({
        name: item.pool,
        value: parseFloat(item.total_value),
        units: parseFloat(item.total_units)
    }));

    // Prepare data for top items bar chart
    const topItemsData = (charts?.top_items || []).map(item => ({
        name: item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name,
        fullName: item.name,
        value: parseFloat(item.total_value),
        quantity: parseFloat(item.quantity)
    }));

    return (
        <>
            <Head title="Inventory Valuation Dashboard" />
            <AdminLayout>
                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleBack}
                                className="p-2 hover:bg-gray-100 rounded-lg"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Inventory Dashboard</h1>
                                <p className="text-gray-500 text-sm mt-0.5">Real-time stock valuation analytics</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <div className="flex bg-gray-100 rounded-lg p-1">
                                <button
                                    onClick={() => setViewMode('dashboard')}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-all ${
                                        viewMode === 'dashboard'
                                            ? 'bg-white text-gray-900 shadow-sm'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <PieChart className="w-4 h-4" />
                                    Dashboard
                                </button>
                                <button
                                    onClick={() => setViewMode('table')}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-all ${
                                        viewMode === 'table'
                                            ? 'bg-white text-gray-900 shadow-sm'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <Layers className="w-4 h-4" />
                                    Table
                                </button>
                            </div>
                            <button
                                onClick={handleExport}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-medium"
                            >
                                <Download className="w-4 h-4" />
                                Export
                            </button>
                        </div>
                    </div>

                    {/* Summary Stats - Always visible */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                            <div className="flex items-center justify-between mb-3">
                                <div className="p-2 bg-blue-50 rounded-lg">
                                    <DollarSign className="w-5 h-5 text-blue-600" />
                                </div>
                                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                                    Total Value
                                </span>
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{formatPeso(summary?.total_valuation || 0)}</p>
                            <p className="text-xs text-gray-500 mt-1">Inventory valuation</p>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                            <div className="flex items-center justify-between mb-3">
                                <div className="p-2 bg-green-50 rounded-lg">
                                    <Package className="w-5 h-5 text-green-600" />
                                </div>
                                <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                                    Total Units
                                </span>
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{summary?.total_items?.toLocaleString() || 0}</p>
                            <p className="text-xs text-gray-500 mt-1">Units in stock</p>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                            <div className="flex items-center justify-between mb-3">
                                <div className="p-2 bg-purple-50 rounded-lg">
                                    <Filter className="w-5 h-5 text-purple-600" />
                                </div>
                                <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
                                    SKUs
                                </span>
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{summary?.total_skus || 0}</p>
                            <p className="text-xs text-gray-500 mt-1">Unique items</p>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                            <div className="flex items-center justify-between mb-3">
                                <div className="p-2 bg-orange-50 rounded-lg">
                                    <TrendingUp className="w-5 h-5 text-orange-600" />
                                </div>
                                <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
                                    Avg Value
                                </span>
                            </div>
                            <p className="text-2xl font-bold text-gray-900">
                                {formatPeso(summary?.total_skus > 0 ? summary?.total_valuation / summary?.total_skus : 0)}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">Per SKU average</p>
                        </div>
                    </div>

                    {/* Dashboard View */}
                    {viewMode === 'dashboard' && (
                        <>
                            {/* Charts Row 1 */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                                {/* Category Distribution (Pie Chart) */}
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="text-base font-semibold text-gray-900">Valuation by Category</h3>
                                            <p className="text-gray-500 text-sm mt-0.5">Distribution across categories</p>
                                        </div>
                                        <PieChart className="w-5 h-5 text-gray-400" />
                                    </div>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RePieChart>
                                                <Pie
                                                    data={categoryData}
                                                    cx="50%"
                                                    cy="50%"
                                                    labelLine={false}
                                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                                    outerRadius={80}
                                                    fill="#8884d8"
                                                    dataKey="value"
                                                >
                                                    {categoryData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip 
                                                    formatter={(value) => formatPeso(value)}
                                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                />
                                            </RePieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Pool Comparison (Bar Chart) */}
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="text-base font-semibold text-gray-900">Valuation by Pool</h3>
                                            <p className="text-gray-500 text-sm mt-0.5">Resto vs Kitchen comparison</p>
                                        </div>
                                        <BarChart3 className="w-5 h-5 text-gray-400" />
                                    </div>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={poolData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                                <YAxis 
                                                    tickFormatter={(value) => `₱${(value/1000).toFixed(0)}k`}
                                                    tick={{ fontSize: 12 }}
                                                />
                                                <Tooltip 
                                                    formatter={(value) => formatPeso(value)}
                                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                />
                                                <Legend />
                                                <Bar dataKey="value" name="Total Value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                                                <Bar dataKey="units" name="Total Units" fill="#10B981" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* Charts Row 2 */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                                {/* Top 10 Items (Horizontal Bar) */}
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-2">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="text-base font-semibold text-gray-900">Top 10 Items by Value</h3>
                                            <p className="text-gray-500 text-sm mt-0.5">Highest value inventory items</p>
                                        </div>
                                        <TrendingUp className="w-5 h-5 text-gray-400" />
                                    </div>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={topItemsData} layout="vertical" margin={{ left: 80 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(value) => `₱${(value/1000).toFixed(0)}k`} />
                                                <YAxis 
                                                    dataKey="name" 
                                                    type="category" 
                                                    tick={{ fontSize: 11 }}
                                                    width={80}
                                                />
                                                <Tooltip 
                                                    formatter={(value, name, props) => {
                                                        if (name === 'Total Value') return formatPeso(value);
                                                        return value;
                                                    }}
                                                    labelFormatter={(label, payload) => {
                                                        const item = payload[0]?.payload;
                                                        return item?.fullName || label;
                                                    }}
                                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                />
                                                <Bar dataKey="value" name="Total Value" fill="#F59E0B" radius={[0, 4, 4, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Quick Stats */}
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="text-base font-semibold text-gray-900">Inventory Insights</h3>
                                            <p className="text-gray-500 text-sm mt-0.5">Key metrics at a glance</p>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
                                            <p className="text-xs text-blue-600 font-medium mb-1">Highest Value Item</p>
                                            <p className="text-sm font-semibold text-gray-900 truncate">
                                                {topItemsData[0]?.fullName || 'N/A'}
                                            </p>
                                            <p className="text-lg font-bold text-blue-600 mt-1">
                                                {formatPeso(topItemsData[0]?.value || 0)}
                                            </p>
                                        </div>
                                        
                                        <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl">
                                            <p className="text-xs text-green-600 font-medium mb-1">Total Categories</p>
                                            <p className="text-2xl font-bold text-green-700">
                                                {categoryData.length}
                                            </p>
                                            <p className="text-xs text-green-600 mt-1">Active categories</p>
                                        </div>

                                        <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl">
                                            <p className="text-xs text-purple-600 font-medium mb-1">Pool Distribution</p>
                                            <div className="flex items-center gap-2 mt-2">
                                                {poolData.map((pool, idx) => (
                                                    <div key={idx} className="flex-1">
                                                        <p className="text-xs text-purple-600">{pool.name}</p>
                                                        <p className="text-sm font-bold text-purple-700">
                                                            {formatPeso(pool.value)}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Table View */}
                    {viewMode === 'table' && (
                        <>
                            {/* Filters */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
                                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-base font-semibold text-gray-900">Filters</h3>
                                        <p className="text-gray-500 text-sm mt-0.5">Search and filter inventory items</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleReset}
                                            className="px-3 py-1.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium flex items-center gap-1.5"
                                        >
                                            <RefreshCw className="w-3.5 h-3.5" />
                                            Reset
                                        </button>
                                        <button
                                            onClick={handleFilter}
                                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-1.5"
                                        >
                                            <Filter className="w-3.5 h-3.5" />
                                            Apply
                                        </button>
                                    </div>
                                </div>
                                <div className="p-6">
                                    <div className="flex gap-4">
                                        {/* Search */}
                                        <div className="flex-1">
                                            <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                                Search Item
                                            </label>
                                            <div className="relative">
                                                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                <input
                                                    type="text"
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    placeholder="Search by item name..."
                                                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                />
                                            </div>
                                        </div>

                                        {/* Pool Filter */}
                                        <div className="w-48">
                                            <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                                Inventory Pool
                                            </label>
                                            <select
                                                value={selectedPool}
                                                onChange={(e) => setSelectedPool(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            >
                                                <option value="">All Pools</option>
                                                {(pools || []).map(pool => (
                                                    <option key={pool.id} value={pool.id}>{pool.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Category Filter */}
                                        <div className="w-48">
                                            <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                                Category
                                            </label>
                                            <select
                                                value={selectedCategory}
                                                onChange={(e) => setSelectedCategory(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            >
                                                <option value="">All Categories</option>
                                                {(categories || []).map(cat => (
                                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Inventory Table */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-base font-semibold text-gray-900">Stock Items</h3>
                                        <p className="text-gray-500 text-sm mt-0.5">{filteredItems.length} items found</p>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="min-w-full">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200">
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Item Name
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Pool
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Category
                                                </th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Quantity
                                                </th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Unit
                                                </th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Cost/Unit
                                                </th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Total Value
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {filteredItems.length > 0 ? (
                                                filteredItems.map((item, idx) => (
                                                    <tr
                                                        key={item.id || idx}
                                                        className="hover:bg-gray-50"
                                                    >
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="text-sm font-medium text-gray-900">{item.name}</div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                                {item.pool_name || 'N/A'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="text-sm text-gray-500">{item.category_name || 'N/A'}</div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                                            <div className="text-sm font-medium text-gray-900">{item.quantity}</div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                                            <div className="text-sm text-gray-500">{item.unit || 'pcs'}</div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                                            <div className="text-sm text-gray-900">{formatPeso(item.cost_per_unit)}</div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                                            <div className="text-sm font-semibold text-green-600">
                                                                {formatPeso(item.total_value)}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="7" className="px-6 py-12 text-center">
                                                        <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                                        <p className="text-gray-500 text-sm">
                                                            {items?.length === 0 ? 'No inventory items found' : 'No items match your search'}
                                                        </p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </AdminLayout>
        </>
    );
}
