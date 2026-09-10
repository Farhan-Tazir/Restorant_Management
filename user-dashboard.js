// user-dashboard.js - Interactive User Dashboard Logic (Connected to Shared Store & SQL API)

const API_BASE = '/api';

window.handleLogout = function() {
    if (window.HotalStore) window.HotalStore.logoutUser();
    window.location.href = 'login.html';
};

document.addEventListener('DOMContentLoaded', () => {
    initTabNavigation();
    initUserProfile();
    initOrdersData();
    initFavoritesGrid();
    initOrderTracker();
    initMobileNav();

    // Event listeners for live real-time updates across tabs/windows
    window.addEventListener('storage', (e) => {
        if (e.key === 'hotal_orders') {
            initOrdersData();
            initOrderTracker();
        }
        if (e.key === 'hotal_current_user') {
            initUserProfile();
        }
    });

    window.addEventListener('hotal_orders_updated', () => {
        initOrdersData();
        initOrderTracker();
    });

    window.addEventListener('hotal_current_user_updated', () => {
        initUserProfile();
    });
});

// Tab Switching Mechanism
function initTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });
}

function switchTab(tabId) {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(btn => {
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    tabPanes.forEach(pane => {
        if (pane.id === `tab-${tabId}`) {
            pane.classList.add('active');
        } else {
            pane.classList.remove('active');
        }
    });
}

// User Profile Management
async function initUserProfile() {
    const form = document.querySelector('#user-profile-form');
    let currentUser = window.HotalStore ? window.HotalStore.getCurrentUser() : null;
    
    // Attempt fetch from SQL REST API backend if available
    if (currentUser && currentUser.id) {
        try {
            const response = await fetch(`${API_BASE}/user/profile?userId=${currentUser.id}`);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.user) {
                    currentUser = {
                        ...currentUser,
                        full_name: data.user.full_name,
                        email: data.user.email,
                        phone: data.user.phone,
                        preferred_payment: data.user.preferred_payment,
                        address: data.user.address,
                        reward_points: data.user.reward_points,
                        loyalty_badge: data.user.loyalty_badge
                    };
                }
            }
        } catch (err) {
            console.log('[Dashboard] API offline, using local store profile');
        }
    }

    if (!currentUser) {
        currentUser = {
            id: 'user-1',
            full_name: 'Farhan Tazir',
            email: 'farhan@example.com',
            phone: '+92 310 3546086',
            preferred_payment: 'Cash on Delivery',
            address: 'House #12, Hotel Springs Avenue, Block 5, City',
            reward_points: 480,
            loyalty_badge: 'Gold Member'
        };
    }

    updateProfileUI(currentUser);

    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const newName = document.querySelector('#prof-name').value.trim();
            const newEmail = document.querySelector('#prof-email').value.trim();
            const newPhone = document.querySelector('#prof-phone').value.trim();
            const newPayment = document.querySelector('#prof-payment').value;
            const newAddress = document.querySelector('#prof-address').value.trim();
            const newPass = document.querySelector('#new-pass') ? document.querySelector('#new-pass').value : '';
            const confirmPass = document.querySelector('#confirm-new-pass') ? document.querySelector('#confirm-new-pass').value : '';

            if (newPass) {
                if (newPass !== confirmPass) {
                    showToast('New passwords do not match!', 'danger');
                    return;
                }
                if (newPass.length < 6) {
                    showToast('Password must be at least 6 characters.', 'danger');
                    return;
                }
                if (window.HotalStore) {
                    window.HotalStore.resetPasswordByPhone(newPhone || currentUser.phone, newPass);
                }
            }

            const updatedData = {
                full_name: newName,
                email: newEmail,
                phone: newPhone,
                preferred_payment: newPayment,
                address: newAddress
            };

            // Save in local store
            if (window.HotalStore) {
                window.HotalStore.updateUserProfile(currentUser.id, updatedData);
            }

            // Send PUT request to backend API
            try {
                await fetch(`${API_BASE}/user/profile`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUser.id, ...updatedData })
                });
            } catch (err) {}

            showToast('Profile & Settings updated successfully!');
            if (document.querySelector('#new-pass')) document.querySelector('#new-pass').value = '';
            if (document.querySelector('#confirm-new-pass')) document.querySelector('#confirm-new-pass').value = '';
            updateProfileUI({ ...currentUser, ...updatedData });
        };
    }
}

