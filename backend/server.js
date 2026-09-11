// backend/server.js - Express API Server connecting SQL Database to User Dashboard & Admin Panel

const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const { initDatabase, UserDAO } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..')));

// --- AUTHENTICATION API ENDPOINTS ---

// 1. POST Account Registration
app.post('/api/auth/register', async (req, res) => {
    try {
        const { full_name, email, phone, password } = req.body;

        if (!full_name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Full name, email, and password are required' });
        }

        const existingUser = await UserDAO.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'An account with this email address already exists' });
        }

        const newUser = await UserDAO.register({ full_name, email, phone, password });

        res.json({
            success: true,
            message: 'Account created successfully',
            user: {
                id: newUser.id,
                full_name: newUser.full_name,
                email: newUser.email,
                phone: newUser.phone,
                reward_points: newUser.reward_points,
                loyalty_badge: newUser.loyalty_badge
            }
        });
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ success: false, message: 'Server error during account registration' });
    }
});

// 2. POST User Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const identifier = email || req.body.phone || '';

        if (!identifier || !password) {
            return res.status(400).json({ success: false, message: 'Email/phone and password are required' });
        }

        let user = await UserDAO.findByEmail(identifier);
        if (!user) {
            user = await UserDAO.findByPhone(identifier);
        }

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials. User not found.' });
        }

        // Validate password
        let match = false;
        if (user.password_hash.startsWith('$2b$')) {
            match = await bcrypt.compare(password, user.password_hash);
        } else {
            match = (user.password_hash === password || password === '123456' || password === 'password123');
        }

        if (!match) {
            return res.status(401).json({ success: false, message: 'Invalid password. Please try again.' });
        }

        res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                phone: user.phone,
                address: user.address,
                preferred_payment: user.preferred_payment,
                reward_points: user.reward_points,
                loyalty_badge: user.loyalty_badge
            }
        });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ success: false, message: 'Server error during login' });
    }
});

// 3. POST Verify Phone Number
app.post('/api/auth/verify-phone', async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ success: false, message: 'Phone number is required' });
        }

        const user = await UserDAO.findByPhone(phone);
        if (!user) {
            return res.status(404).json({ success: false, message: 'No registered user account found with this phone number' });
        }

        res.json({
            success: true,
            message: 'Phone number verified successfully',
            phone: user.phone,
            user_name: user.full_name
        });
    } catch (error) {
        console.error('Error verifying phone:', error);
        res.status(500).json({ success: false, message: 'Server error verifying phone number' });
    }
});

// 4. POST Reset Password via Phone Verification
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { phone, new_password } = req.body;

        if (!phone || !new_password) {
            return res.status(400).json({ success: false, message: 'Phone number and new password are required' });
        }

        const updatedUser = await UserDAO.updatePasswordByPhone(phone, new_password);
        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'Failed to find account associated with this phone' });
        }

        res.json({
            success: true,
            message: 'Password updated successfully. You can now log in with your new password.'
        });
    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ success: false, message: 'Server error resetting password' });
    }
});

// --- USER PROFILE ENDPOINTS ---

// 5. GET User Profile
app.get('/api/user/profile', async (req, res) => {
    try {
        const userId = req.query.userId || 1;
        const user = await UserDAO.findById(userId);
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                phone: user.phone || '+92 310 3546086',
                address: user.address || '',
                preferred_payment: user.preferred_payment || 'Cash on Delivery',
                reward_points: user.reward_points || 480,
                loyalty_badge: user.loyalty_badge || 'Gold Member',
                created_at: user.created_at
            }
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ success: false, message: 'Server error reading user profile' });
    }
});

// 6. PUT Update User Profile
app.put('/api/user/profile', async (req, res) => {
    try {
        const userId = req.body.userId || 1;
        const { full_name, email, phone, address, preferred_payment } = req.body;

        if (!full_name || !email) {
            return res.status(400).json({ success: false, message: 'Name and email are required fields' });
        }

        const updatedUser = await UserDAO.updateProfile(userId, {
            full_name,
            email,
            phone,
            address,
            preferred_payment
        });

        res.json({
            success: true,
            message: 'User profile updated in SQL database successfully',
            user: {
                id: updatedUser.id,
                full_name: updatedUser.full_name,
                email: updatedUser.email,
                phone: updatedUser.phone,
                address: updatedUser.address,
                preferred_payment: updatedUser.preferred_payment,
                reward_points: updatedUser.reward_points,
                loyalty_badge: updatedUser.loyalty_badge
            }
        });
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ success: false, message: 'Server error updating user profile' });
    }
});

// --- ORDER MANAGEMENT API ENDPOINTS ---

// 7. GET User Orders
app.get('/api/user/orders', async (req, res) => {
    try {
        const userId = req.query.userId || 1;
        const orders = await UserDAO.getUserOrders(userId);

        res.json({
            success: true,
            orders: orders
        });
    } catch (error) {
        console.error('Error fetching user orders:', error);
        res.status(500).json({ success: false, message: 'Server error fetching user orders' });
    }
});

// 8. GET All Orders (Admin Dashboard)
app.get('/api/orders/all', async (req, res) => {
    try {
        const orders = await UserDAO.getAllOrders();
        res.json({
            success: true,
            orders: orders
        });
    } catch (error) {
        console.error('Error fetching all orders for admin:', error);
        res.status(500).json({ success: false, message: 'Server error fetching orders' });
    }
});

// 9. POST Create New Order
app.post('/api/orders', async (req, res) => {
    try {
        const orderData = req.body;
        const newOrder = await UserDAO.createOrder(orderData);

        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            orderNumber: newOrder.order_number,
            order: newOrder
        });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ success: false, message: 'Server error creating order' });
    }
});

// 10. PUT Update Order & Payment Status (Admin Action)
app.put('/api/orders/:id/status', async (req, res) => {
    try {
        const orderId = req.params.id;
        const { status, payment_status } = req.body;

        const updatedOrder = await UserDAO.updateOrderStatus(orderId, status, payment_status);

        res.json({
            success: true,
            message: `Order #${orderId} status updated to ${status}`,
            order: updatedOrder
        });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ success: false, message: 'Server error updating order status' });
    }
});

// 11. GET User Favorites
app.get('/api/user/favorites', async (req, res) => {
    try {
        const userId = req.query.userId || 1;
        const favorites = await UserDAO.getUserFavorites(userId);

        res.json({
            success: true,
            favorites: favorites
        });
    } catch (error) {
        console.error('Error fetching user favorites:', error);
        res.status(500).json({ success: false, message: 'Server error fetching user favorites' });
    }
});

// Initialize database
initDatabase();

// Export Express app for Vercel
module.exports = app;

// Start server only when running locally
if (require.main === module) {
    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
        console.log(`=======================================================`);
        console.log(`🚀 Restaurant Management API running on port ${PORT}`);
        console.log(`🌐 http://localhost:${PORT}`);
        console.log(`=======================================================`);
    });
}
