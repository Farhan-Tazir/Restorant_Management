// items-store.js - Shared Data Store for Restaurant Menu Items, Users, Orders & Payments

const DEFAULT_ITEMS = [
    {
        id: 'item-1',
        name: 'Burger',
        category: 'Fast Food',
        price: 12.00,
        description: 'Juicy grilled beef patty with fresh lettuce, tomato, cheese and signature sauce.',
        image: 'images/burger-removebg-preview.png',
        isAvailable: true,
        isFeatured: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'item-2',
        name: 'Large Pizza',
        category: 'Pizza',
        price: 18.50,
        description: 'Cheesy pizza topped with fresh pepperoni, veggies, and classic marinara sauce.',
        image: 'images/pizza-removebg-preview.png',
        isAvailable: true,
        isFeatured: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'item-3',
        name: 'Sekh Kabab',
        category: 'Grill',
        price: 14.00,
        description: 'Tender charcoal-grilled spiced meat skewers served with mint chutney.',
        image: 'images/sekh_kabak-removebg-preview.png',
        isAvailable: true,
        isFeatured: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'item-4',
        name: 'Shawarma',
        category: 'Fast Food',
        price: 9.99,
        description: 'Flavorful wrapped spiced chicken with garlic sauce, veggies, and pickles.',
        image: 'images/shawarma-removebg-preview.png',
        isAvailable: true,
        isFeatured: true,
        createdAt: new Date().toISOString()
    }
];

const DEFAULT_USERS = [
    {
        id: 'user-1',
        full_name: 'Farhan Tazir',
        email: 'farhan@example.com',
        phone: '+92 310 3546086',
        password: 'password123',
        role: 'customer',
        address: 'House #12, Hotel Springs Avenue, Block 5, City',
        preferred_payment: 'Cash on Delivery',
        reward_points: 480,
        loyalty_badge: 'Gold Member',
        created_at: new Date().toISOString()
    },
    {
        id: 'user-admin',
        full_name: 'Admin Manager',
        email: 'admin@example.com',
        phone: '+92 300 1234567',
        password: 'admin123',
        role: 'admin',
        address: 'Restaurant Headquarters, Suite 101',
        preferred_payment: 'Corporate Account',
        reward_points: 9999,
        loyalty_badge: 'Super Administrator',
        created_at: new Date().toISOString()
    }
];

const DEFAULT_ORDERS = [
    {
        id: 'HTL-9402',
        order_number: 'HTL-9402',
        user_id: 'user-1',
        customer_name: 'Farhan Tazir',
        phone: '+92 310 3546086',
        order_type: 'delivery',
        table_number: '',
        delivery_address: 'House #12, Hotel Springs Avenue, Block 5, City',
        status: 'out_for_delivery', // pending, accepted, preparing, out_for_delivery, completed, cancelled
        payment_method: 'Cash on Delivery',
        payment_status: 'pending', // pending, paid, refunded
        subtotal: 30.50,
        delivery_fee: 2.00,
        total_amount: 32.50,
        created_at: new Date().toISOString(),
        items: [
            { item_name: 'Burger', quantity: 1, unit_price: 12.00 },
            { item_name: 'Large Pizza', quantity: 1, unit_price: 18.50 }
        ]
    },
    {
        id: 'HTL-8910',
        order_number: 'HTL-8910',
        user_id: 'user-1',
        customer_name: 'Farhan Tazir',
        phone: '+92 310 3546086',
        order_type: 'dine_in',
        table_number: 'Table #05',
        delivery_address: '',
        status: 'completed',
        payment_method: 'Credit / Debit Card',
        payment_status: 'paid',
        subtotal: 34.00,
        delivery_fee: 0.00,
        total_amount: 34.00,
        created_at: new Date(Date.now() - 86400000).toISOString(),
        items: [
            { item_name: 'Sekh Kabab', quantity: 2, unit_price: 14.00 },
            { item_name: 'Soft Drink', quantity: 2, unit_price: 3.00 }
        ]
    }
];

const ITEMS_STORAGE_KEY = 'hotal_items';
const USERS_STORAGE_KEY = 'hotal_users';
const CURRENT_USER_KEY = 'hotal_current_user';
const ORDERS_STORAGE_KEY = 'hotal_orders';

// --- MENU ITEMS STORE ---
function getItems() {
    try {
        const stored = localStorage.getItem(ITEMS_STORAGE_KEY);
        if (!stored) {
            localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(DEFAULT_ITEMS));
            return DEFAULT_ITEMS;
        }
        return JSON.parse(stored);
    } catch (e) {
        console.error('Error reading items from localStorage:', e);
        return DEFAULT_ITEMS;
    }
}

function saveItems(items) {
    try {
        localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(items));
        window.dispatchEvent(new CustomEvent('hotal_items_updated', { detail: items }));
    } catch (e) {
        console.error('Error saving items to localStorage:', e);
    }
}

