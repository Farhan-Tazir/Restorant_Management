// order-form.js - Logic for Hotel Restaurant Order Form

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

// Render Menu Items with Thumbnails & Selected Card Glow
function renderOrderFormMenu() {
  menu = getActiveMenu();
  if (!menuItems) return;

  if (menu.length === 0) {
    menuItems.innerHTML = '<p style="color: var(--second-color); padding: 20px; text-align: center; font-size: 1rem;">No menu items currently available for ordering.</p>';
    return;
  }

  menuItems.innerHTML = menu.map((item) => `
    <label class="menu-item-card" for="chk-${item.id}" id="card-${item.id}">
      <img src="${item.image || 'images/fast-food.png'}" class="menu-item-thumb" alt="${item.name}" onerror="this.src='images/fast-food.png'">
      <div class="menu-item-info">
        <span class="menu-item-title">${item.name}</span>
        <span class="menu-item-desc">${item.description || 'Freshly prepared with top ingredients.'}</span>
      </div>
      <span class="menu-item-price">$${parseFloat(item.price).toFixed(2)}</span>
      <input id="chk-${item.id}" class="item-checkbox" data-id="${item.id}" type="checkbox" aria-label="Add ${item.name}" />
      <div class="quantity-stepper">
        <input class="quantity-input" data-quantity-for="${item.id}" type="number" min="1" value="1" disabled aria-label="Quantity of ${item.name}" onclick="event.stopPropagation();" />
      </div>
    </label>`).join('');
}

renderOrderFormMenu();

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
    const orderType = formData.get('orderType') || 'pickup';
    const paymentMethod = formData.get('paymentMethod') || 'Cash on Delivery';
    
    let subtotal = 0;
    selectedItems.forEach(i => subtotal += i.unit_price * i.quantity);
    const deliveryFee = orderType === 'delivery' ? 2.00 : 0.00;
    const grandTotal = subtotal + deliveryFee;

    const orderPayload = {
      user_id: currentUser ? currentUser.id : 'user-1',
      customer_name: formData.get('fullName') || (currentUser ? currentUser.full_name : 'Guest'),
      phone: formData.get('phone') || (currentUser ? currentUser.phone : ''),
      order_type: orderType,
      table_number: formData.get('tableNumber') || '',
      delivery_address: formData.get('deliveryAddress') || '',
      payment_method: paymentMethod,
      subtotal: subtotal,
      delivery_fee: deliveryFee,
      total_amount: grandTotal,
      items: selectedItems
    };

    try {
      // Save locally in HotalStore for instant cross-tab live tracking
      const createdLocalOrder = window.HotalStore.addOrder(orderPayload);

      // Attempt API backend sync with matching order_number ID
      try {
        await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...orderPayload,
            order_number: createdLocalOrder.order_number,
            id: createdLocalOrder.id
          }),
        });
      } catch (apiErr) {
        console.log('[OrderForm] Offline submit - saved locally');
      }

      form.reset();
      updateTotal();
      message.className = 'form-message success';
      message.innerHTML = `<i class='bx bx-check-circle'></i> Order <strong>${createdLocalOrder.order_number}</strong> placed! Redirecting to Live Tracker...`;

      setTimeout(() => {
        window.location.href = 'user-dashboard.html';
      }, 1500);

    } catch (error) {
      message.className = 'form-message error';
      message.textContent = 'Failed to submit order. Please try again.';
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
