import { describe, it, expect, vi, beforeEach } from "vitest";
import { userService } from "@/server/services/user.service";
import { db } from "@/server/db";
import { auth } from "@/lib/auth";
import { emailService } from "@/server/services/email.service";
import { ConflictError, NotFoundError, AppError } from "@/server/utils/errors";

// Mock dependencies
vi.mock("@/server/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      createUser: vi.fn(),
      setUserPassword: vi.fn(),
    },
  },
}));

vi.mock("@/server/services/email.service", () => ({
  emailService: {
    sendInvitationEmail: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
  },
}));

vi.mock("@/server/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("UserService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createUser", () => {
    it("creates a user successfully", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      vi.mocked(db.select).mockImplementation(mockSelect);

      vi.mocked(auth.api.createUser).mockResolvedValueOnce({
        user: {
          id: "123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const result = await userService.createUser({
        email: "test@example.com",
        name: "Test User",
        firstName: "Test",
        lastName: "User",
        jobTitle: "Developer",
        role: "user",
      });

      expect(result.email).toBe("test@example.com");
      expect(auth.api.createUser).toHaveBeenCalled();
    });

    it("throws ConflictError if user already exists", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ email: "existing@example.com" }]),
          }),
        }),
      });
      vi.mocked(db.select).mockImplementation(mockSelect);

      await expect(
        userService.createUser({
          email: "existing@example.com",
          name: "Test User",
          firstName: "Test",
          lastName: "User",
          jobTitle: "Developer",
          role: "user",
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("inviteUser", () => {
    it("creates and sends an invitation successfully", async () => {
      // Mock no existing user
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      vi.mocked(db.select).mockImplementation(mockSelect);

      // Mock organization exists
      const mockOrgSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "org123", name: "Test Org" }]),
          }),
        }),
      });
      vi.mocked(db.select)
        .mockImplementationOnce(mockSelect) // First call for user check
        .mockImplementationOnce(mockOrgSelect); // Second call for org check

      // Mock insert
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });
      vi.mocked(db.insert).mockImplementation(mockInsert);

      const result = await userService.inviteUser({
        email: "new@example.com",
        role: "referrer",
        organizationId: "org123",
        invitedBy: { id: "admin123", name: "Admin User", email: "admin@example.com" },
      });

      expect(result.email).toBe("new@example.com");
      expect(result.role).toBe("referrer");
      expect(emailService.sendInvitationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "new@example.com",
          organizationName: "Test Org",
        })
      );
    });

    it("throws ConflictError if user already has pending invitation", async () => {
      // Mock existing user
      const mockUserSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ email: "existing@example.com" }]),
          }),
        }),
      });

      // Mock existing invitation
      const mockInviteSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "invite123" }]),
          }),
        }),
      });

      vi.mocked(db.select)
        .mockImplementationOnce(mockUserSelect)
        .mockImplementationOnce(mockInviteSelect);

      await expect(
        userService.inviteUser({
          email: "existing@example.com",
          role: "specialist",
          organizationId: "org123",
          invitedBy: { id: "admin123", name: "Admin", email: "admin@example.com" },
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("acceptInvitation", () => {
    it("accepts invitation and creates user successfully", async () => {
      // Mock invitation exists
      const mockInviteSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "invite123",
                email: "test@example.com",
                organizationId: "org123",
                role: "referrer",
                status: "pending",
                expiresAt: new Date(Date.now() + 86400000), // 1 day from now
              },
            ]),
          }),
        }),
      });

      // Mock no existing user
      const mockUserSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      vi.mocked(db.select)
        .mockImplementationOnce(mockInviteSelect)
        .mockImplementationOnce(mockUserSelect);

      // Mock user creation
      vi.mocked(auth.api.createUser).mockResolvedValueOnce({
        user: {
          id: "user123",
          email: "test@example.com",
          name: "Test User",
          role: "referrer",
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Mock member insert
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });
      vi.mocked(db.insert).mockImplementation(mockInsert);

      // Mock invitation update
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });
      vi.mocked(db.update).mockImplementation(mockUpdate);

      const result = await userService.acceptInvitation({
        invitationId: "invite123",
        email: "test@example.com",
        password: "password123",
        firstName: "Test",
        lastName: "User",
        jobTitle: "Developer",
      });

      expect(result.userId).toBe("user123");
      expect(auth.api.createUser).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalled();
    });

    it("throws error if invitation is expired", async () => {
      const mockInviteSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "invite123",
                email: "test@example.com",
                status: "pending",
                expiresAt: new Date(Date.now() - 86400000), // 1 day ago
              },
            ]),
          }),
        }),
      });

      vi.mocked(db.select).mockImplementationOnce(mockInviteSelect);

      await expect(
        userService.acceptInvitation({
          invitationId: "invite123",
          email: "test@example.com",
          password: "password123",
          firstName: "Test",
          lastName: "User",
          jobTitle: "Developer",
        })
      ).rejects.toThrow(AppError);
    });

    it("throws error if invitation already used", async () => {
      const mockInviteSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "invite123",
                email: "test@example.com",
                status: "accepted",
                expiresAt: new Date(Date.now() + 86400000),
              },
            ]),
          }),
        }),
      });

      vi.mocked(db.select).mockImplementationOnce(mockInviteSelect);

      await expect(
        userService.acceptInvitation({
          invitationId: "invite123",
          email: "test@example.com",
          password: "password123",
          firstName: "Test",
          lastName: "User",
          jobTitle: "Developer",
        })
      ).rejects.toThrow(AppError);
    });
  });

  describe("listUsers", () => {
    it("returns paginated user list", async () => {
      const mockUsers = [
        { id: "1", email: "user1@example.com", name: "User 1" },
        { id: "2", email: "user2@example.com", name: "User 2" },
      ];

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(mockUsers),
              }),
            }),
          }),
        }),
      });

      const mockCount = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 2 }]),
        }),
      });

      vi.mocked(db.select).mockImplementationOnce(mockSelect).mockImplementationOnce(mockCount);

      const result = await userService.listUsers({
        page: 1,
        limit: 20,
      });

      expect(result.users).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
    });

    it("filters users by search term", async () => {
      const mockUsers = [{ id: "1", email: "john@example.com", name: "John Doe" }];

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(mockUsers),
              }),
            }),
          }),
        }),
      });

      const mockCount = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      });

      vi.mocked(db.select).mockImplementationOnce(mockSelect).mockImplementationOnce(mockCount);

      const result = await userService.listUsers({
        page: 1,
        limit: 20,
        search: "john",
      });

      expect(result.users).toHaveLength(1);
      expect(result.users[0].email).toBe("john@example.com");
    });
  });
});
