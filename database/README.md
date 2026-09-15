# Restaurant Database (MySQL)

`schema_mysql.sql` creates the MySQL database tables and initial seed data for the Restaurant Management System, matching the `mysql2` client configured in `backend/db.js`.

## Includes

- `users`: User and administrator accounts with password hashes, loyalty tiers, and roles.
- `customers`: Customer contact and delivery profiles.
- `menu_categories`: Hierarchical categorization of dishes (Burgers, Pizza, Grill, Fast Food, Drinks).
- `menu_items`: Menu catalog with pricing, descriptions, images, and availability statuses.
- `user_favorites`: Relational favorites mapping users to saved menu dishes.
- `orders` & `order_items`: Dine-in, pickup, and delivery orders with point-in-time item pricing and quantities.
- `payments`: Transaction ledger and payment method tracking.

## Run it

Create a MySQL database (e.g. `hotel_db`), then import `database/schema_mysql.sql`:

```bash
# Using mysql CLI
mysql -u root -p hotel_db < database/schema_mysql.sql
```

## Configure Environment Variables

Set the MySQL credentials or `DATABASE_URL` in your `.env` file or hosting provider (e.g. Vercel):

```env
# Option A: Connection URI (recommended for managed providers)
DATABASE_URL=mysql://user:password@host:3306/hotel_db

# Option B: Discrete connection variables
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=hotel_db
PORT=3000
```

