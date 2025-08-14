# Frontend Architecture

## Component Architecture

### Component Organization
```text
app/
├── (auth)/                    # Auth layout group
│   ├── login/
│   ├── reset-password/
│   └── verify/
├── (dashboard)/              # Dashboard layout group
│   ├── layout.tsx           # Dashboard shell with nav
│   ├── bookings/
│   │   ├── page.tsx        # Bookings list/calendar view
│   │   ├── [id]/
│   │   │   └── page.tsx    # Booking detail page
│   │   └── new/
│   │       └── page.tsx    # Create booking wizard
│   ├── documents/
│   └── settings/
├── admin/                    # Admin-only routes
│   ├── impersonate/
│   └── audit/
├── api/                     # API routes (Hono)
│   └── [[...route]]/
│       └── route.ts        # Hono app entry
└── components/
    ├── ui/                  # Shadcn UI components
    ├── bookings/           # Booking-specific components
    ├── documents/          # Document components
    ├── forms/              # Form components
    └── layout/             # Layout components
```

### Component Template
```typescript
// Example: BookingCard component
import { type FC } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import type { Booking } from '@/types/booking';

interface BookingCardProps {
  booking: Booking;
  onSelect?: (booking: Booking) => void;
}

export const BookingCard: FC<BookingCardProps> = ({ 
  booking, 
  onSelect 
}) => {
  const statusColor = {
    active: 'bg-green-500',
    closed: 'bg-gray-500',
    archived: 'bg-gray-700'
  }[booking.status];

  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => onSelect?.(booking)}
    >
      <CardHeader>
        <div className="flex justify-between items-start">
          <h3 className="font-semibold">{booking.examineeName}</h3>
          <Badge className={statusColor}>
            {booking.currentProgress}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {booking.specialist.name} • {formatDate(booking.appointmentDate)}
        </p>
        {booking.appointmentType === 'telehealth' && (
          <Badge variant="outline" className="mt-2">
            Telehealth
          </Badge>
        )}
      </CardContent>
    </Card>
  );
};
```

## State Management Architecture

### State Structure
```typescript
// Global state managed by TanStack Query
// No client-side global state needed - all server state

// Query keys factory
export const queryKeys = {
  all: ['bookings'] as const,
  lists: () => [...queryKeys.all, 'list'] as const,
  list: (filters: BookingFilters) => 
    [...queryKeys.lists(), filters] as const,
  details: () => [...queryKeys.all, 'detail'] as const,
  detail: (id: string) => [...queryKeys.details(), id] as const,
};

// Example query hook
export function useBookings(filters: BookingFilters) {
  return useQuery({
    queryKey: queryKeys.list(filters),
    queryFn: () => api.bookings.list(filters),
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Mutations with optimistic updates
export function useCreateBooking() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: api.bookings.create,
    onMutate: async (newBooking) => {
      // Optimistic update
      await queryClient.cancelQueries({ 
        queryKey: queryKeys.lists() 
      });
      
      const previousBookings = queryClient.getQueryData(
        queryKeys.lists()
      );
      
      queryClient.setQueryData(queryKeys.lists(), (old) => {
        return [...(old || []), newBooking];
      });
      
      return { previousBookings };
    },
    onError: (err, newBooking, context) => {
      // Rollback on error
      queryClient.setQueryData(
        queryKeys.lists(),
        context?.previousBookings
      );
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.lists() 
      });
    },
  });
}
```

### State Management Patterns
- Server state via TanStack Query with aggressive caching
- Form state via TanStack Form
- UI state via React useState for local component state
- URL state via Next.js router for filters and pagination
- No Redux/Zustand needed - server state is source of truth

## Routing Architecture

### Route Organization
```text
app/
├── (auth)/
│   └── login/page.tsx              # /login
├── (dashboard)/
│   ├── page.tsx                    # / (redirects to /bookings)
│   ├── bookings/
│   │   ├── page.tsx               # /bookings (list/calendar)
│   │   ├── [id]/page.tsx          # /bookings/:id (detail)
│   │   └── new/page.tsx           # /bookings/new (create)
│   └── documents/page.tsx         # /documents
└── admin/
    ├── impersonate/page.tsx       # /admin/impersonate
    └── audit/page.tsx             # /admin/audit
```

### Protected Route Pattern
```typescript
// app/(dashboard)/layout.tsx
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { DashboardNav } from '@/components/layout/dashboard-nav';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  
  if (!session) {
    redirect('/login');
  }
  
  return (
    <div className="flex h-screen">
      <DashboardNav user={session.user} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

// Middleware for role-based access
// middleware.ts
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function middleware(request: Request) {
  const session = await auth();
  
  // Admin routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (session?.user?.role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/(dashboard)/:path*'],
};
```

## Frontend Services Layer

### API Client Setup
```typescript
// lib/api-client.ts
import { hc } from 'hono/client';
import type { AppType } from '@/app/api/[[...route]]/route';

const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';

// Type-safe API client
export const api = hc<AppType>(baseUrl, {
  headers: () => ({
    'Content-Type': 'application/json',
  }),
  fetch: (input, init) => {
    // Add auth token from cookies
    return fetch(input, {
      ...init,
      credentials: 'include',
    });
  },
});

// With error handling
export async function apiRequest<T>(
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof Response) {
      const data = await error.json();
      throw new ApiError(data.message, error.status, data);
    }
    throw error;
  }
}

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data: any
  ) {
    super(message);
  }
}
```

### Service Example
```typescript
// services/bookings.service.ts
import { api, apiRequest } from '@/lib/api-client';
import type { Booking, BookingFormData } from '@/types/booking';

export const bookingsService = {
  async list(filters?: BookingFilters) {
    return apiRequest(() => 
      api.bookings.$get({ query: filters })
    );
  },
  
  async get(id: string) {
    return apiRequest(() => 
      api.bookings[':id'].$get({ param: { id } })
    );
  },
  
  async create(data: BookingFormData) {
    // First create Acuity appointment
    const response = await apiRequest(() =>
      api.bookings.$post({ json: data })
    );
    
    return response;
  },
  
  async updateProgress(id: string, progress: string, notes?: string) {
    return apiRequest(() =>
      api.bookings[':id'].progress.$post({
        param: { id },
        json: { progress, notes }
      })
    );
  },
};

// React Query integration
export function useBooking(id: string) {
  return useQuery({
    queryKey: ['bookings', id],
    queryFn: () => bookingsService.get(id),
    enabled: !!id,
  });
}
```
