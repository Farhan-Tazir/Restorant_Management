// items-store.js - Shared Data Store for Restaurant Menu Items

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

const STORAGE_KEY = 'hotal_items';

function getItems() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_ITEMS));
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
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        // Broadcast custom event for same-window updates
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

// Export functions to global scope for static script inclusion
window.HotalStore = {
    getItems,
    saveItems,
    addItem,
    updateItem,
    toggleItemAvailability,
    removeItem,
    resetDefaultItems,
    DEFAULT_ITEMS
};
