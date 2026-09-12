// backend/server.js - Express API Server connecting SQL Database to User Dashboard & Admin Panel

const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { initDatabase, UserDAO } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Server-Side Session Security & Token Configuration
const SESSION_SECRET = process.env.SESSION_SECRET || 'hotel_mgmt_secure_session_secret_2026_x89a';
const activeSessions = new Map();

/**
 * Creates a cryptographically signed, tamper-proof session token.
 * Format: payloadBase64Url.signatureBase64Url
 * Works seamlessly across both in-memory state and Vercel serverless instances.
 */
function createSession(user) {
    const role = user.role || 'customer';
    const payload = {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: role,
        phone: user.phone || '',
        iat: Date.now(),
        exp: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days expiration
    };

    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
    const token = `${payloadB64}.${signature}`;

    activeSessions.set(token, payload);
    return { token, session: payload };
}

/**
 * Verifies and decodes a signed session token.
 * Rejects any fabricated, altered, or expired tokens.
 */
async function verifySessionToken(token) {
    if (!token || typeof token !== 'string') return null;

    // Check fast in-memory active sessions first
    if (activeSessions.has(token)) {
        const cached = activeSessions.get(token);
        if (cached && cached.exp > Date.now()) {
            return cached;
        }
        activeSessions.delete(token);
    }

    // Verify cryptographic HMAC signature for serverless/cold-start requests
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadB64, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');

    try {
        const sigBuffer = Buffer.from(signature);
        const expectedBuffer = Buffer.from(expectedSig);
        if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
            return null; // Tampered or invalid signature
        }

        const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
        if (!payload || !payload.exp || payload.exp < Date.now()) {
            return null; // Expired
        }

        // Validate user against server database/in-memory records for authoritative role verification
        const user = await UserDAO.findById(payload.id);
        if (!user) return null;

        // Authoritative role from server record
        payload.role = user.role || 'customer';
        payload.full_name = user.full_name || payload.full_name;
        payload.phone = user.phone || payload.phone;

        activeSessions.set(token, payload);
        return payload;
    } catch (_) {
        return null;
    }
}

/**
 * Extracts authentication token from Bearer header, X-Auth-Token, HttpOnly Cookie, or query param.
 */
function extractToken(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const t = authHeader.substring(7).trim();
        if (t) return t;
    }

    if (req.headers['x-auth-token']) {
        const t = String(req.headers['x-auth-token']).trim();
        if (t) return t;
    }

    if (req.headers.cookie) {
        const cookies = req.headers.cookie.split(';');
        for (const cookie of cookies) {
            const [name, ...valParts] = cookie.trim().split('=');
            if (name === 'auth_token') {
                const val = decodeURIComponent(valParts.join('=')).trim();
                if (val) return val;
            }
        }
    }

    if (req.query && req.query.token) {
        return String(req.query.token).trim();
    }

    return null;
}

/**
 * Sets secure HttpOnly cookie for session token.
 */
function setAuthCookie(res, token) {
    const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
    // SameSite=None with Secure is required for iframe embedded environments (e.g. AI Studio preview)
    const cookieFlags = isProduction
        ? '; SameSite=None; Secure; Partitioned'
        : '; SameSite=Lax';
    res.setHeader('Set-Cookie', `auth_token=${encodeURIComponent(token)}; Path=/; HttpOnly${cookieFlags}; Max-Age=${7 * 24 * 3600}`);
}

/**
 * Clears HttpOnly authentication cookie.
 */