function addItem(itemData) {
    const items = getItems();
    const newItem = {
        id: 'item-' + Date.now(),
        name: itemData.name.trim(),
        category: itemData.category || 'General',
        price: parseFloat(itemData.price) || 0,
        description: itemData.description || '',
        image: itemData.image || 'images/fast-food.png',
        isAvailable: itemData.isAvailable !== false,
        isFeatured: !!itemData.isFeatured,
        createdAt: new Date().toISOString()
    };
    items.unshift(newItem);
    saveItems(items);
    return newItem;
}

function updateItem(id, itemData) {
    const items = getItems();
    const index = items.findIndex(item => item.id === id);
    if (index !== -1) {
        items[index] = {
            ...items[index],
            name: itemData.name.trim(),
            category: itemData.category || items[index].category,
            price: parseFloat(itemData.price) || 0,
            description: itemData.description || '',
            image: itemData.image || items[index].image,
            isAvailable: itemData.isAvailable !== undefined ? itemData.isAvailable : items[index].isAvailable,
            isFeatured: itemData.isFeatured !== undefined ? itemData.isFeatured : items[index].isFeatured,
            updatedAt: new Date().toISOString()
        };
        saveItems(items);
        return items[index];
    }
    return null;
}

function toggleItemAvailability(id) {
    const items = getItems();
    const item = items.find(i => i.id === id);
    if (item) {
        item.isAvailable = !item.isAvailable;
        saveItems(items);
        return item;
    }
    return null;
}

function removeItem(id) {
    let items = getItems();
    items = items.filter(item => item.id !== id);
    saveItems(items);
}

function resetDefaultItems() {
    saveItems(DEFAULT_ITEMS);
    return DEFAULT_ITEMS;
}

// --- USERS & AUTHENTICATION STORE ---
function getUsers() {
    try {
        const stored = localStorage.getItem(USERS_STORAGE_KEY);
        if (!stored) {
            localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
            return DEFAULT_USERS;
        }
        return JSON.parse(stored);
    } catch (e) {
        return DEFAULT_USERS;
    }
}

function saveUsers(users) {
    try {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
        window.dispatchEvent(new CustomEvent('hotal_users_updated', { detail: users }));
    } catch (e) {
        console.error('Error saving users:', e);
    }
}

function registerUser(userData) {
    const users = getUsers();
    const existingEmail = users.find(u => u.email.toLowerCase() === userData.email.toLowerCase());
    if (existingEmail) {
        throw new Error('An account with this email address already exists!');
    }

    const newUser = {
        id: 'user-' + Date.now(),
        full_name: userData.full_name.trim(),
        email: userData.email.trim().toLowerCase(),
        phone: userData.phone ? userData.phone.trim() : '',
        password: userData.password,
        role: userData.role || 'customer',
        address: userData.address || '',
        preferred_payment: 'Cash on Delivery',
        reward_points: 100,
        loyalty_badge: 'Silver Member',
        created_at: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers(users);
    return newUser;
}

function loginUser(identifier, password) {
    const users = getUsers();
    const term = identifier.trim().toLowerCase();
    const user = users.find(u => 
        (u.email.toLowerCase() === term || (u.phone && u.phone.replace(/\s+/g, '') === term.replace(/\s+/g, ''))) &&
        u.password === password
    );

    if (!user) {
        throw new Error('Invalid email/phone or password');
    }

    setCurrentUser(user);
    return user;
}

function getCurrentUser() {
    try {
        const stored = localStorage.getItem(CURRENT_USER_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && (parsed.id || parsed.email)) {
                return parsed;
            }
        }
    } catch (e) {}
    // Strict authentication: Return null if nobody is logged in. Never fallback to default users.
    return null;
}

function isLoggedIn() {
    const user = getCurrentUser();
    return Boolean(user && (user.id || user.email));
}

function isAdmin() {
    const user = getCurrentUser();
    if (!user) return false;
    return Boolean(user.role === 'admin' || (user.email && user.email.toLowerCase() === 'admin@example.com'));
}

function getAuthHeaders() {
    const user = getCurrentUser();
    const headers = { 'Content-Type': 'application/json' };
    if (user && user.token) {
        headers['Authorization'] = `Bearer ${user.token}`;
    }
    return headers;
}

function setCurrentUser(user) {
    try {
        if (!user) {
            localStorage.removeItem(CURRENT_USER_KEY);
        } else {
            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
        }
        window.dispatchEvent(new CustomEvent('hotal_current_user_updated', { detail: user }));
    } catch (e) {}
}

function logoutUser() {
    try {
        const user = getCurrentUser();
        if (user && user.token) {
            fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                }
            }).catch(() => {});
        }
        localStorage.removeItem(CURRENT_USER_KEY);
        window.dispatchEvent(new CustomEvent('hotal_current_user_updated', { detail: null }));
    } catch (e) {}
}

function verifyPhone(phone) {
    const users = getUsers();
    const normalized = phone.trim().replace(/\s+/g, '');
    const user = users.find(u => u.phone && u.phone.trim().replace(/\s+/g, '') === normalized);
    return user || null;
}

