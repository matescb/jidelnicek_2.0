# Jídelníček Frontend

This is the React frontend application for the Jídelníček meal planning system.

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **React Router v6** for navigation with protected routes
- **Tailwind CSS** for styling with dark mode support
- **React Hook Form + Zod** for form handling and validation
- **Zustand** for state management
- **TanStack Query** for server state management
- **i18next** for internationalization (English and Czech)
- **Axios** for API communication

## Project Structure

```
frontend/
├── src/
│   ├── api/           # API client and endpoints
│   ├── components/    # Reusable UI components
│   │   ├── auth/      # Authentication components
│   │   ├── common/    # Common components (LoadingScreen, ErrorBoundary)
│   │   ├── layouts/   # Layout components
│   │   └── navigation/# Navigation components
│   ├── context/       # React contexts (Auth, Theme)
│   ├── hooks/         # Custom React hooks
│   ├── i18n/          # Internationalization setup
│   ├── pages/         # Page components
│   ├── router/        # React Router configuration
│   ├── styles/        # Global styles and CSS
│   ├── types/         # TypeScript type definitions
│   └── utils/         # Utility functions
├── public/            # Static assets
└── index.html         # HTML entry point
```

## Features Implemented

### Navigation & Routing
- ✅ React Router v6 with lazy loading
- ✅ Protected routes with authentication guards
- ✅ Public routes with redirect logic
- ✅ Breadcrumb navigation
- ✅ Mobile-responsive sidebar navigation
- ✅ URL parameter handling

### Authentication
- ✅ JWT token management with auto-refresh
- ✅ Login/logout functionality
- ✅ Protected route guards
- ✅ Session persistence
- ✅ Auth context with user state

### UI/UX
- ✅ Dark mode support with system preference detection
- ✅ Responsive design (mobile-first)
- ✅ Loading states and error boundaries
- ✅ Toast notifications
- ✅ Collapsible sidebar navigation

### Internationalization
- ✅ English and Czech language support
- ✅ Language switcher in header
- ✅ Automatic language detection

## Getting Started

1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

## Development

### Environment Variables

Create a `.env` file in the frontend directory:

```env
VITE_API_URL=http://localhost:8000/api/v1
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### API Integration

The frontend is configured to proxy API requests to the backend:
- Development: Proxied to `http://localhost:8000`
- Production: Use the `VITE_API_URL` environment variable

### Adding New Routes

1. Create page component in `src/pages/`
2. Add route configuration in `src/router/index.tsx`
3. Update breadcrumb configuration if needed
4. Add navigation item if needed

### State Management

- **Auth State**: Managed by AuthContext
- **Theme State**: Managed by ThemeContext
- **Server State**: Use TanStack Query
- **Local State**: Use Zustand for complex state

## Next Steps

1. Complete remaining page components
2. Implement form components with validation
3. Add recipe management UI
4. Add trip planning interface
5. Implement real-time calculations
6. Add comprehensive test coverage