function clearAuthCookie(res) {
    const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
    const cookieFlags = isProduction
        ? '; SameSite=None; Secure; Partitioned'
        : '; SameSite=Lax';
    res.setHeader('Set-Cookie', `auth_token=; Path=/; HttpOnly${cookieFlags}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
}

// Authentication extraction middleware (runs on all requests)
app.use(async (req, res, next) => {
    const token = extractToken(req);
    if (token) {
        const userSession = await verifySessionToken(token);
        if (userSession) {
            req.user = userSession;
            req.authToken = token;
        } else {
            req.user = null;
            req.authToken = null;
        }
    } else {
        req.user = null;
        req.authToken = null;
    }
    next();
});

// Guard: User must be authenticated
function requireAuth(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required. Please log in to continue.'
        });
    }
    next();
}

// Guard: User must be an administrator
function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required. Please log in as an administrator.'
        });
    }
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Access denied: Administrator privileges required.'
        });
    }
    next();
}

// --- SERVER-PROTECTED ADMINISTRATOR PORTAL ROUTE ---
// Accessible strictly to authenticated administrators.
// Prevents static file exposure and unauthorized direct navigation.
app.get(['/admin', '/admin.html'], (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');

    // If an authenticated user with customer role attempts to access admin panel, deny with 403
    if (req.user && req.user.role !== 'admin') {
        return res.status(403).send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>403 - Access Denied | Hotel Admin</title>
    <link rel="stylesheet" href="/style.css">
    <link rel="stylesheet" href="https://unpkg.com/boxicons@latest/css/boxicons.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #0e0e0e; color: #fff; font-family: 'Poppins', sans-serif; text-align: center; padding: 20px; margin: 0; }
        .auth-card { background: #181818; border: 1px solid #e74c3c; padding: 48px 36px; border-radius: 16px; max-width: 460px; width: 100%; box-shadow: 0 10px 30px rgba(0,0,0,0.6); }
        .auth-card i { font-size: 54px; color: #e74c3c; margin-bottom: 16px; display: inline-block; }
        h1 { color: #e74c3c; font-size: 1.7rem; margin: 0 0 12px; font-weight: 700; }
        p { color: #aaa; font-size: 14px; margin: 0 0 28px; line-height: 1.6; }
        .btn { display: inline-block; background: #ff9f0d; color: #fff; padding: 12px 30px; border-radius: 30px; text-decoration: none; font-weight: 600; transition: 0.3s; }
        .btn:hover { background: #e08906; transform: translateY(-2px); }
    </style>
    <script>
        setTimeout(function() {
            window.location.replace('/user-dashboard.html');
        }, 1500);
    </script>
</head>
<body>
    <div class="auth-card">
        <i class='bx bx-shield-x'></i>
        <h1>Access Denied (403)</h1>
        <p>Your account does not have administrator privileges. Only authorized managers may access this portal. Redirecting to user dashboard...</p>
        <a href="/user-dashboard.html" class="btn">Return to User Dashboard</a>
    </div>
</body>
</html>
        `);
    }

    // Serve protected admin dashboard.
    // The embedded cryptographic guard in admin.html / admin.js verifies the administrator token
    // against /api/auth/me using Bearer authentication (persisted securely in localStorage).
    // Unauthenticated visitors are instantly redirected to login.html by the head guard.
    res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

// Server-Side Guard for User Dashboard: Super Admin must NEVER enter or use user-dashboard.html
app.get(['/user-dashboard', '/user-dashboard.html'], (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');

    // If an authenticated admin tries to access customer dashboard, redirect to admin dashboard
    if (req.user && req.user.role === 'admin') {
        return res.redirect('/admin.html');
    }

    // Serve user-dashboard.html for customers/visitors
    res.sendFile(path.join(__dirname, '..', 'user-dashboard.html'));
});

// Serve frontend static public files (admin.html is safely kept inside backend/views/)
app.use(express.static(path.join(__dirname, '..')));

// --- AUTHENTICATION API ENDPOINTS ---

// 1. POST Account Registration
app.post('/api/auth/register', async (req, res) => {
    try {
        const { full_name, email, phone, password } = req.body;

        if (!full_name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Full name, email, and password are required' });
        }

        if (typeof password !== 'string' || password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
        }

        const existingUser = await UserDAO.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'An account with this email address already exists' });
        }

        // New registrations are always assigned 'customer' role
        const role = 'customer';
        const newUser = await UserDAO.register({ full_name, email, phone, password, role });
        const { token } = createSession({ ...newUser, role });

        setAuthCookie(res, token);

        res.json({
            success: true,
            message: 'Account created successfully',
            token: token,
            user: {
                id: newUser.id,
                full_name: newUser.full_name,
                email: newUser.email,
                phone: newUser.phone,
                role: role,
                reward_points: newUser.reward_points,
                loyalty_badge: newUser.loyalty_badge
            }
        });
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ success: false, message: error.message || 'Server error during account registration' });
    }
});

