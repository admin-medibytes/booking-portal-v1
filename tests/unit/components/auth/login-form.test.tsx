import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '@/components/auth/login-form';
import { authClient } from '@/lib/auth-client';

// Mock dependencies
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signIn: {
      email: vi.fn(),
    },
    getSession: vi.fn(),
  },
}));

describe('LoginForm', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form with all fields', () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/remember me/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByText(/forgot your password/i)).toBeInTheDocument();
  });

  it('validates email format', async () => {
    render(<LoginForm />);
    
    const emailInput = screen.getByLabelText(/email address/i);
    await user.type(emailInput, 'invalid-email');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
    });
  });

  it('validates password is required', async () => {
    render(<LoginForm />);
    
    const emailInput = screen.getByLabelText(/email address/i);
    await user.type(emailInput, 'user@example.com');
    
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });

  it('handles successful login for existing user', async () => {
    const mockPush = vi.fn();
    const mockRouter = { push: mockPush, replace: vi.fn() };
    vi.mocked(authClient.signIn.email).mockResolvedValueOnce({
      data: {
        user: {
          id: '123',
          email: 'user@example.com',
          emailVerified: true,
          image: 'initialized',
        },
        session: {},
      },
      error: null,
    });

    vi.mocked(authClient.getSession).mockResolvedValueOnce({
      data: {
        user: {
          id: '123',
          email: 'user@example.com',
          emailVerified: true,
          image: 'initialized',
        },
        session: {},
      },
      error: null,
    });

    // Override the mock for this test
    vi.doMock('next/navigation', () => ({
      useRouter: () => mockRouter,
    }));

    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email address/i), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(authClient.signIn.email).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'password123',
        rememberMe: false,
      });
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('redirects to onboarding for first-time users', async () => {
    const mockPush = vi.fn();
    const mockRouter = { push: mockPush, replace: vi.fn() };
    vi.mocked(authClient.signIn.email).mockResolvedValueOnce({
      data: {
        user: {
          id: '123',
          email: 'user@example.com',
          emailVerified: true,
          image: null, // No image means first-time user
        },
        session: {},
      },
      error: null,
    });

    vi.mocked(authClient.getSession).mockResolvedValueOnce({
      data: {
        user: {
          id: '123',
          email: 'user@example.com',
          emailVerified: true,
          image: null,
        },
        session: {},
      },
      error: null,
    });

    vi.doMock('next/navigation', () => ({
      useRouter: () => mockRouter,
    }));

    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email address/i), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/onboarding');
    });
  });

  it('displays error message on failed login', async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValueOnce({
      data: null,
      error: {
        message: 'Invalid credentials',
      },
    });

    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email address/i), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });

  it('handles remember me checkbox', async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValueOnce({
      data: {
        user: {
          id: '123',
          email: 'user@example.com',
          emailVerified: true,
        },
        session: {},
      },
      error: null,
    });

    render(<LoginForm />);

    const rememberMeCheckbox = screen.getByLabelText(/remember me/i);
    await user.click(rememberMeCheckbox);

    await user.type(screen.getByLabelText(/email address/i), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(authClient.signIn.email).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'password123',
        rememberMe: true,
      });
    });
  });
});