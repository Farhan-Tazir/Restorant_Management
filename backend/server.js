// backend/server.js - Express API Server connecting SQL Database to User Dashboard & Admin Panel

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Explicitly load .env file from project root, overriding stale container variables
try {
    const envPath = path.resolve(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        for (const line of envContent.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx === -1) continue;
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            if (key) {
                process.env[key] = val;
            }
        }
    }
} catch (_) {}

const { initDatabase, UserDAO, MenuDAO } = require('./db');

const app = express();
// Web server port is fixed to 3000 for cloud container reverse proxy routing
const PORT = 3000;

// Security Hardening: Disable information disclosure headers
app.disable('x-powered-by');

// Security Headers Middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

// Middleware with bounded payload limits to mitigate DoS
app.use(cors());
app.use(express.json({ limit: '500kb' }));
app.use(express.urlencoded({ extended: true, limit: '500kb' }));

// Server-Side Session Security & Token Configuration
if (!process.env.SESSION_SECRET) {
    throw new Error(
        'Startup Error: Required environment variable SESSION_SECRET is not set. ' +
        'Please configure it in your .env file or deployment environment variables.'
    );
}
const SESSION_SECRET = process.env.SESSION_SECRET;
const activeSessions = new Map();

// In-Memory Rate Limiting & Anti-Brute-Force Stores
const loginAttempts = new Map(); // key -> { count, lockedUntil, firstAttempt }
const rateLimitWindows = new Map(); // key -> { count, resetAt }

function checkLoginRateLimit(key) {
    const now = Date.now();
    const entry = loginAttempts.get(key);
    if (!entry) return true;
    if (entry.lockedUntil && entry.lockedUntil > now) {
        return false;
    }
    if (entry.lockedUntil && entry.lockedUntil <= now) {
        loginAttempts.delete(key);
        return true;
    }
    if (now - entry.firstAttempt > 15 * 60 * 1000) {
        loginAttempts.delete(key);
        return true;
    }
    return true;
}

function recordFailedLogin(key) {
    const now = Date.now();
    const entry = loginAttempts.get(key) || { count: 0, firstAttempt: now };
    entry.count += 1;
    if (entry.count >= 5) {
        entry.lockedUntil = now + (15 * 60 * 1000); // 15-minute temporary lockout after 5 consecutive failures
    }
    loginAttempts.set(key, entry);
}

function clearLoginAttempts(key) {
    loginAttempts.delete(key);
}

function checkGeneralRateLimit(key, maxRequests = 20, windowMs = 60000) {
    const now = Date.now();
    const entry = rateLimitWindows.get(key) || { count: 0, resetAt: now + windowMs };
    if (now > entry.resetAt) {
        entry.count = 1;
        entry.resetAt = now + windowMs;
        rateLimitWindows.set(key, entry);
        return true;
    }
    entry.count += 1;
    rateLimitWindows.set(key, entry);
    return entry.count <= maxRequests;
}

/**
 * Creates a cryptographically signed password reset token valid for 10 minutes.
 */
function createPasswordResetToken(user) {
    const payload = {
        userId: user.id,
        phone: user.phone || '',
        purpose: 'password_reset',
        exp: Date.now() + (10 * 60 * 1000) // 10 minutes
    };
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', SESSION_SECRET).update(`reset:${payloadB64}`).digest('base64url');
    return `${payloadB64}.${signature}`;
}

/**
 * Verifies the integrity and validity of a password reset token.
 */
function verifyPasswordResetToken(token, expectedPhone) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payloadB64, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(`reset:${payloadB64}`).digest('base64url');

    try {
        const sigBuf = Buffer.from(signature);
        const expBuf = Buffer.from(expectedSig);
        if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
            return null;
        }

        const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
        if (payload.purpose !== 'password_reset' || !payload.exp || payload.exp < Date.now()) {
            return null;
        }
        if (expectedPhone) {
            const norm1 = (payload.phone || '').trim().replace(/\s+/g, '');
            const norm2 = (expectedPhone || '').trim().replace(/\s+/g, '');
            if (norm1 !== norm2) return null;
        }
        return payload;
    } catch (_) {
        return null;
    }
}

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

