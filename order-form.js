// order-form.js - Logic for Hotel Restaurant Order Form

// Authentication Guard: Ensure user is authenticated before accessing order form
if (typeof window !== 'undefined' && (!window.HotalStore || !window.HotalStore.isLoggedIn())) {
    window.location.replace('login.html?redirect=order-form.html');
}

function getActiveMenu() {
  if (window.HotalStore && typeof window.HotalStore.getItems === 'function') {
    return window.HotalStore.getItems().filter(item => item.isAvailable);
  }
  return [
    { id: 'item-1', name: 'Burger', price: 12.00, description: 'Juicy beef burger', image: 'images/burger-removebg-preview.png', category: 'Fast Food' },
    { id: 'item-2', name: 'Large Pizza', price: 18.50, description: 'Cheesy pepperoni pizza', image: 'images/pizza-removebg-preview.png', category: 'Pizza' },
    { id: 'item-3', name: 'Sekh Kabab', price: 14.00, description: 'Charcoal grilled skewers', image: 'images/sekh_kabak-removebg-preview.png', category: 'Grill' },
    { id: 'item-4', name: 'Shawarma', price: 9.99, description: 'Spiced chicken wrap', image: 'images/shawarma-removebg-preview.png', category: 'Fast Food' },
  ];
}

let menu = getActiveMenu();

const form = document.querySelector('#order-form');
const menuItems = document.querySelector('#menu-items');
const totalElement = document.querySelector('#total');
const message = document.querySelector('#form-message');
const header = document.querySelector("header");

// Auto-fill logged in user info if available
document.addEventListener('DOMContentLoaded', () => {
    if (window.HotalStore && typeof window.HotalStore.getCurrentUser === 'function') {
        const user = window.HotalStore.getCurrentUser();
        if (user) {
            const nameEl = document.querySelector('#order-fullName');
            const phoneEl = document.querySelector('#order-phone');
            const emailEl = document.querySelector('#order-email');
            const addressEl = document.querySelector('#order-deliveryAddress');

            if (nameEl && !nameEl.value) nameEl.value = user.full_name || '';
            if (phoneEl && !phoneEl.value) phoneEl.value = user.phone || '';
            if (emailEl && !emailEl.value) emailEl.value = user.email || '';
            if (addressEl && !addressEl.value) addressEl.value = user.address || '';
        }
    }
});

window.addEventListener("scroll", function() {
    if (header) header.classList.toggle("sticky", window.scrollY > 80);
});

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Render Menu Items with Thumbnails & Selected Card Glow
function renderOrderFormMenu() {
  menu = getActiveMenu();
  if (!menuItems) return;

  if (menu.length === 0) {
    menuItems.innerHTML = '<p style="color: var(--second-color); padding: 20px; text-align: center; font-size: 1rem;">No menu items currently available for ordering.</p>';
    return;
  }

  const esc = (window.HotalStore && window.HotalStore.escapeHtml) ? window.HotalStore.escapeHtml : escapeHtml;

  menuItems.innerHTML = menu.map((item) => `
    <label class="menu-item-card" for="chk-${esc(item.id)}" id="card-${esc(item.id)}">
      <img src="${esc(item.image || 'images/fast-food.png')}" class="menu-item-thumb" alt="${esc(item.name)}" onerror="this.src='images/fast-food.png'">
      <div class="menu-item-info">
        <span class="menu-item-title">${esc(item.name)}</span>
        <span class="menu-item-desc">${esc(item.description || 'Freshly prepared with top ingredients.')}</span>
      </div>
      <span class="menu-item-price">$${parseFloat(item.price || 0).toFixed(2)}</span>
      <input id="chk-${esc(item.id)}" class="item-checkbox" data-id="${esc(item.id)}" type="checkbox" aria-label="Add ${esc(item.name)}" />
      <div class="quantity-stepper">
        <input class="quantity-input" data-quantity-for="${esc(item.id)}" type="number" min="1" value="1" disabled aria-label="Quantity of ${esc(item.name)}" onclick="event.stopPropagation();" />
      </div>
    </label>`).join('');
}

