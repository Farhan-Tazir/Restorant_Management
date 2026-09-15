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

// Dynamic rendering of shop items managed via Admin Dashboard & persistent user favorites
let userFavoriteIds = new Set();

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function fetchUserFavorites() {
    if (!window.HotalStore || !window.HotalStore.isLoggedIn()) {
        userFavoriteIds.clear();
        return;
    }
    try {
        const res = await fetch('/api/user/favorites', {
            headers: window.HotalStore.getAuthHeaders()
        });
        if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.favorites)) {
                userFavoriteIds = new Set(data.favorites.map(f => String(f.id || f.menu_item_id)));
            }
        }
    } catch (e) {
        console.warn('Could not fetch user favorites:', e);
    }
}

window.handleFavoriteToggle = async function(btn, itemId) {
    if (!window.HotalStore || !window.HotalStore.isLoggedIn()) {
        window.location.href = 'login.html?redirect=index.html';
        return;
    }

    const strId = String(itemId);
    const isLiked = btn.classList.contains('liked') || userFavoriteIds.has(strId);
    const icon = btn.querySelector('i');

    if (isLiked) {
        btn.classList.remove('liked');
        if (icon) {
            icon.className = 'bx bx-heart';
            icon.style.color = '';
        }
        userFavoriteIds.delete(strId);

        try {
            await fetch(`/api/user/favorites/${encodeURIComponent(strId)}`, {
                method: 'DELETE',
                headers: window.HotalStore.getAuthHeaders()
            });
        } catch (e) {
            console.warn('Failed to remove favorite from server:', e);
        }
    } else {
        btn.classList.add('liked');
        if (icon) {
            icon.className = 'bx bxs-heart';
            icon.style.color = '#e74c3c';
        }
        userFavoriteIds.add(strId);

        try {
            await fetch('/api/user/favorites', {
                method: 'POST',
                headers: window.HotalStore.getAuthHeaders(),
                body: JSON.stringify({ menu_item_id: strId })
            });
        } catch (e) {
            console.warn('Failed to save favorite to server:', e);
        }
    }
};

function renderShopItems() {
    const shopContent = document.querySelector('.shop-content');
    if (!shopContent || !window.HotalStore) return;

    const items = window.HotalStore.getItems().filter(item => item.isAvailable);

    if (items.length === 0) {
        shopContent.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--second-color); padding: 40px; font-size: 1.2rem;">No products currently available on menu. Check back soon!</div>`;
        return;
    }

    const esc = window.HotalStore.escapeHtml || escapeHtml;

    shopContent.innerHTML = items.map(item => {
        const isFav = userFavoriteIds.has(String(item.id));
        return `
        <div class="item-card" data-id="${esc(item.id)}">
            <div class="item-card-header">
                <span class="badge-category">${esc(item.category || 'Special')}</span>
                <span class="status-badge ${item.isAvailable ? 'available' : 'unavailable'}">
                    <i class='bx ${item.isAvailable ? 'bx-check' : 'bx-x'}'></i>
                    ${item.isAvailable ? 'In Stock' : 'Out of Stock'}
                </span>
            </div>

            <div class="item-image-wrapper">
                <img src="${esc(item.image)}" alt="${esc(item.name)}" onerror="this.src='images/fast-food.png'">
            </div>

            <div class="item-details">
                <h3>${esc(item.name)}</h3>
                <p>${esc(item.description || 'Freshly prepared with authentic ingredients.')}</p>
            </div>

            <div class="item-bottom">
                <div class="item-price">$${parseFloat(item.price || 0).toFixed(2)}</div>
                <div class="item-actions">
                    <button class="icon-btn fav-btn ${isFav ? 'liked' : ''}" onclick="handleFavoriteToggle(this, '${esc(item.id)}')" title="${isFav ? 'Remove from Favorites' : 'Add to Favorites'}">
                        <i class='bx ${isFav ? 'bxs-heart' : 'bx-heart'}' ${isFav ? 'style="color: #e74c3c;"' : ''}></i>
                    </button>
                    <a href="order-form.html" class="btn-order-pill">
                        <i class='bx bx-cart-alt'></i> Order Now
                    </a>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
    renderShopItems();

    // Sync menu items & user favorites from backend
    if (window.HotalStore) {
        if (typeof window.HotalStore.fetchMenuItems === 'function') {
            window.HotalStore.fetchMenuItems().then(() => renderShopItems()).catch(() => {});
        }
        if (window.HotalStore.isLoggedIn()) {
            await fetchUserFavorites();
            renderShopItems();
        }
    }

    // Check admin visibility in navbar
    const adminLink = document.getElementById('nav-admin-link');
    if (adminLink) {
        adminLink.style.display = (window.HotalStore && window.HotalStore.isAdmin()) ? 'inline-flex' : 'none';
    }

    // Auth-aware user profile navigation
    const userIcon = document.getElementById('nav-user-icon');
    if (userIcon) {
        userIcon.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.HotalStore && typeof window.HotalStore.navigateToUserPortal === 'function') {
                window.HotalStore.navigateToUserPortal();
            } else if (window.HotalStore && window.HotalStore.isLoggedIn()) {
                window.location.href = window.HotalStore.isAdmin() ? 'admin.html' : 'user-dashboard.html';
            } else {
                window.location.href = 'login.html';
            }
        });
    }

    // Auth-aware order button clicks
    document.addEventListener('click', (e) => {
        const orderBtn = e.target.closest('a[href="order-form.html"], a[href="./order-form.html"]');
        if (orderBtn) {
            if (!window.HotalStore || !window.HotalStore.isLoggedIn()) {
                e.preventDefault();
                window.location.href = 'login.html?redirect=order-form.html';
            }
        }
    });

    window.addEventListener('storage', (e) => {
        if (e.key === 'hotal_items') {
            renderShopItems();
        }
        if (e.key === 'hotal_current_user') {
            if (adminLink) {
                adminLink.style.display = (window.HotalStore && window.HotalStore.isAdmin()) ? 'inline-flex' : 'none';
            }
        }
    });

    window.addEventListener('hotal_items_updated', () => {
        renderShopItems();
    });

    window.addEventListener('hotal_current_user_updated', () => {
        if (adminLink) {
            adminLink.style.display = (window.HotalStore && window.HotalStore.isAdmin()) ? 'inline-flex' : 'none';
        }
    });
});