function updateProfileUI(profile) {
    const navAvatar = document.querySelector('#nav-avatar-initial');
    const navUser = document.querySelector('#nav-username');
    const heroAvatar = document.querySelector('#hero-avatar');
    const heroUser = document.querySelector('#hero-username');
    const rewardPts = document.querySelector('#stat-reward-points');
    const loyaltyBadge = document.querySelector('#hero-loyalty-badge');

    const name = profile.full_name || profile.name || 'Farhan Tazir';
    const initial = name.charAt(0).toUpperCase() || 'F';

    if (navAvatar) navAvatar.textContent = initial;
    if (heroAvatar) heroAvatar.textContent = initial;
    if (navUser) navUser.textContent = name.split(' ')[0];
    if (heroUser) heroUser.textContent = name;
    if (rewardPts) rewardPts.textContent = profile.reward_points || profile.rewardPoints || 480;
    if (loyaltyBadge) loyaltyBadge.innerHTML = `<i class='bx bxs-star'></i> ${profile.loyalty_badge || profile.loyaltyBadge || 'Gold Member'}`;

    const profName = document.querySelector('#prof-name');
    const profEmail = document.querySelector('#prof-email');
    const profPhone = document.querySelector('#prof-phone');
    const profPayment = document.querySelector('#prof-payment');
    const profAddress = document.querySelector('#prof-address');

    if (profName) profName.value = name;
    if (profEmail) profEmail.value = profile.email || '';
    if (profPhone) profPhone.value = profile.phone || '';
    if (profPayment) profPayment.value = profile.preferred_payment || profile.payment || 'Cash on Delivery';
    if (profAddress) profAddress.value = profile.address || '';
}

