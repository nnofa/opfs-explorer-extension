import { formatFileSize, getFileIcon } from "../popup";

describe("Popup Utilities", () => {
  describe("formatFileSize", () => {
    it("should format bytes correctly", () => {
      expect(formatFileSize(0)).toBe("0 Bytes");
      expect(formatFileSize(1024)).toBe("1 KB");
      expect(formatFileSize(1024 * 1024)).toBe("1 MB");
      expect(formatFileSize(1024 * 1024 * 1024)).toBe("1 GB");
    });

    it("should handle decimal sizes correctly", () => {
      expect(formatFileSize(1500)).toBe("1.46 KB");
      expect(formatFileSize(1500000)).toBe("1.43 MB");
    });
  });

  describe("getFileIcon", () => {
    it("should return correct icon for different file types", () => {
      expect(getFileIcon("test.pdf")).toContain("fa-file-pdf");
      expect(getFileIcon("test.docx")).toContain("fa-file-word");
      expect(getFileIcon("test.txt")).toContain("fa-file-lines");
      expect(getFileIcon("test.jpg")).toContain("fa-file-image");
      expect(getFileIcon("test.zip")).toContain("fa-file-zipper");
      expect(getFileIcon("test.unknown")).toContain("fa-file");
    });
  });
});