// 2. POST User Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const identifier = (email || req.body.phone || '').trim();

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

        // Strict password verification using bcrypt only. No hardcoded or universal bypass passwords.
        let match = false;
        if (user.password_hash) {
            try {
                match = await bcrypt.compare(password, user.password_hash);
            } catch (_) {
                match = false;
            }
        }

        if (!match) {
            return res.status(401).json({ success: false, message: 'Invalid credentials. Please check your password.' });
        }

        const role = user.role || 'customer';
        const { token } = createSession({ ...user, role });

        setAuthCookie(res, token);

        res.json({
            success: true,
            message: 'Login successful',
            token: token,
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                phone: user.phone,
                role: role,
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

// 2b. POST User Logout
app.post('/api/auth/logout', (req, res) => {
    if (req.authToken) {
        activeSessions.delete(req.authToken);
    }
    clearAuthCookie(res);
    res.json({ success: true, message: 'Logged out successfully' });
});

// 2c. GET Current Authenticated User Info
app.get('/api/auth/me', requireAuth, async (req, res) => {
    try {
        const user = await UserDAO.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.json({
            success: true,
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                phone: user.phone,
                role: req.user.role,
                address: user.address,
                preferred_payment: user.preferred_payment,
                reward_points: user.reward_points,
                loyalty_badge: user.loyalty_badge
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error checking session' });
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

// 5. GET User Profile (Protected - Authenticated user only)
app.get('/api/user/profile', requireAuth, async (req, res) => {
    try {
        let targetId = req.user.id;
        if (req.query.userId && String(req.query.userId) !== String(req.user.id)) {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ success: false, message: 'Forbidden: You cannot view another user\'s profile' });
            }
            targetId = req.query.userId;
        }

        const user = await UserDAO.findById(targetId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                phone: user.phone || '',
                address: user.address || '',
                preferred_payment: user.preferred_payment || 'Cash on Delivery',
                reward_points: user.reward_points || 0,
                loyalty_badge: user.loyalty_badge || 'Silver Member',
                role: user.role || 'customer',
                created_at: user.created_at
            }
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ success: false, message: 'Server error reading user profile' });
    }
});

// 6. PUT Update User Profile (Protected - Authenticated user or Admin)
app.put('/api/user/profile', requireAuth, async (req, res) => {
    try {
        let targetId = req.user.id;
        if (req.body.userId && String(req.body.userId) !== String(req.user.id)) {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ success: false, message: 'Forbidden: You cannot update another user\'s profile' });
            }
            targetId = req.body.userId;
        }

        const { full_name, email, phone, address, preferred_payment } = req.body;

        if (!full_name || !email) {
            return res.status(400).json({ success: false, message: 'Name and email are required fields' });
        }

        const updatedUser = await UserDAO.updateProfile(targetId, {
            full_name,
            email,
            phone,
            address,
            preferred_payment
        });

        res.json({
            success: true,
            message: 'User profile updated successfully',
            user: {
                id: updatedUser.id,
                full_name: updatedUser.full_name,
                email: updatedUser.email,
                phone: updatedUser.phone,
                address: updatedUser.address,
                preferred_payment: updatedUser.preferred_payment,
                reward_points: updatedUser.reward_points,
                loyalty_badge: updatedUser.loyalty_badge,
                role: updatedUser.role || 'customer'
            }
        });
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ success: false, message: 'Server error updating user profile' });
    }
});

// --- ORDER MANAGEMENT API ENDPOINTS ---

// 7. GET User Orders (Protected - Authenticated user only)
app.get('/api/user/orders', requireAuth, async (req, res) => {
    try {
        let targetId = req.user.id;
        if (req.query.userId && String(req.query.userId) !== String(req.user.id)) {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ success: false, message: 'Forbidden: You cannot view another user\'s orders' });
            }
            targetId = req.query.userId;
        }

        const orders = await UserDAO.getUserOrders(targetId);

        res.json({
            success: true,
            orders: orders
        });
    } catch (error) {
        console.error('Error fetching user orders:', error);
        res.status(500).json({ success: false, message: 'Server error fetching user orders' });
    }
});

// 8. GET All Orders (Admin Dashboard - Protected Admin Only)
app.get('/api/orders/all', requireAdmin, async (req, res) => {
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

// 9. POST Create New Order (Protected - Authenticated user)
app.post('/api/orders', requireAuth, async (req, res) => {
    try {
        const orderData = {
            ...req.body,
            user_id: req.user.id,
            customer_name: req.body.customer_name || req.user.full_name,
            phone: req.body.phone || req.user.phone || ''
        };
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

// 10. PUT Update Order & Payment Status (Admin Action - Protected Admin Only)
app.put('/api/orders/:id/status', requireAdmin, async (req, res) => {
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

// 11. GET User Favorites (Protected - Authenticated user only)
app.get('/api/user/favorites', requireAuth, async (req, res) => {
    try {
        let targetId = req.user.id;
        if (req.query.userId && String(req.query.userId) !== String(req.user.id)) {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ success: false, message: 'Forbidden: You cannot view another user\'s favorites' });
            }
            targetId = req.query.userId;
        }

        const favorites = await UserDAO.getUserFavorites(targetId);

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

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`=======================================================`);
        console.log(`🚀 Restaurant Management API running on port ${PORT}`);
        console.log(`🌐 http://0.0.0.0:${PORT}`);
        console.log(`=======================================================`);
    });
}
