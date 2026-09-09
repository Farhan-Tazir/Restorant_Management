const menu = [
  { id: 1, name: 'Classic Burger', price: 8.99 },
  { id: 2, name: 'Margherita Pizza', price: 11.99 },
  { id: 3, name: 'Soft Drink', price: 2.5 },
  { id: 4, name: 'Chocolate Cake', price: 4.99 },
];

const form = document.querySelector('#order-form');
const menuItems = document.querySelector('#menu-items');
const totalElement = document.querySelector('#total');
const message = document.querySelector('#form-message');

menuItems.innerHTML = menu.map((item) => `
  <label class="menu-item">
    <span><span class="menu-item-name">${item.name}</span><br><span class="menu-item-price">$${item.price.toFixed(2)}</span></span>
    <input class="item-select" data-id="${item.id}" type="checkbox" aria-label="Add ${item.name}" />
    <input class="quantity" data-quantity-for="${item.id}" type="number" min="1" value="1" disabled aria-label="Quantity of ${item.name}" />
  </label>`).join('');

function updateTotal() {
  let total = 0;
  menu.forEach((item) => {
    const selected = document.querySelector(`.item-select[data-id="${item.id}"]`);
    const quantity = document.querySelector(`[data-quantity-for="${item.id}"]`);
    quantity.disabled = !selected.checked;
    if (selected.checked) total += item.price * Number(quantity.value || 1);
  });
  totalElement.textContent = `$${total.toFixed(2)}`;
}

menuItems.addEventListener('input', updateTotal);
form.addEventListener('change', (event) => {
  if (event.target.name === 'orderType') {
    const type = event.target.value;
    document.querySelector('#table-field').hidden = type !== 'dine_in';
    document.querySelector('#address-field').hidden = type !== 'delivery';
  }
  updateTotal();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const items = menu.flatMap((item) => {
    const checked = document.querySelector(`.item-select[data-id="${item.id}"]`).checked;
    const quantity = Number(document.querySelector(`[data-quantity-for="${item.id}"]`).value);
    return checked ? [{ menuItemId: item.id, quantity }] : [];
  });

  if (!items.length) {
    message.textContent = 'Please select at least one menu item.';
    return;
  }

  const button = form.querySelector('button');
  button.disabled = true;
  message.className = 'form-message';
  message.textContent = 'Submitting your order…';

  const payload = Object.fromEntries(formData.entries());
  payload.items = items;

  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Order could not be submitted.');
    const order = await response.json();
    form.reset();
    updateTotal();
    message.className = 'form-message success';
    message.textContent = `Thank you! Your order ${order.orderNumber || ''} has been received.`;
  } catch (error) {
    message.textContent = 'Unable to submit the order. Please try again shortly.';
  } finally {
    button.disabled = false;
  }
});
