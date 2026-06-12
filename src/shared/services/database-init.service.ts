import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseInitService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseInitService.name);

  constructor(private dataSource: DataSource) {}

  async onModuleInit() {
    this.logger.log('Checking if database tables exist...');

    try {
      const queryRunner = this.dataSource.createQueryRunner();

      try {
        const usersTable = await queryRunner.hasTable('users');

        if (!usersTable) {
          this.logger.log('Database tables not found, creating schema...');
          await this.createSchema(queryRunner);
        } else {
          this.logger.log('Database tables exist, skipping schema creation');
        }

        // Always attempt to apply migrations and seed test data
        await this.applyMigrations(queryRunner);
        await this.seedDatabase(queryRunner);
      } finally {
        await queryRunner.release();
      }
    } catch (err) {
      this.logger.error('Failed to initialize database', err);
      throw err;
    }
  }

  private async createSchema(queryRunner: any) {
    try {
      // Create ENUM types
      try {
        await queryRunner.query(`CREATE TYPE cart_status AS ENUM ('OPEN', 'ORDERED')`);
      } catch (err: any) {
        if (!err.message.includes('already exists')) {
          throw err;
        }
      }

      try {
        await queryRunner.query(
          `CREATE TYPE order_status AS ENUM ('OPEN', 'APPROVED', 'CONFIRMED', 'SENT', 'COMPLETED', 'CANCELLED')`,
        );
      } catch (err: any) {
        if (!err.message.includes('already exists')) {
          throw err;
        }
      }

      // Create tables
      await queryRunner.query(`
        CREATE TABLE carts (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          status cart_status NOT NULL DEFAULT 'OPEN'
        )
      `);

       await queryRunner.query(`
         CREATE TABLE cart_items (
           cart_id UUID NOT NULL,
           product_id VARCHAR NOT NULL,
           count INTEGER NOT NULL,
           PRIMARY KEY (cart_id, product_id),
           CONSTRAINT fk_cart_items_cart_id FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE
         )
       `);

      await queryRunner.query(`
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
        )
      `);

      await queryRunner.query(`
        CREATE TABLE users (
          id UUID PRIMARY KEY,
          username VARCHAR(255) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          name VARCHAR(255),
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

       await queryRunner.query(`
         CREATE TABLE order_items (
           id UUID PRIMARY KEY,
           order_id UUID NOT NULL,
           product_id VARCHAR NOT NULL,
           count INTEGER NOT NULL,
           title VARCHAR,
           description TEXT,
           price NUMERIC(10, 2),
           created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
           CONSTRAINT fk_order_items_order_id FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
         )
       `);

       // Create indices
       await queryRunner.query(`CREATE INDEX idx_carts_user_id ON carts(user_id)`);
       await queryRunner.query(`CREATE INDEX idx_cart_items_product_id ON cart_items(product_id)`);
       await queryRunner.query(`CREATE INDEX idx_orders_user_id ON orders(user_id)`);
       await queryRunner.query(`CREATE INDEX idx_orders_cart_id ON orders(cart_id)`);
       await queryRunner.query(`CREATE INDEX idx_users_username ON users(username)`);
       await queryRunner.query(`CREATE INDEX idx_order_items_order_id ON order_items(order_id)`);

      this.logger.log('Database schema created successfully');
    } catch (err) {
      this.logger.error('Failed to create schema', err);
      throw err;
    }
  }

    private async applyMigrations(queryRunner: any) {
      this.logger.log('Applying database migrations...');

      try {
        // Migration: Add updated_at column to carts table
        const hasUpdatedAt = await queryRunner.hasColumn('carts', 'updated_at');
        if (!hasUpdatedAt) {
          this.logger.log('Adding updated_at column to carts table...');
          await queryRunner.query(`
            ALTER TABLE carts
            ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          `);
          this.logger.log('updated_at column added to carts table');
        }

        // Migration: Create order_items table if it doesn't exist
        const hasOrderItemsTable = await queryRunner.hasTable('order_items');
        if (!hasOrderItemsTable) {
          this.logger.log('Creating order_items table...');
          await queryRunner.query(`
            CREATE TABLE order_items (
              id UUID PRIMARY KEY,
              order_id UUID NOT NULL,
              product_id VARCHAR NOT NULL,
              count INTEGER NOT NULL,
              title VARCHAR,
              description TEXT,
              price NUMERIC(10, 2),
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT fk_order_items_order_id FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
            )
          `);
          await queryRunner.query(`CREATE INDEX idx_order_items_order_id ON order_items(order_id)`);
          this.logger.log('order_items table created successfully');
        }

        // Migration: Convert product_id from UUID to VARCHAR
        try {
          this.logger.log('Attempting to convert product_id column type from UUID to VARCHAR...');
          // First, add a new column with VARCHAR type
          await queryRunner.query(`
            ALTER TABLE cart_items 
            ADD COLUMN IF NOT EXISTS product_id_varchar VARCHAR
          `);

          // Copy data from product_id to product_id_varchar
          await queryRunner.query(`
            UPDATE cart_items 
            SET product_id_varchar = product_id::VARCHAR 
            WHERE product_id_varchar IS NULL
          `);

          // Drop the old UUID column
          await queryRunner.query(`
            ALTER TABLE cart_items 
            DROP CONSTRAINT IF EXISTS pk_cart_items
          `);

          await queryRunner.query(`
            ALTER TABLE cart_items 
            DROP COLUMN product_id
          `);

          // Rename the new column
          await queryRunner.query(`
            ALTER TABLE cart_items 
            RENAME COLUMN product_id_varchar TO product_id
          `);

          // Recreate the primary key
          await queryRunner.query(`
            ALTER TABLE cart_items 
            ADD PRIMARY KEY (cart_id, product_id)
          `);

          this.logger.log('Product ID column type conversion completed');
        } catch (err: any) {
          if (err.message.includes('already exists') || err.message.includes('column "product_id_varchar" of relation "cart_items" already exists')) {
            this.logger.log('Product ID column already VARCHAR or migration already applied');
          } else {
            throw err;
          }
        }

        // Add product details columns to cart_items if they don't exist
        const hasColumn = await queryRunner.hasColumn('cart_items', 'price');

        if (!hasColumn) {
          this.logger.log('Adding product details columns to cart_items...');
          await queryRunner.query(`
            ALTER TABLE cart_items
            ADD COLUMN IF NOT EXISTS title VARCHAR,
            ADD COLUMN IF NOT EXISTS description TEXT,
            ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2)
          `);
          this.logger.log('Product details migration completed successfully');
        } else {
          this.logger.log('Cart items already have product details columns');
        }
      } catch (err: any) {
        this.logger.error('Failed to apply migrations', err);
        throw err;
      }
    }

  private async seedDatabase(queryRunner: any) {
    this.logger.log('Ensuring test data exists...');

    const userId = '550e8400-e29b-41d4-a716-446655440001';
    const cartId = '650e8400-e29b-41d4-a716-446655440001';
    const productId = '750e8400-e29b-41d4-a716-446655440001';

    try {
      // Check if test user exists
      const existingUser = await queryRunner.query(
        `SELECT id FROM users WHERE username = $1`,
        ['PashaSmurf'],
      );

      if (existingUser && existingUser.length > 0) {
        this.logger.log('Test data already exists');
        return;
      }

      // Insert test user
      await queryRunner.query(
        `INSERT INTO users (id, username, password_hash, name) 
         VALUES ($1, $2, $3, $4)`,
        [userId, 'PashaSmurf', 'TEST_PASSWORD', 'Pasha Smurf'],
      );

      // Insert test cart
      await queryRunner.query(
        `INSERT INTO carts (id, user_id, status) 
         VALUES ($1, $2, $3)`,
        [cartId, userId, 'OPEN'],
      );

      // Insert test cart items
      await queryRunner.query(
        `INSERT INTO cart_items (cart_id, product_id, count) 
         VALUES ($1, $2, $3)`,
        [cartId, productId, 2],
      );

      this.logger.log('Test data seeded successfully');
    } catch (err: any) {
      this.logger.error('Failed to seed test data', err);
      throw err;
    }
  }
}