function resetPasswordByPhone(phone, newPassword) {
    const users = getUsers();
    const normalized = phone.trim().replace(/\s+/g, '');
    const userIndex = users.findIndex(u => u.phone && u.phone.trim().replace(/\s+/g, '') === normalized);

    if (userIndex === -1) {
        throw new Error('No account registered with this phone number!');
    }

    users[userIndex].password = newPassword;
    saveUsers(users);

    const currentUser = getCurrentUser();
    if (currentUser && currentUser.id === users[userIndex].id) {
        currentUser.password = newPassword;
        setCurrentUser(currentUser);
    }

    return users[userIndex];
}

function updateUserProfile(userId, profileData) {
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === userId || u.id === Number(userId));

    if (userIndex !== -1) {
        users[userIndex] = {
            ...users[userIndex],
            full_name: profileData.full_name || users[userIndex].full_name,
            email: profileData.email || users[userIndex].email,
            phone: profileData.phone || users[userIndex].phone,
            address: profileData.address || users[userIndex].address,
            preferred_payment: profileData.preferred_payment || users[userIndex].preferred_payment
        };
        saveUsers(users);

        const current = getCurrentUser();
        if (current && (current.id === userId || current.id === Number(userId))) {
            setCurrentUser(users[userIndex]);
        }
        return users[userIndex];
    }
    return null;
}

// --- ORDERS & PAYMENTS STORE ---
function getOrders() {
    try {
        const stored = localStorage.getItem(ORDERS_STORAGE_KEY);
        if (!stored) {
            localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(DEFAULT_ORDERS));
            return DEFAULT_ORDERS;
        }
        return JSON.parse(stored);
    } catch (e) {
        return DEFAULT_ORDERS;
    }
}

function saveOrders(orders) {
    try {
        localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
        window.dispatchEvent(new CustomEvent('hotal_orders_updated', { detail: orders }));
    } catch (e) {
        console.error('Error saving orders:', e);
    }
}

function addOrder(orderData) {
    const orders = getOrders();
    const orderNum = 'HTL-' + Math.floor(1000 + Math.random() * 9000);
    const newOrder = {
        id: orderNum,
        order_number: orderNum,
        user_id: orderData.user_id || (getCurrentUser() ? getCurrentUser().id : 'user-1'),
        customer_name: orderData.customer_name || (getCurrentUser() ? getCurrentUser().full_name : 'Guest'),
        phone: orderData.phone || (getCurrentUser() ? getCurrentUser().phone : ''),
        order_type: orderData.order_type || 'delivery',
        table_number: orderData.table_number || '',
        delivery_address: orderData.delivery_address || '',
        status: 'pending', // pending -> accepted -> preparing -> out_for_delivery -> completed
        payment_method: orderData.payment_method || 'Cash on Delivery',
        payment_status: orderData.payment_method === 'Credit / Debit Card' || orderData.payment_method === 'Online Wallet' ? 'paid' : 'pending',
        subtotal: parseFloat(orderData.subtotal || 0),
        delivery_fee: orderData.order_type === 'delivery' ? 2.00 : 0.00,
        total_amount: parseFloat(orderData.total_amount || 0),
        created_at: new Date().toISOString(),
        items: orderData.items || []
    };

    orders.unshift(newOrder);
    saveOrders(orders);
    return newOrder;
}

function updateOrderStatus(orderId, status) {
    const orders = getOrders();
    const order = orders.find(o => o.id === orderId || o.order_number === orderId || String(o.id) === String(orderId) || String(o.order_number) === String(orderId));
    if (order) {
        order.status = status;
        if (status === 'completed') {
            order.payment_status = 'paid';
        }
        saveOrders(orders);
        return order;
    }
    return null;
}

function updatePaymentStatus(orderId, paymentStatus) {
    const orders = getOrders();
    const order = orders.find(o => o.id === orderId || o.order_number === orderId || String(o.id) === String(orderId) || String(o.order_number) === String(orderId));
    if (order) {
        order.payment_status = paymentStatus;
        saveOrders(orders);
        return order;
    }
    return null;
}

function getUserOrders(userId) {
    const orders = getOrders();
    if (!userId) return orders;
    return orders.filter(o => o.user_id === userId || String(o.user_id) === String(userId));
}

function getLatestActiveOrder(userId) {
    const orders = getUserOrders(userId);
    const active = orders.find(o => o.status !== 'completed' && o.status !== 'cancelled');
    return active || orders[0] || null;
}

// Export functions to global scope
window.HotalStore = {
    getItems,
    saveItems,
    addItem,
    updateItem,
    toggleItemAvailability,
    removeItem,
    resetDefaultItems,
    DEFAULT_ITEMS,
    
    // Auth & Users
    getUsers,
    saveUsers,
    registerUser,
    loginUser,
    getCurrentUser,
    setCurrentUser,
    logoutUser,
    isLoggedIn,
    isAdmin,
    getAuthHeaders,
    verifyPhone,
    resetPasswordByPhone,
    updateUserProfile,

    // Orders & Payments
    getOrders,
    saveOrders,
    addOrder,
    updateOrderStatus,
    updatePaymentStatus,
    getUserOrders,
    getLatestActiveOrder
};