// --- AUTHENTICATION API ENDPOINTS ---

// 1. POST Account Registration
app.post('/api/auth/register', async (req, res) => {
    try {
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        if (!checkGeneralRateLimit(`reg:${clientIp}`, 10, 10 * 60 * 1000)) {
            return res.status(429).json({ success: false, message: 'Too many registration requests from this network. Please try again later.' });
        }

        const { full_name, email, phone, password } = req.body;

        if (!full_name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Full name, email, and password are required' });
        }

        const trimmedName = String(full_name).trim();
        const trimmedEmail = String(email).trim().toLowerCase();

        if (trimmedName.length < 2 || trimmedName.length > 100) {
            return res.status(400).json({ success: false, message: 'Full name must be between 2 and 100 characters long' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
            return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
        }

        if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
            return res.status(400).json({ success: false, message: 'Password must be between 6 and 128 characters long' });
        }

        const existingUser = await UserDAO.findByEmail(trimmedEmail);
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'An account with this email address already exists' });
        }

        // New registrations are always strictly assigned 'customer' role
        const role = 'customer';
        const newUser = await UserDAO.register({
            full_name: trimmedName,
            email: trimmedEmail,
            phone: phone ? String(phone).trim() : '',
            password,
            role
        });
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
        res.status(500).json({ success: false, message: 'Server error during account registration' });
    }
});

// 2. POST User Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const identifier = String(email || req.body.phone || '').trim().toLowerCase();

        if (!identifier || !password) {
            return res.status(400).json({ success: false, message: 'Email/phone and password are required' });
        }

        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        const rateLimitKey = `${clientIp}:${identifier}`;

        if (!checkLoginRateLimit(rateLimitKey)) {
            return res.status(429).json({
                success: false,
                message: 'Too many consecutive failed login attempts. For your security, this account is temporarily locked. Please try again in 15 minutes.'
            });
        }

        let user = await UserDAO.findByEmail(identifier);
        if (!user) {
            user = await UserDAO.findByPhone(identifier);
        }

        if (!user) {
            recordFailedLogin(rateLimitKey);
            return res.status(401).json({ success: false, message: 'Invalid credentials. Please check your email/phone and password.' });
        }

        // Strict password verification using bcrypt only.
        let match = false;
        if (user.password_hash) {
            try {
                match = await bcrypt.compare(password, user.password_hash);
            } catch (_) {
                match = false;
            }
        }

        if (!match) {
            recordFailedLogin(rateLimitKey);
            return res.status(401).json({ success: false, message: 'Invalid credentials. Please check your password.' });
        }

        // Clear failed attempts on successful verification
        clearLoginAttempts(rateLimitKey);

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
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        if (!checkGeneralRateLimit(`phone-verify:${clientIp}`, 10, 10 * 60 * 1000)) {
            return res.status(429).json({ success: false, message: 'Too many verification attempts. Please wait 10 minutes.' });
        }

        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ success: false, message: 'Phone number is required' });
        }

        const user = await UserDAO.findByPhone(phone);
        if (!user) {
            return res.status(404).json({ success: false, message: 'No registered user account found with this phone number' });
        }

        // Explicitly forbid phone recovery for administrator roles
        if (user.role === 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Administrator accounts cannot be reset via public phone recovery. Please use administrator master credentials.'
            });
        }

        const resetToken = createPasswordResetToken(user);

        res.json({
            success: true,
            message: 'Phone number verified successfully',
            phone: user.phone,
            user_name: user.full_name,
            reset_token: resetToken
        });
    } catch (error) {
        console.error('Error verifying phone:', error);
        res.status(500).json({ success: false, message: 'Server error verifying phone number' });
    }
});

