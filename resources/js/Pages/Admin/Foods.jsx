import { Head, usePage } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import FoodItemForm from '@/Pages/Admin/FoodItems/Form';
import {
  Tag, Utensils, CheckCircle, XCircle,
  Plus, Edit, Trash2, Search, Filter, SortAsc,
  ChevronRight, Folder, AlertTriangle,
  Save, X, ArrowUpDown, Package,
  ChefHat, Loader2, RefreshCw, Image as ImageIcon, 
  Upload, Star, DollarSign,
  ChevronLeft, ChevronsLeft, ChevronsRight, Coffee,         
  CupSoda, Beer, Wine, Milk, Eye
} from 'lucide-react';

const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return imagePath;
    }
    const cleanPath = imagePath.replace(/^storage\//, '');
    return `/storage/${cleanPath}`;
};

function ImageWithFallback({ src, alt }) {
    const [errored, setErrored] = useState(false);
    if (errored) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
                <Utensils className="h-8 w-8 text-gray-400" />
            </div>
        );
    }
    return (
        <img
            src={src}
            alt={alt}
            className="w-full h-full object-cover"
            onError={() => setErrored(true)}
        />
    );
}

export default function Foods({ 
    categories: initialCategories = [], 
    items: initialItems = [], 
    total_categories, 
    total_items, 
    active_categories, 
    available_items,
    flash = {}
}) {
    const { props } = usePage();
    const userRole = props.auth?.user?.role || 'admin';
    const isKitchenRole       = userRole === 'kitchen';
    const isRestoRole         = userRole === 'resto' || userRole === 'manager';
    const isAdminRole         = userRole === 'admin';
    const isKitchenRestoRole  = userRole === 'kitchen_resto';
    const [currentTab, setCurrentTab] = useState('items');
    const [categories, setCategories] = useState(initialCategories);
    const [items, setItems] = useState(initialItems);
    const [categoryTypeTab, setCategoryTypeTab] = useState('all'); // 'all', 'resto', 'kitchen'
    const [showAddSubcategoryModal, setShowAddSubcategoryModal] = useState(false);
    const [showEditSubcategoryModal, setShowEditSubcategoryModal] = useState(false);
    const [newSubcategory, setNewSubcategory] = useState({ 
        name: '', 
        description: '',
        is_kitchen_category: false,
        parent_id: ''
    });
    const [editSubcategory, setEditSubcategory] = useState({ 
        id: '', 
        name: '', 
        description: '',
        is_kitchen_category: false,
        parent_id: ''
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterCategoryType, setFilterCategoryType] = useState('');
    const [sortBy, setSortBy] = useState('name');
    
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(9);
    const [categoryPage, setCategoryPage] = useState(1);
    const [categoriesPerPage, setCategoriesPerPage] = useState(10);
    
    const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
    const [showAddItemModal, setShowAddItemModal] = useState(false);
    const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
    const [showEditItemModal, setShowEditItemModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showImageModal, setShowImageModal] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    
    const [newCategory, setNewCategory] = useState({ 
        name: '', 
        description: '',
        is_kitchen_category: isKitchenRole ? true : false
    });
    
    const [newItem, setNewItem] = useState({ 
        name: '', 
        description: '', 
        price: '', 
        category_id: '',
        stock_quantity: 0,
        low_stock_threshold: 10,
        is_available: true,
        is_featured: false,
        pricing_type: 'single',
        price_solo: '',
        price_whole: '',
        image: null,
        image_preview: null,
        menu_visibility: isKitchenRole ? 'kitchen' : isRestoRole ? 'resto' : 'both'
    });
    
    const [editCategory, setEditCategory] = useState({ 
        id: '', 
        name: '', 
        description: '',
        is_kitchen_category: false 
    });
    
    const [editItem, setEditItem] = useState({ 
        id: '', 
        name: '', 
        description: '', 
        price: '', 
        category_id: '',
        stock_quantity: 0,
        low_stock_threshold: 10,
        is_available: true,
        is_featured: false,
        pricing_type: 'single',
        price_solo: '',
        price_whole: '',
        image: null,
        image_preview: null,
        remove_image: false,
        menu_visibility: isKitchenRole ? 'kitchen' : isRestoRole ? 'resto' : 'both'
    });
    
    const [deleteTarget, setDeleteTarget] = useState({ type: '', id: '', name: '' });
    
    // Notification state
    const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
    const notificationTimeoutRef = useRef(null);
    
    // Loading states
    const [loading, setLoading] = useState({ type: '', id: '' });
    const [refreshing, setRefreshing] = useState(false);
    
    // Stats state
    const [stats, setStats] = useState({
        total_categories: total_categories || 0,
        total_main_categories: 0,
        total_subcategories: 0,
        total_items: total_items || 0,
        active_categories: active_categories || 0,
        available_items: available_items || 0
    });

    // FoodItemForm state
    const [showItemForm, setShowItemForm] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [ingredients, setIngredients] = useState([]);

    // Image file input refs
    const addImageInputRef = useRef(null);
    const editImageInputRef = useRef(null);
    
    // Filtered and sorted items
    // Role-based category and item filters
    const roleFilteredCategories = categories.filter(cat => {
        if (isKitchenRole) return cat.is_kitchen_category;
        if (isRestoRole) return !cat.is_kitchen_category;
        return true; // admin/manager sees all
    });
    const categoryById = roleFilteredCategories.reduce((acc, cat) => {
        acc[cat.id] = cat;
        return acc;
    }, {});

    const roleFilteredItems = items.filter(item => {
        if (isKitchenRole) return item.menu_visibility === 'kitchen';
        if (isRestoRole) return item.menu_visibility === 'resto';
        return true; // only admin sees all
    });

    const filteredItems = roleFilteredItems.filter(item => {
        const matchesSearch = !searchTerm || 
            item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (item.category_name && item.category_name.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const matchesCategory = !filterCategory || item.category_id == filterCategory;
        const category = categoryById[item.category_id];
        const isSubcategoryItem = Boolean(category?.parent_id);
        const matchesCategoryType = !filterCategoryType
            || (filterCategoryType === 'main' && !isSubcategoryItem)
            || (filterCategoryType === 'sub' && isSubcategoryItem);

        return matchesSearch && matchesCategory && matchesCategoryType;
    }).sort((a, b) => {
        switch(sortBy) {
            case 'name':
                return a.name.localeCompare(b.name);
            case 'price_low':
                const aPrice = a.pricing_type === 'dual' ? a.price_solo : (a.price || 0);
                const bPrice = b.pricing_type === 'dual' ? b.price_solo : (b.price || 0);
                return aPrice - bPrice;
            case 'price_high':
                const aPriceHigh = a.pricing_type === 'dual' ? a.price_solo : (a.price || 0);
                const bPriceHigh = b.pricing_type === 'dual' ? b.price_solo : (b.price || 0);
                return bPriceHigh - aPriceHigh;
            case 'category':
                return (a.category_name || '').localeCompare(b.category_name || '');
            default:
                return 0;
        }
    });
    
    // Filtered categories (main categories only)
    const filteredMainCategories = roleFilteredCategories.filter(cat => !cat.parent_id);
    
    // Pagination calculations for items
    const totalItemPages = Math.ceil(filteredItems.length / itemsPerPage);
    const paginatedItems = filteredItems.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );
    const filteredAvailableCount = filteredItems.filter(item => item.is_available).length;
    const filteredUnavailableCount = filteredItems.length - filteredAvailableCount;
    
    // Pagination calculations for main categories
    const totalCategoryPages = Math.ceil(filteredMainCategories.length / categoriesPerPage);
    const paginatedCategories = filteredMainCategories.slice(
        (categoryPage - 1) * categoriesPerPage,
        categoryPage * categoriesPerPage
    );
    
    // Reset page when filter/search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterCategory, filterCategoryType, sortBy]);

    const clearItemFilters = () => {
        setSearchTerm('');
        setFilterCategory('');
        setFilterCategoryType('');
        setSortBy('name');
    };

    // Show notification
    const showNotification = (message, type = 'success') => {
        setNotification({ show: true, message, type });
        
        if (notificationTimeoutRef.current) {
            clearTimeout(notificationTimeoutRef.current);
        }
        
        notificationTimeoutRef.current = setTimeout(() => {
            setNotification({ show: false, message: '', type: 'success' });
        }, 5000);
    };
    
    const closeNotification = () => {
        setNotification({ show: false, message: '', type: 'success' });
        if (notificationTimeoutRef.current) {
            clearTimeout(notificationTimeoutRef.current);
        }
    };
    
    // Format price with peso sign
    const formatPrice = (price) => {
        if (price === null || price === undefined || price === '') return '₱0.00';
        const numPrice = Number(price);
        if (isNaN(numPrice)) return '₱0.00';
        return `₱${numPrice.toFixed(2)}`;
    };
    
    // Get CSRF token
    const getCsrfToken = () => {
        const metaToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        if (metaToken) return metaToken;

        const xsrfCookie = document.cookie
            .split('; ')
            .find(cookie => cookie.startsWith('XSRF-TOKEN='))
            ?.split('=')[1];

        return xsrfCookie ? decodeURIComponent(xsrfCookie) : '';
    };
    
    // Handle image selection for add item
    const handleAddImageSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (file.size > 2 * 1024 * 1024) {
            showNotification('Image size must be less than 2MB', 'error');
            return;
        }
        
        if (!file.type.startsWith('image/')) {
            showNotification('File must be an image', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onloadend = () => {
            setNewItem(prev => ({
                ...prev,
                image: file,
                image_preview: reader.result
            }));
        };
        reader.readAsDataURL(file);
    };
    
    // Handle image selection for edit item
    const handleEditImageSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (file.size > 2 * 1024 * 1024) {
            showNotification('Image size must be less than 2MB', 'error');
            return;
        }
        
        if (!file.type.startsWith('image/')) {
            showNotification('File must be an image', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onloadend = () => {
            setEditItem(prev => ({
                ...prev,
                image: file,
                image_preview: reader.result,
                remove_image: false
            }));
        };
        reader.readAsDataURL(file);
    };
    
    // Remove image from add item
    const removeAddImage = () => {
        setNewItem(prev => ({ ...prev, image: null, image_preview: null }));
        if (addImageInputRef.current) addImageInputRef.current.value = '';
    };
    
    // Remove image from edit item
    const removeEditImage = () => {
        setEditItem(prev => ({ ...prev, image: null, image_preview: null, remove_image: true }));
        if (editImageInputRef.current) editImageInputRef.current.value = '';
    };
    
    // Refresh all data
    const refreshData = async () => {
        setRefreshing(true);
        try {
            const catResponse = await fetch('/admin/food-categories', {
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                }
            });
            const catData = await catResponse.json();
            if (catData.success) {
                const filtered = (catData.categories || []).filter(cat => {
                    if (isKitchenRole) return cat.is_kitchen_category;
                    if (isRestoRole) return !cat.is_kitchen_category;
                    return true;
                });
                setCategories(filtered);
            }
            
            const itemResponse = await fetch('/admin/food-items?limit=1000', {
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                }
            });
            const itemData = await itemResponse.json();
            if (itemData.success) {
                setItems(itemData.items || []);
            }
            
            showNotification('Data refreshed successfully');
        } catch (error) {
            showNotification('Failed to refresh data', 'error');
        } finally {
            setRefreshing(false);
        }
    };

    // Fetch ingredients for FoodItemForm
    const fetchIngredients = async () => {
        try {
            const response = await fetch('/admin/inventory/ingredients', {
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                }
            });
            const data = await response.json();
            if (data.success || data.ingredients) {
                setIngredients(data.ingredients || []);
            }
        } catch (error) {
            console.error('Failed to fetch ingredients:', error);
        }
    };

    // Load ingredients on mount
    useEffect(() => {
        fetchIngredients();
    }, []);

    // Handle save item from FoodItemForm
    const handleSaveItem = async (formData) => {
        // kitchen_resto role manages KitchenItems (drinks), not regular Items
        const baseUrl = isKitchenRestoRole ? '/admin/kitchen-items' : '/admin/food-items';
        const url = selectedItem
            ? `${baseUrl}/${selectedItem.id}`
            : baseUrl;

        if (selectedItem) {
            formData.append('_method', 'PUT');
        }

        const csrfToken = getCsrfToken();
        if (csrfToken && !formData.has('_token')) {
            formData.append('_token', csrfToken);
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'X-CSRF-TOKEN': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json',
                },
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                if (selectedItem) {
                    setItems(items.map(item => item.id === data.item.id ? data.item : item));
                } else {
                    setItems([...items, data.item]);
                }
                setShowItemForm(false);
                setSelectedItem(null);
                showNotification(selectedItem ? 'Item updated successfully' : 'Item added successfully');
            } else {
                showNotification(data.message || 'Failed to save item', 'error');
            }
        } catch (error) {
            showNotification('Error saving item', 'error');
        }
    };
    
    // Toggle category status
    const toggleCategoryStatus = async (category) => {
        setLoading({ type: 'category-toggle', id: category.id });
        try {
            const response = await fetch(`/admin/food-categories/${category.id}/toggle-status`, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({})
            });
            
            const data = await response.json();
            
            if (data.success) {
                setCategories(prev => prev.map(cat => 
                    cat.id === category.id ? { ...cat, is_active: data.is_active } : cat
                ));
                
                showNotification('Category status updated');
            }
        } catch (error) {
            showNotification('Failed to update status', 'error');
        } finally {
            setLoading({ type: '', id: '' });
        }
    };
    
    // Toggle item status
    const toggleItemStatus = async (item) => {
        setLoading({ type: 'item-toggle', id: item.id });
        try {
            const response = await fetch(`/admin/food-items/${item.id}/toggle-status`, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({})
            });
            
            const data = await response.json();
            
            if (data.success) {
                setItems(prev => prev.map(it => 
                    it.id === item.id ? { ...it, is_available: data.is_available } : it
                ));
                
                showNotification('Item status updated');
            }
        } catch (error) {
            showNotification('Failed to update status', 'error');
        } finally {
            setLoading({ type: '', id: '' });
        }
    };
    
    // Add category
    const handleAddCategory = async (e) => {
        e.preventDefault();
        if (!newCategory.name.trim()) {
            showNotification('Category name is required', 'error');
            return;
        }
        
        setLoading({ type: 'add-category', id: '' });
        try {
            const response = await fetch('/admin/food-categories', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    name: newCategory.name.trim(),
                    description: newCategory.description || '',
                    is_kitchen_category: newCategory.is_kitchen_category
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                setCategories(prev => [...prev, data.category]);
                const newTotalPages = Math.ceil((categories.length + 1) / categoriesPerPage);
                setCategoryPage(newTotalPages);
                showNotification('Category added successfully');
                setNewCategory({ name: '', description: '', is_kitchen_category: false });
                setShowAddCategoryModal(false);
            }
        } catch (error) {
            showNotification('Failed to add category', 'error');
        } finally {
            setLoading({ type: '', id: '' });
        }
    };
    
    // Add item with image upload
    const handleAddItem = async (e) => {
        e.preventDefault();
        
        // Validation
        if (!newItem.name.trim()) {
            showNotification('Item name is required', 'error');
            return;
        }
        
        if (newItem.pricing_type === 'dual') {
            if (!newItem.price_solo || !newItem.price_whole) {
                showNotification('Both Solo and Whole prices are required', 'error');
                return;
            }
        } else {
            if (!newItem.price) {
                showNotification('Price is required', 'error');
                return;
            }
        }
        
        if (!newItem.category_id) {
            showNotification('Please select a category', 'error');
            return;
        }
        
        setLoading({ type: 'add-item', id: '' });
        
        const formData = new FormData();
        formData.append('name', newItem.name.trim());
        formData.append('description', newItem.description || '');
        formData.append('category_id', newItem.category_id);
        formData.append('stock_quantity', newItem.stock_quantity || 0);
        formData.append('low_stock_threshold', newItem.low_stock_threshold || 10);
        formData.append('is_available', newItem.is_available ? '1' : '0');
        formData.append('is_featured', newItem.is_featured ? '1' : '0');
        formData.append('pricing_type', newItem.pricing_type);
        formData.append('menu_visibility', newItem.menu_visibility || 'both');
        
        if (newItem.pricing_type === 'dual') {
            formData.append('price', newItem.price_solo);
            formData.append('price_solo', newItem.price_solo);
            formData.append('price_whole', newItem.price_whole);
        } else {
            formData.append('price', newItem.price);
        }
        
        if (newItem.image) {
            formData.append('image', newItem.image);
        }

        const csrfToken = getCsrfToken();
        if (csrfToken && !formData.has('_token')) {
            formData.append('_token', csrfToken);
        }
        
        try {
            const response = await fetch('/admin/food-items', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'X-CSRF-TOKEN': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json',
                },
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                setItems(prev => [...prev, data.item]);
                const newTotalPages = Math.ceil((filteredItems.length + 1) / itemsPerPage);
                setCurrentPage(newTotalPages);
                showNotification('Item added successfully');
                setNewItem({ 
                    name: '', description: '', price: '', category_id: '',
                    stock_quantity: 0, low_stock_threshold: 10,
                    is_available: true, is_featured: false,
                    pricing_type: 'single',
                    price_solo: '', price_whole: '',
                    image: null, image_preview: null
                });
                setShowAddItemModal(false);
            }
        } catch (error) {
            showNotification('Failed to add item', 'error');
        } finally {
            setLoading({ type: '', id: '' });
        }
    };
    
    // Update category
    const handleUpdateCategory = async (e) => {
        e.preventDefault();
        if (!editCategory.name.trim()) {
            showNotification('Category name is required', 'error');
            return;
        }
        
        setLoading({ type: 'update-category', id: editCategory.id });
        try {
            const response = await fetch(`/admin/food-categories/${editCategory.id}`, {
                method: 'PUT',
                headers: {
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    name: editCategory.name.trim(),
                    description: editCategory.description || '',
                    is_kitchen_category: editCategory.is_kitchen_category
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                setCategories(prev => prev.map(cat => 
                    cat.id === editCategory.id ? { ...cat, name: editCategory.name, description: editCategory.description, is_kitchen_category: editCategory.is_kitchen_category } : cat
                ));
                showNotification('Category updated successfully');
                setShowEditCategoryModal(false);
            }
        } catch (error) {
            showNotification('Failed to update category', 'error');
        } finally {
            setLoading({ type: '', id: '' });
        }
    };
    
    // Update item with image upload
    const handleUpdateItem = async (e) => {
        e.preventDefault();
        
        if (!editItem.name.trim()) {
            showNotification('Item name is required', 'error');
            return;
        }
        
        if (editItem.pricing_type === 'dual') {
            if (!editItem.price_solo || !editItem.price_whole) {
                showNotification('Both Solo and Whole prices are required', 'error');
                return;
            }
        } else {
            if (!editItem.price) {
                showNotification('Price is required', 'error');
                return;
            }
        }
        
        if (!editItem.category_id) {
            showNotification('Please select a category', 'error');
            return;
        }
        
        setLoading({ type: 'update-item', id: editItem.id });
        
        const formData = new FormData();
        formData.append('_method', 'PUT');
        formData.append('name', editItem.name.trim());
        formData.append('description', editItem.description || '');
        formData.append('category_id', editItem.category_id);
        formData.append('stock_quantity', editItem.stock_quantity || 0);
        formData.append('low_stock_threshold', editItem.low_stock_threshold || 10);
        formData.append('is_available', editItem.is_available ? '1' : '0');
        formData.append('is_featured', editItem.is_featured ? '1' : '0');
        formData.append('pricing_type', editItem.pricing_type);
        formData.append('menu_visibility', editItem.menu_visibility || 'both');
        
        if (editItem.pricing_type === 'dual') {
            formData.append('price', editItem.price_solo);
            formData.append('price_solo', editItem.price_solo);
            formData.append('price_whole', editItem.price_whole);
        } else {
            formData.append('price', editItem.price);
        }
        
        if (editItem.image) {
            formData.append('image', editItem.image);
        }
        
        if (editItem.remove_image) {
            formData.append('remove_image', '1');
        }

        const csrfToken = getCsrfToken();
        if (csrfToken && !formData.has('_token')) {
            formData.append('_token', csrfToken);
        }
        
        try {
            const response = await fetch(`/admin/food-items/${editItem.id}`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'X-CSRF-TOKEN': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json',
                },
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                setItems(prev => prev.map(item => 
                    item.id === editItem.id ? data.item : item
                ));
                showNotification('Item updated successfully');
                setShowEditItemModal(false);
            }
        } catch (error) {
            showNotification('Failed to update item', 'error');
        } finally {
            setLoading({ type: '', id: '' });
        }
    };
    
    // Delete category
    const handleDeleteCategory = async (id) => {
        setLoading({ type: 'delete-category', id });
        try {
            const response = await fetch(`/admin/food-categories/${id}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'Accept': 'application/json',
                }
            });

            let data;
            try {
                data = await response.json();
            } catch {
                throw new Error(`Server error (${response.status})`);
            }

            if (data.success) {
                setCategories(prev => prev.filter(cat => cat.id !== id));
                setItems(prev => prev.filter(item => item.category_id !== id));

                if (paginatedCategories.length === 1 && categoryPage > 1) {
                    setCategoryPage(categoryPage - 1);
                }

                showNotification('Category deleted successfully');
                setShowDeleteModal(false);
            } else {
                showNotification(data.message || 'Failed to delete category', 'error');
                setShowDeleteModal(false);
            }
        } catch (error) {
            showNotification(error.message || 'Failed to delete category', 'error');
            setShowDeleteModal(false);
        } finally {
            setLoading({ type: '', id: '' });
        }
    };
    
    // Delete item
    const handleDeleteItem = async (id) => {
        setLoading({ type: 'delete-item', id });
        try {
            const response = await fetch(`/admin/food-items/${id}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'Accept': 'application/json',
                }
            });

            let data;
            try {
                data = await response.json();
            } catch {
                throw new Error(`Server error (${response.status})`);
            }

            if (data.success) {
                setItems(prev => prev.filter(item => item.id !== id));

                if (paginatedItems.length === 1 && currentPage > 1) {
                    setCurrentPage(currentPage - 1);
                }

                showNotification('Item deleted successfully');
                setShowDeleteModal(false);
            } else {
                // Server returned a business-logic error (e.g. item has sales history)
                showNotification(data.message || 'Failed to delete item', 'error');
                setShowDeleteModal(false);
            }
        } catch (error) {
            showNotification(error.message || 'Failed to delete item', 'error');
            setShowDeleteModal(false);
        } finally {
            setLoading({ type: '', id: '' });
        }
    };
    
    // Handle delete with validation
    const handleDelete = async () => {
        // Validate delete target before attempting deletion
        if (!deleteTarget.id || deleteTarget.id === undefined || deleteTarget.id === null || deleteTarget.id === '') {
            showNotification('Cannot delete: Invalid item ID', 'error');
            setShowDeleteModal(false);
            setDeleteTarget({ type: '', id: '', name: '' });
            return;
        }
        
        if (deleteTarget.type === 'category') {
            await handleDeleteCategory(deleteTarget.id);
        } else {
            await handleDeleteItem(deleteTarget.id);
        }
        setDeleteTarget({ type: '', id: '', name: '' });
    };
    
    // Add subcategory
    const handleAddSubcategory = async (e) => {
        e.preventDefault();
        if (!newSubcategory.name.trim()) {
            showNotification('Subcategory name is required', 'error');
            return;
        }
        
        setLoading({ type: 'add-subcategory', id: '' });
        try {
            const response = await fetch('/admin/food-categories', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    name: newSubcategory.name.trim(),
                    description: newSubcategory.description || '',
                    is_kitchen_category: newSubcategory.is_kitchen_category,
                    parent_id: newSubcategory.parent_id
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                setCategories(prev => [...prev, data.category]);
                const newTotalPages = Math.ceil((categories.length + 1) / categoriesPerPage);
                setCategoryPage(newTotalPages);
                showNotification('Subcategory added successfully');
                setNewSubcategory({ 
                    name: '', 
                    description: '',
                    is_kitchen_category: false,
                    parent_id: ''
                });
                setShowAddSubcategoryModal(false);
            }
        } catch (error) {
            showNotification('Failed to add subcategory', 'error');
        } finally {
            setLoading({ type: '', id: '' });
        }
    };
    
    // Update subcategory
    const handleUpdateSubcategory = async (e) => {
        e.preventDefault();
        if (!editSubcategory.name.trim()) {
            showNotification('Subcategory name is required', 'error');
            return;
        }
        
        setLoading({ type: 'update-subcategory', id: editSubcategory.id });
        try {
            const response = await fetch(`/admin/food-categories/${editSubcategory.id}`, {
                method: 'PUT',
                headers: {
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    name: editSubcategory.name.trim(),
                    description: editSubcategory.description || '',
                    is_kitchen_category: editSubcategory.is_kitchen_category,
                    parent_id: editSubcategory.parent_id
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                setCategories(prev => prev.map(cat => 
                    cat.id === editSubcategory.id ? { ...cat, name: editSubcategory.name, description: editSubcategory.description, is_kitchen_category: editSubcategory.is_kitchen_category, parent_id: editSubcategory.parent_id } : cat
                ));
                showNotification('Subcategory updated successfully');
                setShowEditSubcategoryModal(false);
            }
        } catch (error) {
            showNotification('Failed to update subcategory', 'error');
        } finally {
            setLoading({ type: '', id: '' });
        }
    };
    
    // Open edit modals
    const openEditCategoryModal = (category) => {
        setEditCategory({
            id: category.id,
            name: category.name,
            description: category.description || '',
            is_kitchen_category: category.is_kitchen_category || false
        });
        setShowEditCategoryModal(true);
    };
    
    const openEditSubcategoryModal = (subcategory) => {
        setEditSubcategory({
            id: subcategory.id,
            name: subcategory.name,
            description: subcategory.description || '',
            is_kitchen_category: subcategory.is_kitchen_category || false,
            parent_id: subcategory.parent_id
        });
        setShowEditSubcategoryModal(true);
    };
    
    const openEditItemModal = (item) => {
        setEditItem({
            id: item.id,
            name: item.name,
            description: item.description || '',
            price: item.price || '',
            category_id: item.category_id,
            stock_quantity: item.stock_quantity || 0,
            low_stock_threshold: item.low_stock_threshold || 10,
            is_available: item.is_available !== false,
            is_featured: item.is_featured || false,
            pricing_type: item.pricing_type || 'single',
            price_solo: item.price_solo || '',
            price_whole: item.price_whole || '',
            image: null,
            image_preview: item.image ? getImageUrl(item.image) : null,
            remove_image: false,
            menu_visibility: item.menu_visibility || 'both'
        });
        setShowEditItemModal(true);
    };
    
    // Open delete modal with validation
    const openDeleteModal = (type, id, name) => {
        // Validate that we have a valid ID before opening the modal
        if (!id || id === undefined || id === null || id === '') {
            console.error('Cannot open delete modal: Invalid or missing ID');
            return;
        }
        
        setDeleteTarget({ type, id, name });
        setShowDeleteModal(true);
    };
    
    // View image
    const viewImage = (imageUrl) => {
        setSelectedImage(imageUrl);
        setShowImageModal(true);
    };
    
    // Clean up on unmount
    useEffect(() => {
        return () => {
            if (notificationTimeoutRef.current) {
                clearTimeout(notificationTimeoutRef.current);
            }
        };
    }, []);
    
    // Get main categories for dropdown
    const mainCategories = roleFilteredCategories.filter(cat => !cat.parent_id);
    
    // Pagination Component
    const Pagination = ({ currentPage, totalPages, onPageChange, itemsPerPage, onItemsPerPageChange, totalItems }) => {
        if (totalPages <= 1) return null;
        
        const pageNumbers = [];
        const maxVisible = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        
        if (endPage - startPage + 1 < maxVisible) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            pageNumbers.push(i);
        }
        
        return (
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-gray-500">
                    Showing <span className="font-medium text-gray-700">
                        {((currentPage - 1) * itemsPerPage) + 1}
                    </span> to{' '}
                    <span className="font-medium text-gray-700">
                        {Math.min(currentPage * itemsPerPage, totalItems)}
                    </span> of{' '}
                    <span className="font-medium text-gray-700">{totalItems}</span> entries
                </div>
                
                <div className="flex items-center gap-4">
                    <select
                        value={itemsPerPage}
                        onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value={9}>9 per page</option>
                        <option value={18}>18 per page</option>
                        <option value={27}>27 per page</option>
                        <option value={36}>36 per page</option>
                    </select>
                    
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onPageChange(1)}
                            disabled={currentPage === 1}
                            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                            title="First page"
                        >
                            <ChevronsLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => onPageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        
                        {startPage > 1 && (
                            <>
                                <button
                                    onClick={() => onPageChange(1)}
                                    className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                                >
                                    1
                                </button>
                                {startPage > 2 && <span className="px-2 text-gray-400">...</span>}
                            </>
                        )}
                        
                        {pageNumbers.map(page => (
                            <button
                                key={page}
                                onClick={() => onPageChange(page)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-lg ${
                                    currentPage === page
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-700 hover:bg-gray-100'
                                }`}
                            >
                                {page}
                            </button>
                        ))}
                        
                        {endPage < totalPages && (
                            <>
                                {endPage < totalPages - 1 && <span className="px-2 text-gray-400">...</span>}
                                <button
                                    onClick={() => onPageChange(totalPages)}
                                    className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                                >
                                    {totalPages}
                                </button>
                            </>
                        )}
                        
                        <button
                            onClick={() => onPageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => onPageChange(totalPages)}
                            disabled={currentPage === totalPages}
                            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                            title="Last page"
                        >
                            <ChevronsRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        );
    };
    
    return (
        <AdminLayout>
            <Head title="Food Menu Management" />
            
            {/* Notification */}
            {notification.show && (
                <div className="fixed top-4 right-4 z-50 max-w-sm animate-slide-in">
                    <div className={`p-4 rounded-lg shadow-lg border-l-4 ${
                        notification.type === 'success' 
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-800' 
                            : notification.type === 'info'
                                ? 'bg-blue-50 border-blue-500 text-blue-800'
                                : 'bg-rose-50 border-rose-500 text-rose-800'
                    }`}>
                        <div className="flex items-start">
                            <div className="flex-shrink-0">
                                {notification.type === 'success' ? (
                                    <CheckCircle className="h-5 w-5 text-emerald-500" />
                                ) : notification.type === 'info' ? (
                                    <Eye className="h-5 w-5 text-blue-500" />
                                ) : (
                                    <XCircle className="h-5 w-5 text-rose-500" />
                                )}
                            </div>
                            <div className="ml-3 flex-1">
                                <p className="text-sm font-medium">{notification.message}</p>
                            </div>
                            <button 
                                onClick={closeNotification}
                                className="ml-4 flex-shrink-0 text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Image View Modal */}
            {showImageModal && selectedImage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
                    <div className="relative max-w-3xl max-h-[90vh]">
                        <button
                            onClick={() => setShowImageModal(false)}
                            className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <img 
                            src={selectedImage} 
                            alt="Preview" 
                            className="max-w-full max-h-[90vh] rounded-lg"
                        />
                    </div>
                </div>
            )}
            
            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 animate-scale-in">
                        <div className="p-6">
                            <div className="flex items-center mb-4">
                                <div className="p-2 bg-amber-100 rounded-lg mr-3">
                                    <AlertTriangle className="h-6 w-6 text-amber-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">Confirm Deletion</h3>
                                    <p className="text-sm text-gray-500">This action cannot be undone</p>
                                </div>
                            </div>
                            <p className="text-gray-600 mb-6">
                                Are you sure you want to delete <span className="font-semibold">{deleteTarget.name}</span>?
                                {deleteTarget.type === 'category' && ' All items in this category will also be removed.'}
                            </p>
                            <div className="flex justify-end space-x-3">
                                <button 
                                    onClick={() => setShowDeleteModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleDelete}
                                    className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors flex items-center"
                                    disabled={loading.type.includes('delete')}
                                >
                                    {loading.type.includes('delete') ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                        <Trash2 className="h-4 w-4 mr-2" />
                                    )}
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Main Content */}
            <div className="p-4 sm:p-6">
                {/* Header */}
                <div className="mb-6 sm:mb-8">
                    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-4">
                        <div>
                            <div className="flex items-center mb-2">
                                <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl mr-3">
                                    <Utensils className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                                </div>
                                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Food Menu Management</h1>
                            </div>
                        </div>
                        <div className="mt-4 lg:mt-0 flex flex-wrap items-center gap-2">
                            <button 
                                onClick={refreshData}
                                disabled={refreshing}
                                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-xs sm:text-sm flex items-center disabled:opacity-50"
                            >
                                <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                                <span className="hidden sm:inline">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
                                <span className="sm:hidden">Refresh</span>
                            </button>
                        </div>
                    </div>
                    
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-blue-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs sm:text-sm font-medium text-blue-700 mb-1">Categories</p>
                                    <div className="flex items-baseline">
                                        <span className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.total_categories}</span>
                                        <span className="text-xs sm:text-sm text-gray-500 ml-1 sm:ml-2">total</span>
                                    </div>
                                    <div className="flex items-center mt-1 sm:mt-2">
                                        <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 mr-1" />
                                        <span className="text-xs sm:text-sm font-medium text-gray-700">{stats.active_categories}</span>
                                        <span className="text-xs sm:text-sm text-gray-500 ml-1">active</span>
                                    </div>
                                </div>
                                <div className="p-2 sm:p-3 bg-white/50 rounded-xl">
                                    <Tag className="h-5 w-5 sm:h-8 sm:w-8 text-blue-600" />
                                </div>
                            </div>
                        </div>
                        
                        <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-emerald-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs sm:text-sm font-medium text-emerald-700 mb-1">Menu Items</p>
                                    <div className="flex items-baseline">
                                        <span className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.total_items}</span>
                                        <span className="text-xs sm:text-sm text-gray-500 ml-1 sm:ml-2">total</span>
                                    </div>
                                    <div className="flex items-center mt-1 sm:mt-2">
                                        <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 mr-1" />
                                        <span className="text-xs sm:text-sm font-medium text-gray-700">{stats.available_items}</span>
                                        <span className="text-xs sm:text-sm text-gray-500 ml-1">active</span>
                                    </div>
                                </div>
                                <div className="p-2 sm:p-3 bg-white/50 rounded-xl">
                                    <Package className="h-5 w-5 sm:h-8 sm:w-8 text-emerald-600" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Tabs */}
                <div className="mb-4 sm:mb-6">
                    <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl w-fit">
                        <button
                            onClick={() => setCurrentTab('categories')}
                            className={`px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium rounded-lg transition-all flex items-center ${
                                currentTab === 'categories'
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <Tag className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                            <span className="hidden sm:inline">Categories</span>
                            <span className="sm:hidden">Cats</span>
                            <span className="ml-1 sm:ml-2 px-1.5 py-0.5 text-xs bg-gray-100 rounded-full">
                                {stats.total_categories}
                            </span>
                        </button>
                        <button
                            onClick={() => setCurrentTab('items')}
                            className={`px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium rounded-lg transition-all flex items-center ${
                                currentTab === 'items'
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <Utensils className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                            <span className="hidden sm:inline">Menu Items</span>
                            <span className="sm:hidden">Items</span>
                            <span className="ml-1 sm:ml-2 px-1.5 py-0.5 text-xs bg-gray-100 rounded-full">
                                {stats.total_items}
                            </span>
                        </button>
                    </div>
                </div>
                
                {/* Categories Tab */}
                {currentTab === 'categories' && (
                    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white flex justify-between items-center">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                                    <Tag className="h-5 w-5 mr-2 text-blue-600" />
                                    Food Categories
                                </h2>
                                <p className="text-sm text-gray-500 mt-1">Organize your menu items into categories</p>
                            </div>
                            <button
                                onClick={() => setShowAddCategoryModal(true)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Category
                            </button>
                        </div>
                        
                        <div className="p-6">
                            <div className="grid gap-4">
                                {paginatedCategories.length === 0 ? (
                                    <div className="text-center py-12">
                                        <Tag className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                                        <h3 className="text-lg font-medium text-gray-900 mb-1">No Categories Yet</h3>
                                    </div>
                                ) : (
                                    paginatedCategories.map((category) => (
                                        <div key={category.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${category.is_active ? 'bg-blue-100' : 'bg-gray-200'}`}>
                                                    <Tag className={`h-5 w-5 ${category.is_active ? 'text-blue-600' : 'text-gray-600'}`} />
                                                </div>
                                                <div>
                                                    <h3 className="font-medium text-gray-900">{category.name}</h3>
                                                    {category.description && (
                                                        <p className="text-sm text-gray-500">{category.description}</p>
                                                    )}
                                                    {category.is_kitchen_category && (
                                                        <span className="inline-flex items-center px-2 py-0.5 mt-1 bg-amber-100 text-amber-700 rounded-full text-xs">
                                                            <ChefHat className="h-3 w-3 mr-1" />
                                                            Kitchen Category
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => toggleCategoryStatus(category)}
                                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                                            category.is_active
                                                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                                        }`}
                                                        disabled={loading.type === 'category-toggle' && loading.id === category.id}
                                                    >
                                                        {loading.type === 'category-toggle' && loading.id === category.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : category.is_active ? 'Active' : 'Inactive'}
                                                    </button>
                                                    <button
                                                        onClick={() => openEditCategoryModal(category)}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => openDeleteModal('category', category.id, category.name)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setNewSubcategory({ 
                                                                name: '', 
                                                                description: '',
                                                                is_kitchen_category: false,
                                                                parent_id: category.id
                                                            });
                                                            setShowAddSubcategoryModal(true);
                                                        }}
                                                        className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                                        title="Add subcategory"
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                    </button>
                                                </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            
                            {categories.length > 0 && (
                                <Pagination
                                    currentPage={categoryPage}
                                    totalPages={totalCategoryPages}
                                    onPageChange={setCategoryPage}
                                    itemsPerPage={categoriesPerPage}
                                    onItemsPerPageChange={setCategoriesPerPage}
                                    totalItems={categories.length}
                                />
                            )}
                        </div>
                    </div>
                )}
                
                {/* Items Tab */}
                {currentTab === 'items' && (
                    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/60">
                            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                                        <Utensils className="h-5 w-5 mr-2 text-emerald-600" />
                                        Menu Items
                                    </h2>
                                    <p className="text-sm text-gray-500 mt-1">Manage all your food and beverage items</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-700">
                                        {filteredItems.length} result{filteredItems.length !== 1 ? 's' : ''}
                                    </span>
                                    {categories.length > 0 && (
                                        <button
                                            onClick={() => {
                                                setSelectedItem(null);
                                                setShowItemForm(true);
                                            }}
                                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium flex items-center"
                                        >
                                            <Plus className="h-4 w-4 mr-2" />
                                            Add Item
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Filters */}
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">Search</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <input
                                            type="text"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            placeholder="Search items..."
                                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">Category</label>
                                    <select
                                        value={filterCategory}
                                        onChange={(e) => setFilterCategory(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                    >
                                        <option value="">All Categories</option>
                                        {roleFilteredCategories.map(category => (
                                            <option key={category.id} value={category.id}>
                                                {category.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">Category Type</label>
                                    <select
                                        value={filterCategoryType}
                                        onChange={(e) => setFilterCategoryType(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                    >
                                        <option value="">All Types</option>
                                        <option value="main">Main Categories</option>
                                        <option value="sub">Subcategories</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">Sort By</label>
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                    >
                                        <option value="name">Name (A-Z)</option>
                                        <option value="price_low">Price (Low to High)</option>
                                        <option value="price_high">Price (High to Low)</option>
                                        <option value="category">Category</option>
                                    </select>
                                </div>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                    <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                                        Available: {filteredAvailableCount}
                                    </span>
                                    <span className="px-2 py-1 rounded-full bg-rose-100 text-rose-700 font-medium">
                                        Unavailable: {filteredUnavailableCount}
                                    </span>
                                </div>
                                <button
                                    onClick={clearItemFilters}
                                    className="px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                    Reset Filters
                                </button>
                            </div>
                        </div>
                        
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {paginatedItems.length === 0 ? (
                                    <div className="col-span-full text-center py-12">
                                        <Package className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                                        <h3 className="text-lg font-medium text-gray-900 mb-1">No Items Found</h3>
                                        <p className="text-gray-500 mb-4">
                                            {categories.length === 0 
                                                ? 'Create a category first to add menu items' 
                                                : 'Try adjusting your search or add a new item'}
                                        </p>
                                    </div>
                                ) : (
                                    paginatedItems.map((item) => {
                                        const inventoryStatus = item.inventory_status || 'no_recipe';
                                        const rawServings = item.inventory_available_servings;
                                        const parsedServings = rawServings === null || rawServings === undefined
                                            ? null
                                            : Number(rawServings);
                                        const inventoryServings = Number.isFinite(parsedServings) ? parsedServings : null;
                                        const inventoryLabel = item.inventory_status_label || 'No Recipe';
                                        const inventoryBadgeClass =
                                            inventoryStatus === 'in'
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : inventoryStatus === 'low'
                                                    ? 'bg-amber-100 text-amber-700'
                                                    : inventoryStatus === 'out'
                                                        ? 'bg-rose-100 text-rose-700'
                                                        : 'bg-gray-100 text-gray-700';
                                        const inventoryText = inventoryServings === null
                                            ? inventoryLabel
                                            : `${inventoryLabel} (${inventoryServings} serving${inventoryServings === 1 ? '' : 's'})`;

                                        return (
                                            <div key={item.id} className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
                                                <div 
                                                    className="h-40 bg-gray-200 relative cursor-pointer"
                                                    onClick={() => item.image && viewImage(getImageUrl(item.image))}
                                                >
                                                    {item.image ? (
                                                        <ImageWithFallback
                                                            src={getImageUrl(item.image)}
                                                            alt={item.name}
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                                            <Utensils className="h-8 w-8 text-gray-400" />
                                                        </div>
                                                    )}
                                                    {item.is_featured && (
                                                        <div className="absolute top-2 left-2 px-2 py-1 bg-amber-500 text-white text-xs font-medium rounded-full flex items-center">
                                                            <Star className="h-3 w-3 mr-1 fill-white" />
                                                            Featured
                                                        </div>
                                                    )}
                                                    {!item.is_available && (
                                                        <div className="absolute top-2 right-2 px-2 py-1 bg-red-500 text-white text-xs font-medium rounded-full">
                                                            Unavailable
                                                        </div>
                                                    )}
                                                    {item.menu_visibility && item.menu_visibility !== 'both' && (
                                                        <div className={`absolute bottom-2 left-2 px-2 py-1 text-xs font-medium rounded-full ${
                                                            item.menu_visibility === 'kitchen'
                                                                ? 'bg-orange-500 text-white'
                                                                : 'bg-blue-500 text-white'
                                                        }`}>
                                                            {item.menu_visibility === 'kitchen' ? '🍳 Kitchen Only' : '🛒 Resto Only'}
                                                        </div>
                                                    )}
                                                    {item.has_sizes && (
                                                        <div className="absolute bottom-2 right-2 px-2 py-1 text-xs font-medium rounded-full bg-indigo-600 text-white">
                                                            ☕ Sizes
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                <div className="p-4">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <h3 className="font-semibold text-gray-900">{item.name}</h3>
                                                        {item.has_sizes && item.size_variants?.length > 0 ? (
                                                            <div className="text-right">
                                                                {item.size_variants.flatMap(sg => sg.variants).slice(0, 2).map((v, i) => (
                                                                    <span key={i} className="text-xs text-gray-500 block">
                                                                        {v.label}: {formatPrice(v.price)}
                                                                    </span>
                                                                ))}
                                                                {item.size_variants.flatMap(sg => sg.variants).length > 2 && (
                                                                    <span className="text-xs text-gray-400">+more</span>
                                                                )}
                                                            </div>
                                                        ) : item.pricing_type === 'dual' ? (
                                                            <div className="text-right">
                                                                <span className="text-xs text-gray-500 block">Solo: {formatPrice(item.price_solo)}</span>
                                                                <span className="text-xs text-gray-500 block">Whole: {formatPrice(item.price_whole)}</span>
                                                                <span className="text-sm font-bold text-blue-600 mt-1 block">
                                                                    {formatPrice(item.price_solo)} - {formatPrice(item.price_whole)}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-lg font-bold text-emerald-600">
                                                                {formatPrice(item.price)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    
                                                    {item.description && (
                                                        <p className="text-sm text-gray-500 mb-3 line-clamp-2">{item.description}</p>
                                                    )}
                                                    
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium flex items-center">
                                                            <Folder className="h-3 w-3 mr-1" />
                                                            {item.category_name}
                                                        </span>
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center ${inventoryBadgeClass}`}>
                                                            <Package className="h-3 w-3 mr-1" />
                                                            {inventoryText}
                                                        </span>
                                                    </div>
                                                    
                                                    <div className="flex items-center justify-between">
                                                        <button
                                                            onClick={() => toggleItemStatus(item)}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                                                item.is_available
                                                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                                    : 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                                                            }`}
                                                            disabled={loading.type === 'item-toggle' && loading.id === item.id}
                                                        >
                                                            {loading.type === 'item-toggle' && loading.id === item.id ? (
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                            ) : item.is_available ? 'Available' : 'Unavailable'}
                                                        </button>
                                                        
                                                        <div className="flex gap-1">
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedItem(item);
                                                                    setShowItemForm(true);
                                                                }}
                                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                title="Edit"
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => openDeleteModal('item', item.id, item.name)}
                                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                            
                            {filteredItems.length > 0 && (
                                <Pagination
                                    currentPage={currentPage}
                                    totalPages={totalItemPages}
                                    onPageChange={setCurrentPage}
                                    itemsPerPage={itemsPerPage}
                                    onItemsPerPageChange={setItemsPerPage}
                                    totalItems={filteredItems.length}
                                />
                            )}
                        </div>
                    </div>
                )}
            </div>
            
            {/* Add Category Modal */}
            {showAddCategoryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 animate-scale-in">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
                            <div className="flex items-center">
                                <div className="p-2 bg-blue-100 rounded-lg mr-3">
                                    <Plus className="h-5 w-5 text-blue-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">New Category</h3>
                            </div>
                            <button 
                                onClick={() => setShowAddCategoryModal(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <form onSubmit={handleAddCategory} className="p-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                                        Category Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={newCategory.name}
                                        onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="e.g., Appetizers, Main Course"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
                                    <textarea
                                        value={newCategory.description}
                                        onChange={(e) => setNewCategory({...newCategory, description: e.target.value})}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        rows="3"
                                        placeholder="Brief description of this category..."
                                    />
                                </div>
                                {isAdminRole ? (
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="add_is_kitchen_category"
                                        checked={newCategory.is_kitchen_category}
                                        onChange={(e) => setNewCategory({...newCategory, is_kitchen_category: e.target.checked})}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor="add_is_kitchen_category" className="ml-2 text-sm text-gray-700">
                                        Kitchen Category (items prepared in kitchen)
                                    </label>
                                </div>
                                ) : (
                                <div className="flex items-center px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                                    <span className="text-sm text-gray-500">
                                        {isKitchenRole ? '🍳 This will be a Kitchen Category' : '🛒 This will be a Resto Category'}
                                    </span>
                                </div>
                                )}
                            </div>
                            <div className="mt-6 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAddCategoryModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center"
                                    disabled={loading.type === 'add-category'}
                                >
                                    {loading.type === 'add-category' ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                        <Save className="h-4 w-4 mr-2" />
                                    )}
                                    Create Category
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {/* Add Item Modal */}
            {showAddItemModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white z-10 flex justify-between items-center px-6 py-4 border-b border-gray-100">
                            <div className="flex items-center">
                                <div className="p-2 bg-emerald-100 rounded-lg mr-3">
                                    <Plus className="h-5 w-5 text-emerald-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">New Menu Item</h3>
                            </div>
                            <button 
                                onClick={() => {
                                    setShowAddItemModal(false);
                                    setNewItem({ 
                                        name: '', description: '', price: '', category_id: '',
                                        stock_quantity: 0, low_stock_threshold: 10,
                                        is_available: true, is_featured: false,
                                        pricing_type: 'single',
                                        price_solo: '', price_whole: '',
                                        image: null, image_preview: null
                                    });
                                }}
                                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleAddItem} className="p-6">
                            <div className="space-y-4">
                                {/* Image Upload */}
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-2 block">Item Image</label>
                                    <div className="flex items-start gap-4">
                                        <div className="flex-shrink-0">
                                            {newItem.image_preview ? (
                                                <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200">
                                                    <img 
                                                        src={newItem.image_preview} 
                                                        alt="Preview" 
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={removeAddImage}
                                                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="w-24 h-24 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                                                    <ImageIcon className="h-8 w-8 text-gray-400" />
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <input
                                                type="file"
                                                id="add-item-image"
                                                ref={addImageInputRef}
                                                onChange={handleAddImageSelect}
                                                accept="image/*"
                                                className="hidden"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => addImageInputRef.current?.click()}
                                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center"
                                            >
                                                <Upload className="h-4 w-4 mr-2" />
                                                Upload Image
                                            </button>
                                            <p className="text-xs text-gray-500 mt-2">
                                                Max file size: 2MB. Supported: JPG, PNG, GIF
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-1 block">
                                            Item Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={newItem.name}
                                            onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                            placeholder="e.g., Grilled Salmon"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-1 block">
                                            Category <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={newItem.category_id}
                                            onChange={(e) => setNewItem({...newItem, category_id: e.target.value})}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                            required
                                        >
                                            <option value="">Select category</option>
                                            {roleFilteredCategories.map(category => (
                                                <option key={category.id} value={category.id}>
                                                    {category.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
                                    <textarea
                                        value={newItem.description}
                                        onChange={(e) => setNewItem({...newItem, description: e.target.value})}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                        rows="3"
                                        placeholder="Describe the item..."
                                    />
                                </div>

                                {/* Pricing Type Selection */}
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-2 block">Pricing Type</label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center">
                                            <input
                                                type="radio"
                                                name="pricing_type"
                                                value="single"
                                                checked={newItem.pricing_type === 'single'}
                                                onChange={(e) => setNewItem({...newItem, pricing_type: e.target.value})}
                                                className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                                            />
                                            <span className="ml-2 text-sm text-gray-700">Single Price</span>
                                        </label>
                                        <label className="flex items-center">
                                            <input
                                                type="radio"
                                                name="pricing_type"
                                                value="dual"
                                                checked={newItem.pricing_type === 'dual'}
                                                onChange={(e) => setNewItem({...newItem, pricing_type: e.target.value})}
                                                className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                                            />
                                            <span className="ml-2 text-sm text-gray-700">Solo/Whole (Dual Price)</span>
                                        </label>
                                    </div>
                                </div>

                                {/* Visible In */}
                                {isAdminRole ? (
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">Visible In</label>
                                    <select
                                        value={newItem.menu_visibility}
                                        onChange={(e) => setNewItem({...newItem, menu_visibility: e.target.value})}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                    >
                                        <option value="both">Both (Resto &amp; Kitchen)</option>
                                        <option value="resto">Resto POS Only</option>
                                        <option value="kitchen">Kitchen POS Only</option>
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">Controls which POS menu this item appears in.</p>
                                </div>
                                ) : (
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">Visible In</label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={isKitchenRole ? '🍳 Kitchen Only' : '🛒 Resto Only'}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Items you add are automatically assigned to your section.</p>
                                </div>
                                )}

                                {newItem.pricing_type === 'dual' ? (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                                                Solo Price (₱) <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={newItem.price_solo}
                                                onChange={(e) => setNewItem({...newItem, price_solo: e.target.value})}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                                placeholder="0.00"
                                                required={newItem.pricing_type === 'dual'}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                                                Whole Price (₱) <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={newItem.price_whole}
                                                onChange={(e) => setNewItem({...newItem, price_whole: e.target.value})}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                                placeholder="0.00"
                                                required={newItem.pricing_type === 'dual'}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                                                Price (₱) <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={newItem.price}
                                                onChange={(e) => setNewItem({...newItem, price: e.target.value})}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                                placeholder="0.00"
                                                required={newItem.pricing_type === 'single'}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-700 mb-1 block">Stock Quantity</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={newItem.stock_quantity}
                                                onChange={(e) => setNewItem({...newItem, stock_quantity: parseInt(e.target.value) || 0})}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-700 mb-1 block">Low Stock Threshold</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={newItem.low_stock_threshold}
                                                onChange={(e) => setNewItem({...newItem, low_stock_threshold: parseInt(e.target.value) || 10})}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                                placeholder="10"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-6">
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={newItem.is_available}
                                            onChange={(e) => setNewItem({...newItem, is_available: e.target.checked})}
                                            className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                                        />
                                        <span className="ml-2 text-sm text-gray-700">Available for sale</span>
                                    </label>
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={newItem.is_featured}
                                            onChange={(e) => setNewItem({...newItem, is_featured: e.target.checked})}
                                            className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded"
                                        />
                                        <span className="ml-2 text-sm text-gray-700">Featured item</span>
                                    </label>
                                </div>
                            </div>
                            
                            <div className="mt-6 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddItemModal(false);
                                        setNewItem({ 
                                            name: '', description: '', price: '', category_id: '',
                                            stock_quantity: 0, low_stock_threshold: 10,
                                            is_available: true, is_featured: false,
                                            pricing_type: 'single',
                                            price_solo: '', price_whole: '',
                                            image: null, image_preview: null
                                        });
                                    }}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center"
                                    disabled={loading.type === 'add-item'}
                                >
                                    {loading.type === 'add-item' ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                        <Save className="h-4 w-4 mr-2" />
                                    )}
                                    Add Item
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {/* Edit Category Modal */}
            {showEditCategoryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
                            <div className="flex items-center">
                                <div className="p-2 bg-blue-100 rounded-lg mr-3">
                                    <Edit className="h-5 w-5 text-blue-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">Edit Category</h3>
                            </div>
                            <button 
                                onClick={() => setShowEditCategoryModal(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateCategory} className="p-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                                        Category Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={editCategory.name}
                                        onChange={(e) => setEditCategory({...editCategory, name: e.target.value})}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
                                    <textarea
                                        value={editCategory.description}
                                        onChange={(e) => setEditCategory({...editCategory, description: e.target.value})}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        rows="3"
                                    />
                                </div>
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="edit_is_kitchen_category"
                                        checked={editCategory.is_kitchen_category}
                                        onChange={(e) => setEditCategory({...editCategory, is_kitchen_category: e.target.checked})}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor="edit_is_kitchen_category" className="ml-2 text-sm text-gray-700">
                                        Kitchen Category
                                    </label>
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowEditCategoryModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center"
                                    disabled={loading.type === 'update-category'}
                                >
                                    {loading.type === 'update-category' ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                        <Save className="h-4 w-4 mr-2" />
                                    )}
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {/* Edit Item Modal */}
            {showEditItemModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white z-10 flex justify-between items-center px-6 py-4 border-b border-gray-100">
                            <div className="flex items-center">
                                <div className="p-2 bg-emerald-100 rounded-lg mr-3">
                                    <Edit className="h-5 w-5 text-emerald-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">Edit Menu Item</h3>
                            </div>
                            <button 
                                onClick={() => setShowEditItemModal(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleUpdateItem} className="p-6">
                            <div className="space-y-4">
                                {/* Image Upload */}
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-2 block">Item Image</label>
                                    <div className="flex items-start gap-4">
                                        <div className="flex-shrink-0">
                                            {editItem.image_preview ? (
                                                <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200">
                                                    <img 
                                                        src={editItem.image_preview} 
                                                        alt="Preview" 
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={removeEditImage}
                                                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="w-24 h-24 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                                                    <ImageIcon className="h-8 w-8 text-gray-400" />
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <input
                                                type="file"
                                                id="edit-item-image"
                                                ref={editImageInputRef}
                                                onChange={handleEditImageSelect}
                                                accept="image/*"
                                                className="hidden"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => editImageInputRef.current?.click()}
                                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center"
                                            >
                                                <Upload className="h-4 w-4 mr-2" />
                                                Upload Image
                                            </button>
                                            <p className="text-xs text-gray-500 mt-2">
                                                Leave empty to keep current image
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-1 block">
                                            Item Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={editItem.name}
                                            onChange={(e) => setEditItem({...editItem, name: e.target.value})}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-1 block">
                                            Category <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={editItem.category_id}
                                            onChange={(e) => setEditItem({...editItem, category_id: e.target.value})}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                            required
                                        >
                                            {roleFilteredCategories.map(category => (
                                                <option key={category.id} value={category.id}>
                                                    {category.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
                                    <textarea
                                        value={editItem.description}
                                        onChange={(e) => setEditItem({...editItem, description: e.target.value})}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                        rows="3"
                                    />
                                </div>

                                {/* Pricing Type Selection */}
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-2 block">Pricing Type</label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center">
                                            <input
                                                type="radio"
                                                name="edit_pricing_type"
                                                value="single"
                                                checked={editItem.pricing_type === 'single'}
                                                onChange={(e) => setEditItem({...editItem, pricing_type: e.target.value})}
                                                className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                                            />
                                            <span className="ml-2 text-sm text-gray-700">Single Price</span>
                                        </label>
                                        <label className="flex items-center">
                                            <input
                                                type="radio"
                                                name="edit_pricing_type"
                                                value="dual"
                                                checked={editItem.pricing_type === 'dual'}
                                                onChange={(e) => setEditItem({...editItem, pricing_type: e.target.value})}
                                                className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                                            />
                                            <span className="ml-2 text-sm text-gray-700">Solo/Whole (Dual Price)</span>
                                        </label>
                                    </div>
                                </div>

                                {/* Visible In */}
                                {isAdminRole ? (
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">Visible In</label>
                                    <select
                                        value={editItem.menu_visibility || 'both'}
                                        onChange={(e) => setEditItem({...editItem, menu_visibility: e.target.value})}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                    >
                                        <option value="both">Both (Resto &amp; Kitchen)</option>
                                        <option value="resto">Resto POS Only</option>
                                        <option value="kitchen">Kitchen POS Only</option>
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">Controls which POS menu this item appears in.</p>
                                </div>
                                ) : (
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">Visible In</label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={isKitchenRole ? '🍳 Kitchen Only' : '🛒 Resto Only'}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Items you add are automatically assigned to your section.</p>
                                </div>
                                )}

                                {editItem.pricing_type === 'dual' ? (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                                                Solo Price (₱) <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={editItem.price_solo}
                                                onChange={(e) => setEditItem({...editItem, price_solo: e.target.value})}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                                placeholder="0.00"
                                                required={editItem.pricing_type === 'dual'}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                                                Whole Price (₱) <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={editItem.price_whole}
                                                onChange={(e) => setEditItem({...editItem, price_whole: e.target.value})}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                                placeholder="0.00"
                                                required={editItem.pricing_type === 'dual'}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                                                Price (₱) <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={editItem.price}
                                                onChange={(e) => setEditItem({...editItem, price: e.target.value})}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                                placeholder="0.00"
                                                required={editItem.pricing_type === 'single'}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-700 mb-1 block">Stock Quantity</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={editItem.stock_quantity}
                                                onChange={(e) => setEditItem({...editItem, stock_quantity: parseInt(e.target.value) || 0})}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-700 mb-1 block">Low Stock Threshold</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={editItem.low_stock_threshold}
                                                onChange={(e) => setEditItem({...editItem, low_stock_threshold: parseInt(e.target.value) || 10})}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-6">
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={editItem.is_available}
                                            onChange={(e) => setEditItem({...editItem, is_available: e.target.checked})}
                                            className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                                        />
                                        <span className="ml-2 text-sm text-gray-700">Available for sale</span>
                                    </label>
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={editItem.is_featured}
                                            onChange={(e) => setEditItem({...editItem, is_featured: e.target.checked})}
                                            className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded"
                                        />
                                        <span className="ml-2 text-sm text-gray-700">Featured item</span>
                                    </label>
                                </div>
                            </div>
                            
                            <div className="mt-6 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowEditItemModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center"
                                    disabled={loading.type === 'update-item'}
                                >
                                    {loading.type === 'update-item' ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                        <Save className="h-4 w-4 mr-2" />
                                    )}
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {/* Add Subcategory Modal */}
            {showAddSubcategoryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 animate-scale-in">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
                            <div className="flex items-center">
                                <div className="p-2 bg-purple-100 rounded-lg mr-3">
                                    <Plus className="h-5 w-5 text-purple-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">New Subcategory</h3>
                            </div>
                            <button 
                                onClick={() => setShowAddSubcategoryModal(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <form onSubmit={handleAddSubcategory} className="p-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                                        Subcategory Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={newSubcategory.name}
                                        onChange={(e) => setNewSubcategory({...newSubcategory, name: e.target.value})}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        placeholder="e.g., Appetizers, Main Course"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
                                    <textarea
                                        value={newSubcategory.description}
                                        onChange={(e) => setNewSubcategory({...newSubcategory, description: e.target.value})}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        rows="3"
                                        placeholder="Brief description of this subcategory..."
                                    />
                                </div>
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="add_is_kitchen_category_sub"
                                        checked={newSubcategory.is_kitchen_category}
                                        onChange={(e) => setNewSubcategory({...newSubcategory, is_kitchen_category: e.target.checked})}
                                        className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor="add_is_kitchen_category_sub" className="ml-2 text-sm text-gray-700">
                                        Kitchen Category (items prepared in kitchen)
                                    </label>
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAddSubcategoryModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors flex items-center"
                                    disabled={loading.type === 'add-subcategory'}
                                >
                                    {loading.type === 'add-subcategory' ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                        <Save className="h-4 w-4 mr-2" />
                                    )}
                                    Create Subcategory
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {/* Edit Subcategory Modal */}
            {showEditSubcategoryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 animate-scale-in">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
                            <div className="flex items-center">
                                <div className="p-2 bg-purple-100 rounded-lg mr-3">
                                    <Edit className="h-5 w-5 text-purple-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">Edit Subcategory</h3>
                            </div>
                            <button 
                                onClick={() => setShowEditSubcategoryModal(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateSubcategory} className="p-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                                        Subcategory Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={editSubcategory.name}
                                        onChange={(e) => setEditSubcategory({...editSubcategory, name: e.target.value})}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
                                    <textarea
                                        value={editSubcategory.description}
                                        onChange={(e) => setEditSubcategory({...editSubcategory, description: e.target.value})}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        rows="3"
                                    />
                                </div>
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="edit_is_kitchen_category_sub"
                                        checked={editSubcategory.is_kitchen_category}
                                        onChange={(e) => setEditSubcategory({...editSubcategory, is_kitchen_category: e.target.checked})}
                                        className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor="edit_is_kitchen_category_sub" className="ml-2 text-sm text-gray-700">
                                        Kitchen Category
                                    </label>
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowEditSubcategoryModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors flex items-center"
                                    disabled={loading.type === 'update-subcategory'}
                                >
                                    {loading.type === 'update-subcategory' ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                        <Save className="h-4 w-4 mr-2" />
                                    )}
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {/* Add custom animations to Tailwind */}
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
                
                @keyframes scale-in {
                    from {
                        transform: scale(0.95);
                        opacity: 0;
                    }
                    to {
                        transform: scale(1);
                        opacity: 1;
                    }
                }
                
                .animate-slide-in {
                    animation: slide-in 0.3s ease-out;
                }
                
                .animate-scale-in {
                    animation: scale-in 0.2s ease-out;
                }
            `}</style>

            {/* FoodItemForm Modal */}
            {showItemForm && (
                <FoodItemForm
                    item={selectedItem}
                    categories={isKitchenRestoRole
                        ? categories.filter(c => c.is_kitchen_category)
                        : categories}
                    ingredients={ingredients}
                    onSave={handleSaveItem}
                    onClose={() => {
                        setShowItemForm(false);
                        setSelectedItem(null);
                    }}
                />
            )}
        </AdminLayout>
    );
}   
