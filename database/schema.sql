-- Create ENUM types
CREATE TYPE cart_status AS ENUM ('OPEN', 'ORDERED');
CREATE TYPE order_status AS ENUM ('OPEN', 'APPROVED', 'CONFIRMED', 'SENT', 'COMPLETED', 'CANCELLED');

-- Create carts table
CREATE TABLE carts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status cart_status NOT NULL DEFAULT 'OPEN'
);

-- Create cart_items table
CREATE TABLE cart_items (
  cart_id UUID NOT NULL,
  product_id VARCHAR NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (cart_id, product_id),
  CONSTRAINT fk_cart_items_cart_id FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE
);

-- Create orders table (optional enhancement)
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  cart_id UUID NOT NULL,
  payment JSONB,
  delivery JSONB,
  comments TEXT,
  status order_status NOT NULL DEFAULT 'OPEN',
  total NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_cart_id FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE RESTRICT
);

-- Create users table (optional enhancement)
CREATE TABLE users (
  id UUID PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indices for better query performance
CREATE INDEX idx_carts_user_id ON carts(user_id);
CREATE INDEX idx_cart_items_product_id ON cart_items(product_id);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_cart_id ON orders(cart_id);
CREATE INDEX idx_users_username ON users(username);

