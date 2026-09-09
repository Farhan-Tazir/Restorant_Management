-- Restaurant food ordering database (PostgreSQL)
-- Run this file once against an empty PostgreSQL database.

CREATE TABLE customers (
    id BIGSERIAL PRIMARY KEY,
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

CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    order_number VARCHAR(30) NOT NULL UNIQUE,
    customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
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

CREATE INDEX idx_menu_items_category ON menu_items(category_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status_created_at ON orders(status, created_at DESC);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_payments_order ON payments(order_id);

-- Example starter menu. Customize or delete these records before production.
INSERT INTO menu_categories (name, display_order) VALUES
    ('Burgers', 1),
    ('Pizza', 2),
    ('Drinks', 3),
    ('Desserts', 4);

INSERT INTO menu_items (category_id, name, description, price) VALUES
    ((SELECT id FROM menu_categories WHERE name = 'Burgers'), 'Classic Burger', 'Beef patty, lettuce, tomato, and house sauce.', 8.99),
    ((SELECT id FROM menu_categories WHERE name = 'Pizza'), 'Margherita Pizza', 'Tomato sauce, mozzarella, and basil.', 11.99),
    ((SELECT id FROM menu_categories WHERE name = 'Drinks'), 'Soft Drink', 'Choose your preferred flavor.', 2.50),
    ((SELECT id FROM menu_categories WHERE name = 'Desserts'), 'Chocolate Cake', 'Rich chocolate cake slice.', 4.99);
