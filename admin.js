// admin.js - Logic for Hotel Admin Dashboard (Menu & Orders/Payments Management)

// Utility function to escape HTML string safely
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Global Tab Switching Handler
window.switchAdminTab = function(tabName) {
    const menuSection = document.getElementById('admin-menu-section');
    const ordersSection = document.getElementById('admin-orders-section');
    const menuTabBtn = document.getElementById('tab-btn-menu');
    const ordersTabBtn = document.getElementById('tab-btn-orders');

    if (tabName === 'orders') {
        menuSection.style.display = 'none';
        ordersSection.style.display = 'block';
        ordersTabBtn.style.background = 'var(--other-color)';
        ordersTabBtn.style.color = 'var(--main-color)';
        ordersTabBtn.style.borderColor = 'var(--main-color)';
        menuTabBtn.style.background = '#222';
        menuTabBtn.style.color = '#ccc';
        menuTabBtn.style.borderColor = '#444';
        renderAdminOrders();
    } else {
        menuSection.style.display = 'block';
        ordersSection.style.display = 'none';
        menuTabBtn.style.background = 'var(--other-color)';
        menuTabBtn.style.color = 'var(--main-color)';
        menuTabBtn.style.borderColor = 'var(--main-color)';
        ordersTabBtn.style.background = '#222';
        ordersTabBtn.style.color = '#ccc';
        ordersTabBtn.style.borderColor = '#444';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements for Menu
    const itemsGrid = document.getElementById('items-grid');
    const itemsTableWrapper = document.getElementById('items-table-wrapper');
    const itemsTableBody = document.getElementById('items-table-body');
    const emptyState = document.getElementById('empty-state');
    
    // Stats Elements for Menu
    const statTotalItems = document.getElementById('stat-total-items');
    const statInStockItems = document.getElementById('stat-instock-items');
    const statCategories = document.getElementById('stat-categories');
    const statFeatured = document.getElementById('stat-featured');

    // Controls Elements for Menu
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    const viewGridBtn = document.getElementById('view-grid-btn');
    const viewTableBtn = document.getElementById('view-table-btn');
    const openAddModalBtn = document.getElementById('open-add-modal-btn');
    const resetDefaultsBtn = document.getElementById('reset-defaults-btn');
    const emptyAddBtn = document.getElementById('empty-add-btn');

    // Modal Elements for Menu
    const itemModal = document.getElementById('item-modal');
    const modalTitle = document.getElementById('modal-title');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelModalBtn = document.getElementById('cancel-modal-btn');
    const itemForm = document.getElementById('item-form');
    const itemIdInput = document.getElementById('item-id');
    const itemNameInput = document.getElementById('item-name');
    const itemCategorySelect = document.getElementById('item-category');
    const itemPriceInput = document.getElementById('item-price');
    const itemImageInput = document.getElementById('item-image');
    const imagePreview = document.getElementById('image-preview');
    const itemDescriptionInput = document.getElementById('item-description');
    const itemAvailableCheckbox = document.getElementById('item-available');
    const itemFeaturedCheckbox = document.getElementById('item-featured');
    const presetThumbs = document.querySelectorAll('.preset-thumb');

    // Delete Modal Elements
    const deleteModal = document.getElementById('delete-modal');
    const deleteItemName = document.getElementById('delete-item-name');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

    // State Variables
    let currentView = 'grid'; // 'grid' or 'table'
    let itemToDeleteId = null;

    // Toast Notification Helper
    function showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = 'toast';
        
        let icon = 'bx-info-circle';
        if (type === 'success') icon = 'bx-check-circle';
        if (type === 'danger') icon = 'bx-x-circle';

        toast.innerHTML = `<i class='bx ${icon}' style="font-size: 22px; color: var(--main-color)"></i> <span>${message}</span>`;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // --- MENU ITEMS MANAGEMENT LOGIC ---

    function updateStats(items) {
        if (statTotalItems) statTotalItems.textContent = items.length;
        if (statInStockItems) statInStockItems.textContent = items.filter(i => i.isAvailable).length;
        if (statCategories) statCategories.textContent = new Set(items.map(i => i.category)).size;
        if (statFeatured) statFeatured.textContent = items.filter(i => i.isFeatured).length;
    }

    function getFilteredItems() {
        const items = window.HotalStore.getItems();
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const selectedCategory = categoryFilter ? categoryFilter.value : 'ALL';

        return items.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchTerm) || 
                                  item.category.toLowerCase().includes(searchTerm) ||
                                  (item.description && item.description.toLowerCase().includes(searchTerm));
            
            const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;

            return matchesSearch && matchesCategory;
        });
    }

    function renderMenu() {
        if (!itemsGrid) return;
        const items = window.HotalStore.getItems();
        updateStats(items);

        const filteredItems = getFilteredItems();

        if (filteredItems.length === 0) {
            itemsGrid.style.display = 'none';
            if (itemsTableWrapper) itemsTableWrapper.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        if (currentView === 'grid') {
            itemsGrid.style.display = 'grid';
            if (itemsTableWrapper) itemsTableWrapper.style.display = 'none';
            renderGridView(filteredItems);
        } else {
            itemsGrid.style.display = 'none';
            if (itemsTableWrapper) itemsTableWrapper.style.display = 'block';
            renderTableView(filteredItems);
        }
    }

    function renderGridView(items) {
        itemsGrid.innerHTML = items.map(item => `
            <div class="item-card" data-id="${item.id}">
                <div class="item-card-header">
                    <span class="badge-category">${escapeHtml(item.category)}</span>
                    <span class="status-badge ${item.isAvailable ? 'available' : 'unavailable'}">
                        <i class='bx ${item.isAvailable ? 'bx-check' : 'bx-x'}'></i>
                        ${item.isAvailable ? 'In Stock' : 'Out of Stock'}
                    </span>
                </div>

                <div class="item-image-wrapper">
                    <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" onerror="this.src='images/fast-food.png'">
                </div>

                <div class="item-details">
                    <h3>${escapeHtml(item.name)}</h3>
                    <p>${escapeHtml(item.description || 'No description provided.')}</p>
                </div>

                <div class="item-bottom">
                    <div class="item-price">$${item.price.toFixed(2)}</div>
                    <div class="item-actions">
                        <button class="icon-btn toggle-btn" onclick="handleToggleStock('${item.id}')" title="Toggle Stock Availability">
                            <i class='bx ${item.isAvailable ? 'bx-hide' : 'bx-show'}'></i>
                        </button>
                        <button class="icon-btn edit-btn" onclick="handleEditModal('${item.id}')" title="Edit Item">
                            <i class='bx bx-edit'></i>
                        </button>
                        <button class="icon-btn delete-btn" onclick="handleDeletePrompt('${item.id}', '${escapeHtml(item.name)}')" title="Delete Item">
                            <i class='bx bx-trash'></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function renderTableView(items) {
        if (!itemsTableBody) return;
        itemsTableBody.innerHTML = items.map(item => `
            <tr>
                <td>
                    <img src="${escapeHtml(item.image)}" class="table-img" alt="${escapeHtml(item.name)}" onerror="this.src='images/fast-food.png'">
                </td>
                <td><strong>${escapeHtml(item.name)}</strong></td>
                <td><span class="badge-category">${escapeHtml(item.category)}</span></td>
                <td><strong style="color: var(--main-color);">$${item.price.toFixed(2)}</strong></td>
                <td>
                    <span class="status-badge ${item.isAvailable ? 'available' : 'unavailable'}">
                        ${item.isAvailable ? 'Available' : 'Unavailable'}
                    </span>
                </td>
                <td>${item.isFeatured ? '<i class="bx bxs-star" style="color: var(--main-color);"></i> Yes' : 'No'}</td>
                <td>
                    <div class="item-actions">
                        <button class="icon-btn toggle-btn" onclick="handleToggleStock('${item.id}')" title="Toggle Availability">
                            <i class='bx ${item.isAvailable ? 'bx-hide' : 'bx-show'}'></i>
                        </button>
                        <button class="icon-btn edit-btn" onclick="handleEditModal('${item.id}')" title="Edit">
                            <i class='bx bx-edit'></i>
                        </button>
                        <button class="icon-btn delete-btn" onclick="handleDeletePrompt('${item.id}', '${escapeHtml(item.name)}')" title="Delete">
                            <i class='bx bx-trash'></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    if (viewGridBtn) {
        viewGridBtn.addEventListener('click', () => {
            currentView = 'grid';
            viewGridBtn.classList.add('active');
            if (viewTableBtn) viewTableBtn.classList.remove('active');
            renderMenu();
        });
    }

    if (viewTableBtn) {
        viewTableBtn.addEventListener('click', () => {
            currentView = 'table';
            viewTableBtn.classList.add('active');
            if (viewGridBtn) viewGridBtn.classList.remove('active');
            renderMenu();
        });
    }

    if (searchInput) searchInput.addEventListener('input', renderMenu);
    if (categoryFilter) categoryFilter.addEventListener('change', renderMenu);

    function openModal(isEdit = false) {
        if (!itemModal) return;
        itemModal.classList.add('open');
        if (isEdit) {
            modalTitle.innerHTML = `<i class='bx bx-edit'></i> Edit Menu Item`;
        } else {
            modalTitle.innerHTML = `<i class='bx bx-plus-circle'></i> Add New Item`;
            itemForm.reset();
            itemIdInput.value = '';
            itemImageInput.value = 'images/burger-removebg-preview.png';
            updatePreviewImage('images/burger-removebg-preview.png');
        }
    }

    function closeModal() {
        if (itemModal) itemModal.classList.remove('open');
    }

    if (openAddModalBtn) openAddModalBtn.addEventListener('click', () => openModal(false));
    if (emptyAddBtn) emptyAddBtn.addEventListener('click', () => openModal(false));
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);

    function updatePreviewImage(url) {
        if (!imagePreview) return;
        imagePreview.src = url || 'images/fast-food.png';
        imagePreview.onerror = () => { imagePreview.src = 'images/fast-food.png'; };
    }

    if (itemImageInput) {
        itemImageInput.addEventListener('input', (e) => updatePreviewImage(e.target.value.trim()));
    }

    presetThumbs.forEach(thumb => {
        thumb.addEventListener('click', () => {
            presetThumbs.forEach(t => t.classList.remove('selected'));
            thumb.classList.add('selected');
            const url = thumb.getAttribute('data-url');
            if (itemImageInput) itemImageInput.value = url;
            updatePreviewImage(url);
        });
    });

    window.handleEditModal = function(id) {
        const items = window.HotalStore.getItems();
        const item = items.find(i => i.id === id);
        if (!item) return;

        itemIdInput.value = item.id;
        itemNameInput.value = item.name;
        itemCategorySelect.value = item.category;
        itemPriceInput.value = item.price;
        itemImageInput.value = item.image;
        itemDescriptionInput.value = item.description || '';
        itemAvailableCheckbox.checked = item.isAvailable;
        itemFeaturedCheckbox.checked = !!item.isFeatured;

        updatePreviewImage(item.image);
        openModal(true);
    };

    window.handleToggleStock = function(id) {
        const updated = window.HotalStore.toggleItemAvailability(id);
        if (updated) {
            showToast(`"${updated.name}" is now ${updated.isAvailable ? 'In Stock' : 'Out of Stock'}`, 'success');
            renderMenu();
        }
    };

    window.handleDeletePrompt = function(id, name) {
        itemToDeleteId = id;
        if (deleteItemName) deleteItemName.textContent = `"${name}"`;
        if (deleteModal) deleteModal.classList.add('open');
    };

    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', () => {
            if (deleteModal) deleteModal.classList.remove('open');
            itemToDeleteId = null;
        });
    }

    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', () => {
            if (itemToDeleteId) {
                window.HotalStore.removeItem(itemToDeleteId);
                showToast('Item deleted successfully from website.', 'success');
                if (deleteModal) deleteModal.classList.remove('open');
                itemToDeleteId = null;
                renderMenu();
            }
        });
    }

    if (itemForm) {
        itemForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const id = itemIdInput.value;
            const itemData = {
                name: itemNameInput.value,
                category: itemCategorySelect.value,
                price: itemPriceInput.value,
                image: itemImageInput.value || 'images/fast-food.png',
                description: itemDescriptionInput.value,
                isAvailable: itemAvailableCheckbox.checked,
                isFeatured: itemFeaturedCheckbox.checked
            };

            if (id) {
                window.HotalStore.updateItem(id, itemData);
                showToast(`Updated "${itemData.name}" successfully!`, 'success');
            } else {
                window.HotalStore.addItem(itemData);
                showToast(`Added "${itemData.name}" to menu!`, 'success');
            }

            closeModal();
            renderMenu();
        });
    }

    if (resetDefaultsBtn) {
        resetDefaultsBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset the menu to default sample products?')) {
                window.HotalStore.resetDefaultItems();
                showToast('Menu items reset to defaults!', 'info');
                renderMenu();
            }
        });
    }

    // --- ORDERS & PAYMENTS MANAGEMENT LOGIC ---

    async function fetchAdminOrdersFromAPI() {
        try {
            const res = await fetch('/api/orders/all');
            if (res.ok) {
                const data = await res.json();
                if (data.success && Array.isArray(data.orders) && window.HotalStore) {
                    const localOrders = window.HotalStore.getOrders();
                    const mergedMap = new Map();
                    
                    // Keep existing local orders first
                    localOrders.forEach(o => mergedMap.set(o.order_number || o.id, o));
                    
                    // Merge or update from backend API
                    data.orders.forEach(o => {
                        const key = o.order_number || (o.id ? `HTL-${o.id}` : 'HTL-0000');
                        const existing = mergedMap.get(key);
                        mergedMap.set(key, {
                            id: key,
                            order_number: key,
                            user_id: o.user_id || (existing ? existing.user_id : 'user-1'),
                            customer_name: o.customer_name || (existing ? existing.customer_name : 'Customer'),
                            phone: o.phone || (existing ? existing.phone : ''),
                            order_type: o.order_type || (existing ? existing.order_type : 'delivery'),
                            table_number: o.table_number || '',
                            delivery_address: o.delivery_address || '',
                            status: o.status || (existing ? existing.status : 'pending'),
                            payment_method: o.payment_method || (existing ? existing.payment_method : 'Cash on Delivery'),
                            payment_status: o.payment_status || (existing ? existing.payment_status : 'pending'),
                            subtotal: parseFloat(o.subtotal || (existing ? existing.subtotal : 0)),
                            delivery_fee: parseFloat(o.delivery_fee || (existing ? existing.delivery_fee : 0)),
                            total_amount: parseFloat(o.total_amount || (existing ? existing.total_amount : 0)),
                            created_at: o.created_at || (existing ? existing.created_at : new Date().toISOString()),
                            items: o.items || (existing ? existing.items : [])
                        });
                    });

                    window.HotalStore.saveOrders(Array.from(mergedMap.values()));
                }
            }
        } catch (e) {
            console.log('[Admin] Standalone offline order rendering mode');
        }
    }

    async function renderAdminOrders() {
        const tableBody = document.getElementById('admin-orders-table-body');
        if (!tableBody) return;

        // Fetch updates from API backend if connected
        await fetchAdminOrdersFromAPI();

        let orders = window.HotalStore ? window.HotalStore.getOrders() : [];

        const searchInput = document.getElementById('order-search-input');
        const statusFilter = document.getElementById('order-status-filter');

        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const filterVal = statusFilter ? statusFilter.value : 'ALL';

        // Stats calculation
        const totalCount = orders.length;
        const pendingCount = orders.filter(o => o.status === 'pending').length;
        const activeCount = orders.filter(o => o.status === 'preparing' || o.status === 'accepted' || o.status === 'out_for_delivery').length;
        const completedCount = orders.filter(o => o.status === 'completed').length;

        const statTotal = document.getElementById('order-stat-total');
        const statPending = document.getElementById('order-stat-pending');
        const statActive = document.getElementById('order-stat-active');
        const statCompleted = document.getElementById('order-stat-completed');

        if (statTotal) statTotal.textContent = totalCount;
        if (statPending) statPending.textContent = pendingCount;
        if (statActive) statActive.textContent = activeCount;
        if (statCompleted) statCompleted.textContent = completedCount;

        const badgeCounter = document.getElementById('admin-pending-count');
        if (badgeCounter) badgeCounter.textContent = pendingCount;

        // Filtering
        const filteredOrders = orders.filter(order => {
            const matchesSearch = (order.id && order.id.toLowerCase().includes(query)) ||
                                  (order.order_number && order.order_number.toLowerCase().includes(query)) ||
                                  (order.customer_name && order.customer_name.toLowerCase().includes(query)) ||
                                  (order.phone && order.phone.includes(query));
            const matchesStatus = filterVal === 'ALL' || order.status === filterVal;
            return matchesSearch && matchesStatus;
        });

        if (filteredOrders.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--second-color); padding: 30px;">No customer orders found matching your search.</td></tr>`;
            return;
        }

        tableBody.innerHTML = filteredOrders.map(order => {
            const isPending = order.status === 'pending';
            const isPreparing = order.status === 'preparing' || order.status === 'accepted';
            const isOutForDelivery = order.status === 'out_for_delivery';
            const isCompleted = order.status === 'completed';

            let statusBadgeClass = 'available';
            let statusText = 'Pending';
            if (isPending) { statusBadgeClass = 'unavailable'; statusText = 'Pending Acceptance'; }
            else if (isPreparing) { statusBadgeClass = 'available'; statusText = 'Preparing Food'; }
            else if (isOutForDelivery) { statusBadgeClass = 'badge-category'; statusText = 'Out for Delivery'; }
            else if (isCompleted) { statusBadgeClass = 'available'; statusText = 'Completed'; }

            const itemsStr = order.items && order.items.length 
                ? order.items.map(i => `${i.quantity || 1}x ${i.item_name || i.name || i.menuItemId || 'Food Item'}`).join(', ') 
                : 'Order Items';

            let typeLocation = escapeHtml((order.order_type || 'delivery').toUpperCase());
            if (order.order_type === 'dine_in' && order.table_number) typeLocation += ` (${escapeHtml(order.table_number)})`;
            if (order.order_type === 'delivery' && order.delivery_address) typeLocation += `<br><small style="color:#aaa;">${escapeHtml(order.delivery_address)}</small>`;

            const orderDisplayId = order.order_number || order.id || 'HTL-0000';

            return `
                <tr>
                    <td><strong class="order-id-tag" style="color: var(--main-color);">#${escapeHtml(orderDisplayId)}</strong><br><small style="color: var(--second-color); font-size: 0.8rem;">${new Date(order.created_at || Date.now()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</small></td>
                    <td>
                        <strong>${escapeHtml(order.customer_name || 'Customer')}</strong><br>
                        <small style="color: var(--second-color);"><i class='bx bx-phone'></i> ${escapeHtml(order.phone || 'N/A')}</small>
                    </td>
                    <td>${typeLocation}</td>
                    <td style="max-width: 200px; font-size: 0.88rem;">${escapeHtml(itemsStr)}</td>
                    <td>
                        <strong style="color: var(--main-color);">$${parseFloat(order.total_amount || 0).toFixed(2)}</strong><br>
                        <span style="font-size: 0.78rem; padding: 2px 6px; border-radius: 4px; background: ${order.payment_status === 'paid' ? 'rgba(46, 204, 113, 0.2)' : 'rgba(230, 126, 34, 0.2)'}; color: ${order.payment_status === 'paid' ? '#2ecc71' : '#e67e22'};">
                            ${order.payment_status === 'paid' ? 'PAID' : 'UNPAID'} (${escapeHtml(order.payment_method || 'COD')})
                        </span>
                    </td>
                    <td>
                        <span class="status-badge ${statusBadgeClass}" style="padding: 4px 10px; border-radius: 12px; font-size: 0.82rem; display: inline-block;">
                            ${statusText}
                        </span>
                    </td>
                    <td>
                        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                            ${isPending ? `
                                <button class="btn-primary" onclick="handleAcceptOrder('${escapeHtml(orderDisplayId)}')" style="padding: 5px 12px; font-size: 0.82rem; background: #2ecc71; border: none; box-shadow: none;">
                                    <i class='bx bx-check-circle'></i> Accept Order
                                </button>
                            ` : ''}

                            ${isPreparing ? `
                                <button class="btn-primary" onclick="handleAdvanceOrderStatus('${escapeHtml(orderDisplayId)}', 'out_for_delivery')" style="padding: 5px 12px; font-size: 0.82rem; background: #9b59b6; border: none;">
                                    <i class='bx bx-cycling'></i> Send to Customer
                                </button>
                            ` : ''}

                            ${isOutForDelivery ? `
                                <button class="btn-primary" onclick="handleAdvanceOrderStatus('${escapeHtml(orderDisplayId)}', 'completed')" style="padding: 5px 12px; font-size: 0.82rem; background: #2ecc71; border: none;">
                                    <i class='bx bx-check-double'></i> Mark Delivered
                                </button>
                            ` : ''}

                            <button class="btn-secondary" onclick="handleToggleOrderPayment('${escapeHtml(orderDisplayId)}')" style="padding: 5px 10px; font-size: 0.82rem;" title="Toggle Payment Status">
                                <i class='bx bx-credit-card'></i> ${order.payment_status === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Global Order Action Handlers
    window.handleAcceptOrder = async function(orderId) {
        window.HotalStore.updateOrderStatus(orderId, 'preparing');
        try {
            await fetch(`/api/orders/${orderId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'preparing' })
            });
        } catch (e) {}
        showToast(`Order #${orderId} accepted! Kitchen is preparing food.`, 'success');
        renderAdminOrders();
    };

    window.handleAdvanceOrderStatus = async function(orderId, nextStatus) {
        window.HotalStore.updateOrderStatus(orderId, nextStatus);
        try {
            await fetch(`/api/orders/${orderId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: nextStatus })
            });
        } catch (e) {}

        const statusLabels = { out_for_delivery: 'Out for Delivery / Sent to Customer', completed: 'Completed & Delivered' };
        showToast(`Order #${orderId} updated to "${statusLabels[nextStatus] || nextStatus}"!`, 'success');
        renderAdminOrders();
    };

    window.handleToggleOrderPayment = async function(orderId) {
        const order = window.HotalStore.getOrders().find(o => o.id === orderId || o.order_number === orderId);
        if (!order) return;

        const newPaymentStatus = order.payment_status === 'paid' ? 'pending' : 'paid';
        window.HotalStore.updatePaymentStatus(orderId, newPaymentStatus);

        try {
            await fetch(`/api/orders/${orderId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: order.status, payment_status: newPaymentStatus })
            });
        } catch (e) {}

        showToast(`Payment for Order #${orderId} marked as ${newPaymentStatus.toUpperCase()}!`, 'success');
        renderAdminOrders();
    };

    const orderSearch = document.getElementById('order-search-input');
    const orderFilter = document.getElementById('order-status-filter');
    if (orderSearch) orderSearch.addEventListener('input', renderAdminOrders);
    if (orderFilter) orderFilter.addEventListener('change', renderAdminOrders);

    // Cross-tab real-time listener & Auto-refresh interval
    window.addEventListener('storage', (e) => {
        if (e.key === 'hotal_items') renderMenu();
        if (e.key === 'hotal_orders') renderAdminOrders();
    });

    window.addEventListener('hotal_items_updated', renderMenu);
    window.addEventListener('hotal_orders_updated', renderAdminOrders);

    // Initial render
    renderMenu();
    renderAdminOrders();
});
