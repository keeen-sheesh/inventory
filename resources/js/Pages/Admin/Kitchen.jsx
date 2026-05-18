import React, { useState, useEffect, useRef, useCallback } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, router } from '@inertiajs/react';
import { 
  Clock, 
  CheckCircle, 
  Bell, 
  RefreshCw,
  Play,
  X,
  AlertCircle,
  Utensils,
  Volume2,
  VolumeX,
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
  Volume1,
  Package,
  CalendarDays,
  ChevronDown,
  Filter,
  CalendarRange,
  CalendarCheck,
  CalendarX,
  CalendarClock,
  ListFilter,
  ChevronsUpDown,
  Maximize,
  Minimize
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isToday, isSameDay } from 'date-fns';
import { nowPH, formatPHTime, toDate } from '@/utils/phTime';
import { useKitchenOrders } from '@/hooks/useReverb';

// Helper to get CSRF token
const getCsrfToken = () => {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
};

// Helper to refresh CSRF token
const refreshCsrfToken = async () => {
  try {
    const response = await fetch('/csrf-token', {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        'Accept': 'application/json',
      },
    });
    if (response.ok) {
      const data = await response.json();
      const metaTag = document.querySelector('meta[name="csrf-token"]');
      if (metaTag) {
        metaTag.setAttribute('content', data.token);
      }
      return data.token;
    }
  } catch (error) {
    console.error('Failed to refresh CSRF token:', error);
  }
  return null;
};

