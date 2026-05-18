// resources/js/Pages/Admin/POS.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Head, usePage, router } from '@inertiajs/react';
import { 
    ShoppingCart, 
    Users, 
    CreditCard, 
    CheckCircle,
    Clock,
    Table as TableIcon,
    Truck,
    Package,
    Trash2,
    Plus,
    Minus,
    Search,
    AlertCircle,
    X,
    Printer,
    ChefHat,
    ArrowLeft,
    Loader2,
    Percent,
    Tag,
    Edit,
    Grid,
    List,
    Star,
    Coffee,
    Pizza,
    Salad,
    Soup,
    Sandwich,
    Milk,
    GlassWater,
    Wine,
    Utensils,
    Crown,
    Sparkles,
    Bell,
    RefreshCw,
    Eye,
    EyeOff,
    Ban,
    CheckSquare,
    Wifi,
    WifiOff,
    Hotel,
    Wallet,
    DollarSign,
    ChevronLeft,
    ChevronRight,
    Building,
    Hash,
    Flame,
    Check,
    Hourglass,
    Zap,
    Activity,
    AlertTriangle,
    BadgePercent,
    Briefcase,
    Building2,
    MessageSquare,
    Settings,
    User,
    UserCircle,
    Heart,
    Gift,
    Maximize2,
    Minimize2,
    Play
} from 'lucide-react';
import ReceiptPrint from '@/Components/ReceiptPrint';
import ShiftReceiptPrint from '@/Components/ShiftReceiptPrint';
import { nowPH, formatPHTime, formatPHDate, formatPHDateTime } from '@/utils/phTime';

// Category icons mapping
const categoryIcons = {
    'Main Dish': ChefHat,
    'Burgers & Sandwiches': Sandwich,
    'Pasta': Pizza,
    'Salad': Salad,
    'Appetizers': Utensils,
    'Coffee Based': Coffee,
    'Milk Based': Milk,
    'Frappe': Coffee,
    'Soda': GlassWater,
    'Add ons': Plus,
    'Soup': Soup,
    'Drinks': Wine,
    'Non Based Coffee': Coffee,
    'Specialty': Crown,
    'Seasonal': Star,
    'Rice (4-5 persons)': Utensils,
    'Soup and Salad': Soup,
    'Casa Jedliana Soup': Soup,
    'Side dish': Utensils,
    'Pork': ChefHat,
    'Chicken': ChefHat,
    'Fish & Seafoods': ChefHat,
    'Vegetables': Salad,
    'Rice in a bowl': Utensils,
    'Set Meals': Package,
    'American Breakfast': Coffee,
    'Filipino Breakfast': Coffee,
    'Breakfast Side dish': Utensils,
    'Beverages': Wine,
    'Add Ons': Plus,
};

// Order type options
const ORDER_TYPES = [
    { value: 'dine_in', label: 'Dine In', icon: TableIcon, color: 'bg-blue-500' },
    { value: 'takeout', label: 'Takeout', icon: Package, color: 'bg-emerald-500' },
    { value: 'delivery', label: 'Delivery', icon: Truck, color: 'bg-purple-500' },
];

// Payment methods
const PAYMENT_METHODS = [
    { id: 1, name: 'Cash', icon: DollarSign, color: 'bg-green-500', textColor: 'text-green-600', bgColor: 'bg-green-50' },
    { id: 2, name: 'Card', icon: CreditCard, color: 'bg-blue-500', textColor: 'text-blue-600', bgColor: 'bg-blue-50' },
    { id: 3, name: 'E-Wallet', icon: Wallet, color: 'bg-purple-500', textColor: 'text-purple-600', bgColor: 'bg-purple-50' },
    { id: 4, name: 'Hotel', icon: Hotel, color: 'bg-amber-500', textColor: 'text-amber-600', bgColor: 'bg-amber-50' },
];

// Price formatting
// Read CSRF token — tries meta tag first, then Inertia shared data
const getCsrf = () => {
    // 1. Standard Laravel meta tag (most reliable)
    const meta = document.querySelector('meta[name="csrf-token"]')?.content;
    if (meta) return meta;
    // 2. Inertia puts it on the page data attribute
    const pageData = document.getElementById('app')?.dataset?.page;
    if (pageData) {
        try {
            const parsed = JSON.parse(pageData);
            if (parsed?.props?.csrf_token) return parsed.props.csrf_token;
        } catch {}
    }
    // 3. Last resort — read from cookie (for Sanctum/Axios setup)
    const match = document.cookie.split('; ').find(r => r.startsWith('XSRF-TOKEN='));
    return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : '';
};

const formatPrice = (price) => {
    if (price === null || price === undefined || price === '') return '0.00';
    const numPrice = Number(price);
    if (isNaN(numPrice)) return '0.00';
    return numPrice.toFixed(2);
};

// Philippine time formatting - using phTime.js utility
// formatPhilippineTime is replaced by formatPHTime from phTime.js

const getCurrentUnixSeconds = () => Math.floor(Date.now() / 1000);

const normalizeMenuTimestamp = (value) => {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue) || numericValue <= 0) {
        return 0;
    }

    // Accept seconds or milliseconds and always keep seconds in state.
    if (numericValue > 9999999999) {
        return Math.floor(numericValue / 1000);
    }

    return Math.floor(numericValue);
};

// Get image URL helper function
const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return imagePath;
    }
    const cleanPath = imagePath.replace(/^storage\//, '');
    return `/storage/${cleanPath}`;
};

// Category groups for employee discounts
const CATEGORY_GROUPS = {
    COFFEE: ['Coffee Based', 'Coffee', 'Milk Based', 'Frappe'],
    SODA: ['Soda', 'Soda & Bottled Drinks'],
    ADD_ONS: ['Add ons', 'Add Ons'],
    FOOD: [
        'Rice (4-5 persons)', 'Soup and Salad', 'Appetizer', 'Burgers & Sandwich',
        'Casa Jedliana Soup', 'Salad', 'Pasta', 'Noodles', 'Side dish', 'Pork',
        'Chicken', 'Fish & Seafoods', 'Vegetables', 'Rice in a bowl', 'Set Meals',
        'American Breakfast', 'Filipino Breakfast', 'Breakfast Side dish',
        'Main Dish', 'Burgers & Sandwiches', 'Appetizers', 'Soup'
    ]
};

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

