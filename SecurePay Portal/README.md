# SecurePay Portal - MongoDB Version

A secure customer international payments portal built with React, TypeScript, Node.js/Express, and MongoDB.

## Features

- 🔐 Secure user authentication with bcrypt password hashing
- 💳 International payment processing
- 📊 Transaction history and tracking
- 🛡️ Comprehensive security measures (XSS, SQL injection, CSRF protection)
- 📱 Responsive design with Tailwind CSS
- 🚀 Modern stack with TypeScript and MongoDB

## Prerequisites

Before running this application, make sure you have:

1. **Node.js** (version 18 or higher) - [Download](https://nodejs.org/)
2. **MongoDB** - Choose one option:
   - Local MongoDB installation - [Download](https://www.mongodb.com/try/download/community)
   - MongoDB Atlas (cloud) - [Sign up](https://www.mongodb.com/cloud/atlas)
3. **VS Code** (recommended) - [Download](https://code.visualstudio.com/)

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Database Setup

#### Option A: Local MongoDB
1. Install and start MongoDB locally
2. MongoDB will run on `mongodb://localhost:27017` by default

#### Option B: MongoDB Atlas (Cloud)
1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster
3. Get your connection string from the Atlas dashboard

### 3. Environment Configuration
1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and update the MongoDB connection string:
   ```env
   # Your MongoDB Atlas connection:
   MONGODB_URI=mongodb+srv://st10378305_db_user:st10378305_password@portalcluster.ukqgnrz.mongodb.net/?retryWrites=true&w=majority&appName=PortalCluster
   ```

### 4. Build the Frontend
```bash
npm run build
```

### 5. Start the Application

#### Development Mode:
```bash
# Start the Express server with MongoDB
npm run dev:server
```

#### Production Mode:
```bash
# Build and start
npm run build
npm start
```

The application will be available at:
- Frontend: http://localhost:3001
- API: http://localhost:3001/api

## Project Structure

```
src/
├── server/           # Express.js server with MongoDB
├── react-app/        # React frontend application
├── shared/           # Shared TypeScript types and schemas
└── worker/           # Legacy Cloudflare Worker code (not used)
```

## Database Collections

The application uses these MongoDB collections:

- **users** - User accounts and profiles
- **user_sessions** - Active user sessions
- **payment_transactions** - Payment records and history

Indexes are automatically created for optimal performance.

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### User Management
- `GET /api/user/profile` - Get user profile

### Payments
- `POST /api/payments/create` - Initiate payment
- `GET /api/payments/history` - Get transaction history
- `GET /api/payments/:id` - Get transaction details

### Health Check
- `GET /api/health` - Server health status

## Security Features

- 🔒 Password hashing with bcrypt (12 rounds)
- 🛡️ Input validation with Zod schemas
- 🚫 Rate limiting for authentication and payments
- 🔐 Session-based authentication
- 🌐 CORS protection
- 🛑 XSS and injection attack prevention
- 📊 Request logging and monitoring

Additional server security middleware:
- `helmet` is used to set secure HTTP headers. Install with `npm install helmet`.

Admin (staff) endpoints were added to the API:
- `GET /api/admin/transactions` - list transactions (staff only)
- `POST /api/admin/transactions/:id/verify` - mark transaction as verified/completed (staff only)

## Development

### Useful VS Code Extensions
- TypeScript and JavaScript Language Features
- Tailwind CSS IntelliSense
- ES7+ React/Redux/React-Native snippets
- MongoDB for VS Code

### Running Tests
```bash
npm run lint
```

### Building for Production
```bash
npm run build
```

## Deployment Options

### Traditional Node.js Hosting
- Deploy to services like Heroku, DigitalOcean, AWS EC2, etc.
- Use MongoDB Atlas for the database
- Set environment variables in your hosting platform

### Docker Deployment
Create a Dockerfile and docker-compose.yml for containerized deployment.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGODB_URI` | MongoDB connection string | Yes |
| `PORT` | Server port (default: 3001) | No |
| `NODE_ENV` | Environment (development/production) | No |

## Troubleshooting

### MongoDB Connection Issues
1. Ensure MongoDB is running (for local installations)
2. Check your connection string format
3. Verify network access for MongoDB Atlas
4. Check firewall settings

### Port Conflicts
If port 3001 is busy, change the `PORT` in your `.env` file.

### Build Issues
1. Clear node_modules: `rm -rf node_modules && npm install`
2. Clear build cache: `rm -rf dist && npm run build`

## Support

For issues or questions, please check:
1. MongoDB connection is working
2. All environment variables are set correctly
3. Node.js version is 18 or higher
4. All dependencies are installed
