// admin.js - Logic for Hotel Admin Dashboard

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const itemsGrid = document.getElementById('items-grid');
    const itemsTableWrapper = document.getElementById('items-table-wrapper');
    const itemsTableBody = document.getElementById('items-table-body');
    const emptyState = document.getElementById('empty-state');
    
    // Stats Elements
    const statTotalItems = document.getElementById('stat-total-items');
    const statInStockItems = document.getElementById('stat-instock-items');
    const statCategories = document.getElementById('stat-categories');
    const statFeatured = document.getElementById('stat-featured');

    // Controls Elements
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    const viewGridBtn = document.getElementById('view-grid-btn');
    const viewTableBtn = document.getElementById('view-table-btn');
    const openAddModalBtn = document.getElementById('open-add-modal-btn');
    const resetDefaultsBtn = document.getElementById('reset-defaults-btn');
    const emptyAddBtn = document.getElementById('empty-add-btn');

    // Modal Elements
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

    // Render Dashboard Stats
    function updateStats(items) {
        statTotalItems.textContent = items.length;
        
        const inStockCount = items.filter(i => i.isAvailable).length;
        statInStockItems.textContent = inStockCount;

        const categories = new Set(items.map(i => i.category));
        statCategories.textContent = categories.size;

        const featuredCount = items.filter(i => i.isFeatured).length;
        statFeatured.textContent = featuredCount;
    }

    // Filter Items Logic
    function getFilteredItems() {
        const items = window.HotalStore.getItems();
        const searchTerm = searchInput.value.toLowerCase().trim();
        const selectedCategory = categoryFilter.value;

        return items.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchTerm) || 
                                  item.category.toLowerCase().includes(searchTerm) ||
                                  (item.description && item.description.toLowerCase().includes(searchTerm));
            
            const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;

            return matchesSearch && matchesCategory;
        });
    }

    // Render Main UI
    function render() {
        const items = window.HotalStore.getItems();
        updateStats(items);

        const filteredItems = getFilteredItems();

        if (filteredItems.length === 0) {
            itemsGrid.style.display = 'none';
            itemsTableWrapper.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        if (currentView === 'grid') {
            itemsGrid.style.display = 'grid';
            itemsTableWrapper.style.display = 'none';
            renderGridView(filteredItems);
        } else {
            itemsGrid.style.display = 'none';
            itemsTableWrapper.style.display = 'block';
            renderTableView(filteredItems);
        }
    }

    // Render Grid Cards
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

    // Render Table View
    function renderTableView(items) {
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

    // View Switching
    viewGridBtn.addEventListener('click', () => {
        currentView = 'grid';
        viewGridBtn.classList.add('active');
        viewTableBtn.classList.remove('active');
        render();
    });

    viewTableBtn.addEventListener('click', () => {
        currentView = 'table';
        viewTableBtn.classList.add('active');
        viewGridBtn.classList.remove('active');
        render();
    });

    // Search and Filter Listeners
    searchInput.addEventListener('input', render);
    categoryFilter.addEventListener('change', render);

    // Modal Control Functions
    function openModal(isEdit = false) {
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
        itemModal.classList.remove('open');
    }

    openAddModalBtn.addEventListener('click', () => openModal(false));
    emptyAddBtn.addEventListener('click', () => openModal(false));
    closeModalBtn.addEventListener('click', closeModal);
    cancelModalBtn.addEventListener('click', closeModal);

    itemModal.addEventListener('click', (e) => {
        if (e.target === itemModal) closeModal();
    });

    // Image URL Preview update
    function updatePreviewImage(url) {
        imagePreview.src = url || 'images/fast-food.png';
        imagePreview.onerror = () => {
            imagePreview.src = 'images/fast-food.png';
        };
    }

    itemImageInput.addEventListener('input', (e) => {
        updatePreviewImage(e.target.value.trim());
    });

    // Preset Thumbs Handler
    presetThumbs.forEach(thumb => {
        thumb.addEventListener('click', () => {
            presetThumbs.forEach(t => t.classList.remove('selected'));
            thumb.classList.add('selected');
            const url = thumb.getAttribute('data-url');
            itemImageInput.value = url;
            updatePreviewImage(url);
        });
    });

    // Edit Item Modal Handler (Exposed globally)
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

    // Toggle Stock Handler (Exposed globally)
    window.handleToggleStock = function(id) {
        const updated = window.HotalStore.toggleItemAvailability(id);
        if (updated) {
            showToast(`"${updated.name}" is now ${updated.isAvailable ? 'In Stock' : 'Out of Stock'}`, 'success');
            render();
        }
    };

    // Delete Prompt Handler (Exposed globally)
    window.handleDeletePrompt = function(id, name) {
        itemToDeleteId = id;
        deleteItemName.textContent = `"${name}"`;
        deleteModal.classList.add('open');
    };

    cancelDeleteBtn.addEventListener('click', () => {
        deleteModal.classList.remove('open');
        itemToDeleteId = null;
    });

    confirmDeleteBtn.addEventListener('click', () => {
        if (itemToDeleteId) {
            window.HotalStore.removeItem(itemToDeleteId);
            showToast('Item deleted successfully from website.', 'success');
            deleteModal.classList.remove('open');
            itemToDeleteId = null;
            render();
        }
    });

    // Save Form Submission (Add or Edit)
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
        render();
    });

    // Reset Defaults Handler
    resetDefaultsBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset the menu to default sample products?')) {
            window.HotalStore.resetDefaultItems();
            showToast('Menu items reset to defaults!', 'info');
            render();
        }
    });

    // Real-time listener across tabs/windows
    window.addEventListener('storage', (e) => {
        if (e.key === 'hotal_items') {
            render();
        }
    });

    // Local custom event listener
    window.addEventListener('hotal_items_updated', () => {
        render();
    });

    // Helper Utility for Escaping HTML
    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Initial Render
    render();
});