// Populate Orders List in Overview and Orders Tab
async function initOrdersData() {
    const overviewRecentBody = document.querySelector('#overview-recent-orders-list');
    const fullOrdersBody = document.querySelector('#full-orders-list');

    if (!overviewRecentBody && !fullOrdersBody) return;

    const currentUser = window.HotalStore ? window.HotalStore.getCurrentUser() : null;
    let userOrders = window.HotalStore ? window.HotalStore.getUserOrders(currentUser ? currentUser.id : null) : [];

    // Attempt backend API fetch
    if (currentUser && currentUser.id) {
        try {
            const res = await fetch(`${API_BASE}/user/orders?userId=${currentUser.id}`);
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.orders && data.orders.length > 0) {
                    userOrders = data.orders.map(o => ({
                        id: o.order_number || `HTL-${o.id}`,
                        date: new Date(o.created_at).toLocaleDateString() + ', ' + new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        type: o.order_type || 'delivery',
                        table_number: o.table_number || '',
                        delivery_address: o.delivery_address || '',
                        items: o.items ? o.items.map(i => `${i.quantity}x ${i.item_name || i.menuItemId}`).join(', ') : 'Custom Order',
                        total: parseFloat(o.total_amount || 0),
                        status: o.status,
                        payment_status: o.payment_status || 'pending',
                        payment_method: o.payment_method || 'Cash on Delivery'
                    }));
                }
            }
        } catch (e) {}
    }

    const activeCountEl = document.querySelector('#stat-active-orders');
    const completedCountEl = document.querySelector('#stat-completed-orders');

    if (activeCountEl) {
        const activeCount = userOrders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length;
        activeCountEl.textContent = activeCount;
    }
    if (completedCountEl) {
        const completedCount = userOrders.filter(o => o.status === 'completed').length;
        completedCountEl.textContent = completedCount;
    }

    const formatStatusBadge = (status) => {
        if (status === 'pending') return `<span class="status-badge preparing" style="background: rgba(230, 126, 34, 0.2); color: #e67e22;"><i class='bx bx-time'></i> Pending Acceptance</span>`;
        if (status === 'preparing' || status === 'accepted') return `<span class="status-badge preparing"><i class='bx bx-loader-alt bx-spin'></i> Preparing Food</span>`;
        if (status === 'out_for_delivery') return `<span class="status-badge preparing" style="background: rgba(155, 89, 182, 0.2); color: #9b59b6;"><i class='bx bx-cycling'></i> Out for Delivery</span>`;
        if (status === 'completed') return `<span class="status-badge delivered"><i class='bx bx-check-circle'></i> Delivered</span>`;
        return `<span class="status-badge delivered">${status}</span>`;
    };

    // Overview tab recent orders (Top 3)
    if (overviewRecentBody) {
        overviewRecentBody.innerHTML = userOrders.slice(0, 3).map(order => `
            <tr>
                <td class="order-id-tag">#${order.id || order.order_number}</td>
                <td>${order.date || new Date(order.created_at).toLocaleDateString()}</td>
                <td style="max-width: 220px;">${order.items || (order.items_summary ? order.items_summary : 'Selected Items')}</td>
                <td style="font-weight: 600; color: var(--main-color);">$${parseFloat(order.total_amount || order.total || 0).toFixed(2)}</td>
                <td>${formatStatusBadge(order.status)}</td>
                <td>
                    <button class="action-btn-sm" onclick="reorderItems('${order.id || order.order_number}')">
                        <i class='bx bx-refresh'></i> Re-order
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // Full orders tab
    if (fullOrdersBody) {
        fullOrdersBody.innerHTML = userOrders.map(order => `
            <tr>
                <td class="order-id-tag">#${order.id || order.order_number}</td>
                <td>${order.date || new Date(order.created_at).toLocaleDateString()}</td>
                <td><span style="font-size: 0.85rem; background: #252525; padding: 3px 8px; border-radius: 6px; text-transform: uppercase;">${order.type || order.order_type || 'Delivery'}</span></td>
                <td style="max-width: 220px;">${order.items || 'Food Items'}</td>
                <td>
                    <strong style="color: var(--main-color);">$${parseFloat(order.total_amount || order.total || 0).toFixed(2)}</strong><br>
                    <small style="color: ${order.payment_status === 'paid' ? '#2ecc71' : '#e67e22'}; font-weight: 500;">
                        ${order.payment_status === 'paid' ? 'PAID' : 'UNPAID'} (${order.payment_method || 'COD'})
                    </small>
                </td>
                <td>${formatStatusBadge(order.status)}</td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="action-btn-sm" onclick="reorderItems('${order.id || order.order_number}')">
                            <i class='bx bx-refresh'></i> Re-order
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
}

// Populate Favorite Dishes Grid
async function initFavoritesGrid() {
    const container = document.querySelector('#favorites-container');
    if (!container) return;

    let items = [];
    if (window.HotalStore && typeof window.HotalStore.getItems === 'function') {
        items = window.HotalStore.getItems();
    }

    if (!items || items.length === 0) {
        items = [
            { id: 'item-1', name: 'Burger', price: 12.00, description: 'Juicy grilled beef patty with fresh lettuce, tomato, cheese and signature sauce.', image: 'images/burger-removebg-preview.png' },
            { id: 'item-2', name: 'Large Pizza', price: 18.50, description: 'Cheesy pizza topped with fresh pepperoni, veggies, and classic marinara sauce.', image: 'images/pizza-removebg-preview.png' },
            { id: 'item-3', name: 'Sekh Kabab', price: 14.00, description: 'Tender charcoal-grilled spiced meat skewers served with mint chutney.', image: 'images/sekh_kabak-removebg-preview.png' },
            { id: 'item-4', name: 'Shawarma', price: 9.99, description: 'Flavorful wrapped spiced chicken with garlic sauce, veggies, and pickles.', image: 'images/shawarma-removebg-preview.png' }
        ];
    }

    container.innerHTML = items.map(item => `
        <div class="fav-card">
            <div class="fav-img-wrapper">
                <button class="fav-heart-btn" onclick="toggleFavorite(this)" title="Toggle Favorite">
                    <i class='bx bxs-heart'></i>
                </button>
                <img src="${item.image || item.image_url || 'images/fast-food.png'}" alt="${item.name}" onerror="this.src='images/fast-food.png'">
            </div>
            <div class="fav-details">
                <h3>${item.name}</h3>
                <p>${item.description || 'Delicious freshly prepared dish.'}</p>
                <div class="fav-bottom">
                    <span class="fav-price">$${parseFloat(item.price).toFixed(2)}</span>
                    <a href="order-form.html" class="action-btn-sm" style="background: var(--main-color); color: var(--bg-color); border: none;">
                        <i class='bx bx-cart-add'></i> Order Now
                    </a>
                </div>
            </div>
        </div>
    `).join('');

    const favStat = document.querySelector('#stat-fav-items');
    if (favStat) favStat.textContent = items.length;
}

// Live Order Tracker Progress Stepper Logic
function initOrderTracker() {
    const currentUser = window.HotalStore ? window.HotalStore.getCurrentUser() : null;
    const activeOrder = window.HotalStore ? window.HotalStore.getLatestActiveOrder(currentUser ? currentUser.id : null) : null;

    const badge = document.querySelector('#tracker-status-badge');
    const progressBar = document.querySelector('#stepper-progress-bar');
    const orderIdEl = document.querySelector('#tracker-order-id');
    const itemsCountEl = document.querySelector('#tracker-order-item-count');
    const itemsListEl = document.querySelector('#tracker-order-items-list');
    const totalEl = document.querySelector('#tracker-order-total');
    const paymentStatusEl = document.querySelector('#tracker-payment-status-badge');
    const orderTypeDetailsEl = document.querySelector('#tracker-order-type-details');
    const previewImg = document.querySelector('#tracker-item-img');

    if (!activeOrder) {
        if (badge) {
            badge.className = 'status-badge delivered';
            badge.innerHTML = `<i class='bx bx-check-circle'></i> No Active Orders`;
        }
        if (progressBar) progressBar.style.width = '0%';
        if (orderIdEl) orderIdEl.innerHTML = `No Active Order`;
        if (itemsListEl) itemsListEl.textContent = 'Place an order on our menu to track your meal in real-time!';
        return;
    }

    const status = activeOrder.status; // pending, accepted, preparing, out_for_delivery, completed
    let currentStep = 1;

    if (status === 'pending') {
        currentStep = 1;
        if (badge) {
            badge.className = 'status-badge preparing';
            badge.style.background = 'rgba(230, 126, 34, 0.2)';
            badge.style.color = '#e67e22';
            badge.innerHTML = `<i class='bx bx-time bx-spin'></i> Order Placed (Awaiting Admin Acceptance)`;
        }
    } else if (status === 'preparing' || status === 'accepted') {
        currentStep = 2;
        if (badge) {
            badge.className = 'status-badge preparing';
            badge.style.background = 'rgba(52, 152, 219, 0.2)';
            badge.style.color = '#3498db';
            badge.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> Chef is Preparing Your Food`;
        }
    } else if (status === 'out_for_delivery') {
        currentStep = 3;
        if (badge) {
            badge.className = 'status-badge preparing';
            badge.style.background = 'rgba(155, 89, 182, 0.2)';
            badge.style.color = '#9b59b6';
            badge.innerHTML = `<i class='bx bx-cycling bx-flashing'></i> Out for Delivery / Ready`;
        }
    } else if (status === 'completed') {
        currentStep = 4;
        if (badge) {
            badge.className = 'status-badge delivered';
            badge.innerHTML = `<i class='bx bx-check-circle'></i> Order Delivered & Enjoy!`;
        }
    }

    updateTrackerProgress(currentStep);

    // Populate order details in tracker
    if (orderIdEl) orderIdEl.innerHTML = `Order #${activeOrder.order_number || activeOrder.id}`;
    
    const items = activeOrder.items || [];
    if (itemsCountEl) itemsCountEl.textContent = `(${items.length} Items)`;
    if (itemsListEl) {
        itemsListEl.textContent = items.map(i => `${i.quantity}x ${i.item_name || i.menuItemId}`).join(', ') || 'Selected Food Items';
    }
    if (totalEl) totalEl.textContent = `$${parseFloat(activeOrder.total_amount || 0).toFixed(2)}`;
    
    if (paymentStatusEl) {
        const isPaid = activeOrder.payment_status === 'paid';
        paymentStatusEl.style.color = isPaid ? '#2ecc71' : '#e67e22';
        paymentStatusEl.innerHTML = `<i class='bx ${isPaid ? 'bx-check-circle' : 'bx-time'}'></i> Payment: ${isPaid ? 'PAID' : 'PENDING'} (${activeOrder.payment_method || 'COD'})`;
    }

    if (orderTypeDetailsEl) {
        let typeStr = `Type: ${activeOrder.order_type ? activeOrder.order_type.toUpperCase() : 'DELIVERY'}`;
        if (activeOrder.order_type === 'dine_in' && activeOrder.table_number) typeStr += ` (${activeOrder.table_number})`;
        if (activeOrder.order_type === 'delivery' && activeOrder.delivery_address) typeStr += ` -> Address: ${activeOrder.delivery_address}`;
        orderTypeDetailsEl.textContent = typeStr;
    }

    if (previewImg && items.length > 0) {
        const firstItemName = (items[0].item_name || '').toLowerCase();
        if (firstItemName.includes('pizza')) previewImg.src = 'images/pizza-removebg-preview.png';
        else if (firstItemName.includes('kabab')) previewImg.src = 'images/sekh_kabak-removebg-preview.png';
        else if (firstItemName.includes('shawarma')) previewImg.src = 'images/shawarma-removebg-preview.png';
        else previewImg.src = 'images/burger-removebg-preview.png';
    }
}

function updateTrackerProgress(step) {
    const progressBar = document.querySelector('#stepper-progress-bar');
    const percentages = { 1: '15%', 2: '45%', 3: '75%', 4: '100%' };
    if (progressBar) progressBar.style.width = percentages[step] || '25%';

    for (let i = 1; i <= 4; i++) {
        const stepEl = document.querySelector(`#step-${i}`);
        if (!stepEl) continue;

        if (i < step) {
            stepEl.className = 'step-item completed';
        } else if (i === step) {
            stepEl.className = 'step-item active';
        } else {
            stepEl.className = 'step-item';
        }
    }
}

// Re-order Action
window.reorderItems = function(orderId) {
    showToast(`Order #${orderId} items loaded into checkout! Redirecting...`);
    setTimeout(() => {
        window.location.href = 'order-form.html';
    }, 1000);
};

// Favorite Heart Toggle
window.toggleFavorite = function(btn) {
    const icon = btn.querySelector('i');
    if (icon.classList.contains('bxs-heart')) {
        icon.className = 'bx bx-heart';
        btn.style.color = 'var(--second-color)';
        showToast('Removed from favorites');
    } else {
        icon.className = 'bx bxs-heart';
        btn.style.color = '#e74c3c';
        showToast('Added to favorites!');
    }
};

// Simple Toast Notification
function showToast(message, type = 'info') {
    let toast = document.querySelector('#dashboard-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'dashboard-toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: #222;
            color: var(--text-color);
            border: 1px solid var(--main-color);
            padding: 14px 24px;
            border-radius: 12px;
            font-size: 0.95rem;
            font-weight: 500;
            box-shadow: 0 8px 25px rgba(0,0,0,0.5);
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 10px;
            transition: all 0.4s ease;
            opacity: 0;
            transform: translateY(20px);
        `;
        document.body.appendChild(toast);
    }

    const iconClass = type === 'danger' ? 'bx-x-circle' : 'bx-info-circle';
    const iconColor = type === 'danger' ? '#e74c3c' : 'var(--main-color)';

    toast.innerHTML = `<i class='bx ${iconClass}' style="color: ${iconColor}; font-size: 1.3rem;"></i> ${message}`;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
    }, 3200);
}

// Mobile Nav Toggle
function initMobileNav() {
    const menuIcon = document.querySelector('#menu-icon');
    const navlist = document.querySelector('.navlist');

    if (menuIcon && navlist) {
        menuIcon.addEventListener('click', () => {
            menuIcon.classList.toggle('bx-x');
            navlist.classList.toggle('open');
        });

        window.addEventListener('scroll', () => {
            menuIcon.classList.remove('bx-x');
            navlist.classList.remove('open');
        });
    }
}