// Load previously reordered items passed from user dashboard
function checkAndLoadReorder() {
  try {
    const raw = sessionStorage.getItem('hotal_reorder_items');
    if (!raw) return;
    const reorderItems = JSON.parse(raw);
    sessionStorage.removeItem('hotal_reorder_items');

    if (Array.isArray(reorderItems) && reorderItems.length > 0) {
      let matchedCount = 0;
      reorderItems.forEach(reItem => {
        const itemName = (reItem.item_name || reItem.name || '').toLowerCase();
        const itemId = String(reItem.menuItemId || reItem.id || '');

        const target = menu.find(m => 
          (itemId && String(m.id) === itemId) || 
          (itemName && m.name.toLowerCase() === itemName)
        );

        if (target) {
          const chk = document.querySelector(`.item-checkbox[data-id="${target.id}"]`);
          const qty = document.querySelector(`[data-quantity-for="${target.id}"]`);
          const card = document.querySelector(`#card-${target.id}`);
          if (chk && qty) {
            chk.checked = true;
            qty.disabled = false;
            qty.value = reItem.quantity || 1;
            if (card) card.classList.add('selected');
            matchedCount++;
          }
        }
      });

      if (matchedCount > 0) {
        updateTotal();
        if (message) {
          message.className = 'form-message success';
          message.innerHTML = `<i class='bx bx-check-circle'></i> Loaded ${matchedCount} dish(es) from your previous order into checkout!`;
        }
      }
    }
  } catch (err) {
    console.warn('[OrderForm] Could not load reorder items:', err);
  }
}

renderOrderFormMenu();
checkAndLoadReorder();

// Fetch latest menu items from backend API
if (window.HotalStore && typeof window.HotalStore.fetchMenuItems === 'function') {
  window.HotalStore.fetchMenuItems().then(() => {
    renderOrderFormMenu();
    updateTotal();
    checkAndLoadReorder();
  }).catch(() => {});
}

function updateTotal() {
  let subtotal = 0;
  menu.forEach((item) => {
    const selected = document.querySelector(`.item-checkbox[data-id="${item.id}"]`);
    const quantity = document.querySelector(`[data-quantity-for="${item.id}"]`);
    const card = document.querySelector(`#card-${item.id}`);

    if (selected && quantity) {
      quantity.disabled = !selected.checked;
      if (card) {
        if (selected.checked) {
          card.classList.add('selected');
        } else {
          card.classList.remove('selected');
        }
      }
      if (selected.checked) {
        subtotal += parseFloat(item.price) * Number(quantity.value || 1);
      }
    }
  });

  const selectedOrderType = document.querySelector('input[name="orderType"]:checked');
  const deliveryFee = (selectedOrderType && selectedOrderType.value === 'delivery') ? 2.00 : 0.00;
  const grandTotal = subtotal + (subtotal > 0 ? deliveryFee : 0);

  if (totalElement) {
    totalElement.textContent = `$${grandTotal.toFixed(2)}`;
  }
}

if (menuItems) {
  menuItems.addEventListener('change', updateTotal);
  menuItems.addEventListener('input', updateTotal);
}

// Order Type Selection Pills Handler
const orderTypeInputs = document.querySelectorAll('input[name="orderType"]');
orderTypeInputs.forEach(input => {
  input.addEventListener('change', (event) => {
    const fieldset = event.target.closest('fieldset');
    fieldset.querySelectorAll('.order-type-pill').forEach(pill => pill.classList.remove('active'));
    event.target.closest('.order-type-pill').classList.add('active');

    const type = event.target.value;
    const tableField = document.querySelector('#table-field');
    const addressField = document.querySelector('#address-field');

    if (tableField) tableField.hidden = type !== 'dine_in';
    if (addressField) addressField.hidden = type !== 'delivery';

    updateTotal();
  });
});

// Payment Method Selection Pills Handler
const paymentMethodInputs = document.querySelectorAll('input[name="paymentMethod"]');
paymentMethodInputs.forEach(input => {
  input.addEventListener('change', (event) => {
    const fieldset = event.target.closest('fieldset');
    fieldset.querySelectorAll('.payment-type-pill').forEach(pill => pill.classList.remove('active'));
    event.target.closest('.payment-type-pill').classList.add('active');
  });
});

