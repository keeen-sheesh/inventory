import React, { useState, useEffect } from 'react';
import { Link, usePage, router } from '@inertiajs/react';
import { 
    LayoutDashboard, 
    CreditCard, 
    BarChart3,
    ChefHat, 
    Utensils, 
    Users,
    Package,
    Settings,
    LogOut,
    Menu,
    Calendar,
} from 'lucide-react';
import { nowPH, formatPHFullDate } from '@/utils/phTime';

export default function AdminLayout({ children, auth }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [businessLogo, setBusinessLogo] = useState(null);
    const [businessName, setBusinessName] = useState('CJ BREW & DINE');
    const [businessTagline, setBusinessTagline] = useState('Restobar System');

    const { url, props } = usePage();
    const currentAuth = auth || props?.auth || {};
    const user = (currentAuth?.user || {});
    const userRole = (user?.role || '').toLowerCase();

    // Fetch business settings for logo and name
    useEffect(() => {
        const settings = props?.settings || {};
        if (settings.business_logo) {
            setBusinessLogo(`/storage/${settings.business_logo}`);
        }
        if (settings.business_name) {
            setBusinessName(settings.business_name);
        }
        if (settings.business_tagline) {
            setBusinessTagline(settings.business_tagline);
        }
    }, [props?.settings]);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
            // Auto-close sidebar on desktop
            if (window.innerWidth > 1024) {
                setSidebarOpen(false);
            }
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);

        // Check localStorage for sidebar state
        const savedState = localStorage.getItem('sidebarState');
        if (savedState === 'open' && window.innerWidth > 1024) {
            setSidebarOpen(true);
        }

        return () => window.removeEventListener('resize', checkMobile);
    }, []);
    
    useEffect(() => {
        localStorage.setItem('sidebarState', sidebarOpen ? 'visible' : 'hidden');
        
        // Update content margin
        const contentWrapper = document.querySelector('.content-wrapper');
        if (contentWrapper && !isMobile) {
            contentWrapper.style.marginLeft = sidebarOpen ? '280px' : '0';
        }
    }, [sidebarOpen, isMobile]);
    
    const isActivePath = (path) => url === path || url.startsWith(`${path}/`);

    const allNavItems = [
        { href: '/admin/dashboard', icon: LayoutDashboard, text: 'Dashboard', active: isActivePath('/admin/dashboard') },
        { href: '/cashier/dashboard', icon: LayoutDashboard, text: 'Dashboard', active: isActivePath('/cashier/dashboard') },
        { href: '/cashier/pos', icon: CreditCard, text: 'POS', active: isActivePath('/cashier/pos') },
        { href: '/admin/kitchen', icon: ChefHat, text: 'Kitchen', active: isActivePath('/admin/kitchen') },
        { href: '/admin/foods', icon: Utensils, text: 'Food Menu', active: isActivePath('/admin/foods') },
        { href: '/admin/reports', icon: BarChart3, text: 'Reports', active: isActivePath('/admin/reports') },
        { href: '/admin/roles', icon: Users, text: 'Roles', active: isActivePath('/admin/roles') },
        { href: '/admin/inventory', icon: Package, text: 'Inventory', active: isActivePath('/admin/inventory') },
        { href: '/admin/settings', icon: Settings, text: 'Settings', active: isActivePath('/admin/settings') },
        { href: '/menu', icon: Utensils, text: 'Menu', active: isActivePath('/menu') },
    ];

    const navByRole = {
        admin: allNavItems.filter((item) => item.href !== '/menu' && item.href !== '/cashier/dashboard'),
        manager: allNavItems.filter((item) =>
            item.href === '/admin/dashboard' ||
            item.href === '/cashier/pos' ||
            item.href === '/admin/foods' ||
            item.href === '/admin/reports' ||
            item.href === '/admin/inventory' ||
            item.href === '/admin/roles'
        ),
        cashier: allNavItems.filter((item) =>
            item.href === '/cashier/dashboard' ||
            item.href === '/cashier/pos'
        ),
        resto: allNavItems.filter((item) =>
            item.href === '/cashier/dashboard' ||
            item.href === '/cashier/pos'
        ),
        kitchen: allNavItems.filter((item) =>
            item.href === '/admin/kitchen' ||
            item.href === '/admin/foods' ||
            item.href === '/admin/inventory'
        ),
        kitchen_resto: allNavItems.filter((item) =>
            item.href === '/admin/kitchen' ||
            item.href === '/admin/foods' ||
            item.href === '/admin/inventory'
        ),
        customer: allNavItems.filter((item) => item.href === '/menu'),
    };

    const navItems = navByRole[userRole] || allNavItems.filter((item) => item.href === '/admin/dashboard');
    
    const roleLabelMap = {
        admin:         'Administrator',
        manager:       'Manager',
        cashier:       'Cashier',
        resto:         'Cashier',
        kitchen:       'Kitchen Staff',
        kitchen_resto: 'Kitchen Resto',
        customer:      'Customer',
    };
    const roleLabel = roleLabelMap[userRole] || (userRole ? userRole.replace('_', ' ') : 'User');
    
    const handleLogout = (e) => {
        e.preventDefault();
        router.post('/logout');
    };
    
    return (
        <div className="min-h-screen bg-gray-50">
            {/* CSRF Token Meta Tag - Add this for forms and AJAX */}
            <meta name="csrf-token" content={document.querySelector('meta[name="csrf-token"]')?.content || ''} />
            
            {/* Hamburger Menu Button - Toggle sidebar */}
            {!sidebarOpen && (
                <button
                    className="fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg"
                    onClick={() => setSidebarOpen(true)}
                >
                    <Menu className="w-6 h-6 text-gray-700" />
                </button>
            )}
            
            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-xl transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="flex flex-col h-full">
                    {/* Sidebar Header */}
                    <div className="p-6 border-b">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                                    {businessLogo ? (
                                        <img 
                                            src={businessLogo} 
                                            alt={businessName}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
                                            <span className="text-white font-bold text-lg">{businessName.charAt(0)}</span>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h1 className="font-bold text-lg text-gray-900">{businessName}</h1>
                                    <p className="text-xs text-gray-500">{businessTagline}</p>
                                </div>
                            </div>
                        </div>
                        
                        {/* User Info */}
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center text-white font-bold">
                                {user?.name?.charAt(0) || 'U'}
                            </div>
                            <div>
                                <p className="font-medium text-gray-900">{user?.name || 'User'}</p>
                                <p className="text-sm text-gray-500">{roleLabel}</p>
                            </div>
                        </div>
                    </div>
                    
                    {/* Navigation */}
                    <nav className="flex-1 p-4 overflow-y-auto">
                        <ul className="space-y-2">
                            {navItems.map((item) => (
                                <li key={item.href}>
                                    {item.external ? (
                                        <Link
                                            href={item.href}
                                            onClick={() => setSidebarOpen(false)}
                                            className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                                                item.active
                                                    ? 'bg-yellow-50 text-yellow-600 border-l-4 border-yellow-500'
                                                    : 'text-gray-700 hover:bg-gray-100'
                                            }`}
                                        >
                                            <item.icon className="w-5 h-5" />
                                            <span>{item.text}</span>
                                        </Link>
                                    ) : (
                                        <Link
                                            href={item.href}
                                            onClick={() => setSidebarOpen(false)}
                                            className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                                                item.active
                                                    ? 'bg-yellow-50 text-yellow-600 border-l-4 border-yellow-500'
                                                    : 'text-gray-700 hover:bg-gray-100'
                                            }`}
                                        >
                                            <item.icon className="w-5 h-5" />
                                            <span>{item.text}</span>
                                        </Link>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </nav>
                    
                    {/* Logout */}
                    <div className="p-4 border-t">
                        <button 
                            onClick={handleLogout}
                            className="flex items-center space-x-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            <LogOut className="w-5 h-5" />
                            <span>Logout</span>
                        </button>
                    </div>
                </div>
            </aside>
            
            {/* Outside-click overlay */}
            {sidebarOpen && (
                <div 
                    className="fixed inset-0 z-30 bg-black/50 lg:bg-transparent"
                    onClick={() => setSidebarOpen(false)}
                />
            )}
            
            {/* Main Content */}
            <div className="content-wrapper min-h-screen">
                {/* Top Navigation Bar */}
                <header className="sticky top-0 z-30 bg-white border-b shadow-sm">
                    <div className="px-6 py-4">
                        <div className="flex items-center justify-end space-x-4">
                            <div className="flex items-center space-x-2 text-sm text-gray-500">
                                <Calendar className="w-4 h-4" />
                                <span>{formatPHFullDate(nowPH())}</span>
                            </div>
                        </div>
                    </div>
                </header>
                
                {/* Page Content */}
                <main className="p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