export default function POS({ 
    categories: initialCategories = [], 
    kitchenCategories: initialKitchenCategories = [],
    paymentMethods: initialPaymentMethods = [],
    pendingOrders: initialPendingOrders = [],
    readyOrders = [],
    appName = 'Restaurant POS',
    menuLastUpdated = 0,
    flash = {}
}) {
    const { auth, csrf_token: csrfToken } = usePage().props;
    
    // ============ STATE MANAGEMENT ============
    const [categories, setCategories] = useState(initialCategories);
    const [kitchenCategories, setKitchenCategories] = useState(initialKitchenCategories);
    const [pendingOrders, setPendingOrders] = useState(initialPendingOrders);
    const [orderItems, setOrderItems] = useState([]);
    const [activeCategory, setActiveCategory] = useState('all');
    const [orderType, setOrderType] = useState('dine_in');
    const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '', address: '', notes: '' });
    
    // Hotel specific fields
    const [hotelInfo, setHotelInfo] = useState({ guestName: '', roomNumber: '' });
    
    const [peopleCount, setPeopleCount] = useState(1);
    const [cardsPresented, setCardsPresented] = useState(0);
    const [discount, setDiscount] = useState({ type: 'none', value: 0 });
    const [searchQuery, setSearchQuery] = useState('');
    const [showOnlyAvailable, setShowOnlyAvailable] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [processingOrder, setProcessingOrder] = useState(null);
    const [pendingReceipt, setPendingReceipt] = useState(null);
    const pendingReceiptRef = useRef(null);

    // Cashier shift (cashier role only)
    const [cashierShift, setCashierShift] = useState(null);
    const [shiftModal, setShiftModal] = useState(null); // 'checkin' | 'checkout' | 'expense' | null
    const [shiftLoading, setShiftLoading] = useState(false);
    const [shiftError, setShiftError] = useState('');
    const [shiftReceipt, setShiftReceipt] = useState(null);
    const [shiftStartingBalance, setShiftStartingBalance] = useState('');
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseDescription, setExpenseDescription] = useState('');
    const [notification, setNotification] = useState(null);
    const [readyOrderNotifications, setReadyOrderNotifications] = useState([]);
    const [successOrder, setSuccessOrder] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState('connected');
    const [lastUpdate, setLastUpdate] = useState(new Date());
    const [showPendingOrders, setShowPendingOrders] = useState(true);
    const [selectedTable, setSelectedTable] = useState(null);
    
    // Item notes state
    const [itemNotes, setItemNotes] = useState({});
    const [showNotesModal, setShowNotesModal] = useState(false);
    const [selectedItemForNotes, setSelectedItemForNotes] = useState(null);
    const [currentNote, setCurrentNote] = useState('');
    
    // Auto-refresh state
    const [isPollingActive, setIsPollingActive] = useState(true);
    const [pollingStats, setPollingStats] = useState({ menu: 0, orders: 0, errors: 0 });
    
    // Modal states
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showDiscountModal, setShowDiscountModal] = useState(false);
    const [showPriceChoiceModal, setShowPriceChoiceModal] = useState(false);
    const [selectedDualPriceItem, setSelectedDualPriceItem] = useState(null);

    // Drink variant modal (size + temperature)
    const [showVariantModal, setShowVariantModal] = useState(false);
    const [selectedVariantItem, setSelectedVariantItem] = useState(null);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
    const [cashAmount, setCashAmount] = useState('');
    const [cashName, setCashName] = useState('');
    const [modalPeopleCount, setModalPeopleCount] = useState(1);
    const [modalCardsPresented, setModalCardsPresented] = useState(0);
    const [modalIsEmployee, setModalIsEmployee] = useState(false);
    const [modalIsPersonal, setModalIsPersonal] = useState(false);
    const [personalInfo, setPersonalInfo] = useState({ name: '', reason: '' });
    const [employeeInfo, setEmployeeInfo] = useState({ name: '', id: '' });
    
    // Refs
    const audioRef = useRef(null);
    const menuPollTimeoutRef = useRef(null);
    const orderPollTimeoutRef = useRef(null);
    const mountedRef = useRef(true);
    const menuPollInFlightRef = useRef(false);
    const orderPollInFlightRef = useRef(false);
    const pollingErrorsRef = useRef(0);
    const lastMenuUpdateRef = useRef(normalizeMenuTimestamp(menuLastUpdated));
    const lastOrderUpdateRef = useRef(Date.now());
    const pendingOrdersRef = useRef(initialPendingOrders);
    const readyNotifiedOrderIdsRef = useRef(new Set());
    
    // Current time state for header
    const [currentTime, setCurrentTime] = useState(formatPHTime(nowPH()));
    const [currentDate, setCurrentDate] = useState(formatPHDate(nowPH()));
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Initialize audio
    useEffect(() => {
        audioRef.current = new Audio('/sound1.mp3');
        audioRef.current.volume = 0.5;
        
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
            }
        };
    }, []);

    // Update time every second
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(formatPHTime(nowPH()));
            setCurrentDate(formatPHDate(nowPH()));
        }, 1000);
        
        return () => clearInterval(timer);
    }, []);

    // Keep fullscreen state in sync (ESC/F11/browser controls)
    useEffect(() => {
        const syncFullscreenState = () => {
            setIsFullscreen(Boolean(
                document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement ||
                document.msFullscreenElement
            ));
        };

        syncFullscreenState();

        document.addEventListener('fullscreenchange', syncFullscreenState);
        document.addEventListener('webkitfullscreenchange', syncFullscreenState);
        document.addEventListener('mozfullscreenchange', syncFullscreenState);
        document.addEventListener('MSFullscreenChange', syncFullscreenState);

        return () => {
            document.removeEventListener('fullscreenchange', syncFullscreenState);
            document.removeEventListener('webkitfullscreenchange', syncFullscreenState);
            document.removeEventListener('mozfullscreenchange', syncFullscreenState);
            document.removeEventListener('MSFullscreenChange', syncFullscreenState);
        };
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            mountedRef.current = false;
            if (menuPollTimeoutRef.current) clearTimeout(menuPollTimeoutRef.current);
            if (orderPollTimeoutRef.current) clearTimeout(orderPollTimeoutRef.current);
        };
    }, []);

    // Cashier shift gate: cashier must check in before using POS.
    useEffect(() => {
        const role = (auth?.user?.role || '').toLowerCase();
        if (role !== 'cashier') return;

        fetch('/cashier/shifts/current', {
            headers: { 'Accept': 'application/json' },
        })
            .then(r => r.json())
            .then(data => {
                if (data.shift) {
                    setCashierShift(data.shift);
                    setShiftModal(null);
                } else {
                    setCashierShift(null);
                    setShiftStartingBalance('');
                    setShiftError('');
                    setShiftModal('checkin');
                }
            })
            .catch(() => {
                // Fail silently; server-side enforcement still blocks order creation.
            });
    }, []);

    // Keep local state synced when Inertia props are refreshed after actions.
    useEffect(() => {
        setCategories(initialCategories);
    }, [initialCategories]);

    useEffect(() => {
        setKitchenCategories(initialKitchenCategories);
    }, [initialKitchenCategories]);

    useEffect(() => {
        setPendingOrders(initialPendingOrders);
        pendingOrdersRef.current = initialPendingOrders;
    }, [initialPendingOrders]);

    useEffect(() => {
        pendingOrdersRef.current = pendingOrders;
    }, [pendingOrders]);

    useEffect(() => {
        const normalized = normalizeMenuTimestamp(menuLastUpdated);
        lastMenuUpdateRef.current = normalized;
    }, [menuLastUpdated]);

    // ============ PROFESSIONAL AUTO-REFRESH WITH ADAPTIVE POLLING ============
    
    // Menu polling function
    const pollMenuUpdates = useCallback(async () => {
        if (!mountedRef.current || !isPollingActive || menuPollInFlightRef.current) return;
        menuPollInFlightRef.current = true;
        let nextDelay = 2000;
        
        try {
            const response = await fetch(`/cashier/pos/menu-updates?last_update=${lastMenuUpdateRef.current}`, {
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Cache-Control': 'no-cache',
                },
            });
            
            if (!mountedRef.current) return;
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.success) {
                    setConnectionStatus('connected');
                    setPollingStats(prev => ({ ...prev, menu: prev.menu + 1, errors: 0 }));
                    pollingErrorsRef.current = 0;
                    
                    if (data.updated && data.categories) {
                        setCategories(data.categories);
                        if (data.kitchen_categories) {
                            setKitchenCategories(data.kitchen_categories);
                        }
                        const normalizedUpdate = normalizeMenuTimestamp(data.menu_last_updated) || getCurrentUnixSeconds();
                        lastMenuUpdateRef.current = normalizedUpdate;
                        setLastUpdate(new Date());
                    }
                } else {
                    throw new Error('Invalid response');
                }
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('Menu polling error:', error);
            
            if (!mountedRef.current) return;
            
            setConnectionStatus('disconnected');
            setPollingStats(prev => ({ ...prev, errors: prev.errors + 1 }));
            pollingErrorsRef.current += 1;
            nextDelay = Math.min(30000, 2000 * Math.pow(1.5, pollingErrorsRef.current));
        } finally {
            menuPollInFlightRef.current = false;
            if (mountedRef.current && isPollingActive) {
                if (menuPollTimeoutRef.current) clearTimeout(menuPollTimeoutRef.current);
                menuPollTimeoutRef.current = setTimeout(pollMenuUpdates, nextDelay);
            }
        }
    }, [isPollingActive]);

    // Order polling function - checks for order status updates
    const pollOrderUpdates = useCallback(async () => {
        if (!mountedRef.current || !isPollingActive || orderPollInFlightRef.current) return;
        orderPollInFlightRef.current = true;
        let nextDelay = 3000;
        
        try {
            const response = await fetch(`/cashier/pos/order-updates?last_update=${lastOrderUpdateRef.current}`, {
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Cache-Control': 'no-cache',
                },
            });
            
            if (!mountedRef.current) return;
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.success) {
                    setConnectionStatus('connected');
                    setPollingStats(prev => ({ ...prev, orders: prev.orders + 1, errors: 0 }));
                    pollingErrorsRef.current = 0;
                    
                    if (data.pending_orders) {
                        // Format order numbers for display
                        const formattedOrders = data.pending_orders.map(order => ({
                            ...order,
                            display_order_number: order.txn_number || order.order_number || `ORD-${String(order.id).padStart(5, '0')}`
                        }));
                        
                        // Check for status changes in existing orders
                        const previousOrders = pendingOrdersRef.current;
                        const statusChanges = [];
                        
                        formattedOrders.forEach(newOrder => {
                            const oldOrder = previousOrders.find(o => o.id === newOrder.id);
                            if (oldOrder && oldOrder.status !== newOrder.status) {
                                statusChanges.push({
                                    id: newOrder.id,
                                    orderNumber: newOrder.display_order_number,
                                    oldStatus: oldOrder.status,
                                    newStatus: newOrder.status,
                                    isReady: newOrder.status === 'ready' || newOrder.all_items_ready === true
                                });
                            }
                        });
                        
                        // Show notifications for status changes
                        statusChanges.forEach(change => {
                            if (change.newStatus === 'ready' || change.all_items_ready === true) {
                                if (!readyNotifiedOrderIdsRef.current.has(change.id)) {
                                    readyNotifiedOrderIdsRef.current.add(change.id);
                                    setReadyOrderNotifications(prev => [...prev, {
                                        id: change.id,
                                        orderNumber: change.orderNumber,
                                        customerName: formattedOrders.find(o => o.id === change.id)?.customer_name || 'Walk-in Customer',
                                        isHotel: formattedOrders.find(o => o.id === change.id)?.payment_method_name === 'Hotel',
                                        roomNumber: formattedOrders.find(o => o.id === change.id)?.room_number,
                                        timestamp: Date.now()
                                    }]);
                                }
                            }
                        });
                        
                        pendingOrdersRef.current = formattedOrders;
                        setPendingOrders(formattedOrders);
                    }
                    
                    lastOrderUpdateRef.current = Date.now();
                    setLastUpdate(new Date());
                } else {
                    throw new Error('Invalid response');
                }
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('Order polling error:', error);
            
            if (!mountedRef.current) return;
            
            setConnectionStatus('disconnected');
            setPollingStats(prev => ({ ...prev, errors: prev.errors + 1 }));
            pollingErrorsRef.current += 1;
            nextDelay = Math.min(30000, 3000 * Math.pow(1.5, pollingErrorsRef.current));
        } finally {
            orderPollInFlightRef.current = false;
            if (mountedRef.current && isPollingActive) {
                if (orderPollTimeoutRef.current) clearTimeout(orderPollTimeoutRef.current);
                orderPollTimeoutRef.current = setTimeout(pollOrderUpdates, nextDelay);
            }
        }
    }, [isPollingActive]);

    // Start polling
    useEffect(() => {
        pollMenuUpdates();
        pollOrderUpdates();

        // Keep session alive — ping every 5 minutes so POS never auto-logs out
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
                if (token) console.log('POS CSRF token refreshed');
            });
        };
        const csrfRefreshInterval = setInterval(refreshCsrf, 10 * 60 * 1000);

        const handleVisibilityChange = () => {
            setIsPollingActive(!document.hidden);
        };
        
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearInterval(keepAliveInterval);
            if (menuPollTimeoutRef.current) clearTimeout(menuPollTimeoutRef.current);
            if (orderPollTimeoutRef.current) clearTimeout(orderPollTimeoutRef.current);
        };
    }, [pollMenuUpdates, pollOrderUpdates]);

    // Helper function to get category name by ID
    const getCategoryName = (categoryId) => {
        for (const category of categories) {
            if (category.id === categoryId) {
                return category.name;
            }
            // Check if items have category_name directly
            if (category.items) {
                const item = category.items.find(i => i.id === categoryId);
                if (item) return category.name;
            }
        }
        return '';
    };

    // Calculate employee discounts based on category
    const calculateEmployeeDiscount = (items) => {
        let totalEmployeeDiscount = 0;
        
        items.forEach(item => {
            // Find the category name for this item
            let categoryName = '';
            for (const category of categories) {
                const found = category.items?.find(i => i.id === item.id);
                if (found) {
                    categoryName = category.name;
                    break;
                }
            }
            
            const itemSubtotal = Number(item.price) * item.quantity;
            
            // Apply discount based on category
            if (CATEGORY_GROUPS.COFFEE.includes(categoryName)) {
                // Coffee, Milk Based, Frappe - 20% discount
                totalEmployeeDiscount += itemSubtotal * 0.20;
            } else if (CATEGORY_GROUPS.SODA.includes(categoryName)) {
                // Soda - 10% discount
                totalEmployeeDiscount += itemSubtotal * 0.10;
            } else if (CATEGORY_GROUPS.FOOD.includes(categoryName)) {
                // All food categories - 5% discount
                totalEmployeeDiscount += itemSubtotal * 0.05;
            }
            // Add-ons - no discount (0%)
        });
        
        return Math.round(totalEmployeeDiscount * 100) / 100;
    };

    // ============ CALCULATIONS ============
    const calculateTotals = (people, cards, discType, discValue, isEmployeeActive, isPersonalActive, items, selectedPaymentMethod) => {
        const subtotal = items.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);
        
        // Personal orders are completely free — skip all other calculations
        if (isPersonalActive) {
            return {
                subtotal,
                employeeDiscount: 0,
                cardDiscount: 0,
                additionalDiscount: subtotal, // show full discount
                serviceCharge: 0,
                totalDiscount: subtotal,
                total: 0
            };
        }

        // Step 1: Calculate employee discount if active
        let employeeDiscount = 0;
        if (isEmployeeActive) {
            employeeDiscount = calculateEmployeeDiscount(items);
        }
        
        // Step 2: Calculate card discount (20% per card) - applies to subtotal after employee discount
        let afterEmployeeDiscount = subtotal - employeeDiscount;
        let cardDiscount = 0;
        if (cards > 0 && people > 0) {
            cardDiscount = (afterEmployeeDiscount * 0.20) / people * cards;
            cardDiscount = Math.round(cardDiscount * 100) / 100;
        }
        
        // Step 3: Calculate additional manual discount - applies after employee and card discounts
        let afterCardDiscount = afterEmployeeDiscount - cardDiscount;
        let additionalDiscount = 0;
        if (discType === 'percentage' && discValue > 0) {
            additionalDiscount = (afterCardDiscount * discValue) / 100;
        } else if (discType === 'fixed' && discValue > 0) {
            additionalDiscount = discValue;
        }
        additionalDiscount = Math.round(additionalDiscount * 100) / 100;
        
        // Step 4: Calculate total after all discounts
        let afterAllDiscounts = afterCardDiscount - additionalDiscount;
        
        // Step 5: Apply hotel service charge (10%) if payment method is Hotel - applies after all discounts
        let serviceCharge = 0;
        if (selectedPaymentMethod?.name === 'Hotel') {
            serviceCharge = afterAllDiscounts * 0.10;
            serviceCharge = Math.round(serviceCharge * 100) / 100;
        }
        
        const finalTotal = afterAllDiscounts + serviceCharge;
        
        return {
            subtotal,
            employeeDiscount,
            cardDiscount,
            additionalDiscount,
            serviceCharge,
            totalDiscount: employeeDiscount + cardDiscount + additionalDiscount,
            total: finalTotal < 0 ? 0 : finalTotal
        };
    };

    const { subtotal, employeeDiscount, cardDiscount, additionalDiscount, serviceCharge, total } = calculateTotals(
        peopleCount, cardsPresented, discount.type, discount.value, modalIsEmployee, modalIsPersonal, orderItems, selectedPaymentMethod
    );

    const modalTotals = calculateTotals(
        modalPeopleCount, modalCardsPresented, discount.type, discount.value, modalIsEmployee, modalIsPersonal, orderItems, selectedPaymentMethod
    );

    // ============ FILTERING ============
    const filterItems = (items) => {
        let filtered = items || [];
        if (showOnlyAvailable) {
            filtered = filtered.filter(item => item.is_available !== false);
        }
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(item => 
                item.name.toLowerCase().includes(query) ||
                (item.description && item.description.toLowerCase().includes(query))
            );
        }
        return filtered;
    };

    const getFilteredItems = () => {
        // Combine resto categories and kitchen categories
        const allCategories = [...(categories || []), ...(kitchenCategories || [])];
        
        if (allCategories.length === 0) return [];
        
        const allItems = allCategories.flatMap(cat => 
            (cat.items || []).map(item => ({
                ...item,
                category_name: cat.name,
                category_id: cat.id,
                // source is already set by backend, default to 'resto' if not present
                source: item.source || 'resto'
            }))
        );

        if (activeCategory === 'all') {
            return filterItems(allItems);
        } else if (activeCategory.startsWith('b:')) {
            // Both kitchen and resto share this category name — include items from both IDs
            const ids = activeCategory.slice(2).split(',').map(String);
            return filterItems(allItems.filter(item => ids.includes(item.category_id.toString())));
        } else if (activeCategory.startsWith('r:') || activeCategory.startsWith('k:')) {
            const id = activeCategory.slice(2);
            return filterItems(allItems.filter(item => item.category_id.toString() === id));
        } else {
            // Legacy plain numeric value fallback
            return filterItems(allItems.filter(item => item.category_id.toString() === activeCategory));
        }
    };

    const filteredItems = getFilteredItems();
    const allItemsCount = [...(categories || []), ...(kitchenCategories || [])].reduce((sum, category) => sum + (category.items?.length || 0), 0);

    // Map of ingredient_id -> total stock-units already committed by items currently in the cart.
    // Recomputed whenever the cart or categories change.
    const cartIngredientUsage = React.useMemo(() => {
        const usage = {};
        for (const cartItem of orderItems) {
            let menuItem = null;
            const lookupCategories = (cartItem.source === 'kitchen')
                ? kitchenCategories
                : categories;
            for (const cat of lookupCategories) {
                const found = cat.items?.find(i => i.id === cartItem.id);
                if (found) { menuItem = found; break; }
            }
            const recipeRows = Array.isArray(menuItem?.recipe) ? menuItem.recipe : null;
            if (!recipeRows || recipeRows.length === 0) continue;
            const qty = cartItem.quantity || 1;
            for (const row of recipeRows) {
                const ingredient_id = row.ingredient_id ?? row.id;
                if (!ingredient_id) continue;
                const perServing = cartItem.portion === 'whole' && Number.isFinite(Number(row.qty_whole))
                    ? Number(row.qty_whole)
                    : Number(row.qty);
                if (!Number.isFinite(perServing) || perServing <= 0) continue;
                usage[ingredient_id] = (usage[ingredient_id] || 0) + perServing * qty;
            }
        }
        return usage;
    }, [orderItems, categories, kitchenCategories]);

    const getEffectiveAvailable = (item, portionOverride = null) => {
        if (!item) return null;

        const portion = portionOverride || item.portion || null;
        const servingsRaw = portion === 'whole' && item.inventory_available_servings_whole !== undefined
            ? item.inventory_available_servings_whole
            : item.inventory_available_servings;
        if (servingsRaw !== null && servingsRaw !== undefined && servingsRaw !== '') {
            const servings = Number(servingsRaw);
            if (Number.isFinite(servings)) {
                if (Array.isArray(item.recipe) && item.recipe.length) {
                    let maxServingsConsumed = 0;
                    for (const row of item.recipe) {
                        const ingredient_id = row.ingredient_id ?? row.id;
                        if (!ingredient_id) continue;
                        const perServing = portion === 'whole' && Number.isFinite(Number(row.qty_whole))
                            ? Number(row.qty_whole)
                            : Number(row.qty);
                        if (!Number.isFinite(perServing) || perServing <= 0) continue;
                        const usedByCart = cartIngredientUsage[ingredient_id] || 0;
                        maxServingsConsumed = Math.max(maxServingsConsumed, usedByCart / perServing);
                    }
                    return Math.max(0, Math.floor(servings - maxServingsConsumed));
                }
                // No recipe — subtract same-item cart quantity
                const inCart = orderItems
                    .filter(ci => ci.id === item.id)
                    .reduce((sum, ci) => sum + (ci.quantity || 1), 0);
                return Math.max(0, Math.floor(servings) - inCart);
            }
        }

        if (item.stock_quantity === null || item.stock_quantity === undefined) {
            return null;
        }

        const stock = Number(item.stock_quantity);
        if (!Number.isFinite(stock)) {
            return null;
        }

        const inCart = orderItems
            .filter(ci => ci.id === item.id)
            .reduce((sum, ci) => sum + (ci.quantity || 1), 0);
        return Math.max(0, Math.floor(stock) - inCart);
    };

    const getStockUnitLabel = (item) => {
        const servingsRaw = item?.inventory_available_servings;
        if (servingsRaw !== null && servingsRaw !== undefined && servingsRaw !== '') {
            return 'serving';
        }
        return 'item';
    };

    const isOutOfStock = (item) => {
        if (item?.inventory_status === 'out') {
            return true;
        }
        const available = getEffectiveAvailable(item, item?.portion || null);
        return available !== null && available <= 0;
    };

    const hasDualPriceOptions = (item) => {
        if (!item || item.pricing_type !== 'dual') {
            return false;
        }

        const solo = Number(item.price_solo);
        const whole = Number(item.price_whole);

        return Number.isFinite(solo) && solo > 0 && Number.isFinite(whole) && whole > 0;
    };

    const closePriceChoiceModal = () => {
        setShowPriceChoiceModal(false);
        setSelectedDualPriceItem(null);
    };

    // ============ NOTIFICATIONS ============
    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    };

    // Dismiss a ready order notification
    const dismissReadyNotification = (notificationId) => {
        setReadyOrderNotifications(prev => prev.filter(n => n.id !== notificationId));
    };

    // Dismiss all ready order notifications
    const dismissAllNotifications = () => {
        setReadyOrderNotifications([]);
    };

    const showSuccessOrder = (orderData, receiptData = null) => {
        setSuccessOrder(orderData);
        
        // After success modal closes (5 seconds), show receipt if available
        if (receiptData) {
            setTimeout(() => {
                pendingReceiptRef.current = receiptData;
                setPendingReceipt(receiptData);
            }, 5200); // Show after success modal closes
        }
        
        // Auto-clear success modal after 5 seconds
        setTimeout(() => setSuccessOrder(null), 5000);
    };

    // ============ ORDER MANAGEMENT WITH STOCK CHECKING ============
    const addToOrder = (item, options = {}) => {
        if (item.is_available === false) {
            showNotification(`${item.name} is unavailable`, 'error');
            return;
        }

        if (!item.has_recipe && !item.ingredients?.length) {
            showNotification(`${item.name} has no recipe set — contact admin`, 'error');
            return;
        }

        const selectedPortion   = options.portion     || null;
        const selectedSize      = options.size_name   || null;
        const selectedTemp      = options.temperature || null;
        const rawSelectedPrice  = options.price !== undefined && options.price !== null
            ? Number(options.price)
            : Number(item.price);
        const selectedPrice = Number.isFinite(rawSelectedPrice) ? rawSelectedPrice : (Number(item.price) || 0);
        // cartKey must be unique per portion/size/temp combination
        const variantKey = [selectedPortion, selectedSize, selectedTemp].filter(Boolean).join(':') || 'single';
        const cartKey = `${item.id}:${variantKey}`;
        const variantLabel = selectedSize
            ? `${selectedSize}${selectedTemp ? ' ' + (selectedTemp === 'hot' ? 'Hot' : 'Iced') : ''}`
            : null;
        const displayName = variantLabel
            ? `${item.name} (${variantLabel})`
            : selectedPortion
                ? `${item.name} (${selectedPortion === 'solo' ? 'Solo' : 'Whole'})`
                : item.name;

        const available = getEffectiveAvailable(item, selectedPortion);
        const stockUnit = getStockUnitLabel(item);

        if (available !== null && available <= 0) {
            showNotification(`${item.name} is out of stock`, 'error');
            return;
        }

        const existingItemIndex = orderItems.findIndex(oi => oi.cartKey === cartKey);

        if (existingItemIndex >= 0) {
            const updatedItems = [...orderItems];
            updatedItems[existingItemIndex].quantity += 1;
            setOrderItems(updatedItems);
        } else {
            setOrderItems([...orderItems, {
                id: item.id,
                cartKey,
                name: displayName,
                baseName: item.name,
                portion: selectedPortion,
                size_name: selectedSize,
                temperature: selectedTemp,
                price: selectedPrice,
                quantity: 1,
                stock: available,
                stockUnit,
                originalStock: available,
                image: item.image,
                notes: '',
                source: item.source || 'resto',
            }]);
        }

        showNotification(`${displayName} added`, 'success');
    };

    const handleMenuItemClick = (item) => {
        if (item.is_available === false || isOutOfStock(item)) {
            return;
        }

        if (!item.has_recipe && !item.ingredients?.length) {
            return;
        }

        // Drink with size+temp variants takes priority
        if (item.has_sizes && Array.isArray(item.size_variants) && item.size_variants.length > 0) {
            setSelectedVariantItem(item);
            setShowVariantModal(true);
            return;
        }

        if (hasDualPriceOptions(item)) {
            setSelectedDualPriceItem(item);
            setShowPriceChoiceModal(true);
            return;
        }

        addToOrder(item);
    };

    // Open notes modal for item
    const openNotesModal = (index) => {
        setSelectedItemForNotes(index);
        setCurrentNote(orderItems[index].notes || '');
        setShowNotesModal(true);
    };

    // Save note for item
    const saveItemNote = () => {
        if (selectedItemForNotes !== null) {
            const updatedItems = [...orderItems];
            updatedItems[selectedItemForNotes].notes = currentNote;
            setOrderItems(updatedItems);
            setShowNotesModal(false);
            setSelectedItemForNotes(null);
            setCurrentNote('');
            showNotification('Note added', 'success');
        }
    };

    const updateQuantity = (index, change) => {
        const updatedItems = [...orderItems];
        const item = updatedItems[index];
        const newQuantity = item.quantity + change;
        
        if (newQuantity < 1) {
            updatedItems.splice(index, 1);
            setOrderItems(updatedItems);
            showNotification(`${item.name} removed`, 'info');
            return;
        }
        
        if (change > 0 && item.stock !== null && newQuantity > item.stock) {
            const stockUnit = item.stockUnit || 'item';
            showNotification(`Only ${item.stock} ${item.stock === 1 ? stockUnit : `${stockUnit}s`} available`, 'warning');
            return;
        }
        
        item.quantity = newQuantity;
        setOrderItems(updatedItems);
    };

    const removeItem = (index) => {
        const itemName = orderItems[index].name;
        const updatedItems = orderItems.filter((_, i) => i !== index);
        setOrderItems(updatedItems);
        showNotification(`${itemName} removed`, 'info');
    };

    const clearOrder = () => {
        if (orderItems.length === 0) return;
        if (window.confirm('Clear entire order?')) {
            setOrderItems([]);
            setCustomerInfo({ name: '', phone: '', address: '', notes: '' });
            setHotelInfo({ guestName: '', roomNumber: '' });
            setPeopleCount(1);
            setCardsPresented(0);
            setModalIsEmployee(false);
            setDiscount({ type: 'none', value: 0 });
            setItemNotes({});
            showNotification('Order cleared', 'info');
        }
    };

    // ============ KITCHEN ACTION FUNCTIONS ============
    
    // Start kitchen order preparation
    // Start kitchen order preparation
