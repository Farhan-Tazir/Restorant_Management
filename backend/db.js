// backend/db.js - SQL Database Connection & Data Store Provider

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// Load environment file if present (supported natively in Node.js 20+)
try {
    if (typeof process.loadEnvFile === 'function') {
        process.loadEnvFile();
    }
} catch (_) {}

// Security Hardening: Enforce required environment variables (no hardcoded fallback credentials)
if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    throw new Error(
        'Startup Error: Required environment variables ADMIN_EMAIL and ADMIN_PASSWORD are not set. ' +
        'Please configure them in your .env file or deployment environment variables.'
    );
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL.toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// In-Memory Fallback State (Simulates SQL database when DB server is not active)
const inMemoryDatabase = {
    users: [
        {
            id: 1,
            full_name: 'Demo Customer',
            email: 'customer@example.com',
            password_hash: bcrypt.hashSync(process.env.DEMO_PASSWORD || 'customer123', 10),
            role: 'customer',
            phone: '+92 300 1234567',
            address: 'House #12, Hotel Springs Avenue, Block 5, City',
            preferred_payment: 'Cash on Delivery',
            reward_points: 480,
            loyalty_badge: 'Gold Member',
            created_at: new Date().toISOString()
        },
        {
            id: 2,
            full_name: 'Restaurant Administrator',
            email: ADMIN_EMAIL,
            password_hash: bcrypt.hashSync(ADMIN_PASSWORD, 10),
            role: 'admin',
            phone: '+92 310 3546086',
            address: 'Restaurant Headquarters, Suite 101',
            preferred_payment: 'Corporate Account',
            reward_points: 9999,
            loyalty_badge: 'Super Administrator',
            created_at: new Date().toISOString()
        }
    ],
    menu_categories: [
        { id: 1, name: 'Burgers', display_order: 1 },
        { id: 2, name: 'Pizza', display_order: 2 },
        { id: 3, name: 'Grill', display_order: 3 },
        { id: 4, name: 'Fast Food', display_order: 4 },
        { id: 5, name: 'Drinks', display_order: 5 }
    ],
    menu_items: [
        {
            id: 1,
            category_id: 1,
            category: 'Fast Food',
            name: 'Burger',
            description: 'Juicy grilled beef patty with fresh lettuce, tomato, cheese and signature sauce.',
            price: 12.00,
            image: 'images/burger-removebg-preview.png',
            isAvailable: true,
            isFeatured: true,
            createdAt: new Date().toISOString()
        },
        {
            id: 2,
            category_id: 2,
            category: 'Pizza',
            name: 'Large Pizza',
            description: 'Cheesy pizza topped with fresh pepperoni, veggies, and classic marinara sauce.',
            price: 18.50,
            image: 'images/pizza-removebg-preview.png',
            isAvailable: true,
            isFeatured: true,
            createdAt: new Date().toISOString()
        },
        {
            id: 3,
            category_id: 3,
            category: 'Grill',
            name: 'Sekh Kabab',
            description: 'Tender charcoal-grilled spiced meat skewers served with mint chutney.',
            price: 14.00,
            image: 'images/sekh_kabak-removebg-preview.png',
            isAvailable: true,
            isFeatured: true,
            createdAt: new Date().toISOString()
        },
        {
            id: 4,
            category_id: 4,
            category: 'Fast Food',
            name: 'Shawarma',
            description: 'Flavorful wrapped spiced chicken with garlic sauce, veggies, and pickles.',
            price: 9.99,
            image: 'images/shawarma-removebg-preview.png',
            isAvailable: true,
            isFeatured: true,
            createdAt: new Date().toISOString()
        }
    ],
    favorites: [
        { id: 1, user_id: 1, menu_item_id: 1 },
        { id: 2, user_id: 1, menu_item_id: 2 },
        { id: 3, user_id: 1, menu_item_id: 3 },
        { id: 4, user_id: 1, menu_item_id: 4 }
    ],
    orders: [
        {
            id: 1,
            order_number: 'HTL-9402',
            user_id: 1,
            customer_name: 'Demo Customer',
            phone: '+92 300 1234567',
            order_type: 'delivery',
            table_number: '',
            delivery_address: 'House #12, Hotel Springs Avenue, Block 5, City',
            status: 'out_for_delivery',
            payment_method: 'Cash on Delivery',
            payment_status: 'pending',
            subtotal: 30.50,
            delivery_fee: 2.00,
            total_amount: 32.50,
            created_at: new Date().toISOString(),
            items: [
                { item_name: 'Burger', quantity: 1, unit_price: 12.00 },
                { item_name: 'Large Pizza', quantity: 1, unit_price: 18.50 }
            ]
        },
        {
            id: 2,
            order_number: 'HTL-8910',
            user_id: 1,
            customer_name: 'Demo Customer',
            phone: '+92 300 1234567',
            order_type: 'dine_in',
            table_number: 'Table #05',
            delivery_address: '',
            status: 'completed',
            payment_method: 'Credit / Debit Card',
            payment_status: 'paid',
            subtotal: 34.00,
            delivery_fee: 0.00,
            total_amount: 34.00,
            created_at: new Date(Date.now() - 86400000).toISOString(),
            items: [
                { item_name: 'Sekh Kabab', quantity: 2, unit_price: 14.00 },
                { item_name: 'Soft Drink', quantity: 2, unit_price: 3.00 }
            ]
        }
    ]
};

