-- Restaurant food ordering database (PostgreSQL)
-- Run this file once against an empty PostgreSQL database.

-- Users Table for Dashboard & Authentication
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    address TEXT,
    preferred_payment VARCHAR(50) DEFAULT 'Cash on Delivery',
    reward_points INTEGER NOT NULL DEFAULT 480,
    loyalty_badge VARCHAR(50) DEFAULT 'Gold Member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customers (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    full_name VARCHAR(120) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(255),
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE menu_categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE menu_items (
    id BIGSERIAL PRIMARY KEY,
    category_id BIGINT NOT NULL REFERENCES menu_categories(id) ON DELETE RESTRICT,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    image_url TEXT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_favorites (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    menu_item_id BIGINT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, menu_item_id)
);

CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    order_number VARCHAR(30) NOT NULL UNIQUE,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    customer_id BIGINT REFERENCES customers(id) ON DELETE RESTRICT,
    order_type VARCHAR(20) NOT NULL DEFAULT 'pickup'
        CHECK (order_type IN ('dine_in', 'pickup', 'delivery')),
    table_number VARCHAR(20),
    delivery_address TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled')),
    special_instructions TEXT,
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id BIGINT REFERENCES menu_items(id) ON DELETE SET NULL,
    item_name VARCHAR(150) NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    special_instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payments (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    method VARCHAR(20) NOT NULL
        CHECK (method IN ('cash', 'card', 'online')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
    transaction_reference VARCHAR(255),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_menu_items_category ON menu_items(category_id);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status_created_at ON orders(status, created_at DESC);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_user_favorites ON user_favorites(user_id, menu_item_id);

-- Starter Seed Data
INSERT INTO users (full_name, email, password_hash, phone, address, preferred_payment, reward_points, loyalty_badge) VALUES
    ('Farhan Tazir', 'farhan@example.com', '$2b$10$e8w/u11m20JzUo2N4N.E4eO8h9V8pZ3k2A1s3d4f5g6h7j8k9l', '+92 310 3546086', 'House #12, Hotel Springs Avenue, Block 5, City', 'Cash on Delivery', 480, 'Gold Member');

INSERT INTO menu_categories (name, display_order) VALUES
    ('Burgers', 1),
    ('Pizza', 2),
    ('Grill', 3),
    ('Fast Food', 4),
    ('Drinks', 5);

INSERT INTO menu_items (category_id, name, description, price, image_url) VALUES
    ((SELECT id FROM menu_categories WHERE name = 'Burgers'), 'Burger', 'Juicy grilled beef patty with fresh lettuce, tomato, cheese and signature sauce.', 12.00, 'images/burger-removebg-preview.png'),
    ((SELECT id FROM menu_categories WHERE name = 'Pizza'), 'Large Pizza', 'Cheesy pizza topped with fresh pepperoni, veggies, and classic marinara sauce.', 18.50, 'images/pizza-removebg-preview.png'),
    ((SELECT id FROM menu_categories WHERE name = 'Grill'), 'Sekh Kabab', 'Tender charcoal-grilled spiced meat skewers served with mint chutney.', 14.00, 'images/sekh_kabak-removebg-preview.png'),
    ((SELECT id FROM menu_categories WHERE name = 'Fast Food'), 'Shawarma', 'Flavorful wrapped spiced chicken with garlic sauce, veggies, and pickles.', 9.99, 'images/shawarma-removebg-preview.png');

INSERT INTO user_favorites (user_id, menu_item_id)
SELECT u.id, m.id FROM users u, menu_items m WHERE u.email = 'farhan@example.com';
