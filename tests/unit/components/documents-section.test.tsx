import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DocumentsSection } from "@/components/bookings/documents-section";
import { useDocuments } from "@/hooks/use-documents";
import { useAuth } from "@/hooks/use-auth";
import { documentPermissionsService } from "@/server/services/document-permissions.service";

// Mock hooks and services
vi.mock("@/hooks/use-documents");
vi.mock("@/hooks/use-auth");
vi.mock("@/hooks/use-download-document", () => ({
  useDownloadDocument: () => ({
    downloadDocument: vi.fn(),
    isDownloading: () => false,
    getProgress: () => 0,
  }),
}));
vi.mock("@/hooks/use-delete-document", () => ({
  useDeleteDocument: () => ({
    deleteDocument: vi.fn(),
    isDeleting: () => false,
  }),
}));
vi.mock("@/server/services/document-permissions.service");

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("DocumentsSection", () => {
  const mockDocuments = [
    {
      id: "doc-1",
      bookingId: "booking-123",
      uploadedById: "user-1",
      uploadedBy: { id: "user-1", name: "John Doe", email: "john@example.com" },
      s3Key: "key-1",
      fileName: "consent-form.pdf",
      fileSize: 1024,
      mimeType: "application/pdf",
      section: "ime_documents" as const,
      category: "consent_form" as const,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
      deletedAt: null,
    },
    {
      id: "doc-2",
      bookingId: "booking-123",
      uploadedById: "user-2",
      uploadedBy: { id: "user-2", name: "Jane Smith", email: "jane@example.com" },
      s3Key: "key-2",
      fileName: "document-brief.docx",
      fileSize: 2048,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      section: "ime_documents" as const,
      category: "document_brief" as const,
      createdAt: new Date("2024-01-02"),
      updatedAt: new Date("2024-01-02"),
      deletedAt: null,
    },
    {
      id: "doc-3",
      bookingId: "booking-123",
      uploadedById: "user-3",
      uploadedBy: { id: "user-3", name: "Dr. Brown", email: "brown@example.com" },
      s3Key: "key-3",
      fileName: "dictation.mp3",
      fileSize: 3072,
      mimeType: "audio/mpeg",
      section: "supplementary_documents" as const,
      category: "dictation" as const,
      createdAt: new Date("2024-01-03"),
      updatedAt: new Date("2024-01-03"),
      deletedAt: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-1", name: "Test User", email: "test@example.com", memberRole: "referrer" },
      isLoading: false,
      isAuthenticated: true,
    });
    vi.mocked(documentPermissionsService.getUserRole).mockReturnValue("referrer");
    vi.mocked(documentPermissionsService.hasPermission).mockImplementation(({ permission, category }) => {
      if (permission === "upload") return category === "consent_form" || category === "document_brief";
      if (permission === "download") return true;
      if (permission === "delete") return category === "consent_form" || category === "document_brief";
      return false;
    });
  });

  describe("Tab Navigation", () => {
    it("should display IME Documents tab by default", () => {
      vi.mocked(useDocuments).mockReturnValue({
        data: mockDocuments.filter(d => d.section === "ime_documents"),
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      render(<DocumentsSection bookingId="booking-123" />, { wrapper: createWrapper() });

      const imeTab = screen.getByRole("tab", { name: "IME Documents" });
      const suppTab = screen.getByRole("tab", { name: "Supplementary Documents" });

      expect(imeTab).toHaveAttribute("data-state", "active");
      expect(suppTab).toHaveAttribute("data-state", "inactive");
    });

    it("should switch tabs when clicked", async () => {
      const mockRefetch = vi.fn();
      vi.mocked(useDocuments).mockReturnValue({
        data: [],
        isLoading: false,
        refetch: mockRefetch,
      } as any);

      render(<DocumentsSection bookingId="booking-123" />, { wrapper: createWrapper() });

      const suppTab = screen.getByRole("tab", { name: "Supplementary Documents" });
      fireEvent.click(suppTab);

      await waitFor(() => {
        expect(suppTab).toHaveAttribute("data-state", "active");
      });
    });

    it("should filter documents by section", () => {
      vi.mocked(useDocuments).mockReturnValue({
        data: mockDocuments.filter(d => d.section === "ime_documents"),
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      render(<DocumentsSection bookingId="booking-123" />, { wrapper: createWrapper() });

      expect(screen.getByText("consent-form.pdf")).toBeInTheDocument();
      expect(screen.getByText("document-brief.docx")).toBeInTheDocument();
      expect(screen.queryByText("dictation.mp3")).not.toBeInTheDocument();
    });
  });

  describe("Category Filtering", () => {
    it("should display category filter dropdown", () => {
      vi.mocked(useDocuments).mockReturnValue({
        data: mockDocuments.filter(d => d.section === "ime_documents"),
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      render(<DocumentsSection bookingId="booking-123" />, { wrapper: createWrapper() });

      expect(screen.getByText("All Categories")).toBeInTheDocument();
    });

    it("should show document counts per category", () => {
      vi.mocked(useDocuments).mockReturnValue({
        data: mockDocuments.filter(d => d.section === "ime_documents"),
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      render(<DocumentsSection bookingId="booking-123" />, { wrapper: createWrapper() });

      expect(screen.getByText("Consent Form")).toBeInTheDocument();
      expect(screen.getByText("1", { selector: ".text-xs" })).toBeInTheDocument();
    });

    it("should filter documents by category when selected", async () => {
      vi.mocked(useDocuments).mockReturnValue({
        data: mockDocuments.filter(d => d.section === "ime_documents"),
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      render(<DocumentsSection bookingId="booking-123" />, { wrapper: createWrapper() });

      const filterButton = screen.getByRole("combobox", { name: /filter by category/i });
      fireEvent.click(filterButton);

      const consentOption = screen.getByText("Consent Form (1)");
      fireEvent.click(consentOption);

      await waitFor(() => {
        expect(screen.getByText("consent-form.pdf")).toBeInTheDocument();
        expect(screen.queryByText("document-brief.docx")).not.toBeInTheDocument();
      });
    });
  });

  describe("Sorting", () => {
    it("should display sort dropdown", () => {
      vi.mocked(useDocuments).mockReturnValue({
        data: mockDocuments,
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      render(<DocumentsSection bookingId="booking-123" />, { wrapper: createWrapper() });

      expect(screen.getByRole("combobox", { name: /Date/i })).toBeInTheDocument();
    });

    it("should sort documents by name", async () => {
      vi.mocked(useDocuments).mockReturnValue({
        data: mockDocuments.filter(d => d.section === "ime_documents"),
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      render(<DocumentsSection bookingId="booking-123" />, { wrapper: createWrapper() });

      const sortButton = screen.getAllByRole("combobox")[1]; // Sort dropdown is second
      fireEvent.click(sortButton);

      const nameOption = screen.getByText("Name");
      fireEvent.click(nameOption);

      await waitFor(() => {
        const fileNames = screen.getAllByText(/\.(pdf|docx)$/);
        expect(fileNames[0]).toHaveTextContent("consent-form.pdf");
        expect(fileNames[1]).toHaveTextContent("document-brief.docx");
      });
    });
  });

  describe("Permission-based UI", () => {
    it("should show download button for allowed categories", () => {
      vi.mocked(useDocuments).mockReturnValue({
        data: mockDocuments.filter(d => d.section === "ime_documents"),
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      render(<DocumentsSection bookingId="booking-123" />, { wrapper: createWrapper() });

      const downloadButtons = screen.getAllByText("Download");
      expect(downloadButtons).toHaveLength(2); // For both documents
    });

    it("should show delete button for allowed categories", () => {
      vi.mocked(useDocuments).mockReturnValue({
        data: mockDocuments.filter(d => d.section === "ime_documents"),
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      render(<DocumentsSection bookingId="booking-123" />, { wrapper: createWrapper() });

      const deleteButtons = screen.getAllByRole("button", { name: "" }).filter(
        btn => btn.querySelector("svg")?.classList.contains("w-4")
      );
      expect(deleteButtons.length).toBeGreaterThan(0);
    });

    it("should not show consent_form in supplementary documents tab", async () => {
      vi.mocked(useDocuments).mockReturnValue({
        data: mockDocuments.filter(d => d.section === "supplementary_documents"),
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      render(<DocumentsSection bookingId="booking-123" />, { wrapper: createWrapper() });

      const suppTab = screen.getByRole("tab", { name: "Supplementary Documents" });
      fireEvent.click(suppTab);

      await waitFor(() => {
        expect(screen.queryByText("Consent Form")).not.toBeInTheDocument();
      });
    });
  });

  describe("Document Display", () => {
    it("should show uploaded by information", () => {
      vi.mocked(useDocuments).mockReturnValue({
        data: [mockDocuments[0]],
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      render(<DocumentsSection bookingId="booking-123" />, { wrapper: createWrapper() });

      expect(screen.getByText(/by John Doe/)).toBeInTheDocument();
    });

    it("should show appropriate icon for audio files", () => {
      vi.mocked(useDocuments).mockReturnValue({
        data: [mockDocuments[2]],
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      render(<DocumentsSection bookingId="booking-123" />, { wrapper: createWrapper() });

      const audioIcon = screen.getByRole("img", { hidden: true }).parentElement;
      expect(audioIcon).toHaveClass("text-purple-600");
    });

    it("should format file sizes correctly", () => {
      vi.mocked(useDocuments).mockReturnValue({
        data: [mockDocuments[0]],
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      render(<DocumentsSection bookingId="booking-123" />, { wrapper: createWrapper() });

      expect(screen.getByText("1 KB")).toBeInTheDocument();
    });
  });

  describe("Empty States", () => {
    it("should show empty state when no documents", () => {
      vi.mocked(useDocuments).mockReturnValue({
        data: [],
        isLoading: false,
        refetch: vi.fn(),
      } as any);

      render(<DocumentsSection bookingId="booking-123" />, { wrapper: createWrapper() });

      expect(screen.getByText("No documents uploaded")).toBeInTheDocument();
      expect(screen.getByText("Upload Documents", { selector: "button" })).toBeInTheDocument();
    });

    it("should show loading state", () => {
      vi.mocked(useDocuments).mockReturnValue({
        data: [],
        isLoading: true,
        refetch: vi.fn(),
      } as any);

      render(<DocumentsSection bookingId="booking-123" />, { wrapper: createWrapper() });

      expect(screen.getByText("Loading documents...")).toBeInTheDocument();
    });
  });
});