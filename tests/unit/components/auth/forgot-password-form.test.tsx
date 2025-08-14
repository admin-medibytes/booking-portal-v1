import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { authClient } from '@/lib/auth-client';

// Mock dependencies
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    forgetPassword: vi.fn(),
  },
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

describe('ForgotPasswordForm', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders forgot password form', () => {
    render(<ForgotPasswordForm />);

    expect(screen.getByText(/enter your email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
    expect(screen.getByText(/back to sign in/i)).toBeInTheDocument();
  });

  it('validates email format', async () => {
    render(<ForgotPasswordForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    await user.type(emailInput, 'invalid-email');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
    });
  });

  it('sends password reset email successfully', async () => {
    vi.mocked(authClient.forgetPassword).mockResolvedValueOnce({
      data: { success: true },
      error: null,
    });

    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email address/i), 'user@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(authClient.forgetPassword).toHaveBeenCalledWith({
        email: 'user@example.com',
        redirectTo: expect.stringContaining('/reset-password'),
      });
    });
  });

  it('shows success message after sending email', async () => {
    vi.mocked(authClient.forgetPassword).mockResolvedValueOnce({
      data: { success: true },
      error: null,
    });

    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email address/i), 'user@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
      expect(screen.getByText(/we've sent a password reset link to user@example.com/i)).toBeInTheDocument();
    });
  });

  it('displays error message on failure', async () => {
    vi.mocked(authClient.forgetPassword).mockResolvedValueOnce({
      data: null,
      error: { message: 'User not found' },
    });

    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email address/i), 'nonexistent@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/user not found/i)).toBeInTheDocument();
    });
  });

  it('disables submit button while sending', async () => {
    vi.mocked(authClient.forgetPassword).mockImplementation(() => 
      new Promise((resolve) => setTimeout(() => resolve({ data: { success: true }, error: null }), 100))
    );

    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email address/i), 'user@example.com');
    const submitButton = screen.getByRole('button', { name: /send reset link/i });
    
    await user.click(submitButton);

    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveTextContent(/sending/i);

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });
  });
});