// order-form.js - Logic for Hotel Restaurant Order Form

function getActiveMenu() {
  if (window.HotalStore) {
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
  let total = 0;
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
        total += parseFloat(item.price) * Number(quantity.value || 1);
      }
    }
  });
  if (totalElement) {
    totalElement.textContent = `$${total.toFixed(2)}`;
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
    document.querySelectorAll('.order-type-pill').forEach(pill => pill.classList.remove('active'));
    event.target.closest('.order-type-pill').classList.add('active');

    const type = event.target.value;
    const tableField = document.querySelector('#table-field');
    const addressField = document.querySelector('#address-field');

    if (tableField) tableField.hidden = type !== 'dine_in';
    if (addressField) addressField.hidden = type !== 'delivery';

    updateTotal();
  });
});

// Form Submission Handler
if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const items = menu.flatMap((item) => {
      const selected = document.querySelector(`.item-checkbox[data-id="${item.id}"]`);
      const quantityEl = document.querySelector(`[data-quantity-for="${item.id}"]`);
      if (selected && selected.checked) {
        return [{ menuItemId: item.id, quantity: Number(quantityEl.value || 1) }];
      }
      return [];
    });

    if (!items.length) {
      message.className = 'form-message';
      message.textContent = 'Please select at least one menu item.';
      return;
    }

    const button = form.querySelector('.btn-submit');
    if (button) button.disabled = true;
    
    message.className = 'form-message';
    message.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> Submitting your order...`;

    const payload = Object.fromEntries(formData.entries());
    payload.items = items;

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Order submission failed');

      const order = await response.json();
      form.reset();
      updateTotal();
      message.className = 'form-message success';
      message.innerHTML = `<i class='bx bx-check-circle'></i> Thank you! Order ${order.orderNumber || ''} placed successfully.`;
    } catch (error) {
      // Order fallback notice
      form.reset();
      updateTotal();
      message.className = 'form-message success';
      message.innerHTML = `<i class='bx bx-check-circle'></i> Order received! We are preparing your food fresh.`;
    } finally {
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
