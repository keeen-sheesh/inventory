import React, { useState, useEffect, useRef, useCallback } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, router } from '@inertiajs/react';
import { 
  Clock, CheckCircle, Bell, RefreshCw, Play, X, AlertCircle,
  Utensils, Volume2, VolumeX, ChefHat, Coffee, Wifi, WifiOff, 
  AlertOctagon, Construction, BadgeCheck, ChevronLeft, ChevronRight,
  Building2, MessageSquare, Package, CalendarDays, ChevronDown, Filter,
  CalendarRange, CalendarCheck, CalendarX, CalendarClock, Maximize, Minimize,
  Moon, Sun, Ban
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { formatPHTime } from '@/utils/phTime';
import { useKitchenOrders } from '@/hooks/useReverb';

const getCsrfToken = () => {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
};

const refreshCsrfToken = async () => {
  try {
    const response = await fetch('/csrf-token', {
      method: 'GET',
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' },
    });
    if (response.ok) {
      const data = await response.json();
      const metaTag = document.querySelector('meta[name="csrf-token"]');
      if (metaTag) metaTag.setAttribute('content', data.token);
      return data.token;
    }
  } catch (error) {
    console.error('Failed to refresh CSRF token:', error);
  }
  return null;
};

export default function Kitchen({ orders = [], userRole = 'admin' }) {
  const [activeTab, setActiveTab] = useState('in_progress');
  const [notification, setNotification] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioSystemReady, setAudioSystemReady] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('kitchenDarkMode');
    return saved !== null ? saved === 'true' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [kitchenOrders, setKitchenOrders] = useState([]);
  const [processingOrder, setProcessingOrder] = useState(null);
  const [dateFilter, setDateFilter] = useState('today');
  const [customDateRange, setCustomDateRange] = useState({
    from: new Date(),
    to: new Date()
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [showControlPanel, setShowControlPanel] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isAlarmPlaying, setIsAlarmPlaying] = useState(false);
  
  const audioRef = useRef(null);
  const pollTimeoutRef = useRef(null);
  const pollInFlightRef = useRef(false);
  const lastPollSinceRef = useRef(Math.floor(Date.now() / 1000));
  const mountedRef = useRef(true);
  const seenOrderIdsRef = useRef(new Set());
  const notifiedOrderIdsRef = useRef(new Set());
  const isFirstLoadRef = useRef(true);
  const alarmStopTimerRef = useRef(null);
  const soundEnabledRef = useRef(true);
  const audioSystemReadyRef = useRef(false);
  
  const ordersPerPage = 10;
  const isFoodKitchen = userRole === 'kitchen';
  const isAdmin = userRole === 'admin' || userRole === 'manager';
  
  const dateFilterOptions = [
    { value: 'today', label: 'Today', icon: CalendarCheck },
    { value: 'yesterday', label: 'Yesterday', icon: CalendarX },
    { value: 'this_week', label: 'This Week', icon: CalendarRange },
    { value: 'last_week', label: 'Last Week', icon: CalendarRange },
    { value: 'this_month', label: 'This Month', icon: CalendarClock },
    { value: 'last_month', label: 'Last Month', icon: CalendarClock },
    { value: 'custom', label: 'Custom Range', icon: CalendarDays },
  ];
  
  const getDateRangeParams = (filter, customFrom, customTo) => {
    const now = new Date();
    let startDate, endDate;
    
    switch(filter) {
      case 'today':
        startDate = format(now, 'yyyy-MM-dd');
        endDate = format(now, 'yyyy-MM-dd');
        break;
      case 'yesterday':
        startDate = format(subDays(now, 1), 'yyyy-MM-dd');
        endDate = format(subDays(now, 1), 'yyyy-MM-dd');
        break;
      case 'this_week':
        startDate = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        endDate = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        break;
      case 'last_week':
        startDate = format(startOfWeek(subDays(now, 7), { weekStartsOn: 1 }), 'yyyy-MM-dd');
        endDate = format(endOfWeek(subDays(now, 7), { weekStartsOn: 1 }), 'yyyy-MM-dd');
        break;
      case 'this_month':
        startDate = format(startOfMonth(now), 'yyyy-MM-dd');
        endDate = format(endOfMonth(now), 'yyyy-MM-dd');
        break;
      case 'last_month':
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        startDate = format(startOfMonth(lastMonth), 'yyyy-MM-dd');
        endDate = format(endOfMonth(lastMonth), 'yyyy-MM-dd');
        break;
      case 'custom':
        startDate = format(customFrom, 'yyyy-MM-dd');
        endDate = format(customTo, 'yyyy-MM-dd');
        break;
      default:
        startDate = format(now, 'yyyy-MM-dd');
        endDate = format(now, 'yyyy-MM-dd');
    }
    
    return { start_date: startDate, end_date: endDate, date_range: filter };
  };
  
  const getLocalStatus = (order) => {
    // First check if order is cancelled
    if (order.status === 'cancelled') return 'cancelled';
    
    // Then check kitchen_status
    if (order.kitchen_status) {
      if (order.kitchen_status === 'completed') return 'completed';
      if (order.kitchen_status === 'ready') return 'ready';
      if (order.kitchen_status === 'preparing') return 'preparing';
      if (order.kitchen_status === 'pending') return 'pending';
    }
    
    // Then check items
    if (order.items && order.items.length > 0) {
      const itemStatuses = order.items.map(item => item.kitchen_status || 'pending');
      if (itemStatuses.includes('preparing')) return 'preparing';
      if (itemStatuses.includes('ready')) return 'ready';
      if (itemStatuses.includes('pending')) return 'pending';
      if (itemStatuses.every(s => s === 'completed')) return 'completed';
    }
    
    return order.status || 'pending';
  };
  
  const filterOrdersByKitchenType = (orders) => {
    if (isAdmin) return orders;
    
    return orders.filter(order => 
      order.items?.some(item => 
        isFoodKitchen ? item.kitchen_type === 'kitchen' : item.kitchen_type === 'resto'
      )
    );
  };
  
  const showNotification = (title, message, type = 'info') => {
    if (notification) setNotification(null);
    setTimeout(() => {
      setNotification({ title, message, type });
      setTimeout(() => setNotification(null), 3000);
    }, 50);
  };
  
  // Filter orders by date range
  const filterOrdersByDate = (orders, filter, from, to) => {
    const { start_date, end_date } = getDateRangeParams(filter, from, to);
    const startDateObj = new Date(start_date);
    const endDateObj = new Date(end_date);
    endDateObj.setHours(23, 59, 59, 999);
    
    return orders.filter(order => {
      const orderDate = new Date(order.created_at);
      return orderDate >= startDateObj && orderDate <= endDateObj;
    });
  };
  
  // Set orders from props
  useEffect(() => {
    if (orders && Array.isArray(orders)) {
      // Filter by date range first
      const filteredByDate = filterOrdersByDate(orders, dateFilter, customDateRange.from, customDateRange.to);
      setKitchenOrders(filteredByDate);
      const orderIds = filteredByDate.map(o => o.id);
      seenOrderIdsRef.current = new Set(orderIds);
      notifiedOrderIdsRef.current = new Set(orderIds);
      isFirstLoadRef.current = false;
    }
  }, [orders, dateFilter, customDateRange.from, customDateRange.to]);
  
  const filteredByKitchenType = filterOrdersByKitchenType(kitchenOrders);
  
  const pendingOrders = filteredByKitchenType.filter(o => getLocalStatus(o) === 'pending');
  const preparingOrders = filteredByKitchenType.filter(o => getLocalStatus(o) === 'preparing');
  const readyOrders = filteredByKitchenType.filter(o => getLocalStatus(o) === 'ready');
  const completedOrders = filteredByKitchenType.filter(o => getLocalStatus(o) === 'completed');
  const cancelledOrders = filteredByKitchenType.filter(o => getLocalStatus(o) === 'cancelled');
  
  const getCurrentOrders = () => {
    switch(activeTab) {
      case 'in_progress': 
        return [...pendingOrders, ...preparingOrders, ...readyOrders];
      case 'completed': 
        return completedOrders;
      case 'cancelled':
        return cancelledOrders;
      default: 
        return [];
    }
  };
  
  const allOrders = getCurrentOrders();
  const totalPages = Math.ceil(allOrders.length / ordersPerPage);
  const indexOfLastOrder = currentPage * ordersPerPage;
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
  const currentOrders = allOrders.slice(indexOfFirstOrder, indexOfLastOrder);
  
  const getDateRangeDisplay = () => {
    if (dateFilter === 'custom') {
      return `${format(customDateRange.from, 'MMM d, yyyy')} - ${format(customDateRange.to, 'MMM d, yyyy')}`;
    }
    return dateFilterOptions.find(option => option.value === dateFilter)?.label;
  };
  
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('kitchenDarkMode', darkMode);
  }, [darkMode]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, dateFilter]);
  
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);
  
  useEffect(() => {
    audioSystemReadyRef.current = audioSystemReady;
  }, [audioSystemReady]);
  
  useEffect(() => {
    audioRef.current = new Audio('/sound1.mp3');
    audioRef.current.volume = 0.7;
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);
  
  const stopAlarm = useCallback(() => {
    if (alarmStopTimerRef.current) {
      clearTimeout(alarmStopTimerRef.current);
      alarmStopTimerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.loop = false;
    }
    setIsAlarmPlaying(false);
  }, []);
  
  const playAlarm = useCallback(() => {
    if (!soundEnabledRef.current || !audioRef.current || isAlarmPlaying) return;
    
    try {
      if (alarmStopTimerRef.current) {
        clearTimeout(alarmStopTimerRef.current);
      }
      
      stopAlarm();
      
      setIsAlarmPlaying(true);
      audioRef.current.currentTime = 0;
      audioRef.current.loop = true;
      
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => console.warn('Alarm playback failed:', error));
      }
      
      alarmStopTimerRef.current = setTimeout(() => {
        stopAlarm();
      }, 2000);
    } catch (error) {
      console.error('Play error:', error);
      setIsAlarmPlaying(false);
    }
  }, [isAlarmPlaying, stopAlarm]);
  
  const initializeAudioSystem = useCallback(() => {
    if (audioSystemReady || !audioRef.current) return;
    
    audioRef.current.play()
      .then(() => {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setAudioSystemReady(true);
        showNotification('Audio Ready', 'Sound system initialized successfully', 'success');
      })
      .catch(error => {
        console.log('Audio initialization needs user gesture:', error.message);
      });
  }, [audioSystemReady]);
  
  const pollForUpdates = useCallback(async () => {
    if (!mountedRef.current || pollInFlightRef.current) return;
    pollInFlightRef.current = true;
    
    try {
      const { start_date, end_date, date_range } = getDateRangeParams(
        dateFilter, 
        customDateRange.from, 
        customDateRange.to
      );
      
      const url = `/admin/kitchen/check-new?since=${lastPollSinceRef.current}&date_range=${date_range}&start_date=${start_date}&end_date=${end_date}`;
      
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-TOKEN': getCsrfToken(),
        },
      });
      
      if (!mountedRef.current) return;
      
      if (response.status === 419) {
        window.location.reload();
        return;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      setConnectionStatus('connected');
      
      const nextSinceRaw = Number(data?.timestamp) || Math.floor(Date.now() / 1000);
      lastPollSinceRef.current = nextSinceRaw > 1000000000000 
        ? Math.floor(nextSinceRaw / 1000) 
        : nextSinceRaw;
      
      if (data.orders && data.orders.length > 0) {
        // Filter new orders by current date range
        const filteredNewOrders = filterOrdersByDate(data.orders, dateFilter, customDateRange.from, customDateRange.to);
        const currentOrderIds = filteredNewOrders.map(order => order.id);
        const newOrderIds = currentOrderIds.filter(id => !seenOrderIdsRef.current.has(id));
        
        if (newOrderIds.length > 0) {
          setKitchenOrders(filteredNewOrders);
          seenOrderIdsRef.current = new Set(currentOrderIds);
          newOrderIds.forEach(id => notifiedOrderIdsRef.current.add(id));
          
          if (!isFirstLoadRef.current && soundEnabledRef.current && audioSystemReadyRef.current) {
            playAlarm();
            showNotification('New Order', `${newOrderIds.length} new order(s) arrived`, 'success');
          }
        }
        
        isFirstLoadRef.current = false;
      }
    } catch (error) {
      console.error('Polling error:', error);
      setConnectionStatus('disconnected');
    } finally {
      pollInFlightRef.current = false;
      if (mountedRef.current) {
        if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = setTimeout(pollForUpdates, 5000);
      }
    }
  }, [dateFilter, customDateRange.from, customDateRange.to, playAlarm]);
  
  const updateOrderStatus = async (orderId, action, retry = false) => {
    setProcessingOrder(orderId);
    
    try {
      const response = await fetch(`/admin/kitchen/orders/${orderId}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': getCsrfToken(),
          'Accept': 'application/json'
        },
      });
      
      if (response.status === 419 && !retry) {
        await refreshCsrfToken();
        return updateOrderStatus(orderId, action, true);
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setKitchenOrders(prev => prev.map(order => {
          if (order.id !== orderId) return order;
          
          const newStatus = action === 'start' ? 'preparing' : 'ready';
          const updatedItems = (order.items || []).map(item => ({
            ...item,
            kitchen_status: newStatus,
          }));
          
          return { ...order, kitchen_status: newStatus, items: updatedItems };
        }));
        
        const message = action === 'start' ? 'Order started preparing' : 'Order ready for pickup';
        showNotification('Success', message, 'success');
      } else {
        showNotification('Error', data.message || 'Failed to update order', 'error');
      }
    } catch (error) {
      console.error('Update error:', error);
      showNotification('Error', 'Failed to update order status', 'error');
    } finally {
      setProcessingOrder(null);
    }
  };
  
  const handleFilterChange = (filter) => {
    setDateFilter(filter);
    setShowDatePicker(false);
    // Re-filter orders when filter changes
    if (orders && Array.isArray(orders)) {
      const filteredByDate = filterOrdersByDate(orders, filter, customDateRange.from, customDateRange.to);
      setKitchenOrders(filteredByDate);
    }
    const label = dateFilterOptions.find(option => option.value === filter)?.label;
    showNotification('Filter Applied', label, 'success');
  };
  
  const handleCustomRangeApply = () => {
    setDateFilter('custom');
    setShowDatePicker(false);
    // Re-filter orders with custom range
    if (orders && Array.isArray(orders)) {
      const filteredByDate = filterOrdersByDate(orders, 'custom', customDateRange.from, customDateRange.to);
      setKitchenOrders(filteredByDate);
    }
    showNotification('Custom Range Applied', 
      `${format(customDateRange.from, 'MMM d, yyyy')} - ${format(customDateRange.to, 'MMM d, yyyy')}`, 
      'success'
    );
  };
  
  const handleOrderAction = (orderId, action) => {
    if (action === 'start') stopAlarm();
    updateOrderStatus(orderId, action);
  };
  
  const toggleDarkMode = () => {
    setDarkMode(prev => !prev);
    showNotification(!darkMode ? 'Night Mode' : 'Day Mode', '', 'info');
  };
  
  const toggleSound = () => {
    initializeAudioSystem();
    if (soundEnabled) {
      stopAlarm();
    }
    setSoundEnabled(prev => !prev);
    showNotification(!soundEnabled ? 'Sound On' : 'Sound Off', '', 'info');
  };
  
  const testAlarm = () => {
    initializeAudioSystem();
    if (audioSystemReady) {
      playAlarm();
      showNotification('Sound Test', 'Testing kitchen alarm system', 'success');
    } else {
      showNotification('Audio Not Ready', 'Click the speaker button first', 'info');
    }
  };
  
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.error(err));
      setIsFullScreen(true);
    } else {
      document.exitFullscreen();
      setIsFullScreen(false);
    }
  };
  
  const refreshOrders = () => {
    if (orders && Array.isArray(orders)) {
      const filteredByDate = filterOrdersByDate(orders, dateFilter, customDateRange.from, customDateRange.to);
      setKitchenOrders(filteredByDate);
    }
    showNotification('Refreshing', 'Refreshing orders...', 'info');
  };
  
  useEffect(() => {
    pollForUpdates();
    
    const keepAlive = setInterval(() => {
      fetch('/keep-alive').catch(() => {});
    }, 5 * 60 * 1000);
    
    return () => {
      clearInterval(keepAlive);
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
      if (alarmStopTimerRef.current) clearTimeout(alarmStopTimerRef.current);
      mountedRef.current = false;
    };
  }, []);
  
  useKitchenOrders(
    useCallback((order) => {
      if (order?.id && !seenOrderIdsRef.current.has(order.id)) {
        seenOrderIdsRef.current.add(order.id);
        if (soundEnabledRef.current && audioSystemReadyRef.current) {
          playAlarm();
        }
        pollForUpdates();
      }
    }, [playAlarm, pollForUpdates]),
    useCallback((data) => {
      if (data?.id) {
        setKitchenOrders(prev => prev.map(order => {
          if (order.id !== data.id) return order;
          
          const updatedItems = (order.items || []).map(item => 
            data.item_id && item.id === data.item_id 
              ? { ...item, kitchen_status: data.status } 
              : item
          );
          
          return { ...order, items: updatedItems };
        }));
      }
    }, [])
  );
  
  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-red-600 text-white',
      preparing: 'bg-yellow-500 text-white',
      ready: 'bg-blue-600 text-white',
      completed: 'bg-green-600 text-white',
      cancelled: 'bg-gray-600 text-white',
    };
    return colors[status] || 'bg-gray-600 text-white';
  };
  
  const getStatusBadge = (status) => {
    const badges = {
      pending: <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Pending</span>,
      preparing: <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Preparing</span>,
      ready: <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Ready</span>,
      completed: <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Completed</span>,
      cancelled: <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">Cancelled</span>,
    };
    return badges[status] || <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">{status}</span>;
  };
  
  const getItemIcon = (itemName) => {
    const name = itemName.toLowerCase();
    if (name.includes('coffee')) return <Coffee className="w-4 h-4" />;
    if (name.includes('pizza')) return <Utensils className="w-4 h-4" />;
    return <ChefHat className="w-4 h-4" />;
  };
  
  const isHotelOrder = (order) => {
    return order?.payment_method_name === 'Hotel' || order?.is_hotel === true;
  };
  
  const kitchenInfo = isFoodKitchen 
    ? { title: 'Food Kitchen', subtitle: 'Main Dishes • Appetizers • Meals', icon: ChefHat, color: 'from-orange-600 to-amber-600' }
    : isAdmin 
      ? { title: 'Kitchen Display', subtitle: 'Monitor all kitchen orders', icon: ChefHat, color: 'from-red-600 to-orange-600' }
      : { title: 'Resto Kitchen', subtitle: 'Beverages • Coffee • Drinks', icon: Coffee, color: 'from-blue-600 to-indigo-600' };
  
  const KitchenIcon = kitchenInfo.icon;
  
  const ConnectionStatusBadge = () => (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
      connectionStatus === 'connected' 
        ? 'text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-950/50'
        : 'text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-800 dark:bg-red-950/50'
    }`}>
      {connectionStatus === 'connected' ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
      <span className="text-sm font-medium">{connectionStatus === 'connected' ? 'Live' : 'Offline'}</span>
    </div>
  );
  
  const OrderCard = ({ order }) => {
    const [expanded, setExpanded] = useState(false);
    const localStatus = getLocalStatus(order);
    
    if (!order) return null;
    
    const filteredItems = isAdmin 
      ? order.items 
      : order.items.filter(item => 
          isFoodKitchen ? item.kitchen_type === 'kitchen' : item.kitchen_type === 'resto'
        );
    
    const itemSummary = filteredItems.map(item => `${item.quantity}x ${item.name}`).join(', ');
    
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border transition-all hover:shadow-md ${
        localStatus === 'pending' ? 'border-red-400 dark:border-red-700' :
        localStatus === 'preparing' ? 'border-yellow-400 dark:border-yellow-700' :
        localStatus === 'ready' ? 'border-blue-400 dark:border-blue-700' :
        localStatus === 'completed' ? 'border-green-400 dark:border-green-700' :
        localStatus === 'cancelled' ? 'border-gray-400 dark:border-gray-700' :
        'border-gray-200 dark:border-gray-700'
      }`}>
        <div className={`px-3 py-2.5 ${getStatusColor(localStatus)} flex items-center gap-2`}>
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
          
          <div className="flex items-center gap-1.5 shrink-0">
            {localStatus === 'pending' && (
              <button
                onClick={() => handleOrderAction(order.id, 'start')}
                disabled={processingOrder === order.id}
                className="px-3 py-1.5 bg-white text-red-600 rounded-md hover:bg-red-50 flex items-center gap-1 transition-all disabled:opacity-50 font-bold text-xs border border-red-600"
              >
                {processingOrder === order.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                START
              </button>
            )}
            {localStatus === 'preparing' && (
              <button
                onClick={() => handleOrderAction(order.id, 'ready')}
                disabled={processingOrder === order.id}
                className="px-3 py-1.5 bg-white text-blue-600 rounded-md hover:bg-blue-50 flex items-center gap-1 transition-all disabled:opacity-50 font-bold text-xs border border-blue-600"
              >
                {processingOrder === order.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                READY
              </button>
            )}
            {localStatus === 'ready' && (
              <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-md text-xs font-bold border border-blue-400">READY ✓</span>
            )}
            {localStatus === 'completed' && (
              <span className="px-3 py-1.5 bg-gray-100 text-green-700 rounded-md text-xs font-bold border border-green-400">DONE ✓</span>
            )}
            {localStatus === 'cancelled' && (
              <span className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-md text-xs font-bold border border-gray-400">CANCELLED ✗</span>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-md bg-white/20 hover:bg-white/30 text-white transition-colors"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
        
        <div className="px-3 py-1.5 flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
          <ChefHat className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
            <span className="font-medium text-gray-700 dark:text-gray-300">{filteredItems.length} item(s):</span>{' '}
            {itemSummary || 'No items'}
          </span>
        </div>
        
        {expanded && (
          <div className="px-3 py-2.5">
            <div className="flex flex-col gap-1.5">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={`px-3 py-2 rounded-lg border flex items-center gap-2 ${
                    item.kitchen_status === 'completed' ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' :
                    item.kitchen_status === 'preparing' ? 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800' :
                    item.kitchen_status === 'ready' ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800' :
                    'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                  }`}
                >
                  <div className="p-1 bg-white dark:bg-gray-800 rounded shrink-0">{getItemIcon(item.name)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">
                        {item.quantity}x {item.name}
                      </span>
                      {getStatusBadge(item.kitchen_status)}
                    </div>
                    {item.notes && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 italic flex items-center gap-1 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded">
                        <MessageSquare className="w-3 h-3 shrink-0" />
                        {item.notes}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {order.notes && (
              <div className="mt-2 px-3 py-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-xs text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                <span className="font-medium">Order Notes:</span> {order.notes}
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
      <div className="mt-8 flex items-center justify-between">
        <div className="text-sm text-gray-700 dark:text-gray-300">
          Showing {indexOfFirstOrder + 1} to {Math.min(indexOfLastOrder, allOrders.length)} of {allOrders.length} orders
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium">{currentPage}</span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  };
  
  return (
    <AdminLayout>
      <Head title="Kitchen Display" />
      
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl flex items-center justify-between max-w-md animate-slide-in ${
          notification.type === 'success' ? 'bg-green-600' :
          notification.type === 'error' ? 'bg-red-600' : 'bg-yellow-600'
        } text-white`}>
          <div className="flex items-center gap-3">
            {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> :
             notification.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
            <div>
              <div className="font-bold">{notification.title}</div>
              <div className="text-sm opacity-90">{notification.message}</div>
            </div>
          </div>
          <button onClick={() => setNotification(null)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <div className="py-6 px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`p-3 bg-gradient-to-br ${kitchenInfo.color} rounded-xl shadow-lg`}>
                  <KitchenIcon className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{kitchenInfo.title}</h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Philippine Time • {kitchenInfo.subtitle}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleDarkMode}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  {darkMode ? 'Light' : 'Dark'}
                </button>
                
                <ConnectionStatusBadge />
                
                <button
                  onClick={refreshOrders}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
                
                <button
                  onClick={() => setShowControlPanel(!showControlPanel)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                    showControlPanel
                      ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <ChefHat className="w-4 h-4" />
                  Controls
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showControlPanel ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>
          </div>
          
          {showControlPanel && (
            <div className="mb-6 flex flex-wrap items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border ${
                audioSystemReady
                  ? 'bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
              }`}>
                <div className={`w-2 h-2 rounded-full ${audioSystemReady ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                Audio {audioSystemReady ? 'Ready' : 'Not Ready'}
              </div>
              
              <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
              
              <button
                onClick={toggleSound}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  soundEnabled
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                Sound {soundEnabled ? 'On' : 'Off'}
              </button>
              
              <button
                onClick={testAlarm}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors"
              >
                <Bell className="w-4 h-4" />
                Test Alarm
              </button>
              
              <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
              
              <button
                onClick={toggleFullscreen}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {isFullScreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                {isFullScreen ? 'Exit Fullscreen' : 'Fullscreen'}
              </button>
              
              <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
              
              <div className="relative">
                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Filter className="w-4 h-4" />
                  <span>{getDateRangeDisplay()}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDatePicker ? 'rotate-180' : ''}`} />
                </button>
                
                {showDatePicker && (
                  <div className="absolute top-full right-0 mt-2 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3 min-w-[260px]">
                    <div className="space-y-1">
                      {dateFilterOptions.map((option) => {
                        const Icon = option.icon;
                        return (
                          <button
                            key={option.value}
                            onClick={() => {
                              handleFilterChange(option.value);
                              if (option.value !== 'custom') setShowDatePicker(false);
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                              dateFilter === option.value
                                ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            <span className="text-sm font-medium flex-1 text-left">{option.label}</span>
                            {dateFilter === option.value && <CheckCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                          </button>
                        );
                      })}
                    </div>
                    
                    {dateFilter === 'custom' && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Custom Range</p>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400 w-8">From</span>
                            <DatePicker
                              selected={customDateRange.from}
                              onChange={(date) => {
                                if (date) setCustomDateRange(prev => ({ ...prev, from: date, to: date > prev.to ? date : prev.to }));
                              }}
                              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              dateFormat="MMM d, yyyy"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400 w-8">To</span>
                            <DatePicker
                              selected={customDateRange.to}
                              onChange={(date) => date && setCustomDateRange(prev => ({ ...prev, to: date }))}
                              minDate={customDateRange.from}
                              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              dateFormat="MMM d, yyyy"
                            />
                          </div>
                          <button
                            onClick={handleCustomRangeApply}
                            className="mt-1 w-full px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Apply Range
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex space-x-1">
              <button
                onClick={() => setActiveTab('in_progress')}
                className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
                  activeTab === 'in_progress'
                    ? 'border-amber-600 text-amber-600 dark:border-amber-500 dark:text-amber-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Construction className="w-4 h-4" />
                In Progress
                {(pendingOrders.length + preparingOrders.length + readyOrders.length) > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                    {pendingOrders.length + preparingOrders.length + readyOrders.length}
                  </span>
                )}
              </button>
              
              <button
                onClick={() => setActiveTab('completed')}
                className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
                  activeTab === 'completed'
                    ? 'border-green-600 text-green-600 dark:border-green-500 dark:text-green-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <BadgeCheck className="w-4 h-4" />
                Completed
                {completedOrders.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                    {completedOrders.length}
                  </span>
                )}
              </button>
              
              <button
                onClick={() => setActiveTab('cancelled')}
                className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
                  activeTab === 'cancelled'
                    ? 'border-gray-600 text-gray-600 dark:border-gray-500 dark:text-gray-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Ban className="w-4 h-4" />
                Cancelled
                {cancelledOrders.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                    {cancelledOrders.length}
                  </span>
                )}
              </button>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            {activeTab === 'in_progress' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-gray-200 dark:divide-gray-700">
                <div className="p-4 min-h-[500px]">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-red-100 dark:bg-red-900 rounded-lg">
                        <AlertOctagon className="w-4 h-4 text-red-600 dark:text-red-400" />
                      </div>
                      <h3 className="font-bold text-red-800 dark:text-red-200">Pending</h3>
                    </div>
                    <span className="px-2 py-0.5 text-xs font-bold bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-full">
                      {pendingOrders.length}
                    </span>
                  </div>
                  <div className="space-y-3 max-h-[calc(100vh-350px)] overflow-y-auto pr-2">
                    {pendingOrders.length === 0 ? (
                      <div className="text-center py-12 text-gray-400 dark:text-gray-500 italic text-sm">No pending orders</div>
                    ) : (
                      pendingOrders.map(order => <OrderCard key={order.id} order={order} />)
                    )}
                  </div>
                </div>
                
                <div className="p-4 min-h-[500px]">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-amber-100 dark:bg-amber-900 rounded-lg">
                        <Construction className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <h3 className="font-bold text-amber-800 dark:text-amber-200">Preparing</h3>
                    </div>
                    <span className="px-2 py-0.5 text-xs font-bold bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 rounded-full">
                      {preparingOrders.length}
                    </span>
                  </div>
                  <div className="space-y-3 max-h-[calc(100vh-350px)] overflow-y-auto pr-2">
                    {preparingOrders.length === 0 ? (
                      <div className="text-center py-12 text-gray-400 dark:text-gray-500 italic text-sm">No preparing orders</div>
                    ) : (
                      preparingOrders.map(order => <OrderCard key={order.id} order={order} />)
                    )}
                  </div>
                </div>
                
                <div className="p-4 min-h-[500px]">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900 rounded-lg">
                        <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <h3 className="font-bold text-emerald-800 dark:text-emerald-200">Ready</h3>
                    </div>
                    <span className="px-2 py-0.5 text-xs font-bold bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-full">
                      {readyOrders.length}
                    </span>
                  </div>
                  <div className="space-y-3 max-h-[calc(100vh-350px)] overflow-y-auto pr-2">
                    {readyOrders.length === 0 ? (
                      <div className="text-center py-12 text-gray-400 dark:text-gray-500 italic text-sm">No ready orders</div>
                    ) : (
                      readyOrders.map(order => <OrderCard key={order.id} order={order} />)
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'completed' && (
              <div className="p-6">
                <div className="mb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <BadgeCheck className="w-5 h-5 text-green-500" />
                    Completed Orders
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {getDateRangeDisplay()} • {completedOrders.length} order(s)
                  </p>
                </div>
                
                {completedOrders.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="inline-flex p-4 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
                      <BadgeCheck className="w-12 h-12 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No completed orders</h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      No completed orders for {getDateRangeDisplay()}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {currentOrders.map(order => <OrderCard key={order.id} order={order} />)}
                    </div>
                    <Pagination />
                  </>
                )}
              </div>
            )}
            
            {activeTab === 'cancelled' && (
              <div className="p-6">
                <div className="mb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Ban className="w-5 h-5 text-gray-500" />
                    Cancelled Orders
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {getDateRangeDisplay()} • {cancelledOrders.length} order(s)
                  </p>
                </div>
                
                {cancelledOrders.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="inline-flex p-4 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                      <Ban className="w-12 h-12 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No cancelled orders</h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      No cancelled orders for {getDateRangeDisplay()}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </AdminLayout>
  );
}