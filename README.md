# nodejs-aws-cart-api

E-commerce Cart API built with NestJS, TypeORM, and PostgreSQL, deployed on AWS Lambda with API Gateway and RDS.

## Task 8 - SQL Database Integration

This project implements a shopping cart backend service integrated with a SQL database (PostgreSQL on RDS) deployed to
AWS Lambda.

### Features

- ✅ User authentication with Basic Auth
- ✅ Cart operations: add, update, delete items
- ✅ Product details storage: title, description, price
- ✅ Order management and checkout
- ✅ AWS RDS PostgreSQL database integration
- ✅ Automatic database schema initialization and migrations
- ✅ AWS Lambda deployment with API Gateway
- ✅ Infrastructure as Code (CDK)

## Stack

- **Runtime**: Node.js 18 (AWS Lambda)
- **Framework**: NestJS
- **ORM**: TypeORM
- **Database**: PostgreSQL on RDS
- **Infrastructure**: AWS CDK
- **Authentication**: Basic Auth via Passport.js

## Installation & Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run locally in development
npm run start:dev
```

## Deployment

```bash
# Build and deploy to AWS
npm run build:lambda
npm run cdk:deploy
```

## API Endpoints

All endpoints require Basic Auth

### Cart Operations

- `GET /api/profile/cart` - Get user's cart items
- `PUT /api/profile/cart` - Add or update item in cart
- `DELETE /api/profile/cart` - Clear user's cart

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Orders

- `PUT /api/profile/cart/order` - Checkout and create order
- `GET /api/profile/cart/order` - Get all orders

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Database

### Schema

- **users**: User accounts
- **carts**: Shopping carts (OPEN/ORDERED status)
- **cart_items**: Items in carts with product details
- **orders**: Completed orders

### Automatic Initialization

Database schema is automatically created and migrated on app startup via `DatabaseInitService`

## Project Structure

```
src/
  ├── app.controller.ts
  ├── app.module.ts
  ├── lambda.ts
  ├── main.ts
  ├── auth/
  ├── cart/
  ├── order/
  ├── users/
  └── shared/

cdk/
  ├── bin/cdk.ts
  └── lib/cart-api-stack.ts

database/
  ├── schema.sql
  └── seed.sql
```

## License

MIT