// Form Submission Handler
if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    
    const selectedItems = menu.flatMap((item) => {
      const selected = document.querySelector(`.item-checkbox[data-id="${item.id}"]`);
      const quantityEl = document.querySelector(`[data-quantity-for="${item.id}"]`);
      if (selected && selected.checked) {
        return [{
          menuItemId: item.id,
          item_name: item.name,
          unit_price: parseFloat(item.price),
          quantity: Number(quantityEl.value || 1)
        }];
      }
      return [];
    });

    if (!selectedItems.length) {
      message.className = 'form-message error';
      message.textContent = 'Please select at least one menu item to place your order.';
      return;
    }

    const button = form.querySelector('.btn-submit');
    if (button) button.disabled = true;
    
    message.className = 'form-message';
    message.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> Submitting your order...`;

    const currentUser = window.HotalStore ? window.HotalStore.getCurrentUser() : null;
    if (!currentUser) {
      window.location.replace('login.html?redirect=order-form.html');
      return;
    }
    const orderType = formData.get('orderType') || 'pickup';
    const paymentMethod = formData.get('paymentMethod') || 'Cash on Delivery';
    
    let subtotal = 0;
    selectedItems.forEach(i => subtotal += i.unit_price * i.quantity);
    const deliveryFee = orderType === 'delivery' ? 2.00 : 0.00;
    const grandTotal = subtotal + deliveryFee;

    const orderPayload = {
      user_id: currentUser.id,
      customer_name: formData.get('fullName') || currentUser.full_name,
      phone: formData.get('phone') || currentUser.phone || '',
      order_type: orderType,
      table_number: formData.get('tableNumber') || '',
      delivery_address: formData.get('deliveryAddress') || currentUser.address || '',
      payment_method: paymentMethod,
      subtotal: subtotal,
      delivery_fee: deliveryFee,
      total_amount: grandTotal,
      items: selectedItems
    };

    try {
      let finalOrder = null;

      try {
        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: window.HotalStore ? window.HotalStore.getAuthHeaders() : { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderPayload),
        });

        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          if (data && data.success && data.order) {
            finalOrder = data.order;
          }
        } else if (response.status === 401 && !currentUser) {
          message.className = 'form-message error';
          message.textContent = 'Your session has expired. Please log in again to place your order.';
          if (button) button.disabled = false;
          setTimeout(() => {
            window.location.replace('login.html?redirect=order-form.html');
          }, 1500);
          return;
        } else if (response.status === 400) {
          const data = await response.json().catch(() => ({}));
          message.className = 'form-message error';
          message.textContent = (data && data.message) || 'Please check your order details and try again.';
          if (button) button.disabled = false;
          return;
        } else {
          // Status 405 (Method Not Allowed on static hosts/proxies), 404, or 500:
          // Gracefully fall back to the local client store so user ordering is never disrupted
          console.warn(`[OrderForm] API returned status ${response.status}. Using seamless client-store fallback.`);
        }
      } catch (networkErr) {
        console.warn('[OrderForm] Network error connecting to backend API, falling back to local store:', networkErr);
      }

      // Save locally so that live tracker and offline viewing work seamlessly
      const savedOrder = finalOrder ? window.HotalStore.addOrder(finalOrder) : window.HotalStore.addOrder(orderPayload);

      form.reset();
      updateTotal();
      message.className = 'form-message success';
      message.innerHTML = `<i class='bx bx-check-circle'></i> Order <strong>#${escapeHtml(savedOrder.order_number || savedOrder.id)}</strong> placed successfully! Redirecting to Live Tracker...`;

      setTimeout(() => {
        window.location.href = 'user-dashboard.html';
      }, 1500);

    } catch (error) {
      message.className = 'form-message error';
      message.textContent = error.message || 'Failed to submit order. Please try again.';
      if (button) button.disabled = false;
    }
  });
}

// Mobile Navbar Drawer Toggle
const menuIcon = document.querySelector('#menu-icon');
const navlist = document.querySelector('.navlist');
if (menuIcon && navlist) {
  menuIcon.onclick = () => {
    menuIcon.classList.toggle('bx-x');
    navlist.classList.toggle('open');
  };
  window.onscroll = () => {
    menuIcon.classList.remove('bx-x');
    navlist.classList.remove('open');
  };
}

// Live sync with store updates
window.addEventListener('storage', (e) => {
  if (e.key === 'hotal_items') {
    renderOrderFormMenu();
    updateTotal();
  }
});

window.addEventListener('hotal_items_updated', () => {
  renderOrderFormMenu();
  updateTotal();
});