const startKitchenOrder = async (orderId, retryAttempt = false) => {
    setProcessingOrder(orderId);
    
    try {
        const response = await fetch(`/cashier/orders/${orderId}/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': getCsrfToken(),
                'Accept': 'application/json',
            },
        });
        
        if (response.status === 419 && !retryAttempt) {
            const newToken = await refreshCsrfToken();
            if (newToken) {
                setProcessingOrder(null);
                return startKitchenOrder(orderId, true);
            }
        }
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(`Order #${orderId} started preparing`, 'success');
            lastOrderUpdateRef.current = 0; // Force refresh
        } else {
            showNotification(data.error || 'Failed to start order', 'error');
        }
    } catch (error) {
        console.error('Start order error:', error);
        showNotification('Failed to start order', 'error');
    } finally {
        setProcessingOrder(null);
    }
};

// Mark kitchen order as ready
const readyKitchenOrder = async (orderId, retryAttempt = false) => {
    setProcessingOrder(orderId);
    
    try {
        const response = await fetch(`/cashier/orders/${orderId}/kitchen-ready`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': getCsrfToken(),
                'Accept': 'application/json',
            },
        });
        
        if (response.status === 419 && !retryAttempt) {
            const newToken = await refreshCsrfToken();
            if (newToken) {
                setProcessingOrder(null);
                return readyKitchenOrder(orderId, true);
            }
        }
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(`Order #${orderId} is ready`, 'success');
            lastOrderUpdateRef.current = 0; // Force refresh
        } else {
            showNotification(data.error || 'Failed to mark order ready', 'error');
        }
    } catch (error) {
        console.error('Ready order error:', error);
        showNotification('Failed to mark order ready', 'error');
    } finally {
        setProcessingOrder(null);
    }
};

    // ============ MODAL HANDLERS ============
    const openPaymentModal = () => {
        if (orderItems.length === 0) {
            showNotification('Add items first', 'error');
            return;
        }

        const requestedByItemId = orderItems.reduce((acc, cartItem) => {
            acc[cartItem.id] = (acc[cartItem.id] || 0) + cartItem.quantity;
            return acc;
        }, {});

        for (const [itemId, requestedQty] of Object.entries(requestedByItemId)) {
            let currentStock = null;
            let currentStockUnit = 'item';
            let currentName = 'Item';

            for (const category of categories) {
                const found = category.items?.find(i => i.id === Number(itemId));
                if (found) {
                    currentStock = getEffectiveAvailable(found);
                    currentStockUnit = getStockUnitLabel(found);
                    currentName = found.name || currentName;
                    break;
                }
            }

            if (currentStock !== null && currentStock !== undefined && Number(requestedQty) > currentStock) {
                showNotification(`Stock changed for ${currentName}. Only ${currentStock} ${currentStock === 1 ? currentStockUnit : `${currentStockUnit}s`} available.`, 'error');
                const updatedItems = orderItems.map(item =>
                    item.id === Number(itemId) ? { ...item, stock: currentStock, stockUnit: currentStockUnit } : item
                );
                setOrderItems(updatedItems);
                return;
            }
        }

        setModalPeopleCount(peopleCount);
        setModalCardsPresented(cardsPresented);
        setModalIsEmployee(false);
        setModalIsPersonal(false);
        setPersonalInfo({ name: '', reason: '' });
        setSelectedPaymentMethod(null);
        setCashAmount('');
        setCashName('');
        setHotelInfo({ guestName: '', roomNumber: '' });
        setShowPaymentModal(true);
    };

    const openDiscountModal = () => {
        setShowDiscountModal(true);
    };

    // ============ ORDER SUBMISSION ============
    const handlePlaceOrder = () => {
        if (modalIsPersonal && !personalInfo.name) {
            showNotification('Please enter a name for the personal order', 'error');
            return;
        }

        if (!selectedPaymentMethod && !modalIsPersonal) {
            showNotification('Select payment method', 'error');
            return;
        }

        if (selectedPaymentMethod?.name === 'Cash' && (!cashAmount || Number(cashAmount) < modalTotals.total)) {
            showNotification('Invalid cash amount', 'error');
            return;
        }

        if (selectedPaymentMethod?.name === 'Hotel' && (!hotelInfo.guestName || !hotelInfo.roomNumber)) {
            showNotification('Enter guest name and room number', 'error');
            return;
        }

        setIsLoading(true);
        setShowPaymentModal(false);

        let finalCustomerName = customerInfo.name;
        let roomNumber = null;
        
        if (selectedPaymentMethod?.name === 'Hotel') {
            finalCustomerName = `[HOTEL] ${hotelInfo.guestName}`;
            roomNumber = hotelInfo.roomNumber;
        } else if (modalIsPersonal) {
            finalCustomerName = `[PERSONAL] ${personalInfo.name}`;
        } else if (selectedPaymentMethod?.name === 'Cash' && cashName.trim()) {
            finalCustomerName = cashName.trim();
        } else if (orderType === 'delivery' && customerInfo.name) {
            finalCustomerName = customerInfo.name;
        }

        // Calculate final totals with all discounts and service charge
        const finalTotals = calculateTotals(
            modalPeopleCount, 
            modalCardsPresented, 
            discount.type, 
            discount.value, 
            modalIsEmployee,
            modalIsPersonal,
            orderItems, 
            selectedPaymentMethod
        );

            const orderData = {
                items: orderItems.map(item => ({
                    id:          item.id,
                    name:        item.name,
                    price:       Number(item.price),
                    quantity:    item.quantity,
                    portion:     item.portion     || null,
                    notes:       item.notes       || null,
                    source:      item.source      || 'resto',
                    size_name:   item.size_name   || null,
                    temperature: item.temperature || null,
                })),
            order_type: orderType,
            customer_name: finalCustomerName || null,
            room_number: roomNumber,
            customer_phone: customerInfo.phone || null,
            customer_address: customerInfo.address || null,
            notes: modalIsPersonal
                ? `[FREE ORDER - Personal] ${personalInfo.reason || ''}`.trim()
                : (customerInfo.notes || null),
            people_count: modalPeopleCount,
            cards_presented: modalCardsPresented,
            discount_type: discount.type,
            discount_value: discount.value,
            is_employee: modalIsEmployee ? 1 : 0,
            is_personal: modalIsPersonal ? 1 : 0,
                employee_discount_amount: finalTotals.employeeDiscount,
                service_charge: finalTotals.serviceCharge,
                payment_method_id: modalIsPersonal ? 9 : selectedPaymentMethod.id,
                subtotal: finalTotals.subtotal,
                total_amount: finalTotals.total,  // 0 for personal orders
                cash_received: selectedPaymentMethod?.name === 'Cash' ? Number(cashAmount) : null,
                change_due: selectedPaymentMethod?.name === 'Cash'
                    ? Math.max(0, Number(cashAmount) - finalTotals.total)
                    : null,
            };

        // Log order data for debugging
        console.log('ORDER DATA:', orderData);

        router.post('/cashier/pos/orders', orderData, {
            onSuccess: (response) => {
                // Format order number for display
                const orderId = response.props.flash?.order_data?.order_id || Date.now();
                const formattedOrderNumber =
                    response.props.flash?.order_data?.txn_number ||
                    response.props.flash?.order_data?.order_number ||
                    `ORD-${String(orderId).padStart(5, '0')}`;
                
                const successData = {
                    orderId: formattedOrderNumber,
                    total: finalTotals.total,
                    itemsCount: orderItems.length,
                    customerName: finalCustomerName || 'Walk-in',
                    orderType: orderType,
                    paymentMethod: modalIsPersonal ? 'Personal (Free)' : selectedPaymentMethod.name,
                    hasEmployeeDiscount: modalIsEmployee,
                    hasServiceCharge: selectedPaymentMethod?.name === 'Hotel',
                    isPersonal: modalIsPersonal,
                    roomNumber: roomNumber
                };
                
                showSuccessOrder(successData, response.props.flash?.receipt);
                setOrderItems([]);
                setCustomerInfo({ name: '', phone: '', address: '', notes: '' });
                setHotelInfo({ guestName: '', roomNumber: '' });
                setPersonalInfo({ name: '', reason: '' });
                setEmployeeInfo({ name: '', id: '' });
                setPeopleCount(1);
                setCardsPresented(0);
                setModalIsEmployee(false);
                setModalIsPersonal(false);
                setDiscount({ type: 'none', value: 0 });
                setItemNotes({});
                setIsLoading(false);
                
                // Force the next poll cycle to fetch fresh menu stock immediately.
                lastMenuUpdateRef.current = 0;
                lastOrderUpdateRef.current = Date.now();
            },
            onError: (errors) => {
                console.error('Order error:', errors);
                showNotification('Failed to place order', 'error');
                setIsLoading(false);
                setShowPaymentModal(true);
            }
        });
    };

    // ============ ORDER COMPLETION ============
    const completeOrder = (orderId, retryAttempt = false) => {
        if (!window.confirm('Complete this order?')) return;

        setProcessingOrder(orderId);

        fetch(`/cashier/orders/${orderId}/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': getCsrfToken(),
                'Accept': 'application/json',
            },
        })
        .then(async res => {
            // Handle CSRF expiration
            if (res.status === 419 && !retryAttempt) {
                const newToken = await refreshCsrfToken();
                if (newToken) {
                    console.log('CSRF token refreshed, retrying complete...');
                    const retryRes = await fetch(`/cashier/orders/${orderId}/complete`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': getCsrfToken(),
                            'Accept': 'application/json',
                        },
                    });
                    return retryRes.json();
                }
            }
            return res.json();
        })
        .then(data => {
            if (data && data.success) {
                showNotification(data.message || `Order #${orderId} completed`, 'success');
                setPendingOrders(prev => prev.filter(order => order.id !== orderId));
                setReadyOrderNotifications(prev => prev.filter(n => n.id !== orderId));
                lastOrderUpdateRef.current = Date.now();

                // Show the same success popup (clean UI), then show receipt after it closes.
                if (data.receipt) {
                    const r = data.receipt;
                    const subtotal = Number(r.subtotal ?? 0);
                    const discount = Number(r.discount_amount ?? 0);
                    const serviceCharge = Number(r.service_charge_amount ?? 0);
                    const total = subtotal - discount + serviceCharge;

                    const formattedOrderId = r.txn_number || r.order_number || `ORD-${String(orderId).padStart(5, '0')}`;
                    const customerName = r.customer_name || 'Walk-in';
                    const paymentMethod = r.payment_method || 'Cash';
                    const isPersonal = typeof customerName === 'string' && customerName.includes('[PERSONAL]');

                    showSuccessOrder({
                        orderId: formattedOrderId,
                        total,
                        itemsCount: Array.isArray(r.items) ? r.items.length : 0,
                        customerName,
                        orderType: null,
                        paymentMethod,
                        hasEmployeeDiscount: false,
                        hasServiceCharge: serviceCharge > 0,
                        isPersonal,
                        roomNumber: r.room_number || null,
                    }, r);
                }
            } else {
                showNotification(data.error || 'Failed to complete order', 'error');
            }
            setProcessingOrder(null);
        })
        .catch(error => {
            console.error('Complete order error:', error);
            showNotification('Failed to complete order', 'error');
            setProcessingOrder(null);
        });
    };

    const cancelOrder = (orderId, retryAttempt = false) => {
        if (!window.confirm('Cancel this order and restock ingredients?')) return;

        setProcessingOrder(orderId);

        fetch(`/cashier/orders/${orderId}/cancel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': getCsrfToken(),
                'Accept': 'application/json',
            },
        })
        .then(res => {
            // Handle CSRF expiration
            if (res.status === 419 && !retryAttempt) {
                return refreshCsrfToken().then(newToken => {
                    if (newToken) {
                        console.log('CSRF token refreshed, retrying cancel...');
                        setProcessingOrder(null);
                        return cancelOrder(orderId, true); // Retry with new token
                    }
                    return res.json();
                });
            }
            return res.json();
        })
        .then(data => {
            if (data && data.success) {
                showNotification(data.message || `Order #${orderId} cancelled`, 'success');
                setPendingOrders(prev => prev.filter(order => order.id !== orderId));
                setReadyOrderNotifications(prev => prev.filter(n => n.id !== orderId));
                lastOrderUpdateRef.current = Date.now();
                if (data.receipt) {
                    pendingReceiptRef.current = data.receipt;
                    setPendingReceipt(data.receipt);
                }
            } else if (data) {
                showNotification(data.error || 'Failed to cancel order', 'error');
            }
            setProcessingOrder(null);
        })
        .catch(error => {
            console.error('Cancel order error:', error);
            showNotification('Failed to cancel order', 'error');
            setProcessingOrder(null);
        });
    };

    // ============ MANUAL REFRESH ============
    // ============ CASHIER SHIFT (cashier role only) ============
    const handleShiftCheckIn = async (startingBalance) => {
        setShiftLoading(true);
        setShiftError('');
        try {
            const res = await fetch('/cashier/shifts/check-in', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken || getCsrf(),
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ starting_balance: Number(startingBalance) }),
            });
            const data = await res.json();
            if (data.success) {
                setCashierShift(data.shift);
                setShiftModal(null);
                setShiftStartingBalance('');
                showNotification('Shift started.', 'success');
            } else {
                const fallback = data?.errors ? Object.values(data.errors)[0]?.[0] : null;
                setShiftError(data.error || data.message || fallback || 'Failed to check in.');
            }
        } catch {
            setShiftError('Network error. Try again.');
        } finally {
            setShiftLoading(false);
        }
    };

    const handleShiftCheckOut = async () => {
        setShiftLoading(true);
        setShiftError('');
        try {
            const res = await fetch('/cashier/shifts/check-out', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken || getCsrf(),
                    'Accept': 'application/json',
                },
                body: JSON.stringify({}),
            });
            const data = await res.json();
            if (data.success) {
                setShiftReceipt(data.receipt);
                setCashierShift(null);
                setShiftModal(null);
            } else {
                setShiftError(data.error || 'Failed to check out.');
            }
        } catch {
            setShiftError('Network error. Try again.');
        } finally {
            setShiftLoading(false);
        }
    };

    const handleRecordExpense = async ({ amount, description }) => {
        setShiftLoading(true);
        setShiftError('');
        try {
            const res = await fetch('/cashier/transactions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken || getCsrf(),
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    type: 'expense',
                    amount: Number(amount),
                    description: description || null,
                }),
            });
            const data = await res.json();
            if (data.success) {
                showNotification('Expense recorded.', 'success');
                setShiftModal(null);
            } else {
                setShiftError(data.error || 'Failed to record expense.');
            }
        } catch {
            setShiftError('Network error. Try again.');
        } finally {
            setShiftLoading(false);
        }
    };

    // Intercept back/exit button — cashier checks out to generate summary receipt
    const handleExitPOS = () => {
        const role = (auth?.user?.role || '').toLowerCase();
        if (role === 'cashier' && cashierShift) {
            setShiftError('');
            setShiftModal('checkout');
        } else {
            router.visit('/admin/dashboard');
        }
    };

    const toggleFullscreen = async () => {
        const doc = document;
        const docEl = document.documentElement;
        const activeFullscreen = Boolean(
            doc.fullscreenElement ||
            doc.webkitFullscreenElement ||
            doc.mozFullScreenElement ||
            doc.msFullscreenElement
        );

        try {
            if (activeFullscreen) {
                if (doc.exitFullscreen) {
                    await doc.exitFullscreen();
                } else if (doc.webkitExitFullscreen) {
                    doc.webkitExitFullscreen();
                } else if (doc.mozCancelFullScreen) {
                    doc.mozCancelFullScreen();
                } else if (doc.msExitFullscreen) {
                    doc.msExitFullscreen();
                }
                return;
            }

            if (docEl.requestFullscreen) {
                await docEl.requestFullscreen();
            } else if (docEl.webkitRequestFullscreen) {
                docEl.webkitRequestFullscreen();
            } else if (docEl.mozRequestFullScreen) {
                docEl.mozRequestFullScreen();
            } else if (docEl.msRequestFullscreen) {
                docEl.msRequestFullscreen();
            } else {
                showNotification('Fullscreen is not supported on this browser', 'error');
            }
        } catch (error) {
            console.error('Failed to toggle fullscreen:', error);
            showNotification('Unable to toggle fullscreen', 'error');
        }
    };

    const refreshAllData = async () => {
        setIsLoading(true);
        try {
            const [menuRes, orderRes] = await Promise.all([
                fetch('/cashier/pos/menu-data', {
                    headers: { 'Cache-Control': 'no-cache' }
                }),
                fetch('/cashier/pos/order-data', {
                    headers: { 'Cache-Control': 'no-cache' }
                })
            ]);
            
            const menuData = await menuRes.json();
            const orderData = await orderRes.json();
            
            if (menuData.success) setCategories(menuData.categories);
            if (menuData.success) {
                lastMenuUpdateRef.current = normalizeMenuTimestamp(menuData.menu_last_updated) || getCurrentUnixSeconds();
            }
            if (orderData.success) {
                // Format order numbers
                const formattedOrders = orderData.pending_orders.map(order => ({
                    ...order,
                    display_order_number: order.txn_number || order.order_number || `ORD-${String(order.id).padStart(5, '0')}`
                }));
                setPendingOrders(formattedOrders);
            }
            
            setLastUpdate(new Date());
            lastOrderUpdateRef.current = Date.now();
            showNotification('Data refreshed', 'success');
        } catch (error) {
            showNotification('Refresh failed', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // ============ UI COMPONENTS ============
    const ConnectionStatusBadge = () => (
        <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1 px-2 py-1 rounded-md ${connectionStatus === 'connected' ? 'bg-emerald-100' : 'bg-red-100'}`}>
                {connectionStatus === 'connected' ? (
                    <Wifi className="w-3 h-3 text-emerald-600" />
                ) : (
                    <WifiOff className="w-3 h-3 text-red-600" />
                )}
                <span className={`text-xs font-medium ${connectionStatus === 'connected' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {connectionStatus === 'connected' ? 'Live' : 'Offline'}
                </span>
            </div>
            
            <span className="text-xs text-gray-400">
                {formatPHTime(lastUpdate)}
            </span>
        </div>
    );

    // Ready Order Notifications Component
    const ReadyOrderNotifications = () => {
        if (readyOrderNotifications.length === 0) return null;
        
        return (
            <div className="fixed top-4 right-4 z-50 space-y-3 max-w-md">
                {readyOrderNotifications.map((notification, index) => (
                    <div 
                        key={notification.id} 
                        className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl shadow-2xl p-5 animate-slide-in border-l-8 border-yellow-300"
                        style={{ animationDelay: `${index * 100}ms` }}
                    >
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-white/20 rounded-full">
                                <ChefHat className="w-8 h-8" />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-bold text-xl">🍳 Order Ready!</h3>
                                        <p className="text-green-100 text-sm mt-1">Kitchen has completed preparation</p>
                                    </div>
                                    <button 
                                        onClick={() => dismissReadyNotification(notification.id)}
                                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                
                                <div className="bg-white/10 rounded-lg p-4 mb-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm opacity-90">Order Number</span>
                                        <span className="font-mono font-bold text-lg">{notification.orderNumber}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm opacity-90">Customer</span>
                                        <span className="font-semibold">{notification.customerName}</span>
                                    </div>
                                    {notification.isHotel && (
                                        <div className="mt-2 flex items-center gap-1 text-yellow-200 text-xs">
                                            <Building2 className="w-3 h-3" />
                                            <span>Hotel Order</span>
                                            {notification.roomNumber && (
                                                <span className="ml-1">- Room {notification.roomNumber}</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            completeOrder(notification.id);
                                            dismissReadyNotification(notification.id);
                                        }}
                                        className="flex-1 py-3 bg-white text-green-700 rounded-lg font-bold hover:bg-green-50 transition-colors flex items-center justify-center gap-2 shadow-lg"
                                    >
                                        <CheckCircle className="w-5 h-5" />
                                        MARK COMPLETED
                                    </button>
                                    <button
                                        onClick={() => dismissReadyNotification(notification.id)}
                                        className="px-4 py-3 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                                    >
                                        Later
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                
                {readyOrderNotifications.length > 1 && (
                    <button
                        onClick={dismissAllNotifications}
                        className="w-full py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors text-sm font-medium"
                    >
                        Dismiss All ({readyOrderNotifications.length})
                    </button>
                )}
            </div>
        );
    };

    // Success Order Popup - at top right
    const SuccessOrderPopup = () => {
        if (!successOrder) return null;
        return (
            <div className="fixed top-4 right-4 z-50 animate-slide-in max-w-sm">
                <div className={`bg-gradient-to-r ${successOrder.isPersonal ? 'from-pink-500 to-rose-500' : 'from-emerald-500 to-green-500'} text-white rounded-xl shadow-xl p-4`}>
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-white/20 rounded-lg flex-shrink-0">
                            {successOrder.isPersonal ? <Heart className="w-6 h-6" /> : <CheckCircle className="w-6 h-6" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-lg truncate">
                                    {successOrder.isPersonal ? '🎁 Free Order!' : 'Order Placed!'}
                                </h3>
                                <button onClick={() => setSuccessOrder(null)} className="text-white/80 hover:text-white ml-2 flex-shrink-0">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                    <span>Order:</span>
                                    <span className="font-bold">{successOrder.orderId}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Payment:</span>
                                    <span>{successOrder.paymentMethod}</span>
                                </div>
                                {successOrder.hasEmployeeDiscount && (
                                    <div className="flex justify-between text-yellow-200">
                                        <span>Employee Discount</span>
                                        <span>✓</span>
                                    </div>
                                )}
                                {successOrder.hasServiceCharge && (
                                    <div className="flex justify-between text-yellow-200">
                                        <span>Hotel Service Charge</span>
                                        <span>✓</span>
                                    </div>
                                )}
                                {successOrder.roomNumber && (
                                    <div className="flex justify-between text-yellow-200">
                                        <span>Room</span>
                                        <span>{successOrder.roomNumber}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-base font-bold pt-2 border-t border-white/20">
                                    <span>Total:</span>
                                    <span>{successOrder.isPersonal ? 'FREE ₱0.00' : `₱${formatPrice(successOrder.total)}`}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Get status badge based on order status and kitchen items
    const getOrderStatusBadge = (order) => {
        if (order.status === 'completed') {
            return { text: 'Completed', color: 'bg-green-100 text-green-800', icon: CheckCircle };
        }
        if (order.status === 'ready' || order.kitchen_status === 'ready') {
            return { text: 'Ready', color: 'bg-emerald-100 text-emerald-800', icon: Check };
        }
        if (order.status === 'preparing' || order.kitchen_status === 'preparing') {
            return { text: 'Preparing', color: 'bg-blue-100 text-blue-800', icon: Flame };
        }
        if (order.has_kitchen_items === true) {
            return { text: 'In Kitchen', color: 'bg-amber-100 text-amber-800', icon: ChefHat };
        }
        return { text: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Hourglass };
    };

    // Check if order can be completed
    const canCompleteOrder = (order) => {
        if (order.has_kitchen_items === false) return true;
        
        // Check all items ready flag
        if (order.all_items_ready === true) return true;
        
        // Check individual item statuses
        if (order.items && order.items.length > 0) {
            const allReady = order.items.every(i => 
                i.kitchen_status === 'ready' || i.kitchen_status === 'completed'
            );
            if (allReady) return true;
        }
        
        // Check order status
        return order.status === 'ready' || order.kitchen_status === 'ready';
    };

    // Get button text for order
    // Get button text for order
const getOrderButton = (order) => {
    // Check if order has no kitchen items - can complete immediately
    if (order.has_kitchen_items === false) {
        return { text: 'Complete', color: 'bg-green-500 hover:bg-green-600', icon: CheckCircle, disabled: false, action: 'complete' };
    }
    
    // Check if all items are ready (from kitchen)
    const allItemsReady = order.all_items_ready === true;
    
    // Get kitchen status from order items array (MOST IMPORTANT)
    let kitchenStatus = 'pending';
    
    if (order.items && order.items.length > 0) {
        const itemStatuses = order.items.map(i => i.kitchen_status);
        if (itemStatuses.every(s => s === 'ready' || s === 'completed')) {
            kitchenStatus = 'ready';
        } else if (itemStatuses.some(s => s === 'preparing')) {
            kitchenStatus = 'preparing';
        } else if (itemStatuses.some(s => s === 'pending')) {
            kitchenStatus = 'pending';
        }
    } else if (order.kitchen_status) {
        kitchenStatus = order.kitchen_status;
    }
    
    // If all items are ready, override to ready
    if (allItemsReady) {
        kitchenStatus = 'ready';
    }
    
    switch(kitchenStatus) {
        case 'pending':
            return { 
                text: 'Start', 
                color: 'bg-blue-500 hover:bg-blue-600', 
                icon: Play, 
                disabled: false,
                action: 'start'
            };
        case 'preparing':
            return { 
                text: 'Ready', 
                color: 'bg-emerald-500 hover:bg-emerald-600', 
                icon: CheckCircle, 
                disabled: false,
                action: 'ready'
            };
        case 'ready':
            return { 
                text: 'Complete', 
                color: 'bg-green-500 hover:bg-green-600', 
                icon: CheckCircle, 
                disabled: false,
                action: 'complete'
            };
        default:
            return { 
                text: 'In Kitchen', 
                color: 'bg-amber-500 cursor-not-allowed', 
                icon: ChefHat, 
                disabled: true,
                action: null
            };
    }
};

    // Check if order is hotel order by looking at customer name or payment method
    const isHotelOrder = (order) => {
        return order.customer_name?.includes('[HOTEL]') || order.payment_method_name === 'Hotel';
    };

    // Filter pending orders
    const filteredPendingOrders = pendingOrders.filter(order => 
        order.status !== 'completed' && order.status !== 'cancelled'
    );

    // Handle order action based on button type
    const handleOrderAction = (order, button) => {
        if (button.action === 'start') {
            startKitchenOrder(order.id);
        } else if (button.action === 'ready') {
            readyKitchenOrder(order.id);
        } else if (button.action === 'complete') {
            completeOrder(order.id);
        }
    };

    return (
        <>
            <Head title="POS System" />

            {/* Ready Order Notifications */}
            <ReadyOrderNotifications />

            {/* Success Order Popup - TOP RIGHT */}
            <SuccessOrderPopup />

            {/* Regular Notifications */}
            {notification && (
                <div className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-slide-in ${
                    notification.type === 'success' ? 'bg-emerald-500' :
                    notification.type === 'error' ? 'bg-red-500' : 'bg-amber-500'
                } text-white`}>
                    {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> :
                     notification.type === 'error' ? <AlertCircle className="w-5 h-5" /> :
                     <Bell className="w-5 h-5" />}
                    <span className="font-medium">{notification.message}</span>
                    <button onClick={() => setNotification(null)} className="ml-auto hover:opacity-80">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Main Container */}
            <div className="h-screen bg-gray-100 flex flex-col">
                {/* Header */}
                <div className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button onClick={handleExitPOS} className="p-2 hover:bg-gray-100 rounded-lg">
                                <ArrowLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">CJ BREW & DINE</h1>
                                <p className="text-sm text-gray-500">{currentDate} {currentTime}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <ConnectionStatusBadge />

                            <button
                                onClick={toggleFullscreen}
                                className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg font-medium hover:bg-indigo-200 flex items-center gap-2"
                                title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                            >
                                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                                <span className="text-sm">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
                            </button>
                            
                            <button 
                                onClick={refreshAllData} 
                                disabled={isLoading} 
                                className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg font-medium hover:bg-blue-200 disabled:opacity-50 flex items-center gap-2">
                                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                                <span className="text-sm">Refresh</span>
                            </button>

                            {(auth?.user?.role || '').toLowerCase() === 'cashier' && cashierShift && (
                                <button
                                    onClick={() => {
                                        setShiftError('');
                                        setExpenseAmount('');
                                        setExpenseDescription('');
                                        setShiftModal('expense');
                                    }}
                                    className="px-3 py-2 bg-sky-100 text-sky-800 rounded-lg font-medium hover:bg-sky-200 flex items-center gap-2"
                                    title="Record an expense for this shift"
                                >
                                    <Wallet className="w-4 h-4" />
                                    <span className="text-sm">Expense</span>
                                </button>
                            )}
                            <button
                                onClick={() => setShowPendingOrders(!showPendingOrders)}
                                className="px-3 py-2 bg-amber-100 text-amber-700 rounded-lg font-medium hover:bg-amber-200 flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                <span>Pending ({filteredPendingOrders.length})</span>
                                {showPendingOrders ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Layout */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left Column - Current Order */}
                    <div className="w-[30%] bg-white border-r border-gray-200 flex flex-col">
                        <div className="p-4 border-b border-gray-200">
                            <h2 className="text-lg font-bold text-gray-900">Current Order</h2>
                        </div>

                        {/* Order Items */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {orderItems.length === 0 ? (
                                <div className="text-center py-8">
                                    <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                                    <p className="text-gray-500">No items in order</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {orderItems.map((item, index) => (
                                        <div key={index} className="border-b border-gray-100 pb-3">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-medium text-gray-900">{item.name}</h4>
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => openNotesModal(index)}
                                                        className="text-blue-500 hover:text-blue-600 p-1"
                                                        title="Add note"
                                                    >
                                                        <MessageSquare className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => removeItem(index)}
                                                        className="text-red-500 hover:text-red-600"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-gray-600">{item.quantity} x ₱{formatPrice(item.price)}</span>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => updateQuantity(index, -1)}
                                                            className="w-6 h-6 bg-gray-100 rounded hover:bg-gray-200 flex items-center justify-center">
                                                            <Minus className="w-3 h-3" />
                                                        </button>
                                                        <span className="w-6 text-center text-sm">{item.quantity}</span>
                                                        <button
                                                            onClick={() => updateQuantity(index, 1)}
                                                            className="w-6 h-6 bg-gray-100 rounded hover:bg-gray-200 flex items-center justify-center">
                                                            <Plus className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <span className="font-bold text-blue-600">₱{formatPrice(item.price * item.quantity)}</span>
                                            </div>
                                            {item.notes && (
                                                <p className="text-xs text-amber-600 mt-1 italic bg-amber-50 p-1 rounded">
                                                    📝 {item.notes}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Order Summary */}
                        <div className="border-t border-gray-200 p-4 bg-gray-50">
                            {/* Order Type */}
                            <div className="mb-4">
                                <div className="flex gap-2">
                                    {ORDER_TYPES.map(type => {
                                        const Icon = type.icon;
                                        return (
                                            <button
                                                key={type.value}
                                                onClick={() => setOrderType(type.value)}
                                                className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 ${
                                                    orderType === type.value
                                                        ? `${type.color} text-white`
                                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                }`}>
                                                <Icon className="w-3 h-3" />
                                                <span>{type.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Discount Button */}
                            <button
                                onClick={openDiscountModal}
                                className="w-full mb-4 py-2 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-amber-100">
                                <Percent className="w-4 h-4" />
                                {discount.type !== 'none' ? `${discount.type === 'percentage' ? discount.value + '%' : '₱' + discount.value} off` : 'Add Discount'}
                            </button>

                            {/* Totals */}
                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Subtotal</span>
                                    <span className="font-medium">₱{formatPrice(subtotal)}</span>
                                </div>
                                {employeeDiscount > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Employee Discount</span>
                                        <span className="font-medium text-purple-600">-₱{formatPrice(employeeDiscount)}</span>
                                    </div>
                                )}
                                {cardDiscount > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Card Discount (20%)</span>
                                        <span className="font-medium text-emerald-600">-₱{formatPrice(cardDiscount)}</span>
                                    </div>
                                )}
                                {additionalDiscount > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Additional Discount</span>
                                        <span className="font-medium text-red-500">-₱{formatPrice(additionalDiscount)}</span>
                                    </div>
                                )}
                                {serviceCharge > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Hotel Service Charge (10%)</span>
                                        <span className="font-medium text-amber-600">+₱{formatPrice(serviceCharge)}</span>
                                    </div>
                                )}
                                <div className="border-t border-gray-200 pt-2 flex justify-between font-bold">
                                    <span>Total</span>
                                    <span className="text-lg text-blue-600">₱{formatPrice(total)}</span>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-2 gap-2">
                                <button 
                                    onClick={clearOrder}
                                    className="py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium flex items-center justify-center gap-2">
                                    <Trash2 className="w-4 h-4" />
                                    <span>Clear</span>
                                </button>
                                <button 
                                    onClick={openPaymentModal}
                                    className="py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center justify-center gap-2">
                                    <CreditCard className="w-4 h-4" />
                                    <span>Pay</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Middle Column - Menu */}
                    <div className={`${showPendingOrders ? 'w-[45%]' : 'w-[70%]'} flex flex-col bg-gray-50 transition-all duration-300`}>
                        {/* Search */}
                        <div className="bg-white border-b border-gray-200 p-4">
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search products..."
                                        className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <select
                                    value={activeCategory}
                                    onChange={(e) => setActiveCategory(e.target.value)}
                                    className="min-w-[240px] px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="all">{`All Items (${allItemsCount})`}</option>
                                    {(() => {
                                        // Merge categories with same name — show a combined label (Kitchen / Resto / Both)
                                        const restoMap = Object.fromEntries((categories || []).map(c => [c.name.toLowerCase(), c]));
                                        const kitchenMap = Object.fromEntries((kitchenCategories || []).map(c => [c.name.toLowerCase(), c]));
                                        const allNames = [...new Set([
                                            ...(categories || []).map(c => c.name.toLowerCase()),
                                            ...(kitchenCategories || []).map(c => c.name.toLowerCase()),
                                        ])];
                                        return allNames.map(nameLower => {
                                            const restoCat = restoMap[nameLower];
                                            const kitchenCat = kitchenMap[nameLower];
                                            const displayName = (restoCat || kitchenCat).name;
                                            const hasBoth = restoCat && kitchenCat;
                                            // Use a composite value "r:{id}" / "k:{id}" / "b:{rid},{kid}" to filter correctly
                                            const value = hasBoth
                                                ? `b:${restoCat.id},${kitchenCat.id}`
                                                : restoCat
                                                    ? `r:${restoCat.id}`
                                                    : `k:${kitchenCat.id}`;
                                            const itemCount = (restoCat?.items?.length || 0) + (kitchenCat?.items?.length || 0);
                                            return (
                                                <option key={value} value={value}>
                                                    {`${displayName} (${itemCount})`}
                                                </option>
                                            );
                                        });
                                    })()}
                                </select>
                            </div>
                        </div>

                        {/* Menu Items Grid */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {filteredItems.length === 0 ? (
                                <div className="text-center py-12">
                                    <Utensils className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                    <p className="text-gray-500">No items found</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-4">
                                    {filteredItems.map(item => {
                                        const isUnavailable = item.is_available === false;
                                        const noRecipe = !item.has_recipe && !item.ingredients?.length;
                                        const available = getEffectiveAvailable(item);
                                        const stockUnit = getStockUnitLabel(item);
                                        const outOfStock = isOutOfStock(item);
                                        const lowStock = !outOfStock && (
                                            item.inventory_status === 'low' ||
                                            (available !== null && available <= 5 && available > 0)
                                        );
                                        const imageUrl = getImageUrl(item.image);
                                        const isBlocked = isUnavailable || outOfStock || noRecipe;
                                        
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => !isBlocked && handleMenuItemClick(item)}
                                                disabled={isBlocked}
                                                title={noRecipe ? 'No recipe set — go to Food Menu → Inventory to add ingredients' : undefined}
                                                className={`bg-white rounded-lg border border-gray-200 overflow-hidden transition-all ${
                                                    isBlocked ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:border-blue-500'
                                                }`}>
                                                <div className="aspect-square bg-gray-100 relative">
                                                    {imageUrl ? (
                                                        <img 
                                                            src={imageUrl} 
                                                            alt={item.name} 
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                e.target.style.display = 'none';
                                                                e.target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-gray-100"><svg class="w-8 h-8 text-gray-400" ...></svg></div>';
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                                            <Utensils className="w-8 h-8 text-gray-400" />
                                                        </div>
                                                    )}
                                                    {noRecipe && (
                                                        <span className="absolute top-1 right-1 px-1.5 py-0.5 bg-gray-500 text-white text-xs rounded">
                                                            No Recipe
                                                        </span>
                                                    )}
                                                    {outOfStock && !noRecipe && (
                                                        <span className="absolute top-1 right-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded">
                                                            Out of Stock
                                                        </span>
                                                    )}
                                                    {lowStock && !outOfStock && !noRecipe && (
                                                        <span className="absolute top-1 right-1 px-1.5 py-0.5 bg-amber-500 text-white text-xs rounded">
                                                            Low Stock
                                                        </span>
                                                    )}
                                            {/* Source badge - Resto or Kitchen */}
                                            {(() => {
                                                const isKitchenBadge = item.source === 'kitchen' || item.is_kitchen_category;
                                                return (
                                                    <span className={`absolute top-1 left-1 px-1.5 py-0.5 text-xs rounded font-medium ${
                                                        isKitchenBadge
                                                            ? 'bg-orange-500 text-white' 
                                                            : 'bg-blue-500 text-white'
                                                    }`}>
                                                        {isKitchenBadge ? '🍳 Kitchen' : '🍽️ Resto'}
                                                    </span>
                                                );
                                            })()}
                                                </div>
                                                <div className="p-2">
                                                    <h3 className="font-medium text-gray-900 text-sm truncate">{item.name}</h3>
                                                    <div className="flex justify-between items-center mt-1">
                                                        <p className="text-lg font-bold text-blue-600">₱{formatPrice(item.price)}</p>
                                                        {available !== null && !noRecipe && (
                                                            <p className="text-xs text-gray-500">
                                                                {stockUnit === 'serving' ? 'Servings' : 'Stock'}: {available}
                                                            </p>
                                                        )}
                                                        {noRecipe && (
                                                            <p className="text-xs text-gray-400">Set recipe first</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column - Pending Orders */}
                    {showPendingOrders && (
                        <div className="w-[25%] bg-white border-l border-gray-200 flex flex-col">
                            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                                <h2 className="font-bold text-gray-900">Pending Orders</h2>
                                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                                    {filteredPendingOrders.length}
                                </span>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4">
                                {filteredPendingOrders.length === 0 ? (
                                    <div className="text-center py-8">
                                        <Clock className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                                        <p className="text-gray-500">No pending orders</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {filteredPendingOrders.map((order) => {
                                            const statusBadge = getOrderStatusBadge(order);
                                            const StatusIcon = statusBadge.icon;
                                            const button = getOrderButton(order);
                                            const ButtonIcon = button.icon;
                                            const isHotel = isHotelOrder(order);
                                            
                                            return (
                                                <div key={order.id} className={`rounded-lg p-3 border ${
                                                    isHotel 
                                                        ? 'bg-amber-50 border-amber-300' 
                                                        : 'bg-amber-50 border-amber-200'
                                                }`}>
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-gray-900">
                                                                    {order.display_order_number || `ORD-${String(order.id).padStart(5, '0')}`}
                                                                </span>
                                                                {isHotel && (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full text-xs font-medium">
                                                                        <Building2 className="w-3 h-3" />
                                                                        Hotel
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {order.customer_name && (
                                                                <p className="text-xs text-gray-600 mt-1">{order.customer_name}</p>
                                                            )}
                                                            {/* Show room number if hotel order */}
                                                            {isHotel && order.room_number && (
                                                                <div className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                                                                    <Hash className="w-3 h-3" />
                                                                    <span>Room: {order.room_number}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <span className="font-bold text-amber-600">₱{formatPrice(order.total_amount)}</span>
                                                    </div>
                                                    
                                                    {/* Status Badge */}
                                                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusBadge.color} mb-2`}>
                                                        <StatusIcon className="w-3 h-3" />
                                                        <span>{statusBadge.text}</span>
                                                    </div>
                                                    
                                                    <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                                                        {order.items_list || 'No items'}
                                                    </p>
                                                    
                                                    <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                                                        <span>{formatPHTime(order.created_at)}</span>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-2 gap-2">
    {!button.disabled ? (
        <button
            onClick={() => {
                if (button.action === 'start') {
                    startKitchenOrder(order.id);
                } else if (button.action === 'ready') {
                    readyKitchenOrder(order.id);
                } else if (button.action === 'complete') {
                    completeOrder(order.id);
                }
            }}
            disabled={processingOrder === order.id}
            className={`${button.color} text-white rounded text-sm py-1.5 disabled:opacity-50 flex items-center justify-center gap-1`}>
            {processingOrder === order.id ? (
                <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
                <button.icon className="w-3 h-3" />
            )}
            {processingOrder === order.id ? 'Processing...' : button.text}
        </button>
    ) : (
        <button
            disabled
            className="bg-gray-400 text-white rounded text-sm py-1.5 cursor-not-allowed flex items-center justify-center gap-1">
            <ChefHat className="w-3 h-3" />
            {button.text}
        </button>
    )}

    <button
        onClick={() => cancelOrder(order.id)}
        disabled={processingOrder === order.id}
        className="bg-red-500 hover:bg-red-600 text-white rounded text-sm py-1.5 disabled:opacity-50 flex items-center justify-center gap-1">
        <Ban className="w-3 h-3" />
        Cancel
    </button>
</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Payment Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col">

                        {/* Header */}
                        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                            <h2 className="text-base font-bold text-gray-900">Payment</h2>
                            <button onClick={() => setShowPaymentModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Scrollable body */}
                        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3">

                            {/* People & Cards — compact inline row */}
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <div className="flex items-center gap-2 flex-1">
                                    <span className="text-xs text-gray-500 w-12">People</span>
                                    <button onClick={() => setModalPeopleCount(p => Math.max(1, p - 1))} className="w-6 h-6 bg-gray-200 rounded hover:bg-gray-300 flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                                    <span className="w-6 text-center text-sm font-bold">{modalPeopleCount}</span>
                                    <button onClick={() => setModalPeopleCount(p => p + 1)} className="w-6 h-6 bg-gray-200 rounded hover:bg-gray-300 flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                                </div>
                                <div className="flex items-center gap-2 flex-1">
                                    <span className="text-xs text-gray-500 w-14">Cards <span className="text-gray-400">(20%)</span></span>
                                    <button onClick={() => setModalCardsPresented(c => Math.max(0, c - 1))} className="w-6 h-6 bg-gray-200 rounded hover:bg-gray-300 flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                                    <span className="w-6 text-center text-sm font-bold">{modalCardsPresented}</span>
                                    <button onClick={() => setModalCardsPresented(c => Math.min(modalPeopleCount, c + 1))} className="w-6 h-6 bg-gray-200 rounded hover:bg-gray-300 flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                                </div>
                            </div>

                            {/* Employee + Personal toggles side by side */}
                            <div className="grid grid-cols-2 gap-2">
                                {/* Employee */}
                                <div className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${modalIsEmployee ? 'bg-purple-50 border-purple-400' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}
                                    onClick={() => { setModalIsEmployee(!modalIsEmployee); if (!modalIsEmployee) setModalIsPersonal(false); }}>
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-1.5">
                                            <Briefcase className={`w-4 h-4 ${modalIsEmployee ? 'text-purple-600' : 'text-gray-400'}`} />
                                            <span className={`text-xs font-semibold ${modalIsEmployee ? 'text-purple-800' : 'text-gray-600'}`}>Employee</span>
                                        </div>
                                        <div className={`w-8 h-4 rounded-full relative transition-colors ${modalIsEmployee ? 'bg-purple-500' : 'bg-gray-300'}`}>
                                            <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${modalIsEmployee ? 'left-4' : 'left-0.5'}`} />
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-400">Discount by category</p>
                                </div>

                                {/* Personal */}
                                <div className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${modalIsPersonal ? 'bg-pink-50 border-pink-400' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}
                                    onClick={() => {
                                        const next = !modalIsPersonal;
                                        setModalIsPersonal(next);
                                        if (next) { setModalIsEmployee(false); setSelectedPaymentMethod({ id: 5, name: 'Personal', icon: Heart, color: 'bg-pink-500', textColor: 'text-pink-600', bgColor: 'bg-pink-50' }); }
                                        else setSelectedPaymentMethod(null);
                                    }}>
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-1.5">
                                            <Heart className={`w-4 h-4 ${modalIsPersonal ? 'text-pink-600' : 'text-gray-400'}`} />
                                            <span className={`text-xs font-semibold ${modalIsPersonal ? 'text-pink-800' : 'text-gray-600'}`}>Personal</span>
                                        </div>
                                        <div className={`w-8 h-4 rounded-full relative transition-colors ${modalIsPersonal ? 'bg-pink-500' : 'bg-gray-300'}`}>
                                            <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${modalIsPersonal ? 'left-4' : 'left-0.5'}`} />
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-400">Owner / family — free</p>
                                </div>
                            </div>

                            {/* Employee discount breakdown - compact */}
                            {modalIsEmployee && (
                                <div className="p-2 bg-purple-50 rounded-lg border border-purple-200 grid grid-cols-2 gap-x-4 gap-y-0.5">
                                    <span className="text-xs text-purple-700">☕ Coffee/Milk/Frappe</span><span className="text-xs font-bold text-purple-800 text-right">20% off</span>
                                    <span className="text-xs text-purple-700">🍽 Food</span><span className="text-xs font-bold text-purple-800 text-right">5% off</span>
                                    <span className="text-xs text-purple-700">🥤 Soda</span><span className="text-xs font-bold text-purple-800 text-right">10% off</span>
                                    <span className="text-xs text-purple-500">➕ Add-ons</span><span className="text-xs font-bold text-purple-500 text-right">None</span>
                                </div>
                            )}

                            {/* Personal name input */}
                            {modalIsPersonal && (
                                <div className="space-y-2">
                                    <div className="relative">
                                        <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            value={personalInfo.name}
                                            onChange={(e) => setPersonalInfo({...personalInfo, name: e.target.value})}
                                            placeholder="Name (required) — e.g. Owner, Family"
                                            className="w-full pl-9 pr-4 py-2 text-sm border border-pink-300 rounded-lg focus:ring-2 focus:ring-pink-400"
                                            autoFocus
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        value={personalInfo.reason}
                                        onChange={(e) => setPersonalInfo({...personalInfo, reason: e.target.value})}
                                        placeholder="Reason (optional)"
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-400"
                                    />
                                </div>
                            )}

                            {/* Payment Methods - hidden for Personal */}
                            {!modalIsPersonal && (
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Payment Method</p>
                                    <div className="grid grid-cols-4 gap-2">
                                        {PAYMENT_METHODS.map(method => {
                                            const Icon = method.icon;
                                            const isSelected = selectedPaymentMethod?.id === method.id;
                                            return (
                                                <button
                                                    key={method.id}
                                                    onClick={() => setSelectedPaymentMethod(method)}
                                                    className={`py-2 px-1 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                                                        isSelected ? `${method.bgColor} ${method.color.replace('bg-', 'border-')}` : 'border-gray-200 hover:border-gray-300 bg-white'
                                                    }`}>
                                                    <Icon className={`w-5 h-5 ${isSelected ? method.textColor : 'text-gray-500'}`} />
                                                    <span className={`text-xs font-medium leading-tight text-center ${isSelected ? method.textColor : 'text-gray-600'}`}>{method.name}</span>
                                                    {method.name === 'Hotel' && isSelected && <span className="text-xs text-amber-600 leading-tight">+10%</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Cash input */}
                            {selectedPaymentMethod?.name === 'Cash' && (
                                <div className="space-y-2">
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            value={cashName}
                                            onChange={(e) => setCashName(e.target.value)}
                                            placeholder="Customer name (optional)"
                                            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-400"
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cash Received</label>
                                        <input
                                            type="number"
                                            value={cashAmount}
                                            onChange={(e) => setCashAmount(e.target.value)}
                                            placeholder="Enter amount"
                                            className="w-full mt-1 px-3 py-2 text-lg border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Hotel fields — side by side */}
                            {selectedPaymentMethod?.name === 'Hotel' && (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="relative">
                                            <Building className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input type="text" value={hotelInfo.guestName}
                                                onChange={(e) => setHotelInfo({...hotelInfo, guestName: e.target.value})}
                                                placeholder="Guest name"
                                                className="w-full pl-7 pr-2 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-amber-400" autoFocus />
                                        </div>
                                        <div className="relative">
                                            <Hash className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input type="text" value={hotelInfo.roomNumber}
                                                onChange={(e) => setHotelInfo({...hotelInfo, roomNumber: e.target.value})}
                                                placeholder="Room no."
                                                className="w-full pl-7 pr-2 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-amber-400" />
                                        </div>
                                    </div>
                                    <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">🏨 10% service charge applies</p>
                                </div>
                            )}

                            {/* Order Summary — compact */}
                            <div className={`p-3 rounded-lg ${modalIsPersonal ? 'bg-pink-50' : 'bg-blue-50'}`}>
                                <div className="space-y-1 text-sm">
                                    <div className="flex justify-between text-gray-600">
                                        <span>Subtotal</span>
                                        <span>₱{formatPrice(modalTotals.subtotal)}</span>
                                    </div>
                                    {modalTotals.employeeDiscount > 0 && (
                                        <div className="flex justify-between text-purple-600">
                                            <span>Employee Discount</span>
                                            <span>-₱{formatPrice(modalTotals.employeeDiscount)}</span>
                                        </div>
                                    )}
                                    {modalTotals.cardDiscount > 0 && (
                                        <div className="flex justify-between text-emerald-600">
                                            <span>Card Discount</span>
                                            <span>-₱{formatPrice(modalTotals.cardDiscount)}</span>
                                        </div>
                                    )}
                                    {modalTotals.additionalDiscount > 0 && (
                                        <div className="flex justify-between text-red-500">
                                            <span>Discount</span>
                                            <span>-₱{formatPrice(modalTotals.additionalDiscount)}</span>
                                        </div>
                                    )}
                                    {modalTotals.serviceCharge > 0 && (
                                        <div className="flex justify-between text-amber-600">
                                            <span>Service Charge</span>
                                            <span>+₱{formatPrice(modalTotals.serviceCharge)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center pt-1 border-t border-gray-200 mt-1">
                                        <span className="font-bold text-gray-900">Total</span>
                                        {modalIsPersonal ? (
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm line-through text-gray-400">₱{formatPrice(modalTotals.subtotal)}</span>
                                                <span className="text-xl font-bold text-pink-600">FREE</span>
                                            </div>
                                        ) : (
                                            <span className="text-xl font-bold text-blue-600">₱{formatPrice(modalTotals.total)}</span>
                                        )}
                                    </div>

                                    {/* CHANGE AMOUNT - Large and RED */}
                                    {selectedPaymentMethod?.name === 'Cash' && cashAmount && Number(cashAmount) >= modalTotals.total && (
                                        <div className="mt-3 pt-3 border-t-2 border-red-200 bg-red-50 rounded-xl p-4">
                                            <div className="flex justify-between items-center">
                                                <span className="text-lg font-bold text-red-700">CHANGE</span>
                                                <span className="text-3xl font-black text-red-600">
                                                    ₱{formatPrice(Number(cashAmount) - modalTotals.total)}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer actions — fixed at bottom */}
                        <div className="px-4 py-3 border-t border-gray-200 flex gap-2 flex-shrink-0">
                            <button
                                onClick={() => { setShowPaymentModal(false); setModalIsPersonal(false); setPersonalInfo({ name: '', reason: '' }); }}
                                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 text-sm">
                                Cancel
                            </button>
                            <button
                                onClick={handlePlaceOrder}
                                disabled={isLoading || (!modalIsPersonal && !selectedPaymentMethod) || (modalIsPersonal && !personalInfo.name)}
                                className={`flex-1 py-2.5 rounded-lg font-bold text-sm ${
                                    isLoading || (!modalIsPersonal && !selectedPaymentMethod) || (modalIsPersonal && !personalInfo.name)
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : modalIsPersonal
                                        ? 'bg-pink-600 text-white hover:bg-pink-700'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}>
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : modalIsPersonal ? '🎁 Confirm Free Order' : 'Confirm Order'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Discount Modal */}
            {showDiscountModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold">Apply Additional Discount</h2>
                                <button onClick={() => setShowDiscountModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setDiscount({ type: 'percentage', value: 10 })}
                                        className={`py-3 rounded-lg font-medium ${
                                            discount.type === 'percentage' ? 'bg-amber-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
                                        }`}>
                                        Percentage %
                                    </button>
                                    <button
                                        onClick={() => setDiscount({ type: 'fixed', value: 50 })}
                                        className={`py-3 rounded-lg font-medium ${
                                            discount.type === 'fixed' ? 'bg-amber-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
                                        }`}>
                                        Fixed ₱
                                    </button>
                                </div>
                                
                                {discount.type !== 'none' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {discount.type === 'percentage' ? 'Percentage %' : 'Amount (₱)'}
                                        </label>
                                        <input
                                            type="number"
                                            value={discount.value}
                                            onChange={(e) => setDiscount({...discount, value: Number(e.target.value)})}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                                            min="0"
                                            max={discount.type === 'percentage' ? 100 : undefined}
                                        />
                                    </div>
                                )}
                                <p className="text-xs text-gray-500 mt-2">
                                    Note: This discount is applied after employee and card discounts.
                                </p>
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-200 flex gap-3">
                            <button
                                onClick={() => {
                                    setDiscount({ type: 'none', value: 0 });
                                    setShowDiscountModal(false);
                                }}
                                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200">
                                Remove
                            </button>
                            <button
                                onClick={() => setShowDiscountModal(false)}
                                className="flex-1 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600">
                                Apply
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Dual Price Choice Modal */}
            {/* ── Drink Variant Modal (size + temperature) ── */}
            {showVariantModal && selectedVariantItem && (() => {
                const item = selectedVariantItem;
                // Define valid size+temp combos
                const ALLOWED = {
                    'Tall':   ['hot'],
                    'Grande': ['hot', 'iced'],
                    'Venti':  ['iced'],
                };
                const TEMP_COLORS = {
                    hot:  { border: 'border-red-300',     bg: 'bg-red-50',     hover: 'hover:bg-red-100',     text: 'text-red-700',     label: '🔥 Hot' },
                    iced: { border: 'border-blue-300',    bg: 'bg-blue-50',    hover: 'hover:bg-blue-100',    text: 'text-blue-700',    label: '🧊 Iced' },
                };
                const SIZE_COLORS = ['bg-indigo-50 border-indigo-200', 'bg-purple-50 border-purple-200', 'bg-violet-50 border-violet-200'];

                return (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
                        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Choose Size & Temp</h2>
                                <p className="text-sm text-gray-500 mt-0.5">{item.name}</p>
                            </div>
                            <button onClick={() => { setShowVariantModal(false); setSelectedVariantItem(null); }}
                                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5 space-y-3">
                            {(item.size_variants || []).map((sizeGroup, si) => {
                                const sizeName    = sizeGroup.size_name;
                                const allowed     = ALLOWED[sizeName] ?? ['hot', 'iced'];
                                const validTemps  = sizeGroup.variants.filter(v => allowed.includes(v.temperature));
                                if (validTemps.length === 0) return null;
                                return (
                                    <div key={sizeGroup.size_id} className={`rounded-xl border-2 p-3 ${SIZE_COLORS[si % SIZE_COLORS.length]}`}>
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                            {sizeGroup.display_name}
                                        </p>
                                        <div className={`grid gap-2 ${validTemps.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                            {validTemps.map(variant => {
                                                const tc = TEMP_COLORS[variant.temperature] ?? TEMP_COLORS.iced;
                                                return (
                                                    <button
                                                        key={variant.id}
                                                        onClick={() => {
                                                            addToOrder(item, {
                                                                price:       variant.price,
                                                                size_name:   sizeName,
                                                                temperature: variant.temperature,
                                                            });
                                                            setShowVariantModal(false);
                                                            setSelectedVariantItem(null);
                                                        }}
                                                        className={`p-3 rounded-lg border-2 ${tc.border} ${tc.bg} ${tc.hover} transition-colors text-left`}
                                                    >
                                                        <p className={`text-sm font-bold ${tc.text}`}>{tc.label}</p>
                                                        <p className="text-lg font-bold text-gray-900 mt-0.5">₱{formatPrice(variant.price)}</p>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="px-5 pb-5">
                            <button
                                onClick={() => { setShowVariantModal(false); setSelectedVariantItem(null); }}
                                className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
                );
            })()}

            {showPriceChoiceModal && selectedDualPriceItem && (() => {
                // Check stock availability for each portion
                const soloAvailable = getEffectiveAvailable(selectedDualPriceItem, 'solo');
                const wholeAvailable = getEffectiveAvailable(selectedDualPriceItem, 'whole');
                const canOrderSolo = soloAvailable === null || soloAvailable > 0;
                const canOrderWhole = wholeAvailable === null || wholeAvailable > 0;

                return (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold">Select Portion</h2>
                                <button onClick={closePriceChoiceModal} className="p-1 hover:bg-gray-100 rounded-lg">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <p className="text-sm text-gray-600 mt-2">{selectedDualPriceItem.name}</p>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-2 gap-3">
                                {/* SOLO Button */}
                                <button
                                    onClick={() => {
                                        if (canOrderSolo) {
                                            addToOrder(selectedDualPriceItem, {
                                                portion: 'solo',
                                                price: selectedDualPriceItem.price_solo,
                                            });
                                            closePriceChoiceModal();
                                        }
                                    }}
                                    disabled={!canOrderSolo}
                                    className={`p-4 rounded-lg border-2 transition-colors text-left ${
                                        canOrderSolo
                                            ? 'border-blue-200 bg-blue-50 hover:bg-blue-100 cursor-pointer'
                                            : 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-60'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <p className={`text-sm font-semibold ${canOrderSolo ? 'text-blue-800' : 'text-gray-500'}`}>
                                            Solo
                                        </p>
                                        {soloAvailable !== null && (
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                canOrderSolo ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                                {soloAvailable} left
                                            </span>
                                        )}
                                    </div>
                                    <p className={`text-xl font-bold mt-1 ${canOrderSolo ? 'text-blue-600' : 'text-gray-400'}`}>
                                        ₱{formatPrice(selectedDualPriceItem.price_solo)}
                                    </p>
                                    {!canOrderSolo && (
                                        <p className="text-xs text-red-600 mt-1 font-medium">Out of stock</p>
                                    )}
                                </button>

                                {/* WHOLE Button */}
                                <button
                                    onClick={() => {
                                        if (canOrderWhole) {
                                            addToOrder(selectedDualPriceItem, {
                                                portion: 'whole',
                                                price: selectedDualPriceItem.price_whole,
                                            });
                                            closePriceChoiceModal();
                                        }
                                    }}
                                    disabled={!canOrderWhole}
                                    className={`p-4 rounded-lg border-2 transition-colors text-left ${
                                        canOrderWhole
                                            ? 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 cursor-pointer'
                                            : 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-60'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <p className={`text-sm font-semibold ${canOrderWhole ? 'text-emerald-800' : 'text-gray-500'}`}>
                                            Whole
                                        </p>
                                        {wholeAvailable !== null && (
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                canOrderWhole ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                                {wholeAvailable} left
                                            </span>
                                        )}
                                    </div>
                                    <p className={`text-xl font-bold mt-1 ${canOrderWhole ? 'text-emerald-600' : 'text-gray-400'}`}>
                                        ₱{formatPrice(selectedDualPriceItem.price_whole)}
                                    </p>
                                    {!canOrderWhole && canOrderSolo && (
                                        <p className="text-xs text-amber-600 mt-1 font-medium">Only Solo available</p>
                                    )}
                                    {!canOrderWhole && !canOrderSolo && (
                                        <p className="text-xs text-red-600 mt-1 font-medium">Out of stock</p>
                                    )}
                                </button>
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-200">
                            <button
                                onClick={closePriceChoiceModal}
                                className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
                );
            })()}

            {/* Notes Modal */}
            {showNotesModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold">Add Note for Item</h2>
                                <button onClick={() => setShowNotesModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div className="p-6">
                            <textarea
                                value={currentNote}
                                onChange={(e) => setCurrentNote(e.target.value)}
                                placeholder="e.g., No peanuts, extra spicy, etc."
                                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                rows="4"
                                autoFocus
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                This note will appear in the kitchen for the chef.
                            </p>
                        </div>
                        <div className="p-6 border-t border-gray-200 flex gap-3">
                            <button
                                onClick={() => setShowNotesModal(false)}
                                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200">
                                Cancel
                            </button>
                            <button
                                onClick={saveItemNote}
                                className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
                                Save Note
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Receipt Print Modal */}
            {(pendingReceipt || pendingReceiptRef.current) && (
                <ReceiptPrint
                    receipt={pendingReceipt || pendingReceiptRef.current}
                    onClose={() => { pendingReceiptRef.current = null; setPendingReceipt(null); }}
                />
            )}

            {/* Shift Receipt Print (summary-only, one per completed shift) */}
            {shiftReceipt && (
                <ShiftReceiptPrint
                    receipt={shiftReceipt}
                    onClose={() => {
                        setShiftReceipt(null);
                    }}
                />
            )}

            {/* Cashier shift modals */}
            {shiftModal === 'checkin' && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70">
                    <div className="bg-white rounded-2xl shadow-2xl w-96 overflow-hidden">
                        <div className="bg-yellow-500 px-6 py-5">
                            <div>
                                <h2 className="text-white font-bold text-lg">Shift Check-in</h2>
                                <p className="text-yellow-100 text-sm">Enter starting balance to begin your shift</p>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Starting Balance (P)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={shiftStartingBalance}
                                    onChange={(e) => setShiftStartingBalance(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleShiftCheckIn(shiftStartingBalance || '0')}
                                    placeholder="0.00"
                                    autoFocus
                                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg font-mono focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                />
                                <p className="text-xs text-gray-400 mt-1">Enter 0 if the register starts empty.</p>
                            </div>

                            {shiftError && <p className="text-sm text-red-600 font-medium">{shiftError}</p>}

                            <button
                                onClick={() => handleShiftCheckIn(shiftStartingBalance || '0')}
                                disabled={shiftLoading}
                                className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white font-bold rounded-xl transition-colors"
                            >
                                {shiftLoading ? 'Checking in…' : 'Start Shift'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {shiftModal === 'checkout' && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-[420px] overflow-hidden">
                        <div className="bg-gray-900 px-6 py-5 flex items-center justify-between">
                            <div>
                                <h2 className="text-white font-bold text-lg">Shift Check-out</h2>
                                <p className="text-gray-300 text-sm">Generate one summary receipt for this shift</p>
                            </div>
                            <button onClick={() => setShiftModal(null)} className="text-gray-400 hover:text-white text-xl font-bold">✕</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Cashier</span>
                                    <span className="font-mono font-medium">{auth?.user?.name || '—'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Shift Started</span>
                                    <span className="font-mono font-medium">{formatPHDateTime(cashierShift?.check_in_time)}</span>
                                </div>
                            </div>

                            {shiftError && <p className="text-sm text-red-600 font-medium">{shiftError}</p>}

                            <button
                                onClick={handleShiftCheckOut}
                                disabled={shiftLoading}
                                className="w-full py-3 bg-gray-900 hover:bg-black disabled:opacity-50 text-white font-bold rounded-xl transition-colors"
                            >
                                {shiftLoading ? 'Checking out…' : 'Check Out & Print Receipt'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {shiftModal === 'expense' && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-[420px] overflow-hidden">
                        <div className="bg-blue-700 px-6 py-5 flex items-center justify-between">
                            <div>
                                <h2 className="text-white font-bold text-lg">Record Expense</h2>
                                <p className="text-blue-100 text-sm">Logs an expense transaction to your open shift</p>
                            </div>
                            <button onClick={() => setShiftModal(null)} className="text-blue-100 hover:text-white text-xl font-bold">✕</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (P)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={expenseAmount}
                                    onChange={(e) => setExpenseAmount(e.target.value)}
                                    placeholder="0.00"
                                    autoFocus
                                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                                <input
                                    type="text"
                                    value={expenseDescription}
                                    onChange={(e) => setExpenseDescription(e.target.value)}
                                    placeholder="e.g., delivery fee"
                                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                                />
                            </div>

                            {shiftError && <p className="text-sm text-red-600 font-medium">{shiftError}</p>}

                            <button
                                onClick={() => handleRecordExpense({ amount: expenseAmount || '0', description: expenseDescription })}
                                disabled={shiftLoading || expenseAmount === ''}
                                className="w-full py-3 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold rounded-xl transition-colors"
                            >
                                {shiftLoading ? 'Saving…' : 'Save Expense'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
