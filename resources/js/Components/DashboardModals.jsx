import React, { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import Modal from './Modal';
import { CheckCircle, XCircle, Package, Clock, TrendingUp, ShoppingBag, AlertCircle, Bell } from 'lucide-react';

// Format currency in Philippine Peso
const formatPeso = (amount) => {
    return `₱${parseFloat(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

export default function DashboardModals({ 
    activeModal, 
    onClose, 
    modalData,
    onAction 
}) {
    const [notifications, setNotifications] = useState([
        { id: 1, type: 'order', message: 'New order #1024 received', time: '5 min ago', read: false },
        { id: 2, type: 'inventory', message: 'Coca-Cola is running low (5 remaining)', time: '2 hours ago', read: false },
        { id: 3, type: 'payment', message: 'Payment for order #1023 completed', time: '3 hours ago', read: true },
        { id: 4, type: 'system', message: 'Daily backup completed successfully', time: '1 day ago', read: true },
    ]);
    
    // Handle modal actions
    const handleModalAction = (action, data) => {
        if (onAction) onAction(action, data);
        onClose();
    };
    
    // Mark notification as read
    const markAsRead = (id) => {
        setNotifications(notifications.map(notif => 
            notif.id === id ? { ...notif, read: true } : notif
        ));
    };
    
    // Mark all as read
    const markAllAsRead = () => {
        setNotifications(notifications.map(notif => ({ ...notif, read: true })));
    };
    
    // Get unread count
    const unreadCount = notifications.filter(n => !n.read).length;
    
    // Revenue Details Modal
    const RevenueModal = () => (
        <Modal isOpen={activeModal === 'revenue'} onClose={onClose} title="Revenue Details" size="lg">
            <div className="space-y-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center">
                        <TrendingUp className="w-5 h-5 text-yellow-600 mr-2" />
                        <h4 className="font-medium text-yellow-800">Today's Revenue Breakdown</h4>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h4 className="font-medium text-gray-900 mb-3">By Hour</h4>
                        <div className="space-y-3">
                            {[
                                { hour: '9:00 AM', amount: 1250.50 },
                                { hour: '10:00 AM', amount: 1850.75 },
                                { hour: '11:00 AM', amount: 2250.25 },
                                { hour: '12:00 PM', amount: 3150.00 },
                                { hour: '1:00 PM', amount: 2750.50 },
                            ].map((item, index) => (
                                <div key={index} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg">
                                    <span className="text-gray-700">{item.hour}</span>
                                    <span className="font-medium">{formatPeso(item.amount)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div>
                        <h4 className="font-medium text-gray-900 mb-3">By Category</h4>
                        <div className="space-y-3">
                            {[
                                { category: 'Food', amount: 12500.75, percentage: '65%' },
                                { category: 'Beverages', amount: 4500.25, percentage: '23%' },
                                { category: 'Desserts', amount: 1800.50, percentage: '9%' },
                                { category: 'Others', amount: 750.00, percentage: '3%' },
                            ].map((item, index) => (
                                <div key={index} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-700">{item.category}</span>
                                        <div className="flex items-center space-x-3">
                                            <span className="font-medium">{formatPeso(item.amount)}</span>
                                            <span className="text-sm text-gray-500">{item.percentage}</span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div 
                                            className="bg-yellow-500 h-2 rounded-full" 
                                            style={{ width: item.percentage }}
                                        ></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                
                <div className="pt-4 border-t">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-sm text-gray-600">Total Revenue Today</p>
                            <p className="text-2xl font-bold text-gray-900">{formatPeso(modalData?.todaySales || 0)}</p>
                        </div>
                        <button className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-medium">
                            Download Report
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
    
    // Pending Orders Modal
    const PendingOrdersModal = () => (
        <Modal isOpen={activeModal === 'pending-orders'} onClose={onClose} title="Pending Orders" size="lg">
            <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center">
                        <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                        <h4 className="font-medium text-red-800">Orders Requiring Attention</h4>
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-sm text-gray-500 border-b">
                                <th className="pb-3 font-medium">Order #</th>
                                <th className="pb-3 font-medium">Items</th>
                                <th className="pb-3 font-medium">Time</th>
                                <th className="pb-3 font-medium">Status</th>
                                <th className="pb-3 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                { id: 1025, items: 'Pepperoni Pizza, Coke', time: '15 min ago', status: 'preparing' },
                                { id: 1026, items: 'Classic Burger, Fries', time: '25 min ago', status: 'pending' },
                                { id: 1027, items: 'Caesar Salad', time: '30 min ago', status: 'ready' },
                            ].map((order) => (
                                <tr key={order.id} className="border-b hover:bg-gray-50">
                                    <td className="py-3 font-medium">#{order.id}</td>
                                    <td className="py-3">{order.items}</td>
                                    <td className="py-3 text-gray-600">{order.time}</td>
                                    <td className="py-3">
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                            order.status === 'ready' ? 'bg-green-100 text-green-800' :
                                            order.status === 'preparing' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                        </span>
                                    </td>
                                    <td className="py-3">
                                        <div className="flex space-x-2">
                                            <button 
                                                onClick={() => handleModalAction('mark-completed', order.id)}
                                                className="px-3 py-1 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600"
                                            >
                                                Complete
                                            </button>
                                            <button className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300">
                                                View
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                
                <div className="pt-4 border-t">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-sm text-gray-600">Total Pending Orders</p>
                            <p className="text-2xl font-bold text-gray-900">{modalData?.pendingOrders || 0}</p>
                        </div>
                        <div className="space-x-3">
                            <button className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium">
                                Notify Kitchen
                            </button>
                            <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium">
                                Print Summary
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
    
    // Inventory Modal
    const InventoryModal = () => (
        <Modal isOpen={activeModal === 'inventory'} onClose={onClose} title="Low Stock Inventory" size="lg">
            <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center">
                        <Package className="w-5 h-5 text-yellow-600 mr-2" />
                        <h4 className="font-medium text-yellow-800">Items Need Restocking</h4>
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-sm text-gray-500 border-b">
                                <th className="pb-3 font-medium">Item</th>
                                <th className="pb-3 font-medium">Category</th>
                                <th className="pb-3 font-medium">Current Stock</th>
                                <th className="pb-3 font-medium">Min Level</th>
                                <th className="pb-3 font-medium">Status</th>
                                <th className="pb-3 font-medium">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                { name: 'Coca-Cola', category: 'Beverages', stock: 5, min: 20, status: 'critical' },
                                { name: 'Lettuce', category: 'Vegetables', stock: 3, min: 10, status: 'critical' },
                                { name: 'Beef Patty', category: 'Meat', stock: 8, min: 15, status: 'low' },
                                { name: 'Tomatoes', category: 'Vegetables', stock: 12, min: 20, status: 'low' },
                            ].map((item, index) => (
                                <tr key={index} className="border-b hover:bg-gray-50">
                                    <td className="py-3 font-medium">{item.name}</td>
                                    <td className="py-3 text-gray-600">{item.category}</td>
                                    <td className="py-3">
                                        <span className={`font-medium ${
                                            item.status === 'critical' ? 'text-red-600' : 'text-yellow-600'
                                        }`}>
                                            {item.stock} pcs
                                        </span>
                                    </td>
                                    <td className="py-3 text-gray-600">{item.min} pcs</td>
                                    <td className="py-3">
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                            item.status === 'critical' ? 'bg-red-100 text-red-800' :
                                            'bg-yellow-100 text-yellow-800'
                                        }`}>
                                            {item.status === 'critical' ? 'Critical' : 'Low'}
                                        </span>
                                    </td>
                                    <td className="py-3">
                                        <button 
                                            onClick={() => handleModalAction('restock', item.name)}
                                            className="px-3 py-1 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
                                        >
                                            Order More
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                
                <div className="pt-4 border-t">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-sm text-gray-600">Total Items Low on Stock</p>
                            <p className="text-2xl font-bold text-gray-900">{modalData?.lowStockItems || 0}</p>
                        </div>
                        <div className="space-x-3">
                            <button className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-medium">
                                Generate Purchase Order
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
    
    // Return all modal components
    return (
        <>
            {activeModal === 'revenue' && <RevenueModal />}
            {activeModal === 'pending-orders' && <PendingOrdersModal />}
            {activeModal === 'inventory' && <InventoryModal />}
        </>
    );
}