let dbPool = null;
let isConnected = false;

// Initialize Database Connection Pool
async function initDatabase() {
    const rawUrl = process.env.DATABASE_URL ? String(process.env.DATABASE_URL).trim() : '';
    const hasValidUrl = rawUrl.startsWith('mysql://') || rawUrl.startsWith('mysql2://');
    const hasHost = Boolean(process.env.DB_HOST && String(process.env.DB_HOST).trim());

    if (!hasValidUrl && !hasHost) {
        isConnected = false;
        console.log('[SQL Database] No valid MySQL DATABASE_URL or DB_HOST configured. Operating in standalone in-memory fallback mode.');
        return;
    }

    try {
        if (hasValidUrl) {
            console.log('[SQL Database] Attempting connection to MySQL using DATABASE_URL configuration.');
            dbPool = mysql.createPool(rawUrl);
        } else {
            console.log('[SQL Database] Attempting connection to MySQL using discrete DB_* environment variables.');
            const dbConfig = {
                host: process.env.DB_HOST,
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'hotel_db',
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0,
                connectTimeout: 3000
            };
            dbPool = mysql.createPool(dbConfig);
        }

        // Test connection
        const conn = await dbPool.getConnection();
        await conn.ping();
        conn.release();
        isConnected = true;
        console.log('[SQL Database] Connected successfully to MySQL database.');
    } catch (err) {
        isConnected = false;
        console.error('[SQL Database] Connection attempt failed:', err.message);
        console.log('[SQL Database] Operating in standalone in-memory fallback mode due to database connection error.');
    }
}