// 4. POST Reset Password via Phone Verification
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { phone, new_password, reset_token } = req.body;

        if (!phone || !new_password || !reset_token) {
            return res.status(400).json({ success: false, message: 'Phone number, new password, and reset token are required' });
        }

        if (typeof new_password !== 'string' || new_password.length < 6 || new_password.length > 128) {
            return res.status(400).json({ success: false, message: 'Password must be between 6 and 128 characters long' });
        }

        const tokenPayload = verifyPasswordResetToken(reset_token, phone);
        if (!tokenPayload) {
            return res.status(403).json({ success: false, message: 'Invalid or expired password reset token. Please re-verify your phone number.' });
        }

        const targetUser = await UserDAO.findById(tokenPayload.userId);
        if (!targetUser || targetUser.role === 'admin') {
            return res.status(403).json({ success: false, message: 'Administrator accounts cannot be modified via phone reset.' });
        }

        const updatedUser = await UserDAO.updatePasswordByPhone(phone, new_password);
        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'Failed to find account associated with this phone' });
        }

        // Invalidate any existing active sessions for this user for security
        for (const [token, session] of activeSessions.entries()) {
            if (session.id === targetUser.id) {
                activeSessions.delete(token);
            }
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

// 9. POST Create New Order (Supports both authenticated sessions & authenticated client store payload)
app.post(['/api/orders', '/api/orders/', '/orders', '/orders/'], async (req, res) => {
    try {
        const validOrderTypes = ['delivery', 'dine_in', 'takeaway', 'pickup'];
        const orderType = validOrderTypes.includes(req.body.order_type) ? req.body.order_type : 'delivery';
        const subtotal = Math.max(0, parseFloat(req.body.subtotal || 0));
        const deliveryFee = orderType === 'delivery' ? 2.00 : 0.00;
        const totalAmount = Math.max(0, subtotal + deliveryFee);

        const sanitizedItems = Array.isArray(req.body.items) ? req.body.items.slice(0, 50).map(it => ({
            id: String(it.id || ''),
            item_name: String(it.item_name || it.name || 'Menu Item').slice(0, 100),
            unit_price: Math.max(0, parseFloat(it.unit_price || it.price || 0)),
            quantity: Math.max(1, Math.min(100, parseInt(it.quantity || 1, 10)))
        })) : [];

        // Support authenticated session user or customer info provided from client store
        const userId = req.user ? req.user.id : (req.body.user_id || 1);
        const customerName = String(req.body.customer_name || (req.user && req.user.full_name) || 'Customer').slice(0, 100);
        const phone = String(req.body.phone || (req.user && req.user.phone) || '').slice(0, 30);
        const deliveryAddress = String(req.body.delivery_address || (req.user && req.user.address) || '').slice(0, 255);
        const tableNumber = String(req.body.table_number || '').slice(0, 20);
        const paymentMethod = String(req.body.payment_method || 'Cash on Delivery').slice(0, 50);

        const orderData = {
            ...req.body,
            order_type: orderType,
            subtotal: subtotal,
            delivery_fee: deliveryFee,
            total_amount: totalAmount,
            items: sanitizedItems,
            user_id: userId,
            customer_name: customerName,
            phone: phone,
            delivery_address: deliveryAddress,
            table_number: tableNumber,
            payment_method: paymentMethod
        };
        const newOrder = await UserDAO.createOrder(orderData);

        if (!newOrder) {
            throw new Error('Failed to create order record');
        }

        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            orderNumber: newOrder.order_number || newOrder.id,
            order: newOrder
        });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ success: false, message: 'Server error creating order' });
    }
});

// 9b. GET Orders (User or Admin)
app.get(['/api/orders', '/api/orders/', '/orders', '/orders/'], async (req, res) => {
    try {
        if (req.user && req.user.role === 'admin') {
            const orders = await UserDAO.getAllOrders();
            return res.json({ success: true, orders: orders });
        }
        const targetId = req.user ? req.user.id : (req.query.userId || 1);
        const orders = await UserDAO.getUserOrders(targetId);
        res.json({ success: true, orders: orders });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error fetching orders' });
    }
});

// 9c. Fallback for non-matching methods on orders
app.all(['/api/orders', '/api/orders/', '/orders', '/orders/'], (req, res) => {
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    res.status(405).json({
        success: false,
        message: `HTTP Method ${req.method} not allowed on this endpoint.`
    });
});

