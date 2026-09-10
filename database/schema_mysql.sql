-- Restaurant food ordering database (MySQL)
-- Run this file once against an empty MySQL database (e.g. `CREATE DATABASE hotel_db;`).

CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    address TEXT,
    preferred_payment VARCHAR(50) DEFAULT 'Cash on Delivery',
    reward_points INT NOT NULL DEFAULT 480,
    loyalty_badge VARCHAR(50) DEFAULT 'Gold Member',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS customers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT,
    full_name VARCHAR(120) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(255),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS menu_categories (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS menu_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    category_id BIGINT NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    image_url TEXT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES menu_categories(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_favorites (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    menu_item_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_fav (user_id, menu_item_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(30) NOT NULL UNIQUE,
    user_id BIGINT,
    customer_id BIGINT,
    order_type VARCHAR(20) NOT NULL DEFAULT 'pickup',
    table_number VARCHAR(20),
    delivery_address TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    special_instructions TEXT,
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
    delivery_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL,
    menu_item_id BIGINT,
    item_name VARCHAR(150) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    quantity INT NOT NULL,
    special_instructions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    method VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    transaction_reference VARCHAR(255),
    paid_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Initial Seed Data
INSERT IGNORE INTO users (id, full_name, email, password_hash, phone, address, preferred_payment, reward_points, loyalty_badge) VALUES
    (1, 'Farhan Tazir', 'farhan@example.com', '$2b$10$e8w/u11m20JzUo2N4N.E4eO8h9V8pZ3k2A1s3d4f5g6h7j8k9l', '+92 310 3546086', 'House #12, Hotel Springs Avenue, Block 5, City', 'Cash on Delivery', 480, 'Gold Member');

INSERT IGNORE INTO menu_categories (id, name, display_order) VALUES
    (1, 'Burgers', 1),
    (2, 'Pizza', 2),
    (3, 'Grill', 3),
    (4, 'Fast Food', 4),
    (5, 'Drinks', 5);

INSERT IGNORE INTO menu_items (id, category_id, name, description, price, image_url) VALUES
    (1, 1, 'Burger', 'Juicy grilled beef patty with fresh lettuce, tomato, cheese and signature sauce.', 12.00, 'images/burger-removebg-preview.png'),
    (2, 2, 'Large Pizza', 'Cheesy pizza topped with fresh pepperoni, veggies, and classic marinara sauce.', 18.50, 'images/pizza-removebg-preview.png'),
    (3, 3, 'Sekh Kabab', 'Tender charcoal-grilled spiced meat skewers served with mint chutney.', 14.00, 'images/sekh_kabak-removebg-preview.png'),
    (4, 4, 'Shawarma', 'Flavorful wrapped spiced chicken with garlic sauce, veggies, and pickles.', 9.99, 'images/shawarma-removebg-preview.png');

INSERT IGNORE INTO user_favorites (user_id, menu_item_id) VALUES
    (1, 1), (1, 2), (1, 3), (1, 4);