export default function Kitchen({ orders = [], hasNewOrder: initialHasNewOrder, stats = {}, userRole = 'admin' }) {
  const [activeTab, setActiveTab] = useState('in_progress');
  const [notification, setNotification] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioSystemReady, setAudioSystemReady] = useState(false);
  const soundEnabledRef = useRef(true);
  const audioSystemReadyRef = useRef(false);
  const [kitchenOrders, setKitchenOrders] = useState(Array.isArray(orders) ? orders : []);
  const [processingOrder, setProcessingOrder] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dateFilter, setDateFilter] = useState('today');
  const [customDateRange, setCustomDateRange] = useState({
    from: new Date(),
    to: new Date()
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [showControlPanel, setShowControlPanel] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Determine if user is admin (can see both kitchens)
  const isAdmin = userRole === 'admin' || userRole === 'cashier' || userRole === 'owner';
  const isRestoKitchen = userRole === 'kitchen_resto';
  const isFoodKitchen = userRole === 'kitchen';
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 10;

  const audioRef = useRef(null);
  const soundSourcesRef = useRef([]);
  const soundSourceIndexRef = useRef(0);
  const pollTimeoutRef = useRef(null);
  const pollInFlightRef = useRef(false);
  const lastPollSinceRef = useRef(Math.floor(Date.now() / 1000));
  const mountedRef = useRef(true);
  const datePickerRef = useRef(null);
  // Track seen order IDs to detect genuinely new orders
  const seenOrderIdsRef = useRef(new Set());
  const notifiedOrderIdsRef = useRef(new Set());
  const isFirstLoadRef = useRef(true);
  const alarmStopTimerRef = useRef(null);

  // Date filter options
  const dateFilterOptions = [
    { value: 'today', label: 'Today', icon: CalendarCheck },
    { value: 'yesterday', label: 'Yesterday', icon: CalendarX },
    { value: 'this_week', label: 'This Week', icon: CalendarRange },
    { value: 'last_week', label: 'Last Week', icon: CalendarRange },
    { value: 'this_month', label: 'This Month', icon: CalendarClock },
    { value: 'last_month', label: 'Last Month', icon: CalendarClock },
    { value: 'custom', label: 'Custom Range', icon: CalendarDays },
  ];

  // Get date range based on filter
  const getDateRange = (filter) => {
    const now = new Date();
    let from, to;

    switch(filter) {
      case 'today':
        from = now;
        to = now;
        break;
      case 'yesterday':
        from = subDays(now, 1);
        to = subDays(now, 1);
        break;
      case 'this_week':
        from = startOfWeek(now, { weekStartsOn: 1 }); // Monday
        to = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'last_week':
        from = startOfWeek(subDays(now, 7), { weekStartsOn: 1 });
        to = endOfWeek(subDays(now, 7), { weekStartsOn: 1 });
        break;
      case 'this_month':
        from = startOfMonth(now);
        to = endOfMonth(now);
        break;
      case 'last_month':
        from = startOfMonth(subDays(now, 30));
        to = endOfMonth(subDays(now, 30));
        break;
      case 'custom':
        from = customDateRange.from;
        to = customDateRange.to;
        break;
      default:
        from = now;
        to = now;
    }

    return { from, to };
  };

  // Filter orders based on date range
  const filterOrdersByDate = (orders, range) => {
    if (!range.from || !range.to) return orders;
    
    return orders.filter(order => {
      const orderDate = new Date(order.created_at);
      const orderDateOnly = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
      const fromDate = new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate());
      const toDate = new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate());
      
      return orderDateOnly >= fromDate && orderDateOnly <= toDate;
    });
  };

  // Get filtered orders
  const dateRange = getDateRange(dateFilter);
  const filteredKitchenOrders = filterOrdersByDate(kitchenOrders, dateRange);

  // Derive display status from THIS kitchen's own items only
  // Prevents order from "going back" when the other kitchen hasn't acted yet
  const getLocalStatus = (order) => {
    if (!order.items || order.items.length === 0) return order.kitchen_status;
    const statuses = order.items.map(i => i.kitchen_status || 'pending');
    if (statuses.every(s => s === 'completed')) return 'completed';
    if (statuses.every(s => s === 'ready' || s === 'completed')) return 'ready';
    if (statuses.some(s => s === 'preparing' || s === 'ready')) return 'preparing';
    return 'pending';
  };

  // Filter orders by local (per-kitchen) status
  const pendingOrders = filteredKitchenOrders.filter(o => o && getLocalStatus(o) === 'pending');
  const preparingOrders = filteredKitchenOrders.filter(o => o && getLocalStatus(o) === 'preparing');
  const readyOrders = filteredKitchenOrders.filter(o => o && getLocalStatus(o) === 'ready');
  const completedOrders = filteredKitchenOrders.filter(o => o && getLocalStatus(o) === 'completed');

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
  }, [activeTab, dateFilter]);

  // Initialize audio element
  useEffect(() => {
    const pathPrefix = window.location.pathname.includes('/admin/')
      ? window.location.pathname.split('/admin/')[0]
      : '';
    const prefixedSource = `${pathPrefix}/sound1.mp3`.replace(/\/{2,}/g, '/');
    soundSourcesRef.current = Array.from(new Set([prefixedSource, '/sound1.mp3']));
    soundSourceIndexRef.current = 0;

    audioRef.current = new Audio(soundSourcesRef.current[soundSourceIndexRef.current]);
    audioRef.current.volume = 0.7;
    audioRef.current.preload = 'auto';
    
    audioRef.current.addEventListener('error', () => {
      const nextSource = soundSourcesRef.current[soundSourceIndexRef.current + 1];
      if (nextSource && audioRef.current) {
        soundSourceIndexRef.current += 1;
        audioRef.current.src = nextSource;
        audioRef.current.load();
        return;
      }

      console.error('Sound file failed to load:', {
        src: audioRef.current?.currentSrc || 'unknown',
        code: audioRef.current?.error?.code,
      });
    });
    
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
    
    // Seed seenOrderIdsRef with current order IDs to avoid false positives on first poll
    if (orders && Array.isArray(orders)) {
      const initialOrderIds = orders.map(o => o.id);
      seenOrderIdsRef.current = new Set(initialOrderIds);
      notifiedOrderIdsRef.current = new Set(initialOrderIds);
      console.log('Seeded seen order IDs:', initialOrderIds);
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.load();
      }
    };
  }, []);

  // Initialize audio system (must be called from user gesture)
  const initializeAudioSystem = useCallback(() => {
    if (audioSystemReady || !audioRef.current) return;

    console.log('Initializing audio system via user gesture...');
    
    const playPromise = audioRef.current.play();
    
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          setAudioSystemReady(true);
          console.log('Audio system ready.');
          showNotification('🔊 Audio Ready', 'Sound system initialized successfully', 'success');
        })
        .catch(error => {
          console.log('Audio initialization needs a direct user gesture.', error);
        });
    }
  }, [audioSystemReady]);

  // Keep refs in sync so pollForUpdates never needs state in its deps
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { audioSystemReadyRef.current = audioSystemReady; }, [audioSystemReady]);

  // Play alarm — reads refs so it has zero deps and never causes poll restart
  const playAlarm = useCallback(() => {
    if (!soundEnabledRef.current) return;
    if (!audioRef.current) return;

    try {
      // Cancel any existing stop timer
      if (alarmStopTimerRef.current) {
        clearTimeout(alarmStopTimerRef.current);
        alarmStopTimerRef.current = null;
      }

      audioRef.current.loop = true; // loop so it keeps playing
      audioRef.current.currentTime = 0;
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('Alarm playing (20s)');
            // Stop after 20 seconds
            alarmStopTimerRef.current = setTimeout(() => {
              if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                audioRef.current.loop = false;
              }
              alarmStopTimerRef.current = null;
            }, 20000);
          })
          .catch(error => console.warn('Alarm playback failed:', error.message));
      }
    } catch (error) {
      console.error('Unexpected play error:', error);
    }
  }, []); // no deps — uses refs only

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, []);

  // Track fullscreen state changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Sync seen order IDs when orders prop changes (initial load or date filter change)
  useEffect(() => {
    if (orders && Array.isArray(orders) && orders.length > 0) {
      const orderIds = orders.map(o => o.id);
      // Only seed if the set is empty (first load) to avoid overriding during date filter changes
      if (seenOrderIdsRef.current.size === 0) {
        seenOrderIdsRef.current = new Set(orderIds);
        notifiedOrderIdsRef.current = new Set(orderIds);
        console.log('Initialized seen order IDs from prop:', orderIds);
      }
    }
  }, [orders]);

  // Poll for updates
  const pollForUpdates = useCallback(async () => {
    if (!mountedRef.current || pollInFlightRef.current) return;
    pollInFlightRef.current = true;
    let nextDelayMs = 3000;
    
    try {
      const formattedDate = format(selectedDate, 'yyyy-MM-dd');
      const response = await fetch(`/admin/kitchen/check-new?date=${formattedDate}&since=${lastPollSinceRef.current}`, {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-TOKEN': getCsrfToken(),
        },
      });
      
      if (!mountedRef.current) return;

      if (response.status === 401) {
        setConnectionStatus('disconnected');
        showNotification('Session expired', 'Please login again', 'error');
        mountedRef.current = false;
        window.location.href = '/login';
        return;
      }

      if (response.status === 419) {
        setConnectionStatus('disconnected');
        showNotification('Session refreshed', 'Reloading page...', 'info');
        mountedRef.current = false;
        window.location.reload();
        return;
      }

      if (!response.ok) {
        throw new Error(`Connection failed (${response.status})`);
      }

      const data = await response.json();
      setConnectionStatus('connected');

      // Auto-initialize audio system on first successful connection
      if (!audioSystemReadyRef.current && audioRef.current) {
        try {
          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                setAudioSystemReady(true);
                console.log('Audio system auto-initialized');
              })
              .catch(err => {
                console.log('Audio autoplay blocked by browser policy (normal)', err.message);
              });
          }
        } catch (err) {
          console.log('Audio init attempt:', err.message);
        }
      }

      const nextSinceRaw = Number(data?.timestamp) || Math.floor(Date.now() / 1000);
      lastPollSinceRef.current = nextSinceRaw > 1000000000000
        ? Math.floor(nextSinceRaw / 1000)
        : nextSinceRaw;
      
      if (data.orders) {
        // Get current order IDs from the response
        const currentOrderIds = data.orders.map(o => o.id);
        
        // Find genuinely new orders by checking against previously seen IDs
        const newOrderIds = currentOrderIds.filter(id => !seenOrderIdsRef.current.has(id));
        const unnotifiedNewOrderIds = newOrderIds.filter(
          id => !notifiedOrderIdsRef.current.has(id)
        );
        const hasNewOrders = unnotifiedNewOrderIds.length > 0;
        
        // Update the seen order IDs set
        seenOrderIdsRef.current = new Set(currentOrderIds);
        unnotifiedNewOrderIds.forEach(id => notifiedOrderIdsRef.current.add(id));
        
        setKitchenOrders(data.orders);
        
        // Only show notification if there are truly new orders
        // Skip on first load - don't play sound on initial page load
        if (isFirstLoadRef.current) {
          isFirstLoadRef.current = false;
        } else if (soundEnabledRef.current && audioSystemReadyRef.current && hasNewOrders) {
          console.log('New orders detected, playing alarm:', { unnotifiedNewOrderIds, hasNewOrders });
          playAlarm();
          showNotification(
            '🔔 New Order!',
            unnotifiedNewOrderIds.length > 1
              ? `${unnotifiedNewOrderIds.length} new kitchen orders arrived`
              : 'A new kitchen order has arrived',
            'success'
          );
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
  }, [selectedDate, playAlarm]);

  // Start polling
  useEffect(() => {
    pollForUpdates();

    // Keep session alive — ping every 5 minutes so Kitchen never auto-logs out
    const keepAlive = () => {
      fetch('/keep-alive', {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json',
        },
      }).catch(() => {});
    };
    const keepAliveInterval = setInterval(keepAlive, 5 * 60 * 1000);

    // Refresh CSRF token every 10 minutes to prevent expiration
    const refreshCsrf = () => {
      refreshCsrfToken().then(token => {
        if (token) console.log('CSRF token refreshed automatically');
      });
    };
    const csrfRefreshInterval = setInterval(refreshCsrf, 10 * 60 * 1000);

    return () => {
      clearInterval(keepAliveInterval);
      clearInterval(csrfRefreshInterval);
      if (alarmStopTimerRef.current) clearTimeout(alarmStopTimerRef.current);
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, [pollForUpdates]);

  // WebSocket real-time updates
  const handleNewOrder = useCallback((order) => {
    if (!order || !order.id) return;
    
    // Add to seen IDs to prevent duplicate notification
    if (!seenOrderIdsRef.current.has(order.id)) {
      seenOrderIdsRef.current.add(order.id);
      notifiedOrderIdsRef.current.add(order.id);
      
      // Play alarm for new order
      if (soundEnabledRef.current && audioSystemReadyRef.current) {
        playAlarm();
        showNotification('🔔 New Order!', `Order #${order.txn_number || order.id} arrived`, 'success');
      }
      
      // Force poll to refresh the list
      pollForUpdates();
    }
  }, [playAlarm]);

  const handleStatusChange = useCallback((data) => {
    if (!data || !data.id) return;
    
    // Update the local order status
    setKitchenOrders(prev => prev.map(order => {
      if (order.id !== data.id) return order;
      
      // Update kitchen_status based on the event
      const updatedItems = (order.items || []).map(item => {
        if (data.item_id && item.id === data.item_id) {
          return { ...item, kitchen_status: data.status };
        }
        return item;
      });
      
      return { 
        ...order, 
        kitchen_status: data.status,
        items: updatedItems 
      };
    }));
    
    console.log('[Kitchen] Order status updated from WebSocket:', data.id, data.status);
  }, []);

  useKitchenOrders(handleNewOrder, handleStatusChange);

  // Handle filter change
  const handleFilterChange = (filter) => {
    setDateFilter(filter);
    
    if (filter !== 'custom') {
      const range = getDateRange(filter);
      setCustomDateRange(range);
      
      // Show notification
      showNotification('📅 Filter Applied', `Showing ${dateFilterOptions.find(f => f.value === filter)?.label} orders`, 'success');
    }
  };

  // Handle custom date range apply
  const handleCustomRangeApply = () => {
    setDateFilter('custom');
    setShowDatePicker(false);
    showNotification('📅 Custom Range Applied', `${format(customDateRange.from, 'MMM d, yyyy')} - ${format(customDateRange.to, 'MMM d, yyyy')}`, 'success');
  };

  // Format date range for display
  const getDateRangeDisplay = () => {
    if (dateFilter === 'custom') {
      return `${format(customDateRange.from, 'MMM d, yyyy')} - ${format(customDateRange.to, 'MMM d, yyyy')}`;
    }
    return dateFilterOptions.find(f => f.value === dateFilter)?.label;
  };

  const showNotification = (title, message, type = 'info') => {
    // Clear existing notification before showing new one (prevent stacking)
    if (notification) {
      setNotification(null);
    }
    
    // Use a small delay to ensure the DOM updates
    setTimeout(() => {
      setNotification({ title, message, type });
      setTimeout(() => setNotification(null), 3000);
    }, 50);
  };

  const closeNotification = () => setNotification(null);

  const testAlarm = () => {
    initializeAudioSystem();
    if (audioSystemReady) {
      playAlarm();
      showNotification('🔔 Sound Test', 'Testing kitchen alarm system', 'success');
    } else {
      showNotification('👆 Enable Audio', 'Click the "Enable Audio" button first', 'info');
    }
  };

  const toggleSound = () => {
    initializeAudioSystem();
    setSoundEnabled(prev => !prev);
    showNotification(
      !soundEnabled ? '🔊 Sound ON' : '🔇 Sound OFF',
      !soundEnabled ? 'New order notifications enabled' : 'New order notifications disabled',
      'info'
    );
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullScreen(true);
      }).catch(err => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => {
          setIsFullScreen(false);
        });
      }
    }
  };

  // Unified function to update order status
  const updateOrderStatus = async (orderId, action, retryAttempt = false) => {
    setProcessingOrder(orderId);

    const endpoint = action === 'start' ? 'start' : 'ready';
    const successMessage = action === 'start'
      ? { title: '✅ Started', message: `Order #${orderId} is now preparing` }
      : { title: '✅ Ready for Pickup', message: `Order #${orderId} is ready for pickup` };
    const newStatus = action === 'start' ? 'preparing' : 'ready';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`/admin/kitchen/orders/${orderId}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': getCsrfToken(),
          'Accept': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Check response status first
      if (!response.ok) {
        if (response.status === 419) {
          // CSRF token expired - refresh and retry once
          if (!retryAttempt) {
            const newToken = await refreshCsrfToken();
            if (newToken) {
              console.log('CSRF token refreshed, retrying...');
              setProcessingOrder(null);
              return updateOrderStatus(orderId, action, true); // Retry with new token
            }
          }
          showNotification('⚠️ Session Expired', 'Please refresh the page and try again', 'error');
          return;
        }
        throw new Error(`Server error (${response.status})`);
      }

      // Only try to parse JSON if response is valid
      let data;
      try {
        data = await response.json();
      } catch (e) {
        console.error('Failed to parse response:', e);
        showNotification('⚠️ Error', 'Invalid server response', 'error');
        return;
      }

      if (data.success) {
        setKitchenOrders(prev => prev.map(order => {
          if (order.id !== orderId) return order;
          const updatedItems = (order.items || []).map(item => ({
            ...item,
            kitchen_status: newStatus,
          }));
          return { ...order, kitchen_status: newStatus, items: updatedItems };
        }));
        showNotification(successMessage.title, successMessage.message, 'success');
      } else {
        showNotification('⚠️ Error', data.message || 'Failed to update order', 'error');
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        showNotification('⏱️ Timeout', 'Request took too long. Please try again.', 'error');
      } else {
        console.error('Error:', error);
        showNotification('❌ Error', 'Failed to update order', 'error');
      }
    } finally {
      setProcessingOrder(null);
    }
  };

  // Request confirmation for order actions
  const stopAlarm = () => {
    if (alarmStopTimerRef.current) {
      clearTimeout(alarmStopTimerRef.current);
      alarmStopTimerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.loop = false;
    }
  };

  const handleOrderAction = (orderId, action) => {
    if (action === 'start') stopAlarm(); // stop buzzer when staff acknowledges new order
    updateOrderStatus(orderId, action);
  };

  const refreshOrders = () => {
    router.reload({ preserveScroll: true });
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'pending': 
        return 'bg-red-600 text-white border-red-700';
      case 'preparing': 
        return 'bg-yellow-500 text-white border-yellow-600';
      case 'ready':
        return 'bg-blue-600 text-white border-blue-700';
      case 'completed': 
        return 'bg-green-600 text-white border-green-700';
      default: 
        return 'bg-gray-600 text-white border-gray-700';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'pending': return <AlertOctagon className="w-5 h-5" />;
      case 'preparing': return <Construction className="w-5 h-5" />;
      case 'ready': return <Package className="w-5 h-5" />;
      case 'completed': return <BadgeCheck className="w-5 h-5" />;
      default: return <Clock className="w-5 h-5" />;
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Pending</span>;
      case 'preparing':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">Preparing</span>;
      case 'ready':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">Ready to Pickup</span>;
      case 'completed':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Completed</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  const getItemIcon = (itemName) => {
    const name = itemName.toLowerCase();
    if (name.includes('coffee')) return <Coffee className="w-4 h-4" />;
    if (name.includes('pizza')) return <Pizza className="w-4 h-4" />;
    if (name.includes('sandwich') || name.includes('burger')) return <Sandwich className="w-4 h-4" />;
    if (name.includes('soup')) return <Soup className="w-4 h-4" />;
    if (name.includes('salad')) return <Salad className="w-4 h-4" />;
    if (name.includes('wine')) return <Wine className="w-4 h-4" />;
    if (name.includes('beer')) return <Beer className="w-4 h-4" />;
    if (name.includes('water') || name.includes('soda')) return <GlassWater className="w-4 h-4" />;
    return <Utensils className="w-4 h-4" />;
  };

  const ConnectionStatusBadge = () => (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
      connectionStatus === 'connected' 
        ? 'text-emerald-600 border-emerald-200 bg-emerald-50' 
        : 'text-red-600 border-red-200 bg-red-50'
    }`}>
      {connectionStatus === 'connected' ? (
        <Wifi className="w-3.5 h-3.5" />
      ) : (
        <WifiOff className="w-3.5 h-3.5" />
      )}
      <span className="text-sm font-medium">{connectionStatus === 'connected' ? 'Live' : 'Offline'}</span>
    </div>
  );

  // Format time to Philippine time - using phTime.js utility

  // Check if order is hotel
  const isHotelOrder = (order) => {
    return order?.payment_method_name === 'Hotel' || order?.is_hotel === true;
  };

  const OrderCard = ({ order, filterType = null }) => {
    const [expanded, setExpanded] = useState(false);

    if (!order) return null;
    if (!order.items || !Array.isArray(order.items)) {
      order.items = [];
    }

    // Filter items by kitchen_type if filterType is specified
    const filteredItems = filterType
      ? order.items.filter(item => item.kitchen_type === filterType)
      : order.items;

    const itemSummary = filteredItems.map(i => `${i.quantity}x ${i.name}`).join(', ');

    return (
      <div
        className={`bg-white rounded-lg shadow-sm overflow-hidden border transition-all hover:shadow-md ${
          getLocalStatus(order) === 'pending' ? 'border-red-400' :
          getLocalStatus(order) === 'preparing' ? 'border-yellow-400' :
          getLocalStatus(order) === 'ready' ? 'border-blue-400' :
          getLocalStatus(order) === 'completed' ? 'border-green-400' :
          'border-gray-200'
        }`}
      >
        {/* Compact header row */}
        <div className={`px-3 py-2.5 ${getStatusColor(getLocalStatus(order))} flex items-center gap-2`}>
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
            {getLocalStatus(order) === 'pending' && (
              <button
                onClick={() => handleOrderAction(order.id, 'start')}
                disabled={processingOrder === order.id}
                className="px-3 py-1.5 bg-white text-red-600 rounded-md hover:bg-red-50 flex items-center gap-1 transition-all disabled:opacity-50 font-bold text-xs border border-red-600 hover:scale-105 active:scale-95"
              >
                {processingOrder === order.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                START
              </button>
            )}
            {getLocalStatus(order) === 'preparing' && (
              <button
                onClick={() => handleOrderAction(order.id, 'ready')}
                disabled={processingOrder === order.id}
                className="px-3 py-1.5 bg-white text-blue-600 rounded-md hover:bg-blue-50 flex items-center gap-1 transition-all disabled:opacity-50 font-bold text-xs border border-blue-600 hover:scale-105 active:scale-95"
              >
                {processingOrder === order.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                READY
              </button>
            )}
            {getLocalStatus(order) === 'ready' && (
              <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-md text-xs font-bold border border-blue-400 opacity-90">READY ✓</span>
            )}
            {getLocalStatus(order) === 'completed' && (
              <span className="px-3 py-1.5 bg-gray-100 text-green-700 rounded-md text-xs font-bold border border-green-400 opacity-90">DONE ✓</span>
            )}

            {/* Expand toggle */}
            <button
              onClick={() => setExpanded(v => !v)}
              className="p-1.5 rounded-md bg-white/20 hover:bg-white/30 text-white transition-colors"
              title={expanded ? 'Collapse' : 'View items'}
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Item summary (always visible) */}
        <div className="px-3 py-1.5 flex items-center gap-2 bg-gray-50 border-b border-gray-100">
          <ChefHat className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="text-xs text-gray-600 truncate">
            <span className="font-medium text-gray-700">{filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}:</span>{' '}
            {itemSummary || 'No items'}
          </span>
        </div>

        {/* Collapsible item details */}
        {expanded && (
          <div className="px-3 py-2.5">
            {filteredItems.length === 0 ? (
              <div className="text-center py-4 text-gray-400 text-sm bg-gray-50 rounded-lg">No kitchen items</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className={`px-3 py-2 rounded-lg border flex items-center gap-2 ${
                      item.kitchen_status === 'completed' ? 'bg-green-50 border-green-200' :
                      item.kitchen_status === 'preparing' ? 'bg-yellow-50 border-yellow-200' :
                      item.kitchen_status === 'ready' ? 'bg-blue-50 border-blue-200' :
                      'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="p-1 bg-white rounded shrink-0">{getItemIcon(item.name)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center gap-2">
                        <span className="font-medium text-gray-900 text-sm truncate">{item.quantity}x {item.name}</span>
                        {getStatusBadge(item.kitchen_status)}
                      </div>
                      {item.notes && (
                        <p className="text-xs text-amber-600 mt-0.5 italic flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded">
                          <MessageSquare className="w-3 h-3 shrink-0" />
                          {item.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {order.notes && (
              <div className="mt-2 px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-700 border border-gray-200">
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
      <div className="mt-8 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <span>Showing</span>
          <span className="font-medium">{indexOfFirstOrder + 1}</span>
          <span>to</span>
          <span className="font-medium">
            {Math.min(indexOfLastOrder, allOrders.length)}
          </span>
          <span>of</span>
          <span className="font-medium">{allOrders.length}</span>
          <span>orders</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <span className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium">
            {currentPage}
          </span>
          
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
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
          notification.type === 'error' ? 'bg-red-600' :
          'bg-yellow-600'
        } text-white`}>
          <div className="flex items-center gap-3">
            {notification.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : notification.type === 'error' ? (
              <AlertCircle className="w-5 h-5" />
            ) : (
              <Bell className="w-5 h-5" />
            )}
            <div>
              <div className="font-bold">{notification.title}</div>
              <div className="text-sm opacity-90">{notification.message}</div>
            </div>
          </div>
          <button onClick={closeNotification} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="min-h-screen bg-gray-50">
        <div className="py-6 px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-red-600 to-orange-600 rounded-xl shadow-lg">
                  <ChefHat className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                    Kitchen
                  </h1>
                  <p className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Philippine Time • Auto-refresh every 3 seconds
                  </p>
                </div>
              </div>

              {/* Header-level controls */}
              <div className="flex items-center gap-2">
                <ConnectionStatusBadge />
                <button
                  onClick={() => setShowControlPanel(!showControlPanel)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                    showControlPanel
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <ChefHat className="w-4 h-4" />
                  Controls
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showControlPanel ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>

          </div>

          {/* DASHBOARD CONTROL PANEL */}
          {showControlPanel && (
            <div className="mb-6 flex flex-wrap items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
              {/* Audio Status */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border ${
                audioSystemReady
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}>
                <div className={`w-2 h-2 rounded-full ${audioSystemReady ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                Audio {audioSystemReady ? 'Ready' : 'Not Ready'}
              </div>

              <div className="w-px h-5 bg-gray-200" />

              {/* Sound Toggle */}
              <button
                onClick={toggleSound}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  soundEnabled
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                }`}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                Sound {soundEnabled ? 'On' : 'Off'}
              </button>

              {/* Test Alarm */}
              <button
                onClick={testAlarm}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
              >
                <Bell className="w-4 h-4" />
                Test Alarm
              </button>

              <div className="w-px h-5 bg-gray-200" />

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
              >
                {isFullScreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                {isFullScreen ? 'Exit Fullscreen' : 'Fullscreen'}
              </button>

              <div className="w-px h-5 bg-gray-200" />

              {/* Date Filter inside Controls */}
              <div className="relative" ref={datePickerRef}>
                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <Filter className="w-4 h-4" />
                  <span>{getDateRangeDisplay()}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDatePicker ? 'rotate-180' : ''}`} />
                </button>

                {showDatePicker && (
                  <div className="absolute top-full right-0 mt-2 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3 min-w-[260px]">
                    <div className="space-y-1">
                      {dateFilterOptions.map((option) => {
                        const Icon = option.icon;
                        return (
                          <button
                            key={option.value}
                            onClick={() => {
                              handleFilterChange(option.value);
                              if (option.value !== 'custom') {
                                setShowDatePicker(false);
                              }
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                              dateFilter === option.value
                                ? 'bg-blue-50 text-blue-600'
                                : 'hover:bg-gray-50 text-gray-700'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            <span className="text-sm font-medium flex-1 text-left">{option.label}</span>
                            {dateFilter === option.value && (
                              <CheckCircle className="w-4 h-4 text-blue-600" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {dateFilter === 'custom' && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs font-medium text-gray-500 mb-2">Custom Range</p>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-8">From</span>
                            <DatePicker
                              selected={customDateRange.from}
                              onChange={(date) => {
                                if (date) {
                                  setCustomDateRange(prev => ({
                                    ...prev,
                                    from: date,
                                    to: date > prev.to ? date : prev.to
                                  }));
                                }
                              }}
                              selectsStart
                              startDate={customDateRange.from}
                              endDate={customDateRange.to}
                              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md w-full"
                              dateFormat="MMM d, yyyy"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-8">To</span>
                            <DatePicker
                              selected={customDateRange.to}
                              onChange={(date) => {
                                if (date) {
                                  setCustomDateRange(prev => ({ ...prev, to: date }));
                                }
                              }}
                              selectsEnd
                              startDate={customDateRange.from}
                              endDate={customDateRange.to}
                              minDate={customDateRange.from}
                              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md w-full"
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

          {/* CUSTOM TAB NAVIGATION */}
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
                    ? 'border-green-600 text-green-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <BadgeCheck className="w-4 h-4" />
                Completed
                {completedOrders.length > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">
                    {completedOrders.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* CONTENT SECTIONS */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            {activeTab === 'in_progress' && (
              isAdmin ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Resto Kitchen Section (Left Column) */}
                    <section className="bg-gradient-to-b from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200 flex flex-col">
                      <div className="flex justify-between items-center mb-4 pb-3 border-b border-blue-200 shrink-0">
                        <div className="flex items-center gap-2">
                          <Coffee className="w-6 h-6 text-blue-600" />
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">Resto Kitchen</h3>
                            <p className="text-xs text-gray-600">Beverages • Coffee • Drinks</p>
                          </div>
                        </div>
                      </div>

                      {/* Resto Orders - Scrollable */}
                      <div className="flex-1 overflow-y-auto max-h-[calc(100vh-380px)] pr-3">
                        <div className="grid grid-cols-3 gap-4">
                          {/* Resto Pending */}
                          <div className="bg-red-50/80 rounded-xl p-3 border border-red-200 flex flex-col">
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-red-200 sticky top-0 bg-red-50/80 z-10 rounded-t-lg">
                              <div className="p-1.5 bg-red-100 rounded-lg">
                                <AlertOctagon className="w-4 h-4 text-red-600" />
                              </div>
                              <span className="text-sm font-bold text-red-700">Pending</span>
                              <span className="ml-auto px-2 py-0.5 text-xs font-bold bg-red-200 text-red-800 rounded-full">
                                {pendingOrders.filter(o => o.items?.some(i => i.kitchen_type === 'resto')).length}
                              </span>
                            </div>
                            {pendingOrders.filter(o => o.items?.some(i => i.kitchen_type === 'resto')).length === 0 ? (
                              <div className="flex-1 flex items-center justify-center text-xs text-red-400 italic py-8">
                                No pending orders
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2.5 overflow-y-auto">
                                {pendingOrders.filter(o => o.items?.some(i => i.kitchen_type === 'resto')).map(order => (
                                  <OrderCard key={order.id} order={order} filterType="resto" />
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Resto Preparing */}
                          <div className="bg-amber-50/80 rounded-xl p-3 border border-amber-200 flex flex-col">
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-amber-200 sticky top-0 bg-amber-50/80 z-10 rounded-t-lg">
                              <div className="p-1.5 bg-amber-100 rounded-lg">
                                <Construction className="w-4 h-4 text-amber-600" />
                              </div>
                              <span className="text-sm font-bold text-amber-700">Preparing</span>
                              <span className="ml-auto px-2 py-0.5 text-xs font-bold bg-amber-200 text-amber-800 rounded-full">
                                {preparingOrders.filter(o => o.items?.some(i => i.kitchen_type === 'resto')).length}
                              </span>
                            </div>
                            {preparingOrders.filter(o => o.items?.some(i => i.kitchen_type === 'resto')).length === 0 ? (
                              <div className="flex-1 flex items-center justify-center text-xs text-amber-400 italic py-8">
                                No preparing orders
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2.5 overflow-y-auto">
                                {preparingOrders.filter(o => o.items?.some(i => i.kitchen_type === 'resto')).map(order => (
                                  <OrderCard key={order.id} order={order} filterType="resto" />
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Resto Ready */}
                          <div className="bg-emerald-50/80 rounded-xl p-3 border border-emerald-200 flex flex-col">
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-emerald-200 sticky top-0 bg-emerald-50/80 z-10 rounded-t-lg">
                              <div className="p-1.5 bg-emerald-100 rounded-lg">
                                <Package className="w-4 h-4 text-emerald-600" />
                              </div>
                              <span className="text-sm font-bold text-emerald-700">Ready</span>
                              <span className="ml-auto px-2 py-0.5 text-xs font-bold bg-emerald-200 text-emerald-800 rounded-full">
                                {readyOrders.filter(o => o.items?.some(i => i.kitchen_type === 'resto')).length}
                              </span>
                            </div>
                            {readyOrders.filter(o => o.items?.some(i => i.kitchen_type === 'resto')).length === 0 ? (
                              <div className="flex-1 flex items-center justify-center text-xs text-emerald-400 italic py-8">
                                No ready orders
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2.5 overflow-y-auto">
                                {readyOrders.filter(o => o.items?.some(i => i.kitchen_type === 'resto')).map(order => (
                                  <OrderCard key={order.id} order={order} filterType="resto" />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* Kitchen Section (Right Column - Food) */}
                    <section className="bg-gradient-to-b from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-200 flex flex-col">
                      <div className="flex justify-between items-center mb-4 pb-3 border-b border-orange-200 shrink-0">
                        <div className="flex items-center gap-2">
                          <ChefHat className="w-6 h-6 text-orange-600" />
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">Kitchen</h3>
                            <p className="text-xs text-gray-600">Food • Main Dishes • Appetizers</p>
                          </div>
                        </div>
                      </div>

                      {/* Kitchen Orders - Scrollable */}
                      <div className="flex-1 overflow-y-auto max-h-[calc(100vh-380px)] pr-3">
                        <div className="grid grid-cols-3 gap-4">
                          {/* Kitchen Pending */}
                          <div className="bg-red-50/80 rounded-xl p-3 border border-red-200 flex flex-col">
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-red-200 sticky top-0 bg-red-50/80 z-10 rounded-t-lg">
                              <div className="p-1.5 bg-red-100 rounded-lg">
                                <AlertOctagon className="w-4 h-4 text-red-600" />
                              </div>
                              <span className="text-sm font-bold text-red-700">Pending</span>
                              <span className="ml-auto px-2 py-0.5 text-xs font-bold bg-red-200 text-red-800 rounded-full">
                                {pendingOrders.filter(o => o.items?.some(i => i.kitchen_type === 'kitchen')).length}
                              </span>
                            </div>
                            {pendingOrders.filter(o => o.items?.some(i => i.kitchen_type === 'kitchen')).length === 0 ? (
                              <div className="flex-1 flex items-center justify-center text-xs text-red-400 italic py-8">
                                No pending orders
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2.5 overflow-y-auto">
                                {pendingOrders.filter(o => o.items?.some(i => i.kitchen_type === 'kitchen')).map(order => (
                                  <OrderCard key={order.id} order={order} filterType="kitchen" />
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Kitchen Preparing */}
                          <div className="bg-amber-50/80 rounded-xl p-3 border border-amber-200 flex flex-col">
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-amber-200 sticky top-0 bg-amber-50/80 z-10 rounded-t-lg">
                              <div className="p-1.5 bg-amber-100 rounded-lg">
                                <Construction className="w-4 h-4 text-amber-600" />
                              </div>
                              <span className="text-sm font-bold text-amber-700">Preparing</span>
                              <span className="ml-auto px-2 py-0.5 text-xs font-bold bg-amber-200 text-amber-800 rounded-full">
                                {preparingOrders.filter(o => o.items?.some(i => i.kitchen_type === 'kitchen')).length}
                              </span>
                            </div>
                            {preparingOrders.filter(o => o.items?.some(i => i.kitchen_type === 'kitchen')).length === 0 ? (
                              <div className="flex-1 flex items-center justify-center text-xs text-amber-400 italic py-8">
                                No preparing orders
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2.5 overflow-y-auto">
                                {preparingOrders.filter(o => o.items?.some(i => i.kitchen_type === 'kitchen')).map(order => (
                                  <OrderCard key={order.id} order={order} filterType="kitchen" />
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Kitchen Ready */}
                          <div className="bg-emerald-50/80 rounded-xl p-3 border border-emerald-200 flex flex-col">
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-emerald-200 sticky top-0 bg-emerald-50/80 z-10 rounded-t-lg">
                              <div className="p-1.5 bg-emerald-100 rounded-lg">
                                <Package className="w-4 h-4 text-emerald-600" />
                              </div>
                              <span className="text-sm font-bold text-emerald-700">Ready</span>
                              <span className="ml-auto px-2 py-0.5 text-xs font-bold bg-emerald-200 text-emerald-800 rounded-full">
                                {readyOrders.filter(o => o.items?.some(i => i.kitchen_type === 'kitchen')).length}
                              </span>
                            </div>
                            {readyOrders.filter(o => o.items?.some(i => i.kitchen_type === 'kitchen')).length === 0 ? (
                              <div className="flex-1 flex items-center justify-center text-xs text-emerald-400 italic py-8">
                                No ready orders
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2.5 overflow-y-auto">
                                {readyOrders.filter(o => o.items?.some(i => i.kitchen_type === 'kitchen')).map(order => (
                                  <OrderCard key={order.id} order={order} filterType="kitchen" />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                ) : (
                  /* Kitchen Role View - Only Their Kitchen */
                  <section className={`rounded-xl p-4 border flex flex-col ${
                    isRestoKitchen 
                      ? 'bg-gradient-to-b from-blue-50 to-indigo-50 border-blue-200' 
                      : 'bg-gradient-to-b from-orange-50 to-amber-50 border-orange-200'
                  }`}>
                    <div className={`flex justify-between items-center mb-4 pb-3 border-b shrink-0 ${
                      isRestoKitchen ? 'border-blue-200' : 'border-orange-200'
                    }`}>
                      <div className="flex items-center gap-2">
                        {isRestoKitchen ? (
                          <>
                            <Coffee className="w-6 h-6 text-blue-600" />
                            <div>
                              <h3 className="text-lg font-bold text-gray-900">Resto Kitchen</h3>
                              <p className="text-xs text-gray-600">Beverages • Coffee • Drinks</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <ChefHat className="w-6 h-6 text-orange-600" />
                            <div>
                              <h3 className="text-lg font-bold text-gray-900">Kitchen</h3>
                              <p className="text-xs text-gray-600">Food • Main Dishes • Appetizers</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Orders - Scrollable with Pending, Preparing, and Ready side by side */}
                    <div className="flex-1 overflow-y-auto max-h-[calc(100vh-380px)] pr-3">
                      <div className="grid grid-cols-3 gap-4">
                        {/* Pending Column */}
                        <div className="bg-red-50/80 rounded-xl p-3 border border-red-200 flex flex-col">
                          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-red-200 sticky top-0 bg-red-50/80 z-10 rounded-t-lg">
                            <div className="p-1.5 bg-red-100 rounded-lg">
                              <AlertOctagon className="w-4 h-4 text-red-600" />
                            </div>
                            <span className="text-sm font-bold text-red-700">Pending</span>
                            <span className="ml-auto px-2 py-0.5 text-xs font-bold bg-red-200 text-red-800 rounded-full">
                              {pendingOrders.length}
                            </span>
                          </div>
                          {pendingOrders.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center text-xs text-red-400 italic py-8">
                              No pending orders
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2.5 overflow-y-auto">
                              {pendingOrders.map(order => (
                                <OrderCard key={order.id} order={order} />
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Preparing Column */}
                        <div className="bg-amber-50/80 rounded-xl p-3 border border-amber-200 flex flex-col">
                          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-amber-200 sticky top-0 bg-amber-50/80 z-10 rounded-t-lg">
                            <div className="p-1.5 bg-amber-100 rounded-lg">
                              <Construction className="w-4 h-4 text-amber-600" />
                            </div>
                            <span className="text-sm font-bold text-amber-700">Preparing</span>
                            <span className="ml-auto px-2 py-0.5 text-xs font-bold bg-amber-200 text-amber-800 rounded-full">
                              {preparingOrders.length}
                            </span>
                          </div>
                          {preparingOrders.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center text-xs text-amber-400 italic py-8">
                              No preparing orders
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2.5 overflow-y-auto">
                              {preparingOrders.map(order => (
                                <OrderCard key={order.id} order={order} />
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Ready Column */}
                        <div className="bg-emerald-50/80 rounded-xl p-3 border border-emerald-200 flex flex-col">
                          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-emerald-200 sticky top-0 bg-emerald-50/80 z-10 rounded-t-lg">
                            <div className="p-1.5 bg-emerald-100 rounded-lg">
                              <Package className="w-4 h-4 text-emerald-600" />
                            </div>
                            <span className="text-sm font-bold text-emerald-700">Ready</span>
                            <span className="ml-auto px-2 py-0.5 text-xs font-bold bg-emerald-200 text-emerald-800 rounded-full">
                              {readyOrders.length}
                            </span>
                          </div>
                          {readyOrders.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center text-xs text-emerald-400 italic py-8">
                              No ready orders
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2.5 overflow-y-auto">
                              {readyOrders.map(order => (
                                <OrderCard key={order.id} order={order} />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>
            ))}

            {activeTab === 'completed' && (
              <div>
                <div className="mb-3">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <BadgeCheck className="w-5 h-5 text-green-500" />
                    Completed Orders
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {getDateRangeDisplay()} • {completedOrders.length} order{completedOrders.length !== 1 ? 's' : ''}
                  </p>
                </div>
                
                {completedOrders.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="inline-flex p-4 bg-green-100 rounded-full mb-4">
                      <BadgeCheck className="w-12 h-12 text-green-600" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No completed orders</h3>
                    <p className="text-gray-500">
                      {dateFilter === 'today'
                        ? 'Completed orders will appear here'
                        : `No completed orders for ${getDateRangeDisplay()}`}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {currentOrders.map(order => (
                        <OrderCard key={order.id} order={order} />
                      ))}
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
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </AdminLayout>
  );
}