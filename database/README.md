# Restaurant database

`schema.sql` creates a PostgreSQL database for the food-ordering form.

## Includes

- customer contact details
- menu categories and items
- dine-in, pickup, and delivery orders
- individual ordered food items with the price recorded at order time
- payment tracking

## Run it

Create a PostgreSQL database, then run:

```powershell
psql -U postgres -d restaurant_db -f database/schema.sql
```

Set the database URL in your application environment file:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/restaurant_db
```

The application still needs a backend endpoint that receives the submitted food form, creates the customer and order, inserts the chosen items, and calculates the total.
