// backend/db.js - SQL Database Connection & Data Store Provider

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '031035farhan@gmail.com').toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'farhan1709';

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
    if (!process.env.DB_HOST && !process.env.DATABASE_URL) {
        isConnected = false;
        console.log('[SQL Database] Operating in standalone SQL API fallback mode (no DB_HOST configured).');
        return;
    }

    const dbConfig = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'hotel_db',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 2000
    };

    try {
        dbPool = mysql.createPool(dbConfig);
        // Test connection
        const conn = await dbPool.getConnection();
        await conn.ping();
        conn.release();
        isConnected = true;
        console.log('[SQL Database] Connected successfully to MySQL database.');
    } catch (err) {
        isConnected = false;
        console.log('[SQL Database] Operating in standalone SQL API fallback mode (MySQL service unattached).');
    }
}

// User Repository Operations
const UserDAO = {
    async findByEmail(email) {
        if (!email) return null;
        if (isConnected && dbPool) {
            try {
                const [rows] = await dbPool.query('SELECT * FROM users WHERE email = ?', [email]);
                return rows[0] || null;
            } catch (e) {
                console.error('SQL query error:', e);
            }
        }
        return inMemoryDatabase.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
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
        if (isConnected && dbPool) {
            try {
                const [rows] = await dbPool.query(
                    `SELECT m.* FROM menu_items m 
                     JOIN user_favorites f ON m.id = f.menu_item_id 
                     WHERE f.user_id = ?`,
                    [userId]
                );
                return rows;
            } catch (e) {
                console.error('SQL query error:', e);
            }
        }
        return [
            { id: 1, name: 'Burger', price: 12.00, description: 'Juicy grilled beef patty with fresh lettuce, tomato, cheese and signature sauce.', image: 'images/burger-removebg-preview.png' },
            { id: 2, name: 'Large Pizza', price: 18.50, description: 'Cheesy pizza topped with fresh pepperoni, veggies, and classic marinara sauce.', image: 'images/pizza-removebg-preview.png' },
            { id: 3, name: 'Sekh Kabab', price: 14.00, description: 'Tender charcoal-grilled spiced meat skewers served with mint chutney.', image: 'images/sekh_kabak-removebg-preview.png' },
            { id: 4, name: 'Shawarma', price: 9.99, description: 'Flavorful wrapped spiced chicken with garlic sauce, veggies, and pickles.', image: 'images/shawarma-removebg-preview.png' }
        ];
    }
};

module.exports = {
    initDatabase,
    UserDAO
};