// User Repository Operations
const UserDAO = {
    async findByEmail(email) {
        if (!email) return null;
        const normalized = String(email).trim().toLowerCase();
        const variations = [normalized];
        if (normalized.endsWith('@gmailcom')) {
            variations.push(normalized.replace('@gmailcom', '@gmail.com'));
        } else if (normalized.endsWith('@gmail.com')) {
            variations.push(normalized.replace('@gmail.com', '@gmailcom'));
        }

        if (isConnected && dbPool) {
            try {
                const [rows] = await dbPool.query('SELECT * FROM users WHERE email IN (?)', [variations]);
                return rows[0] || null;
            } catch (e) {
                console.error('SQL query error:', e);
            }
        }
        return inMemoryDatabase.users.find(u => variations.includes(u.email.toLowerCase())) || null;
    },

    async findByPhone(phone) {
        if (!phone) return null;
        const normalized = phone.trim().replace(/\s+/g, '');
        if (isConnected && dbPool) {
            try {
                const [rows] = await dbPool.query('SELECT * FROM users WHERE REPLACE(phone, " ", "") = ?', [normalized]);
                return rows[0] || null;
            } catch (e) {
                console.error('SQL query error:', e);
            }
        }
        return inMemoryDatabase.users.find(u => u.phone && u.phone.trim().replace(/\s+/g, '') === normalized) || null;
    },

    async findById(id) {
        if (isConnected && dbPool) {
            try {
                const [rows] = await dbPool.query('SELECT * FROM users WHERE id = ?', [id]);
                return rows[0] || null;
            } catch (e) {
                console.error('SQL query error:', e);
            }
        }
        return inMemoryDatabase.users.find(u => u.id === Number(id) || u.id === id) || null;
    },

    async register(userData) {
        if (!userData.password || typeof userData.password !== 'string' || userData.password.length < 6) {
            throw new Error('Password must be at least 6 characters long.');
        }
        const passwordHash = await bcrypt.hash(userData.password, 10);
        if (isConnected && dbPool) {
            try {
                const [result] = await dbPool.query(
                    `INSERT INTO users (full_name, email, password_hash, phone, address, preferred_payment, reward_points, loyalty_badge)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        userData.full_name,
                        userData.email,
                        passwordHash,
                        userData.phone || '',
                        userData.address || '',
                        'Cash on Delivery',
                        100,
                        'Silver Member'
                    ]
                );
                return this.findById(result.insertId);
            } catch (e) {
                console.error('SQL insert error:', e);
            }
        }

        const newUser = {
            id: inMemoryDatabase.users.length + 1,
            full_name: userData.full_name,
            email: userData.email,
            password_hash: passwordHash,
            role: 'customer',
            phone: userData.phone || '',
            address: userData.address || '',
            preferred_payment: 'Cash on Delivery',
            reward_points: 100,
            loyalty_badge: 'Silver Member',
            created_at: new Date().toISOString()
        };
        inMemoryDatabase.users.push(newUser);
        return newUser;
    },

    async updatePasswordByPhone(phone, newPassword) {
        const normalized = phone.trim().replace(/\s+/g, '');
        const existing = await this.findByPhone(phone);
        if (!existing) return null;
        if (existing.role === 'admin') {
            throw new Error('Unauthorized: Administrator passwords cannot be reset via phone recovery.');
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);

        if (isConnected && dbPool) {
            try {
                await dbPool.query(
                    `UPDATE users SET password_hash = ?, updated_at = NOW() WHERE REPLACE(phone, " ", "") = ? AND role != 'admin'`,
                    [passwordHash, normalized]
                );
                return this.findByPhone(phone);
            } catch (e) {
                console.error('SQL update error:', e);
            }
        }

        const user = inMemoryDatabase.users.find(u => u.phone && u.phone.trim().replace(/\s+/g, '') === normalized && u.role !== 'admin');
        if (user) {
            user.password_hash = passwordHash;
            user.updated_at = new Date().toISOString();
        }
        return user;
    },

    async updateProfile(id, profileData) {
        if (isConnected && dbPool) {
            try {
                await dbPool.query(
                    `UPDATE users 
                     SET full_name = ?, email = ?, phone = ?, address = ?, preferred_payment = ?, updated_at = NOW() 
                     WHERE id = ?`,
                    [profileData.full_name, profileData.email, profileData.phone, profileData.address, profileData.preferred_payment, id]
                );
                return this.findById(id);
            } catch (e) {
                console.error('SQL query error:', e);
            }
        }

        const user = inMemoryDatabase.users.find(u => u.id === Number(id) || u.id === id);
        if (user) {
            user.full_name = profileData.full_name || user.full_name;
            user.email = profileData.email || user.email;
            user.phone = profileData.phone || user.phone;
            user.address = profileData.address || user.address;
            user.preferred_payment = profileData.preferred_payment || user.preferred_payment;
            user.updated_at = new Date().toISOString();
        }
        return user;
    },

    async getUserOrders(userId) {
        if (isConnected && dbPool) {
            try {
                const [orders] = await dbPool.query(
                    'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', 
                    [userId]
                );
                for (let order of orders) {
                    const [items] = await dbPool.query(
                        'SELECT * FROM order_items WHERE order_id = ?', 
                        [order.id]
                    );
                    order.items = items;
                }
                return orders;
            } catch (e) {
                console.error('SQL query error:', e);
            }
        }
        return inMemoryDatabase.orders.filter(o => o.user_id === Number(userId) || o.user_id === userId);
    },

    async getAllOrders() {
        if (isConnected && dbPool) {
            try {
                const [orders] = await dbPool.query('SELECT * FROM orders ORDER BY created_at DESC');
                for (let order of orders) {
                    const [items] = await dbPool.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
                    order.items = items;
                }
                return orders;
            } catch (e) {
                console.error('SQL query error:', e);
            }
        }
        return inMemoryDatabase.orders;
    },

    async createOrder(orderData) {
        const orderNumber = orderData.order_number || orderData.id || ('HTL-' + Math.floor(1000 + Math.random() * 9000));
        const subtotal = parseFloat(orderData.subtotal || 0);
        const deliveryFee = orderData.order_type === 'delivery' ? 2.00 : 0.00;
        const totalAmount = subtotal + deliveryFee;

        if (isConnected && dbPool) {
            try {
                const [res] = await dbPool.query(
                    `INSERT INTO orders (order_number, user_id, order_type, table_number, delivery_address, status, subtotal, delivery_fee, total_amount)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        orderNumber,
                        orderData.user_id || 1,
                        orderData.order_type || 'delivery',
                        orderData.table_number || '',
                        orderData.delivery_address || '',
                        'pending',
                        subtotal,
                        deliveryFee,
                        totalAmount
                    ]
                );

                const orderId = res.insertId;

                if (orderData.items && orderData.items.length) {
                    for (let item of orderData.items) {
                        await dbPool.query(
                            `INSERT INTO order_items (order_id, item_name, unit_price, quantity) VALUES (?, ?, ?, ?)`,
                            [orderId, item.item_name || 'Menu Item', item.unit_price || 10, item.quantity || 1]
                        );
                    }
                }

                // Insert payment record
                await dbPool.query(
                    `INSERT INTO payments (order_id, amount, method, status) VALUES (?, ?, ?, ?)`,
                    [orderId, totalAmount, orderData.payment_method || 'cash', 'pending']
                );

                return this.getUserOrders(orderData.user_id || 1)[0];
            } catch (e) {
                console.error('SQL order error:', e);
            }
        }

        const newOrder = {
            id: orderNumber,
            order_number: orderNumber,
            user_id: orderData.user_id || 1,
            customer_name: orderData.customer_name || 'Customer',
            phone: orderData.phone || '',
            order_type: orderData.order_type || 'delivery',
            table_number: orderData.table_number || '',
            delivery_address: orderData.delivery_address || '',
            status: 'pending',
            payment_method: orderData.payment_method || 'Cash on Delivery',
            payment_status: 'pending',
            subtotal: subtotal,
            delivery_fee: deliveryFee,
            total_amount: totalAmount,
            created_at: new Date().toISOString(),
            items: orderData.items || []
        };
        inMemoryDatabase.orders.unshift(newOrder);
        return newOrder;
    },

    async updateOrderStatus(orderId, status, paymentStatus) {
        if (isConnected && dbPool) {
            try {
                await dbPool.query(
                    `UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ? OR order_number = ?`,
                    [status, orderId, orderId]
                );
                if (paymentStatus) {
                    await dbPool.query(
                        `UPDATE payments SET status = ? WHERE order_id = (SELECT id FROM orders WHERE id = ? OR order_number = ? LIMIT 1)`,
                        [paymentStatus, orderId, orderId]
                    );
                }
            } catch (e) {
                console.error('SQL status update error:', e);
            }
        }

        const order = inMemoryDatabase.orders.find(o => o.id === orderId || o.order_number === orderId || String(o.id) === String(orderId));
        if (order) {
            order.status = status;
            if (paymentStatus) order.payment_status = paymentStatus;
            else if (status === 'completed') order.payment_status = 'paid';
        }
        return order;
    },

    async getUserFavorites(userId) {
        const uid = Number(userId) || userId;
        if (isConnected && dbPool) {
            try {
                const [rows] = await dbPool.query(
                    `SELECT m.id, m.category_id, c.name AS category, m.name, m.description, 
                            m.price, m.image_url AS image, m.is_available AS isAvailable, m.created_at AS createdAt
                     FROM menu_items m 
                     LEFT JOIN menu_categories c ON m.category_id = c.id
                     JOIN user_favorites f ON m.id = f.menu_item_id 
                     WHERE f.user_id = ?
                     ORDER BY f.id DESC`,
                    [uid]
                );
                return rows.map(r => ({
                    id: r.id,
                    name: r.name,
                    category: r.category || 'Special',
                    price: parseFloat(r.price || 0),
                    description: r.description || '',
                    image: r.image || 'images/fast-food.png',
                    isAvailable: Boolean(r.isAvailable),
                    isFeatured: true
                }));
            } catch (e) {
                console.error('SQL getUserFavorites error:', e);
            }
        }
        // In-memory fallback
        const userFavEntries = inMemoryDatabase.favorites.filter(
            f => f.user_id === uid || String(f.user_id) === String(uid)
        );
        const userFavIds = userFavEntries.map(f => f.menu_item_id);
        return inMemoryDatabase.menu_items.filter(
            m => userFavIds.includes(m.id) || userFavIds.includes(Number(m.id)) || userFavIds.includes(String(m.id))
        ).map(m => ({ ...m }));
    },

    async addFavorite(userId, menuItemId) {
        const uid = Number(userId) || userId;
        const mid = Number(menuItemId) || menuItemId;
        if (isConnected && dbPool) {
            try {
                await dbPool.query(
                    `INSERT IGNORE INTO user_favorites (user_id, menu_item_id) VALUES (?, ?)`,
                    [uid, mid]
                );
                return { user_id: uid, menu_item_id: mid };
            } catch (e) {
                console.error('SQL addFavorite error:', e);
            }
        }
        const exists = inMemoryDatabase.favorites.some(
            f => (f.user_id === uid || String(f.user_id) === String(uid)) &&
                 (f.menu_item_id === mid || String(f.menu_item_id) === String(mid))
        );
        if (!exists) {
            inMemoryDatabase.favorites.push({
                id: inMemoryDatabase.favorites.length + 1,
                user_id: uid,
                menu_item_id: mid
            });
        }
        return { user_id: uid, menu_item_id: mid };
    },

    async removeFavorite(userId, menuItemId) {
        const uid = Number(userId) || userId;
        const mid = Number(menuItemId) || menuItemId;
        if (isConnected && dbPool) {
            try {
                await dbPool.query(
                    `DELETE FROM user_favorites WHERE user_id = ? AND menu_item_id = ?`,
                    [uid, mid]
                );
                return true;
            } catch (e) {
                console.error('SQL removeFavorite error:', e);
            }
        }
        inMemoryDatabase.favorites = inMemoryDatabase.favorites.filter(
            f => !((f.user_id === uid || String(f.user_id) === String(uid)) &&
                   (f.menu_item_id === mid || String(f.menu_item_id) === String(mid)))
        );
        return true;
    }
};

