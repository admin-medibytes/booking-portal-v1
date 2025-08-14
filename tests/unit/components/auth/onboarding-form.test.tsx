import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingForm } from '@/components/auth/onboarding-form';
import { authClient } from '@/lib/auth-client';

// Mock dependencies
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    changePassword: vi.fn(),
    updateUser: vi.fn(),
    twoFactor: {
      enable: vi.fn(),
      verifyTotp: vi.fn(),
    },
  },
}));

describe('OnboardingForm', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('renders password creation form', () => {
    render(<OnboardingForm />);

    expect(screen.getByText(/set your password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/enable two-factor authentication/i)).toBeInTheDocument();
  });

  it('validates password length', async () => {
    render(<OnboardingForm />);

    const passwordInput = screen.getByLabelText(/new password/i);
    await user.type(passwordInput, 'short');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    });
  });

  it('validates password confirmation matches', async () => {
    render(<OnboardingForm />);

    await user.type(screen.getByLabelText(/new password/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'different123');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  it('successfully sets password without 2FA', async () => {
    const mockPush = vi.fn();
    vi.doMock('next/navigation', () => ({
      useRouter: () => ({ push: mockPush }),
    }));

    vi.mocked(authClient.changePassword).mockResolvedValueOnce({
      data: { success: true },
      error: null,
    });

    vi.mocked(authClient.updateUser).mockResolvedValueOnce({
      data: { success: true },
      error: null,
    });

    render(<OnboardingForm />);

    await user.type(screen.getByLabelText(/new password/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(authClient.changePassword).toHaveBeenCalledWith({
        newPassword: 'password123',
        currentPassword: '',
        revokeOtherSessions: true,
      });
      expect(authClient.updateUser).toHaveBeenCalledWith({
        image: 'initialized',
      });
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('proceeds to 2FA setup when enabled', async () => {
    vi.mocked(authClient.changePassword).mockResolvedValueOnce({
      data: { success: true },
      error: null,
    });

    vi.mocked(authClient.updateUser).mockResolvedValueOnce({
      data: { success: true },
      error: null,
    });

    render(<OnboardingForm />);

    await user.click(screen.getByLabelText(/enable two-factor authentication/i));
    await user.type(screen.getByLabelText(/new password/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText(/set up two-factor authentication/i)).toBeInTheDocument();
      expect(sessionStorage.getItem('temp_2fa_pwd')).toBe('password123');
    });
  });

  it('cleans up password from sessionStorage on unmount', async () => {
    vi.mocked(authClient.changePassword).mockResolvedValueOnce({
      data: { success: true },
      error: null,
    });

    vi.mocked(authClient.updateUser).mockResolvedValueOnce({
      data: { success: true },
      error: null,
    });

    const { unmount } = render(<OnboardingForm />);

    await user.click(screen.getByLabelText(/enable two-factor authentication/i));
    await user.type(screen.getByLabelText(/new password/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(sessionStorage.getItem('temp_2fa_pwd')).toBe('password123');
    });

    unmount();

    // Password should be cleared from sessionStorage
    expect(sessionStorage.getItem('temp_2fa_pwd')).toBeNull();
  });

  it('displays error when password change fails', async () => {
    vi.mocked(authClient.changePassword).mockResolvedValueOnce({
      data: null,
      error: { message: 'Password change failed' },
    });

    render(<OnboardingForm />);

    await user.type(screen.getByLabelText(/new password/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText(/password change failed/i)).toBeInTheDocument();
    });
  });
});

describe('TwoFactorSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('enables 2FA with password from sessionStorage', async () => {
    sessionStorage.setItem('temp_2fa_pwd', 'testpassword');

    vi.mocked(authClient.twoFactor.enable).mockResolvedValueOnce({
      data: {
        totpURI: 'otpauth://totp/Medibytes:user@example.com?secret=SECRET',
        backupCodes: ['CODE1', 'CODE2', 'CODE3'],
      },
      error: null,
    });

    render(<OnboardingForm />);

    // Simulate being in 2FA step
    const { rerender } = render(<OnboardingForm />);
    
    await waitFor(() => {
      expect(authClient.twoFactor.enable).toHaveBeenCalledWith({
        password: 'testpassword',
      });
    });
  });

  it('shows error when password not found in sessionStorage', async () => {
    const user = userEvent.setup();
    sessionStorage.removeItem('temp_2fa_pwd');

    vi.mocked(authClient.changePassword).mockResolvedValueOnce({
      data: { success: true },
      error: null,
    });

    vi.mocked(authClient.updateUser).mockResolvedValueOnce({
      data: { success: true },
      error: null,
    });

    render(<OnboardingForm />);

    // Force navigation to 2FA step
    await user.click(screen.getByLabelText(/enable two-factor authentication/i));
    await user.type(screen.getByLabelText(/new password/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'password123');
    
    // Clear sessionStorage before form submission completes
    sessionStorage.removeItem('temp_2fa_pwd');
    
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText(/set up two-factor authentication/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/password not found/i)).toBeInTheDocument();
    });
  });

  it('verifies TOTP code successfully', async () => {
    const user = userEvent.setup();
    const mockPush = vi.fn();
    vi.doMock('next/navigation', () => ({
      useRouter: () => ({ push: mockPush }),
    }));

    sessionStorage.setItem('temp_2fa_pwd', 'testpassword');

    vi.mocked(authClient.twoFactor.enable).mockResolvedValueOnce({
      data: {
        totpURI: 'otpauth://totp/Medibytes:user@example.com?secret=SECRET',
        backupCodes: ['CODE1', 'CODE2'],
      },
      error: null,
    });

    vi.mocked(authClient.twoFactor.verifyTotp).mockResolvedValueOnce({
      data: { success: true },
      error: null,
    });

    vi.mocked(authClient.changePassword).mockResolvedValueOnce({
      data: { success: true },
      error: null,
    });

    vi.mocked(authClient.updateUser).mockResolvedValueOnce({
      data: { success: true },
      error: null,
    });

    render(<OnboardingForm />);

    // Navigate to 2FA step
    await user.click(screen.getByLabelText(/enable two-factor authentication/i));
    await user.type(screen.getByLabelText(/new password/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText(/set up two-factor authentication/i)).toBeInTheDocument();
    });

    // Enter verification code
    await user.type(screen.getByLabelText(/verification code/i), '123456');
    await user.click(screen.getByRole('button', { name: /verify & continue/i }));

    await waitFor(() => {
      expect(authClient.twoFactor.verifyTotp).toHaveBeenCalledWith({
        code: '123456',
      });
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });
});