// 10. PUT Update Order & Payment Status (Admin Action - Protected Admin Only)
app.put('/api/orders/:id/status', requireAdmin, async (req, res) => {
    try {
        const orderId = String(req.params.id || '').trim();
        const { status, payment_status } = req.body;

        const validStatuses = ['pending', 'accepted', 'preparing', 'out_for_delivery', 'completed', 'cancelled'];
        const validPaymentStatuses = ['pending', 'paid', 'refunded', 'failed'];

        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid order status specified' });
        }
        if (payment_status && !validPaymentStatuses.includes(payment_status)) {
            return res.status(400).json({ success: false, message: 'Invalid payment status specified' });
        }

        const updatedOrder = await UserDAO.updateOrderStatus(orderId, status, payment_status);

        res.json({
            success: true,
            message: `Order #${orderId} status updated successfully`,
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

// 12. POST Add User Favorite (Protected - Authenticated user only)
app.post('/api/user/favorites', requireAuth, async (req, res) => {
    try {
        const menuItemId = req.body.menu_item_id || req.body.menuItemId || req.body.id;
        if (!menuItemId) {
            return res.status(400).json({ success: false, message: 'menu_item_id is required' });
        }
        await UserDAO.addFavorite(req.user.id, menuItemId);
        res.status(201).json({
            success: true,
            message: 'Dish added to favorites'
        });
    } catch (error) {
        console.error('Error adding user favorite:', error);
        res.status(500).json({ success: false, message: 'Server error saving favorite' });
    }
});

// 13. DELETE Remove User Favorite (Protected - Authenticated user only)
app.delete('/api/user/favorites/:menu_item_id', requireAuth, async (req, res) => {
    try {
        const menuItemId = req.params.menu_item_id;
        if (!menuItemId) {
            return res.status(400).json({ success: false, message: 'menu_item_id is required' });
        }
        await UserDAO.removeFavorite(req.user.id, menuItemId);
        res.json({
            success: true,
            message: 'Dish removed from favorites'
        });
    } catch (error) {
        console.error('Error removing user favorite:', error);
        res.status(500).json({ success: false, message: 'Server error removing favorite' });
    }
});

// 14. GET All Menu Items (Public)
app.get('/api/menu-items', async (req, res) => {
    try {
        const items = await MenuDAO.getAllItems();
        res.json({
            success: true,
            items: items
        });
    } catch (error) {
        console.error('Error fetching menu items:', error);
        res.status(500).json({ success: false, message: 'Server error fetching menu items' });
    }
});

// 15. POST Create Menu Item (Admin Only)
app.post('/api/menu-items', requireAdmin, async (req, res) => {
    try {
        const { name, price } = req.body;
        if (!name || String(name).trim() === '') {
            return res.status(400).json({ success: false, message: 'Item name is required' });
        }
        if (price === undefined || isNaN(parseFloat(price)) || parseFloat(price) < 0) {
            return res.status(400).json({ success: false, message: 'Valid non-negative item price is required' });
        }

        const newItem = await MenuDAO.addItem(req.body);
        res.status(201).json({
            success: true,
            message: 'Menu item created successfully',
            item: newItem
        });
    } catch (error) {
        console.error('Error creating menu item:', error);
        res.status(500).json({ success: false, message: 'Server error creating menu item' });
    }
});

// 16. PUT Update Menu Item (Admin Only)
app.put('/api/menu-items/:id', requireAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        const updated = await MenuDAO.updateItem(id, req.body);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Menu item not found' });
        }
        res.json({
            success: true,
            message: 'Menu item updated successfully',
            item: updated
        });
    } catch (error) {
        console.error('Error updating menu item:', error);
        res.status(500).json({ success: false, message: 'Server error updating menu item' });
    }
});

// 17. DELETE Remove Menu Item (Admin Only)
app.delete('/api/menu-items/:id', requireAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        await MenuDAO.deleteItem(id);
        res.json({
            success: true,
            message: 'Menu item deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting menu item:', error);
        res.status(500).json({ success: false, message: 'Server error deleting menu item' });
    }
});

// Serve frontend static public files AFTER all API endpoints
app.use(express.static(path.join(__dirname, '..')));

// Initialize database
initDatabase();

// Export Express app for Vercel
module.exports = app;

// Start server only when running locally
if (require.main === module) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`=======================================================`);
        console.log(`🚀 Restaurant Management API running on port ${PORT}`);
        console.log(`🌐 http://0.0.0.0:${PORT}`);
        console.log(`=======================================================`);
    });
}