// Menu Item Operations (Admin Management & Public Menu Access)
const MenuDAO = {
    async getAllItems() {
        if (isConnected && dbPool) {
            try {
                const [rows] = await dbPool.query(
                    `SELECT m.id, m.category_id, c.name AS category, m.name, m.description, 
                            m.price, m.image_url AS image, m.is_available AS isAvailable, m.created_at AS createdAt
                     FROM menu_items m
                     LEFT JOIN menu_categories c ON m.category_id = c.id
                     ORDER BY m.id ASC`
                );
                return rows.map(r => ({
                    id: r.id,
                    name: r.name,
                    category: r.category || 'Special',
                    price: parseFloat(r.price || 0),
                    description: r.description || '',
                    image: r.image || 'images/fast-food.png',
                    isAvailable: Boolean(r.isAvailable),
                    isFeatured: true,
                    createdAt: r.createdAt
                }));
            } catch (e) {
                console.error('SQL getAllItems error:', e);
            }
        }
        return inMemoryDatabase.menu_items.map(m => ({ ...m }));
    },

    async getItemById(id) {
        const numId = Number(id) || id;
        if (isConnected && dbPool) {
            try {
                const [rows] = await dbPool.query(
                    `SELECT m.id, m.category_id, c.name AS category, m.name, m.description, 
                            m.price, m.image_url AS image, m.is_available AS isAvailable, m.created_at AS createdAt
                     FROM menu_items m
                     LEFT JOIN menu_categories c ON m.category_id = c.id
                     WHERE m.id = ?`,
                    [numId]
                );
                if (rows.length > 0) {
                    const r = rows[0];
                    return {
                        id: r.id,
                        name: r.name,
                        category: r.category || 'Special',
                        price: parseFloat(r.price || 0),
                        description: r.description || '',
                        image: r.image || 'images/fast-food.png',
                        isAvailable: Boolean(r.isAvailable),
                        isFeatured: true,
                        createdAt: r.createdAt
                    };
                }
            } catch (e) {
                console.error('SQL getItemById error:', e);
            }
        }
        return inMemoryDatabase.menu_items.find(m => m.id === id || m.id === numId || String(m.id) === String(id)) || null;
    },

    async addItem(itemData) {
        const name = String(itemData.name || '').trim();
        const category = String(itemData.category || 'Fast Food').trim();
        const price = parseFloat(itemData.price || 0);
        const description = String(itemData.description || '').trim();
        const image = String(itemData.image || itemData.image_url || 'images/fast-food.png').trim();
        const isAvailable = itemData.isAvailable !== false && itemData.is_available !== false;
        const isFeatured = itemData.isFeatured !== undefined ? Boolean(itemData.isFeatured) : true;

        if (isConnected && dbPool) {
            try {
                let categoryId = 1;
                const [catRows] = await dbPool.query('SELECT id FROM menu_categories WHERE name = ? LIMIT 1', [category]);
                if (catRows.length > 0) {
                    categoryId = catRows[0].id;
                } else {
                    const [catInsert] = await dbPool.query('INSERT INTO menu_categories (name) VALUES (?)', [category]);
                    categoryId = catInsert.insertId;
                }

                const [res] = await dbPool.query(
                    `INSERT INTO menu_items (category_id, name, description, price, image_url, is_available)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [categoryId, name, description, price, image, isAvailable ? 1 : 0]
                );
                return await this.getItemById(res.insertId);
            } catch (e) {
                console.error('SQL addItem error:', e);
            }
        }

        const nextId = inMemoryDatabase.menu_items.length > 0 
            ? Math.max(...inMemoryDatabase.menu_items.map(m => typeof m.id === 'number' ? m.id : parseInt(String(m.id).replace(/\D/g, '') || '0', 10))) + 1
            : 1;

        const newItem = {
            id: nextId,
            category_id: 1,
            category,
            name,
            description,
            price,
            image,
            isAvailable,
            isFeatured,
            createdAt: new Date().toISOString()
        };
        inMemoryDatabase.menu_items.push(newItem);
        return newItem;
    },

    async updateItem(id, itemData) {
        const numId = Number(id) || id;
        const existing = await this.getItemById(id);
        if (!existing) return null;

        const name = itemData.name !== undefined ? String(itemData.name).trim() : existing.name;
        const category = itemData.category !== undefined ? String(itemData.category).trim() : existing.category;
        const price = itemData.price !== undefined ? parseFloat(itemData.price || 0) : existing.price;
        const description = itemData.description !== undefined ? String(itemData.description).trim() : existing.description;
        const image = itemData.image !== undefined ? String(itemData.image).trim() : (itemData.image_url !== undefined ? String(itemData.image_url).trim() : existing.image);
        const isAvailable = itemData.isAvailable !== undefined ? Boolean(itemData.isAvailable) : (itemData.is_available !== undefined ? Boolean(itemData.is_available) : existing.isAvailable);
        const isFeatured = itemData.isFeatured !== undefined ? Boolean(itemData.isFeatured) : existing.isFeatured;

        if (isConnected && dbPool) {
            try {
                let categoryId = null;
                if (itemData.category) {
                    const [catRows] = await dbPool.query('SELECT id FROM menu_categories WHERE name = ? LIMIT 1', [category]);
                    if (catRows.length > 0) {
                        categoryId = catRows[0].id;
                    } else {
                        const [catInsert] = await dbPool.query('INSERT INTO menu_categories (name) VALUES (?)', [category]);
                        categoryId = catInsert.insertId;
                    }
                }

                if (categoryId) {
                    await dbPool.query(
                        `UPDATE menu_items 
                         SET name = ?, category_id = ?, description = ?, price = ?, image_url = ?, is_available = ?, updated_at = NOW()
                         WHERE id = ?`,
                        [name, categoryId, description, price, image, isAvailable ? 1 : 0, numId]
                    );
                } else {
                    await dbPool.query(
                        `UPDATE menu_items 
                         SET name = ?, description = ?, price = ?, image_url = ?, is_available = ?, updated_at = NOW()
                         WHERE id = ?`,
                        [name, description, price, image, isAvailable ? 1 : 0, numId]
                    );
                }
                return await this.getItemById(numId);
            } catch (e) {
                console.error('SQL updateItem error:', e);
            }
        }

        const inMemItem = inMemoryDatabase.menu_items.find(m => m.id === id || m.id === numId || String(m.id) === String(id));
        if (inMemItem) {
            inMemItem.name = name;
            inMemItem.category = category;
            inMemItem.price = price;
            inMemItem.description = description;
            inMemItem.image = image;
            inMemItem.isAvailable = isAvailable;
            inMemItem.isFeatured = isFeatured;
            inMemItem.updatedAt = new Date().toISOString();
            return { ...inMemItem };
        }
        return null;
    },

    async deleteItem(id) {
        const numId = Number(id) || id;
        if (isConnected && dbPool) {
            try {
                await dbPool.query('DELETE FROM menu_items WHERE id = ?', [numId]);
                return true;
            } catch (e) {
                console.error('SQL deleteItem error:', e);
            }
        }
        const initialLen = inMemoryDatabase.menu_items.length;
        inMemoryDatabase.menu_items = inMemoryDatabase.menu_items.filter(
            m => !(m.id === id || m.id === numId || String(m.id) === String(id))
        );
        return inMemoryDatabase.menu_items.length < initialLen;
    }
};

module.exports = {
    initDatabase,
    UserDAO,
    MenuDAO
};
