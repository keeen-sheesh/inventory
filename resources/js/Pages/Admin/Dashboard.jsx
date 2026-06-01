import React, { useState, useEffect } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import DashboardModals from '@/Components/DashboardModals';
import Modal from '@/Components/Modal';
import ReceiptPrint from '@/Components/ReceiptPrint';
import {
    TrendingUp,
    TrendingDown,
    Calendar,
    ChevronDown,
    RefreshCw,
    Bell,
    Search,
    Filter,
    MoreHorizontal,
    Eye,
    ShoppingBag,
    Clock,
    Package,
    DollarSign,
    Users,
    CreditCard,
    Home,
    Truck,
    Coffee,
    AlertCircle,
    CheckCircle,
    XCircle,
    ArrowUpRight,
    ArrowDownRight,
    BarChart3,
    PieChart,
    Activity,
    User,
    Mail,
    Phone,
    Crown,
    Building2,
    ChefHat,
    UserCircle,
    X,
    Maximize2,
    Printer
} from 'lucide-react';
import { formatPHTime } from '@/utils/phTime';

// Format currency in Philippine Peso
const formatPeso = (amount) => {
    if (amount === null || amount === undefined) return '₱0.00';
    return `₱${parseFloat(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

// Format number with commas
const formatNumber = (num) => {
    if (num === null || num === undefined) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// Role icons and colors
const roleConfig = {
    admin: {
        icon: Crown,
        color: 'from-purple-500 to-purple-600',
        bgColor: 'bg-purple-50',
        textColor: 'text-purple-700',
        borderColor: 'border-purple-200',
        label: 'Admin'
    },
    resto_admin: {
        icon: Building2,
        color: 'from-blue-500 to-blue-600',
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-700',
        borderColor: 'border-blue-200',
        label: 'Resto Admin'
    },
    resto: {
        icon: Coffee,
        color: 'from-emerald-500 to-emerald-600',
        bgColor: 'bg-emerald-50',
        textColor: 'text-emerald-700',
        borderColor: 'border-emerald-200',
        label: 'Resto Staff'
    },
    kitchen: {
        icon: ChefHat,
        color: 'from-amber-500 to-amber-600',
        bgColor: 'bg-amber-50',
        textColor: 'text-amber-700',
        borderColor: 'border-amber-200',
        label: 'Kitchen Staff'
    },
    customer: {
        icon: UserCircle,
        color: 'from-gray-500 to-gray-600',
        bgColor: 'bg-gray-50',
        textColor: 'text-gray-700',
        borderColor: 'border-gray-200',
        label: 'Customer'
    }
};

// Status badge mapping
const getStatusBadge = (status) => {
    const statusMap = {
        'completed': { 
            bg: 'bg-emerald-50', 
            text: 'text-emerald-700', 
            border: 'border-emerald-200',
            dot: 'bg-emerald-500',
            icon: CheckCircle,
            label: 'Completed' 
        },
        'pending': { 
            bg: 'bg-amber-50', 
            text: 'text-amber-700', 
            border: 'border-amber-200',
            dot: 'bg-amber-500',
            icon: Clock,
            label: 'Pending' 
        },
        'preparing': { 
            bg: 'bg-blue-50', 
            text: 'text-blue-700', 
            border: 'border-blue-200',
            dot: 'bg-blue-500',
            icon: Coffee,
            label: 'Preparing' 
        },
        'ready': { 
            bg: 'bg-purple-50', 
            text: 'text-purple-700', 
            border: 'border-purple-200',
            dot: 'bg-purple-500',
            icon: CheckCircle,
            label: 'Ready' 
        },
        'cancelled': { 
            bg: 'bg-rose-50', 
            text: 'text-rose-700', 
            border: 'border-rose-200',
            dot: 'bg-rose-500',
            icon: XCircle,
            label: 'Cancelled' 
        },
    };
    return statusMap[status] || { 
        bg: 'bg-gray-50', 
        text: 'text-gray-700', 
        border: 'border-gray-200',
        dot: 'bg-gray-500',
        icon: Clock,
        label: status 
    };
};

// Order type icon and color
const getOrderTypeInfo = (type) => {
    const types = {
        'dine_in': { icon: Home, bg: 'bg-blue-50', text: 'text-blue-700', label: 'Dine In' },
        'takeout': { icon: Package, bg: 'bg-amber-50', text: 'text-amber-700', label: 'Takeout' },
        'delivery': { icon: Truck, bg: 'bg-purple-50', text: 'text-purple-700', label: 'Delivery' },
    };
    return types[type] || { icon: ShoppingBag, bg: 'bg-gray-50', text: 'text-gray-700', label: type };
};

const displayOrderLabel = (transaction) => {
    if (!transaction) return '—';
    return (
        transaction.txn_number ||
        transaction.order_number ||
        (transaction.id ? `ORD-${String(transaction.id).padStart(6, '0')}` : '—')
    );
};

// View All Transactions Modal
const ViewAllModal = ({ isOpen, onClose, allTransactions = [], onViewDetails }) => {
    const [localFilter, setLocalFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    const filteredTransactions = allTransactions.filter(transaction => {
        const matchesStatus = localFilter === 'all' || transaction.status === localFilter;
        const matchesSearch = searchQuery === '' || 
            transaction.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            transaction.txn_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            transaction.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            transaction.id?.toString().includes(searchQuery);
        return matchesStatus && matchesSearch;
    });

    const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentTransactions = filteredTransactions.slice(indexOfFirstItem, indexOfLastItem);

    useEffect(() => {
        setCurrentPage(1);
    }, [localFilter, searchQuery]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
                <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-blue-600">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/20 rounded-xl">
                                <ShoppingBag className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white">All Transactions</h2>
                                <p className="text-white/80 text-sm mt-1">View and manage all orders</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                            <X className="w-5 h-5 text-white" />
                        </button>
                    </div>
                </div>

                <div className="p-6 border-b border-gray-200 bg-gray-50">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex bg-gray-100 rounded-xl overflow-hidden p-0.5 gap-0.5">
                            {['all', 'completed', 'pending', 'preparing', 'ready'].map((filter) => (
                                <button
                                    key={filter}
                                    onClick={() => setLocalFilter(filter)}
                                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                                        localFilter === filter
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                                </button>
                            ))}
                        </div>
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by customer, TXN, or order number..."
                                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="flex items-center px-4 py-2 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
                            <span className="text-sm font-medium">{filteredTransactions.length} results</span>
                        </div>
                    </div>
                </div>

                <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
                    <table className="w-full">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <th className="px-6 py-4">Order</th>
                                <th className="px-6 py-4">Customer / Cashier</th>
                                <th className="px-6 py-4">Items</th>
                                <th className="px-6 py-4">Amount</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Time</th>
                                <th className="px-6 py-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {currentTransactions.length > 0 ? (
                                currentTransactions.map((transaction) => {
                                    const status = getStatusBadge(transaction.status);
                                    const StatusIcon = status.icon;
                                    const OrderTypeIcon = getOrderTypeInfo(transaction.order_type).icon;
                                    const cashierConfig = roleConfig[transaction.cashier_role || 'resto'];
                                    const CashierIcon = cashierConfig.icon;
                                    
                                    return (
                                        <tr 
                                            key={transaction.id} 
                                            className="hover:bg-amber-50/30 cursor-pointer transition-colors border-b border-gray-50 last:border-0"
                                            onClick={() => {
                                                onViewDetails(transaction.id);
                                                onClose();
                                            }}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className={`p-1.5 rounded-lg ${getOrderTypeInfo(transaction.order_type).bg}`}>
                                                        <OrderTypeIcon className={`w-3 h-3 ${getOrderTypeInfo(transaction.order_type).text}`} />
                                                    </div>
                                                    <span className="font-mono font-medium text-gray-900">
                                                        {displayOrderLabel(transaction)}
                                                    </span>
                                                    {transaction.is_hotel && (
                                                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">Hotel</span>
                                                    )}
                                                    {transaction.is_personal && (
                                                        <span className="px-2 py-0.5 bg-pink-100 text-pink-700 text-xs font-medium rounded-full">Personal</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <User className="w-3 h-3 text-gray-400" />
                                                        <span className="text-sm text-gray-900">{transaction.customer_name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`p-1 rounded ${cashierConfig.bgColor}`}>
                                                            <CashierIcon className={`w-3 h-3 ${cashierConfig.textColor}`} />
                                                        </div>
                                                        <span className={`text-xs font-medium ${cashierConfig.textColor}`}>
                                                            {transaction.cashier_name || 'No cashier'}
                                                        </span>
                                                    </div>
                                                    {transaction.room_number && (
                                                        <div className="text-xs text-gray-500">Room #{transaction.room_number}</div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{transaction.items_count} items</td>
                                            <td className="px-6 py-4">
                                                <span className="font-bold text-gray-900">{formatPeso(transaction.total_amount)}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                                                    <StatusIcon className="w-3 h-3" />
                                                    {status.label}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">{formatPHTime(transaction.created_at)}</td>
                                            <td className="px-6 py-4">
                                                <button className="p-1 hover:bg-gray-100 rounded-lg">
                                                    <MoreHorizontal className="w-4 h-4 text-gray-400" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center">
                                            <ShoppingBag className="w-12 h-12 text-gray-300 mb-3" />
                                            <p className="text-gray-500 font-medium">No transactions found</p>
                                            <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                        <p className="text-sm text-gray-500">
                            Showing <span className="font-medium text-gray-700">{indexOfFirstItem + 1}</span> to{' '}
                            <span className="font-medium text-gray-700">{Math.min(indexOfLastItem, filteredTransactions.length)}</span>{' '}
                            of <span className="font-medium text-gray-700">{filteredTransactions.length}</span> entries
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <span className="px-4 py-1 bg-blue-600 text-white rounded-lg font-medium">{currentPage}</span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default function Dashboard({ 
    auth, 
    stats, 
    recentSales, 
    weeklyData, 
    topItems,
    topItemsWeek,
    paymentMethodBreakdown,
    orderTypeBreakdown,
    filters,
    allTransactions = []
}) {
    const [activeModal, setActiveModal] = useState(null);
    const [modalData, setModalData] = useState(null);
    const [dateRange, setDateRange] = useState(filters?.range || 'today');
    const [customDateFrom, setCustomDateFrom] = useState(filters?.from || '');
    const [customDateTo, setCustomDateTo] = useState(filters?.to || '');
    const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
    const [showDateDropdown, setShowDateDropdown] = useState(false);
    const [transactionFilter, setTransactionFilter] = useState(filters?.filter || 'all');
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [isLoadingTransaction, setIsLoadingTransaction] = useState(false);
    const [selectedChartView, setSelectedChartView] = useState('revenue');
    const [showViewAllModal, setShowViewAllModal] = useState(false);
    const [showReceipt, setShowReceipt] = useState(false);
    
    const [localTransactions, setLocalTransactions] = useState(recentSales.data || []);
    const [currentPage, setCurrentPage] = useState(recentSales.current_page || 1);
    
    const unreadCount = 0;
    
    const dateRangeOptions = [
        { value: 'today', label: 'Today', icon: Calendar },
        { value: 'yesterday', label: 'Yesterday', icon: Calendar },
        { value: 'this_week', label: 'This Week', icon: Calendar },
        { value: 'last_week', label: 'Last Week', icon: Calendar },
        { value: 'this_month', label: 'This Month', icon: Calendar },
        { value: 'last_month', label: 'Last Month', icon: Calendar },
        { value: 'custom', label: 'Custom Range', icon: Calendar },
    ];
    
    const selectedRangeLabel = dateRangeOptions.find(opt => opt.value === dateRange)?.label || 'Today';
    
    useEffect(() => {
        if (transactionFilter === 'all') {
            setLocalTransactions(recentSales.data || []);
        } else {
            const filtered = (recentSales.data || []).filter(
                sale => sale.status === transactionFilter
            );
            setLocalTransactions(filtered);
        }
    }, [transactionFilter, recentSales.data]);
    
    const handleDateRangeChange = (range) => {
        setDateRange(range);
        setShowDateDropdown(false);
        
        if (range === 'custom') {
            setShowCustomDatePicker(true);
        } else {
            router.get('/admin/dashboard', { 
                range, 
                page: 1,
                filter: transactionFilter 
            }, { 
                preserveState: true 
            });
        }
    };
    
    const applyCustomDateRange = () => {
        if (customDateFrom && customDateTo) {
            setShowCustomDatePicker(false);
            router.get('/admin/dashboard', { 
                range: 'custom',
                from: customDateFrom,
                to: customDateTo,
                page: 1,
                filter: transactionFilter 
            }, { 
                preserveState: true 
            });
        }
    };
    
    const handleModalAction = (action, data) => {
        switch (action) {
            case 'view-order':
                fetchTransactionDetails(data);
                break;
            case 'view-item':
                setActiveModal('item-details');
                setModalData({ itemId: data, itemName: data });
                break;
            default:
                break;
        }
    };
    
    const fetchTransactionDetails = async (orderId) => {
        setIsLoadingTransaction(true);
        try {
            const response = await fetch(`/admin/transactions/${orderId}`);
            const data = await response.json();
            setSelectedTransaction(data);
            setActiveModal('order-details');
        } catch (error) {
            console.error('Failed to fetch transaction:', error);
        } finally {
            setIsLoadingTransaction(false);
        }
    };
    
    const handleRefresh = () => {
        router.reload({ only: ['stats', 'recentSales', 'topItems'] });
    };
    
    const openModal = (modalName, data = null) => {
        setActiveModal(modalName);
        setModalData(data);
    };
    
    const closeModal = () => {
        setActiveModal(null);
        setModalData(null);
        setSelectedTransaction(null);
    };
    
    const goToPage = (page) => {
        setCurrentPage(page);
        router.get('/admin/dashboard', { 
            page, 
            filter: transactionFilter,
            range: dateRange,
            from: customDateFrom,
            to: customDateTo,
            per_page: 10 
        }, { 
            preserveState: true,
            preserveScroll: true 
        });
    };
    
    const handleFilterChange = (filter) => {
        setTransactionFilter(filter);
        setCurrentPage(1);
    };
    
    const handleViewAll = () => {
        setShowViewAllModal(true);
    };
    
    // Order Details Modal - Changed to OFFICIAL RECEIPT layout
    const OrderDetailsModal = () => {
        if (!selectedTransaction) return null;
        
        const transaction = selectedTransaction;
        const statusBadge = getStatusBadge(transaction.status);
        const StatusIcon = statusBadge.icon;
        const OrderTypeIcon = getOrderTypeInfo(transaction.order_type).icon;
        
        const formatReceiptPrice = (price) => {
            const num = Number(price) || 0;
            return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        };
        
        return (
            <Modal isOpen={activeModal === 'order-details'} onClose={closeModal} title="OFFICIAL RECEIPT" size="md">
                <div className="space-y-4 font-mono text-sm">
                    {/* Header */}
                    <div className="text-center border-b pb-4">
                        <div className="font-bold text-lg">CJ BREW & DINE</div>
                        <div className="text-xs text-gray-500">Restobar System</div>
                        <div className="text-xs text-gray-400 mt-1">{transaction.created_at_formatted}</div>
                    </div>
                    
                    {/* Receipt Info */}
                    <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                            <span className="font-bold">Order #:</span>
                            <span>{transaction.order_number || transaction.txn_number}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Cashier:</span>
                            <span>{transaction.user || 'Admin'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Customer:</span>
                            <span>{transaction.customer_name || 'Walk-in Customer'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Payment:</span>
                            <span>{transaction.payment_method || 'Cash'}</span>
                        </div>
                        {transaction.room_number && (
                            <div className="flex justify-between">
                                <span>Room:</span>
                                <span>#{transaction.room_number}</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span>Status:</span>
                            <span className={`flex items-center gap-1 ${statusBadge.text}`}>
                                <StatusIcon className="w-3 h-3" />
                                {statusBadge.label}
                            </span>
                        </div>
                    </div>
                    
                    <div className="border-t border-dashed my-2"></div>
                    
                    {/* Items Header */}
                    <div className="font-bold text-center">OFFICIAL RECEIPT</div>
                    <div className="border-t border-dashed my-2"></div>
                    
                    {/* Items */}
                    <div className="space-y-2">
                        <div className="font-bold">ITEMS</div>
                        {transaction.items && transaction.items.map((item, index) => (
                            <div key={index} className="space-y-0.5">
                                <div>{item.name}</div>
                                <div className="flex justify-between text-xs text-gray-500 ml-2">
                                    <span>{item.quantity} x {formatReceiptPrice(item.unit_price)}</span>
                                    <span>{formatReceiptPrice(item.total_price)}</span>
                                </div>
                                {item.special_instructions && (
                                    <div className="text-xs text-amber-600 ml-2">📝 {item.special_instructions}</div>
                                )}
                            </div>
                        ))}
                    </div>
                    
                    <div className="border-t border-dashed my-2"></div>
                    
                    {/* Totals */}
                    <div className="space-y-1">
                        <div className="flex justify-between">
                            <span>SUBTOTAL</span>
                            <span>{formatReceiptPrice(transaction.subtotal)}</span>
                        </div>
                        {transaction.discount_amount > 0 && (
                            <div className="flex justify-between">
                                <span>DISCOUNT</span>
                                <span>-{formatReceiptPrice(transaction.discount_amount)}</span>
                            </div>
                        )}
                        {transaction.tax_amount > 0 && (
                            <div className="flex justify-between">
                                <span>VAT (12%)</span>
                                <span>{formatReceiptPrice(transaction.tax_amount)}</span>
                            </div>
                        )}
                    </div>
                    
                    <div className="border-t-2 border-gray-800 my-2"></div>
                    
                    <div className="flex justify-between font-bold text-base">
                        <span>TOTAL</span>
                        <span>{formatReceiptPrice(transaction.total_amount)}</span>
                    </div>
                    
                    <div className="border-t-2 border-gray-800 my-2"></div>
                    
                    {/* Cash */}
                    {transaction.cash_received && (
                        <div className="space-y-1">
                            <div className="flex justify-between">
                                <span>CASH RECEIVED</span>
                                <span>{formatReceiptPrice(transaction.cash_received)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>CHANGE DUE</span>
                                <span>{formatReceiptPrice(transaction.change_due || 0)}</span>
                            </div>
                        </div>
                    )}
                    
                    <div className="border-t border-dashed my-2"></div>
                    
                    {/* Footer */}
                    <div className="text-center text-xs">
                        <div>Thank you for dining with us!</div>
                        <div>Please come again</div>
                        <div className="mt-2">This serves as your</div>
                        <div className="font-bold">OFFICIAL RECEIPT</div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button 
                            onClick={() => setShowReceipt(true)} 
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
                        >
                            <Printer className="w-4 h-4" />
                            Print Receipt
                        </button>
                    </div>
                </div>
            </Modal>
        );
    };
    
    // Item Details Modal
    const ItemDetailsModal = () => (
        <Modal isOpen={activeModal === 'item-details'} onClose={closeModal} title={modalData?.itemName || "Item Details"} size="md">
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white text-2xl">🍕</div>
                    <div>
                        <h3 className="font-bold text-xl text-gray-900">{modalData?.itemName || "Pepperoni Pizza"}</h3>
                        <p className="text-gray-500">Menu Item</p>
                        <p className="text-2xl font-bold text-blue-600 mt-1">{formatPeso(15.99)}</p>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                        <p className="text-xs text-emerald-600 mb-1">Today's Sales</p>
                        <p className="text-2xl font-bold text-emerald-700">124</p>
                        <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                            <ArrowUpRight className="w-3 h-3" />
                            +12% vs yesterday
                        </p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <p className="text-xs text-blue-600 mb-1">Revenue</p>
                        <p className="text-2xl font-bold text-blue-700">{formatPeso(1982.76)}</p>
                        <p className="text-xs text-blue-600 mt-1">Today</p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                        <p className="text-xs text-purple-600 mb-1">This Week</p>
                        <p className="text-2xl font-bold text-purple-700">847</p>
                        <p className="text-xs text-purple-600 mt-1">sold</p>
                    </div>
                    <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                        <p className="text-xs text-amber-600 mb-1">This Month</p>
                        <p className="text-2xl font-bold text-amber-700">2,451</p>
                        <p className="text-xs text-amber-600 mt-1">sold</p>
                    </div>
                </div>
                
                <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <button className="p-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 border border-blue-200 transition-all flex items-center justify-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            Update Price
                        </button>
                        <button className="p-3 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 border border-emerald-200 transition-all flex items-center justify-center gap-2">
                            <Package className="w-4 h-4" />
                            Edit Item
                        </button>
                        <button className="p-3 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 border border-purple-200 transition-all flex items-center justify-center gap-2">
                            <BarChart3 className="w-4 h-4" />
                            Sales Report
                        </button>
                        <button className="p-3 bg-rose-50 text-rose-700 rounded-lg hover:bg-rose-100 border border-rose-200 transition-all flex items-center justify-center gap-2">
                            <XCircle className="w-4 h-4" />
                            Disable Item
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
    
    // Pagination Component
    const Pagination = () => {
        if (recentSales.last_page <= 1) return null;
        
        return (
            <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">
                    Showing <span className="font-medium text-gray-700">{recentSales.from}</span> to{' '}
                    <span className="font-medium text-gray-700">{recentSales.to}</span> of{' '}
                    <span className="font-medium text-gray-700">{recentSales.total}</span> entries
                </p>
                <div className="flex gap-2">
                    <button
                        onClick={() => goToPage(recentSales.current_page - 1)}
                        disabled={recentSales.current_page === 1}
                        className="px-3 py-1 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <button
                        onClick={() => goToPage(recentSales.current_page + 1)}
                        disabled={recentSales.current_page === recentSales.last_page}
                        className="px-3 py-1 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            </div>
        );
    };

    // Weekly Sales Chart
    const WeeklySalesChart = () => {
        if (!weeklyData || weeklyData.length === 0) return null;
        
        const maxSales = Math.max(...weeklyData.map(d => d.sales));
        
        return (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 mt-5">
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2.5">
                        <BarChart3 className="w-4 h-4 text-gray-400" />
                        <h3 className="text-sm font-semibold text-gray-900">Sales Performance</h3>
                        <span className="text-xs text-gray-400 ml-1">· Last 7 days</span>
                    </div>
                    
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => setSelectedChartView('revenue')}
                            className={`px-3 py-1 text-sm rounded-md transition-colors ${
                                selectedChartView === 'revenue'
                                    ? 'bg-white shadow-sm text-gray-900'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            Revenue
                        </button>
                        <button
                            onClick={() => setSelectedChartView('orders')}
                            className={`px-3 py-1 text-sm rounded-md transition-colors ${
                                selectedChartView === 'orders'
                                    ? 'bg-white shadow-sm text-gray-900'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            Orders
                        </button>
                    </div>
                </div>
                
                <div className="grid grid-cols-7 gap-4">
                    {weeklyData.map((day, index) => {
                        const value = selectedChartView === 'revenue' ? day.sales : (day.orders || 0);
                        const maxValue = selectedChartView === 'revenue' ? maxSales : Math.max(...weeklyData.map(d => d.orders || 0), 1);
                        const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
                        
                        return (
                            <div key={index} className="space-y-3">
                                <div className="text-center">
                                    <span className="text-sm font-medium text-gray-600">{day.day}</span>
                                </div>
                                
                                <div className="relative h-40 bg-gray-50/60 rounded-xl overflow-hidden group">
                                    <div 
                                        className={`absolute bottom-0 left-2 right-2 ${
                                            selectedChartView === 'revenue' 
                                                ? 'bg-gradient-to-t from-blue-500 to-blue-400' 
                                                : 'bg-gradient-to-t from-amber-500 to-amber-400'
                                        } rounded-t-lg transition-all duration-500 cursor-pointer`}
                                        style={{ height: `${percentage}%`, minHeight: '4px' }}
                                    >
                                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                            {selectedChartView === 'revenue' ? formatPeso(day.sales) : `${day.orders || 0} orders`}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="text-center">
                                    <div className="text-sm font-semibold text-gray-900">
                                        {selectedChartView === 'revenue' ? formatPeso(day.sales) : day.orders || 0}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <AdminLayout auth={auth}>
            <Head title="Dashboard" />
            
            <DashboardModals 
                activeModal={activeModal}
                onClose={closeModal}
                modalData={modalData}
                onAction={handleModalAction}
            />
            <OrderDetailsModal />
            <ItemDetailsModal />
            <ViewAllModal 
                isOpen={showViewAllModal}
                onClose={() => setShowViewAllModal(false)}
                allTransactions={recentSales.data || []}
                onViewDetails={fetchTransactionDetails}
            />
            {showReceipt && selectedTransaction && (
                <ReceiptPrint
                    receipt={{
                        order_number: selectedTransaction.order_number,
                        txn_number: selectedTransaction.txn_number,
                        customer_name: selectedTransaction.customer_name,
                        cashier_name: selectedTransaction.user,
                        payment_method: selectedTransaction.payment_method,
                        room_number: selectedTransaction.room_number,
                        status: selectedTransaction.status,
                        created_at: selectedTransaction.created_at_formatted,
                        subtotal: selectedTransaction.subtotal,
                        discount_amount: selectedTransaction.discount_amount,
                        tax_amount: selectedTransaction.tax_amount,
                        total_amount: selectedTransaction.total_amount,
                        cash_received: selectedTransaction.cash_received ?? null,
                        change_due: selectedTransaction.change_due ?? null,
                        items: (selectedTransaction.items || []).map(item => ({
                            name: item.name,
                            quantity: item.quantity,
                            price: item.unit_price,
                            subtotal: item.total_price,
                        })),
                    }}
                    onClose={() => setShowReceipt(false)}
                />
            )}
            
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
                        <p className="text-sm text-gray-400 mt-0.5">Welcome back, {auth.user.name}</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <button
                                onClick={() => setShowDateDropdown(!showDateDropdown)}
                                className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors text-sm"
                            >
                                <Calendar className="w-4 h-4 text-gray-500" />
                                <span className="text-sm font-medium text-gray-700">{selectedRangeLabel}</span>
                                <ChevronDown className="w-4 h-4 text-gray-500" />
                            </button>
                            
                            {showDateDropdown && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-gray-200 z-40 py-1">
                                    {dateRangeOptions.map((option) => (
                                        <button
                                            key={option.value}
                                            onClick={() => handleDateRangeChange(option.value)}
                                            className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${
                                                dateRange === option.value ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                                            }`}
                                        >
                                            <option.icon className="w-4 h-4" />
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        {showCustomDatePicker && (
                            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                                <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Date Range</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                                            <input
                                                type="date"
                                                value={customDateFrom}
                                                onChange={(e) => setCustomDateFrom(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                                            <input
                                                type="date"
                                                value={customDateTo}
                                                onChange={(e) => setCustomDateTo(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div className="flex gap-3 pt-4">
                                            <button onClick={() => setShowCustomDatePicker(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
                                            <button onClick={applyCustomDateRange} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Apply</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        <button onClick={handleRefresh} className="p-2 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors" title="Refresh">
                            <RefreshCw className="w-4 h-4 text-gray-600" />
                        </button>
                    </div>
                </div>
            </div>
            
            {/* Alerts */}
            {(stats.lowStockItems > 0 || stats.pendingOrders > 0) && (
                <div className="grid grid-cols-2 gap-3 mb-5">
                    {stats.lowStockItems > 0 && (
                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3.5 flex items-center gap-3">
                            <div className="p-2 bg-amber-100 rounded-lg shrink-0"><Package className="w-4 h-4 text-amber-600" /></div>
                            <div className="flex-1">
                                <p className="font-medium text-amber-800">{stats.lowStockItems} {stats.lowStockItems === 1 ? 'item' : 'items'} low in stock</p>
                                <p className="text-sm text-amber-600 mt-1">Restock soon to avoid running out</p>
                            </div>
                            <button className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium">View Inventory</button>
                        </div>
                    )}
                    
                    {stats.pendingOrders > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-4">
                            <div className="p-3 bg-blue-100 rounded-lg"><Clock className="w-5 h-5 text-blue-600" /></div>
                            <div className="flex-1">
                                <p className="font-medium text-blue-800">{stats.pendingOrders} {stats.pendingOrders === 1 ? 'order' : 'orders'} pending</p>
                                <p className="text-sm text-blue-600 mt-1">Requires attention in kitchen</p>
                            </div>
                            <button onClick={() => router.visit('/admin/kitchen')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">View Kitchen</button>
                        </div>
                    )}
                </div>
            )}
            
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-amber-200 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 bg-amber-50 rounded-xl"><DollarSign className="w-4 h-4 text-amber-600" /></div>
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Revenue</span>
                    </div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total Revenue</p>
                    <p className="text-2xl font-bold text-gray-900 tracking-tight">{formatPeso(stats.totalSales)}</p>
                    <p className="text-xs text-gray-400 mt-2">Avg {formatPeso(stats.averageOrderValue)} · {stats.completedOrders} orders</p>
                </div>
                
                <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-emerald-200 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 bg-emerald-50 rounded-xl"><ShoppingBag className="w-4 h-4 text-emerald-600" /></div>
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Orders</span>
                    </div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total Orders</p>
                    <p className="text-2xl font-bold text-gray-900 tracking-tight">{stats.totalOrders}</p>
                    <p className="text-xs text-gray-400 mt-2">{stats.completedOrders} completed</p>
                </div>
                
                <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-orange-200 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 bg-orange-50 rounded-xl"><Clock className="w-4 h-4 text-orange-500" /></div>
                        <span className="text-xs font-semibold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">Kitchen</span>
                    </div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Pending Orders</p>
                    <p className="text-2xl font-bold text-gray-900 tracking-tight">{stats.pendingOrders}</p>
                    <p className="text-xs text-gray-400 mt-2">Awaiting preparation</p>
                </div>
                
                <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-rose-200 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 bg-rose-50 rounded-xl"><Package className="w-4 h-4 text-rose-500" /></div>
                        {stats.lowStockItems > 0 && <span className="text-xs font-semibold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">{stats.lowStockItems} low</span>}
                    </div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Low Stock Items</p>
                    <p className="text-2xl font-bold text-gray-900 tracking-tight">{stats.lowStockItems}</p>
                    <div className="flex items-center justify-between text-xs text-gray-400 mt-2">
                        <span className="text-gray-500">Out of stock</span>
                        <span className="text-rose-600 font-medium">{stats.outOfStockItems || 0}</span>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Recent Transactions */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <Activity className="w-4 h-4 text-gray-400" />
                                <h3 className="text-sm font-semibold text-gray-900">Recent Transactions</h3>
                            </div>
                            
                            <div className="flex items-center gap-3">
                                <div className="flex bg-gray-100 rounded-xl overflow-hidden p-0.5 gap-0.5">
                                    {['all', 'completed', 'pending'].map((filter) => (
                                        <button
                                            key={filter}
                                            onClick={() => handleFilterChange(filter)}
                                            className={`px-4 py-2 text-sm font-medium transition-colors ${
                                                transactionFilter === filter
                                                    ? 'bg-white text-gray-900 shadow-sm rounded-lg'
                                                    : 'text-gray-500 hover:text-gray-700 rounded-lg'
                                            }`}
                                        >
                                            {filter.charAt(0).toUpperCase() + filter.slice(1)}
                                        </button>
                                    ))}
                                </div>
                                
                                <button onClick={handleViewAll} className="px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs font-medium flex items-center gap-1.5">
                                    <Maximize2 className="w-4 h-4" />
                                    View All
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50/70 text-left text-xs font-medium text-gray-400 uppercase tracking-widest border-b border-gray-100">
                                    <th className="px-6 py-4">Order</th>
                                    <th className="px-6 py-4">Customer / Cashier</th>
                                    <th className="px-6 py-4">Items</th>
                                    <th className="px-6 py-4">Amount</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Time</th>
                                    <th className="px-6 py-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {localTransactions.length > 0 ? (
                                    localTransactions.map((sale) => {
                                        const status = getStatusBadge(sale.status);
                                        const StatusIcon = status.icon;
                                        const OrderTypeIcon = getOrderTypeInfo(sale.order_type).icon;
                                        const cashierConfig = roleConfig[sale.cashier_role || 'resto'];
                                        const CashierIcon = cashierConfig.icon;
                                        
                                        return (
                                            <tr 
                                                key={sale.id} 
                                                className="hover:bg-amber-50/30 cursor-pointer transition-colors border-b border-gray-50 last:border-0"
                                                onClick={() => fetchTransactionDetails(sale.id)}
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`p-1.5 rounded-lg ${getOrderTypeInfo(sale.order_type).bg}`}>
                                                            <OrderTypeIcon className={`w-3 h-3 ${getOrderTypeInfo(sale.order_type).text}`} />
                                                        </div>
                                                        <span className="font-mono font-medium text-gray-900">{displayOrderLabel(sale)}</span>
                                                        {sale.is_hotel && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">Hotel</span>}
                                                        {sale.is_personal && <span className="px-2 py-0.5 bg-pink-100 text-pink-700 text-xs font-medium rounded-full">Personal</span>}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-2"><User className="w-3 h-3 text-gray-400" /><span className="text-sm text-gray-900">{sale.customer_name}</span></div>
                                                        <div className="flex items-center gap-2">
                                                            <div className={`p-1 rounded ${cashierConfig.bgColor}`}><CashierIcon className={`w-3 h-3 ${cashierConfig.textColor}`} /></div>
                                                            <span className={`text-xs font-medium ${cashierConfig.textColor}`}>{sale.cashier_name || 'No cashier'}</span>
                                                        </div>
                                                        {sale.room_number && <div className="text-xs text-gray-500">Room #{sale.room_number}</div>}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{sale.items_count} items</td>
                                                <td className="px-6 py-4"><span className="font-bold text-gray-900">{formatPeso(sale.total_amount)}</span></td>
                                                <td className="px-6 py-4">
                                                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                                                        <StatusIcon className="w-3 h-3" />
                                                        {status.label}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500">{formatPHTime(sale.created_at)}</td>
                                                <td className="px-6 py-4">
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedTransaction(sale);
                                                            setShowReceipt(true);
                                                        }}
                                                        className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Print Receipt"
                                                    >
                                                        <Printer className="w-4 h-4 text-gray-500 hover:text-blue-600" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center">
                                                <ShoppingBag className="w-12 h-12 text-gray-300 mb-3" />
                                                <p className="text-gray-500 font-medium">No transactions found</p>
                                                <p className="text-sm text-gray-400 mt-1">Transactions will appear here</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    
                    <div className="px-5 py-3.5 border-t border-gray-100">
                        <Pagination />
                    </div>
                </div>
                
                {/* Right Column */}
                <div className="space-y-5">
                    {/* Top Items */}
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100">
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2.5">
                                    <TrendingUp className="w-4 h-4 text-amber-500" />
                                    <h3 className="text-sm font-semibold text-gray-900">Top Items</h3>
                                </div>
                                <span className="text-xs text-gray-400">{selectedRangeLabel}</span>
                            </div>
                        </div>
                        
                        <div className="p-4">
                            {topItems.length > 0 ? (
                                <div className="space-y-3">
                                    {topItems.map((item, index) => {
                                        const colors = [
                                            { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
                                            { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
                                            { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
                                            { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
                                            { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
                                        ];
                                        const color = colors[index % colors.length];
                                        
                                        return (
                                            <div 
                                                key={item.item_id} 
                                                className="flex items-center justify-between p-3 bg-gray-50 hover:bg-amber-50/50 rounded-xl cursor-pointer transition-all border border-transparent hover:border-amber-100"
                                                onClick={() => {
                                                    setModalData({ itemName: item.item_name });
                                                    setActiveModal('item-details');
                                                }}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center font-bold text-gray-500 text-xs border border-gray-200 shrink-0">#{index + 1}</div>
                                                    <div>
                                                        <p className="font-semibold text-gray-900">{item.item_name}</p>
                                                        <p className="text-sm text-gray-500">{item.quantity} sold</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-gray-900">{formatPeso(item.revenue)}</p>
                                                    <p className="text-xs text-gray-500">{formatPeso(item.price)} each</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                    <p className="text-gray-500 font-medium">No items sold</p>
                                    <p className="text-sm text-gray-400 mt-1">Items will appear here</p>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Quick Stats */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-5">
                        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Quick Stats</h3>
                        
                        <div className="space-y-4">
                            <div>
                                <p className="text-sm text-gray-500 mb-2">Payment Methods</p>
                                <div className="space-y-2">
                                    {paymentMethodBreakdown && paymentMethodBreakdown.length > 0 ? (
                                        paymentMethodBreakdown.map((method, index) => (
                                            <div key={index} className="flex items-center justify-between">
                                                <span className="text-sm text-gray-600">{method.method || 'Unknown'}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm font-medium text-gray-900">{formatPeso(method.total)}</span>
                                                    <span className="text-xs text-gray-500">({method.order_count} orders)</span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-gray-400">No payment data</p>
                                    )}
                                </div>
                            </div>
                            
                            <div className="border-t border-gray-200 pt-4">
                                <p className="text-sm text-gray-500 mb-2">Order Types</p>
                                <div className="space-y-2">
                                    {orderTypeBreakdown && orderTypeBreakdown.length > 0 ? (
                                        orderTypeBreakdown.map((type, index) => {
                                            const typeInfo = getOrderTypeInfo(type.order_type);
                                            const TypeIcon = typeInfo.icon;
                                            return (
                                                <div key={index} className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`p-1 rounded-lg ${typeInfo.bg}`}>
                                                            <TypeIcon className={`w-3 h-3 ${typeInfo.text}`} />
                                                        </div>
                                                        <span className="text-sm text-gray-600">{typeInfo.label}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-sm font-medium text-gray-900">{type.count} orders</span>
                                                        <span className="text-xs text-gray-500">{formatPeso(type.total)}</span>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <p className="text-sm text-gray-400">No order type data</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <WeeklySalesChart />
            
            {isLoadingTransaction && (
                <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-xl shadow-2xl">
                        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent mx-auto"></div>
                        <p className="text-sm text-gray-600 mt-3">Loading transaction...</p>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}