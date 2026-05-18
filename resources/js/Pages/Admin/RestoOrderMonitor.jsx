import React, { useState, useEffect, useRef, useCallback } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head } from '@inertiajs/react';
import { 
  Clock, 
  CheckCircle, 
  Bell, 
  RefreshCw,
  Play,
  X,
  AlertCircle,
  Utensils,
  ChefHat,
  Coffee,
  Pizza,
  Sandwich,
  Soup,
  Salad,
  Wine,
  Beer,
  GlassWater,
  Calendar,
  Wifi,
  WifiOff,
  AlertOctagon,
  Construction,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Building2,
  MessageSquare,
  Maximize2,
  Minimize2,
  Package,
  CalendarDays,
  ChevronDown,
  Filter,
  Home
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format, subDays } from 'date-fns';
import { useRestoOrders } from '@/hooks/useReverb';

export default function RestoOrderMonitor({ orders = [], hasNewOrder: initialHasNewOrder, stats = {} }) {
  const [activeTab, setActiveTab] = useState('in_progress');
  const [notification, setNotification] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioSystemReady, setAudioSystemReady] = useState(false);
  const [restoOrders, setRestoOrders] = useState(Array.isArray(orders) ? orders : []);
  const [processingOrder, setProcessingOrder] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 10;

  const audioRef = useRef(null);
  const pollTimeoutRef = useRef(null);
  const pollInFlightRef = useRef(false);
  const lastPollSinceRef = useRef(Math.floor(Date.now() / 1000));
  const mountedRef = useRef(true);
  const seenOrderIdsRef = useRef(new Set());
  const notifiedOrderIdsRef = useRef(new Set());
  const isFirstLoadRef = useRef(true);

  // Initialize audio
  useEffect(() => {
    const pathPrefix = window.location.pathname.includes('/admin/')
      ? window.location.pathname.split('/admin/')[0]
      : '';
    const prefixedSource = `${pathPrefix}/sound1.mp3`.replace(/\/{2,}/g, '/');
    
    audioRef.current = new Audio(prefixedSource);
    audioRef.current.volume = 0.5;
    audioRef.current.preload = 'auto';
    
    if (orders && Array.isArray(orders)) {
      const initialOrderIds = orders.map(o => o.id);
      seenOrderIdsRef.current = new Set(initialOrderIds);
      notifiedOrderIdsRef.current = new Set(initialOrderIds);
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  // Play alarm function
  const playAlarm = useCallback(() => {
    if (!soundEnabled || !audioRef.current) return;
    try {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch (e) {}
  }, [soundEnabled]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, []);

  // Filter orders by status
  const pendingOrders = restoOrders.filter(o => o && o.status === 'pending');
  const preparingOrders = restoOrders.filter(o => o && o.status === 'preparing');
  const readyOrders = restoOrders.filter(o => o && o.status === 'ready');
  const completedOrders = restoOrders.filter(o => o && o.status === 'completed');

  // Get current orders based on active tab
  const getCurrentOrders = () => {
    switch(activeTab) {
      case 'in_progress': return [...pendingOrders, ...preparingOrders];
      case 'ready': return readyOrders;
      case 'completed': return completedOrders;
      default: return [];
    }
  };

  const allOrders = getCurrentOrders();
  const totalPages = Math.ceil(allOrders.length / ordersPerPage);
  const indexOfLastOrder = currentPage * ordersPerPage;
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
  const currentOrders = allOrders.slice(indexOfFirstOrder, indexOfLastOrder);

  // Reset pagination on tab change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  // Poll for updates
  const pollForUpdates = useCallback(async () => {
    if (!mountedRef.current || pollInFlightRef.current) return;
    pollInFlightRef.current = true;
    let nextDelayMs = 3000;
    
    try {
      const formattedDate = format(selectedDate, 'yyyy-MM-dd');
      const response = await fetch(`/admin/resto/check-new?date=${formattedDate}&since=${lastPollSinceRef.current}`, {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
        },
      });
      
      if (!mountedRef.current) return;

      if (!response.ok) throw new Error(`Connection failed (${response.status})`);

      const data = await response.json();
      setConnectionStatus('connected');

      const nextSinceRaw = Number(data?.timestamp) || Math.floor(Date.now() / 1000);
      lastPollSinceRef.current = nextSinceRaw > 1000000000000
        ? Math.floor(nextSinceRaw / 1000)
        : nextSinceRaw;
      
      if (data.orders) {
        const currentOrderIds = data.orders.map(o => o.id);
        const newOrderIds = currentOrderIds.filter(id => !seenOrderIdsRef.current.has(id));
        const unnotifiedNewOrderIds = newOrderIds.filter(id => !notifiedOrderIdsRef.current.has(id));
        const hasNewOrders = unnotifiedNewOrderIds.length > 0;
        
        seenOrderIdsRef.current = new Set(currentOrderIds);
        unnotifiedNewOrderIds.forEach(id => notifiedOrderIdsRef.current.add(id));
        
        setRestoOrders(data.orders);
        
        if (isFirstLoadRef.current) {
          isFirstLoadRef.current = false;
        } else if (soundEnabled && hasNewOrders) {
          playAlarm();
          showNotification('🔔 New Order!', 'A new resto order has arrived', 'success');
        }
      }
    } catch (error) {
      console.error('Polling error:', error);
      setConnectionStatus('disconnected');
      nextDelayMs = 5000;
    } finally {
      pollInFlightRef.current = false;
      if (mountedRef.current) {
        if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = setTimeout(pollForUpdates, nextDelayMs);
      }
    }
  }, [selectedDate, soundEnabled, playAlarm]);

  // Start polling
  useEffect(() => {
    pollForUpdates();
    return () => {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, [pollForUpdates]);

  // WebSocket real-time updates
  const handleNewOrder = useCallback((order) => {
    if (!order || !order.id) return;
    
    if (!seenOrderIdsRef.current.has(order.id)) {
      seenOrderIdsRef.current.add(order.id);
      notifiedOrderIdsRef.current.add(order.id);
      
      if (soundEnabled) {
        playAlarm();
        showNotification('🔔 New Order!', `Order #${order.txn_number || order.id} arrived`, 'success');
      }
      
      pollForUpdates();
    }
  }, [soundEnabled, playAlarm, pollForUpdates]);

  const handleStatusChange = useCallback((data) => {
    if (!data || !data.id) return;
    
    setRestoOrders(prev => prev.map(order => 
      order.id === data.id ? { ...order, status: data.status } : order
    ));
    
    console.log('[Resto] Order status updated from WebSocket:', data.id, data.status);
  }, []);

  useRestoOrders(handleNewOrder, handleStatusChange);

  const showNotification = (title, message, type = 'info') => {
    setNotification({ title, message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const closeNotification = () => setNotification(null);

  const toggleSound = () => {
    setSoundEnabled(prev => !prev);
    showNotification(
      !soundEnabled ? '🔊 Sound ON' : '🔇 Sound OFF',
      !soundEnabled ? 'New order notifications enabled' : 'New order notifications disabled',
      'info'
    );
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullScreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullScreen(false)).catch(() => {});
    }
  };

  // Update order status
  const updateOrderStatus = async (orderId, action) => {
    setProcessingOrder(orderId);
    
    const endpoint = action === 'start' ? 'start' : action === 'ready' ? 'ready' : 'complete';
    const successMessage = action === 'start' 
      ? { title: '✅ Started', message: `Order #${orderId} is now preparing` }
      : action === 'ready'
      ? { title: '✅ Ready', message: `Order #${orderId} is ready for serving` }
      : { title: '✅ Completed', message: `Order #${orderId} completed` };
    const newStatus = action === 'start' ? 'preparing' : action === 'ready' ? 'ready' : 'completed';
    
    try {
      const response = await fetch(`/admin/resto/orders/${orderId}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
          'Accept': 'application/json'
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        setRestoOrders(prev => prev.map(order => 
          order.id === orderId ? { ...order, status: newStatus } : order
        ));
        showNotification(successMessage.title, successMessage.message, 'success');
      } else {
        showNotification('⚠️ Error', data.message || 'Failed to update order', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showNotification('❌ Error', 'Failed to update order', 'error');
    } finally {
      setProcessingOrder(null);
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'pending': return 'bg-amber-600 text-white border-amber-700';
      case 'preparing': return 'bg-blue-600 text-white border-blue-700';
      case 'ready': return 'bg-emerald-600 text-white border-emerald-700';
      case 'completed': return 'bg-gray-600 text-white border-gray-700';
      default: return 'bg-gray-600 text-white border-gray-700';
    }
  };

  const ConnectionStatusBadge = () => (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
      connectionStatus === 'connected' 
        ? 'text-emerald-600 border-emerald-200 bg-emerald-50' 
        : 'text-red-600 border-red-200 bg-red-50'
    }`}>
      {connectionStatus === 'connected' ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
      <span className="text-sm font-medium">{connectionStatus === 'connected' ? 'Live' : 'Offline'}</span>
    </div>
  );

  // Format time to Philippine time
  const formatPHTime = (timeString) => {
    if (!timeString) return '';
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString('en-PH', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Manila'
      });
    } catch { return timeString; }
  };

  const isHotelOrder = (order) => order?.payment_method_name === 'Hotel' || order?.is_hotel === true;

  const OrderCard = ({ order }) => {
    const [expanded, setExpanded] = useState(false);
    if (!order) return null;
    if (!order.items || !Array.isArray(order.items)) order.items = [];

    const itemSummary = order.items.map(i => `${i.quantity}x ${i.name}${i.variant_label ? ` (${i.variant_label})` : ''}`).join(', ');

    return (
      <div className={`bg-white rounded-lg shadow-sm overflow-hidden border transition-all hover:shadow-md ${
        order.status === 'pending' ? 'border-amber-400' :
        order.status === 'preparing' ? 'border-blue-400' :
        order.status === 'ready' ? 'border-emerald-400' :
        order.status === 'completed' ? 'border-gray-400' : 'border-gray-200'
      }`}>
        {/* Header */}
        <div className={`px-3 py-2.5 ${getStatusColor(order.status)} flex items-center gap-2`}>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="font-bold text-white text-sm whitespace-nowrap">{order.txn_number || order.order_number}</span>
            <span className="px-1.5 py-0.5 text-xs rounded-full bg-white/20 text-white capitalize whitespace-nowrap">
              {order.order_type?.replace('_', ' ') || 'Takeout'}
            </span>
            {isHotelOrder(order) && (
              <span className="px-1.5 py-0.5 text-xs rounded-full bg-amber-500 text-white flex items-center gap-0.5 whitespace-nowrap">
                <Building2 className="w-2.5 h-2.5" />
                {order.room_number ? `Rm ${order.room_number}` : 'Hotel'}
              </span>
            )}
            <div className="flex items-center gap-1 text-white/70 text-xs ml-1 whitespace-nowrap">
              <Clock className="w-3 h-3" />
              {formatPHTime(order.created_at)}
            </div>
          </div>

          {/* Action button */}
          <div className="flex items-center gap-1.5 shrink-0">
            {order.status === 'pending' && (
              <button
                onClick={() => updateOrderStatus(order.id, 'start')}
                disabled={processingOrder === order.id}
                className="px-3 py-1.5 bg-white text-amber-600 rounded-md hover:bg-amber-50 flex items-center gap-1 transition-all disabled:opacity-50 font-bold text-xs border border-amber-600"
              >
                {processingOrder === order.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                START
              </button>
            )}
            {order.status === 'preparing' && (
              <button
                onClick={() => updateOrderStatus(order.id, 'ready')}
                disabled={processingOrder === order.id}
                className="px-3 py-1.5 bg-white text-emerald-600 rounded-md hover:bg-emerald-50 flex items-center gap-1 transition-all disabled:opacity-50 font-bold text-xs border border-emerald-600"
              >
                {processingOrder === order.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                READY
              </button>
            )}
            {order.status === 'ready' && (
              <button
                onClick={() => updateOrderStatus(order.id, 'complete')}
                disabled={processingOrder === order.id}
                className="px-3 py-1.5 bg-white text-gray-600 rounded-md hover:bg-gray-50 flex items-center gap-1 transition-all disabled:opacity-50 font-bold text-xs border border-gray-400"
              >
                {processingOrder === order.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Tray className="w-3.5 h-3.5" />}
                SERVE
              </button>
            )}
            {order.status === 'completed' && (
              <span className="px-3 py-1.5 bg-gray-100 text-gray-500 rounded-md text-xs font-bold border border-gray-300 opacity-75">DONE ✓</span>
            )}

            <button onClick={() => setExpanded(v => !v)} className="p-1.5 rounded-md bg-white/20 hover:bg-white/30 text-white">
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Item summary */}
        <div className="px-3 py-1.5 flex items-center gap-2 bg-gray-50 border-b border-gray-100">
          <Utensils className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="text-xs text-gray-600 truncate">
            <span className="font-medium text-gray-700">{order.items.length} item{order.items.length !== 1 ? 's' : ''}:</span> {itemSummary || 'No items'}
          </span>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="px-3 py-2.5">
            {order.items.length === 0 ? (
              <div className="text-center py-4 text-gray-400 text-sm bg-gray-50 rounded-lg">No items</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {order.items.map((item) => (
                  <div key={item.id} className="px-3 py-2 rounded-lg border bg-gray-50 border-gray-200">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 text-sm">{item.quantity}x {item.name}</span>
                      {item.size && (
                        <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-indigo-100 text-indigo-700">
                          {item.size}
                        </span>
                      )}
                      {item.temperature === 'hot' && (
                        <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-700">
                          🔥 Hot
                        </span>
                      )}
                      {item.temperature === 'iced' && (
                        <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-700">
                          🧊 Iced
                        </span>
                      )}
                    </div>
                    {item.notes && (
                      <div className="mt-1 text-xs text-amber-600 italic flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> {item.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {order.notes && (
              <div className="mt-2 px-3 py-2 bg-amber-50 rounded-lg text-xs text-amber-700 border border-amber-200">
                <span className="font-medium">Notes:</span> {order.notes}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const Pagination = () => {
    if (totalPages <= 1) return null;
    return (
      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm text-gray-700">
          Showing <span className="font-medium">{indexOfFirstOrder + 1}</span> to <span className="font-medium">{Math.min(indexOfLastOrder, allOrders.length)}</span> of <span className="font-medium">{allOrders.length}</span> orders
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-2 rounded-lg border border-gray-300 bg-white disabled:opacity-50">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium">{currentPage}</span>
          <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="p-2 rounded-lg border border-gray-300 bg-white disabled:opacity-50">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <AdminLayout>
      <Head title="Resto Order Monitor" />
      
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-slide-in ${
          notification.type === 'success' ? 'bg-green-600' : notification.type === 'error' ? 'bg-red-600' : 'bg-yellow-600'
        } text-white`}>
          {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : notification.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
          <div>
            <div className="font-bold">{notification.title}</div>
            <div className="text-sm opacity-90">{notification.message}</div>
          </div>
          <button onClick={closeNotification} className="p-1 hover:bg-white/20 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="min-h-screen bg-gray-50">
        <div className="py-6 px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl shadow-lg">
                  <Home className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Resto Orders</h1>
                  <p className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Clean Kitchen • Auto-refresh every 3 seconds
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ConnectionStatusBadge />
                <button onClick={toggleSound} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border ${soundEnabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                  {soundEnabled ? <Bell className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {soundEnabled ? 'On' : 'Off'}
                </button>
                <button onClick={toggleFullscreen} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700">
                  {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="mb-6 border-b border-gray-200">
            <div className="flex space-x-1">
              <button
                onClick={() => setActiveTab('in_progress')}
                className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
                  activeTab === 'in_progress'
                    ? 'border-amber-600 text-amber-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <Construction className="w-4 h-4" />
                In Progress
                {(pendingOrders.length + preparingOrders.length + readyOrders.length) > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800">
                    {pendingOrders.length + preparingOrders.length + readyOrders.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
                  activeTab === 'completed'
                    ? 'border-gray-600 text-gray-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <BadgeCheck className="w-4 h-4" />
                Completed
                {completedOrders.length > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-800">
                    {completedOrders.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            {activeTab === 'in_progress' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Pending Column */}
                <div className="bg-red-50/80 rounded-xl p-4 border border-red-200">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-red-200">
                    <div className="p-1.5 bg-red-100 rounded-lg">
                      <AlertOctagon className="w-4 h-4 text-red-600" />
                    </div>
                    <span className="text-sm font-bold text-red-700">Pending</span>
                    <span className="ml-auto px-2 py-0.5 text-xs font-bold bg-red-200 text-red-800 rounded-full">
                      {pendingOrders.length}
                    </span>
                  </div>
                  {pendingOrders.length === 0 ? (
                    <div className="text-center text-xs text-red-400 italic py-8">
                      No pending orders
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {pendingOrders.map(order => <OrderCard key={order.id} order={order} />)}
                    </div>
                  )}
                </div>

                {/* Preparing Column */}
                <div className="bg-amber-50/80 rounded-xl p-4 border border-amber-200">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-amber-200">
                    <div className="p-1.5 bg-amber-100 rounded-lg">
                      <Construction className="w-4 h-4 text-amber-600" />
                    </div>
                    <span className="text-sm font-bold text-amber-700">Preparing</span>
                    <span className="ml-auto px-2 py-0.5 text-xs font-bold bg-amber-200 text-amber-800 rounded-full">
                      {preparingOrders.length}
                    </span>
                  </div>
                  {preparingOrders.length === 0 ? (
                    <div className="text-center text-xs text-amber-400 italic py-8">
                      No preparing orders
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {preparingOrders.map(order => <OrderCard key={order.id} order={order} />)}
                    </div>
                  )}
                </div>

                {/* Ready Column */}
                <div className="bg-emerald-50/80 rounded-xl p-4 border border-emerald-200">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-emerald-200">
                    <div className="p-1.5 bg-emerald-100 rounded-lg">
                      <Package className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span className="text-sm font-bold text-emerald-700">Ready</span>
                    <span className="ml-auto px-2 py-0.5 text-xs font-bold bg-emerald-200 text-emerald-800 rounded-full">
                      {readyOrders.length}
                    </span>
                  </div>
                  {readyOrders.length === 0 ? (
                    <div className="text-center text-xs text-emerald-400 italic py-8">
                      No ready orders
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {readyOrders.map(order => <OrderCard key={order.id} order={order} />)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'completed' && (
              <div>
                <div className="mb-3">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <BadgeCheck className="w-5 h-5 text-gray-500" />
                    Completed Orders
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">{allOrders.length} order{allOrders.length !== 1 ? 's' : ''}</p>
                </div>

                {allOrders.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="inline-flex p-4 bg-gray-100 rounded-full mb-4">
                      <BadgeCheck className="w-12 h-12 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No orders</h3>
                    <p className="text-gray-500">Orders will appear here automatically</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {currentOrders.map(order => <OrderCard key={order.id} order={order} />)}
                    </div>
                    <Pagination />
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slide-in { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
      `}</style>
    </AdminLayout>
  );
}
