const header = document.querySelector("header");

window.addEventListener("scroll", function() {
    header.classList.toggle("sticky", window.scrollY > 80);
});

let menu = document.querySelector('#menu-icon');
let navlist = document.querySelector('.navlist');

menu.onclick = () => {
    menu.classList.toggle('bx-x');
    navlist.classList.toggle('open');
};

window.onscroll = () => {
    menu.classList.remove('bx-x');
    navlist.classList.remove('open');
};

const sr =ScrollReveal({
    origin:'top',
    distance: '85px',
    duration: 2500,
    reset: true
})

sr.reveal('.home-text',{delay:300});
sr.reveal('.home-img',{delay:400});
sr.reveal('.container',{delay:400});

sr.reveal('.about-img',{});
sr.reveal('.about-text',{delay:300});

sr.reveal('.middle-text',{});
sr.reveal('.row-btn,.shop-content',{delay:300});

sr.reveal('.review-content,.contact',{delay:300});

// Dynamic rendering of shop items managed via Admin Dashboard
function renderShopItems() {
    const shopContent = document.querySelector('.shop-content');
    if (!shopContent || !window.HotalStore) return;

    const items = window.HotalStore.getItems().filter(item => item.isAvailable);

    if (items.length === 0) {
        shopContent.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--second-color); padding: 40px; font-size: 1.2rem;">No products currently available on menu. Check back soon!</div>`;
        return;
    }

    shopContent.innerHTML = items.map(item => `
        <div class="item-card" data-id="${item.id}">
            <div class="item-card-header">
                <span class="badge-category">${item.category || 'Special'}</span>
                <span class="status-badge ${item.isAvailable ? 'available' : 'unavailable'}">
                    <i class='bx ${item.isAvailable ? 'bx-check' : 'bx-x'}'></i>
                    ${item.isAvailable ? 'In Stock' : 'Out of Stock'}
                </span>
            </div>

            <div class="item-image-wrapper">
                <img src="${item.image}" alt="${item.name}" onerror="this.src='images/fast-food.png'">
            </div>

            <div class="item-details">
                <h3>${item.name}</h3>
                <p>${item.description || 'Freshly prepared with authentic ingredients.'}</p>
            </div>

            <div class="item-bottom">
                <div class="item-price">$${parseFloat(item.price).toFixed(2)}</div>
                <div class="item-actions">
                    <button class="icon-btn fav-btn" onclick="this.classList.toggle('liked')" title="Add to Favorites">
                        <i class='bx bx-heart'></i>
                    </button>
                    <a href="order-form.html" class="btn-order-pill">
                        <i class='bx bx-cart-alt'></i> Order Now
                    </a>
                </div>
            </div>
        </div>
    `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    renderShopItems();

    window.addEventListener('storage', (e) => {
        if (e.key === 'hotal_items') {
            renderShopItems();
        }
    });

    window.addEventListener('hotal_items_updated', () => {
        renderShopItems();
    });
});