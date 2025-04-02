import { getOPFSRoot, getAllFiles, readFile, deleteFile } from "../content";

// Mock implementations of FileSystem API interfaces
class MockFileSystemHandle {
  constructor(public readonly name: string) {}
  readonly kind: "file" | "directory" = "file";
  isSameEntry(other: FileSystemHandle): Promise<boolean> {
    return Promise.resolve(false);
  }
}

class MockFileSystemFileHandle extends MockFileSystemHandle {
  readonly kind: "file" = "file";
  getFile(): Promise<File> {
    return Promise.resolve(new File([], this.name));
  }
  createWritable(
    options?: FileSystemCreateWritableOptions
  ): Promise<FileSystemWritableFileStream> {
    return Promise.resolve(
      new WritableStream() as FileSystemWritableFileStream
    );
  }
}

class MockFileSystemDirectoryHandle extends MockFileSystemHandle {
  readonly kind: "directory" = "directory";
  private mockValues: FileSystemHandle[] = [];
  public getFileHandle: jest.Mock;
  public getDirectoryHandle: jest.Mock;
  public removeEntry: jest.Mock;

  constructor(name: string) {
    super(name);
    this.getFileHandle = jest.fn();
    this.getDirectoryHandle = jest.fn();
    this.removeEntry = jest.fn();
  }

  resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null> {
    return Promise.resolve(null);
  }

  keys(): AsyncIterableIterator<string> {
    return {
      [Symbol.asyncIterator]() {
        return this;
      },
      async next() {
        return { done: true, value: undefined };
      },
    };
  }

  values(): AsyncIterableIterator<FileSystemHandle> {
    return {
      [Symbol.asyncIterator]() {
        return this;
      },
      async next() {
        return { done: true, value: undefined };
      },
    };
  }

  entries(): AsyncIterableIterator<[string, FileSystemHandle]> {
    return {
      [Symbol.asyncIterator]() {
        return this;
      },
      async next() {
        return { done: true, value: undefined };
      },
    };
  }

  // Helper methods for testing
  setMockValues(values: FileSystemHandle[]) {
    this.mockValues = values;
  }
}

// Mock navigator.storage
const mockStorage = {
  getDirectory: jest.fn(),
};

Object.defineProperty(global, "navigator", {
  value: {
    storage: mockStorage,
  },
  writable: true,
});

describe("OPFS Operations", () => {
  let mockRoot: MockFileSystemDirectoryHandle;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRoot = new MockFileSystemDirectoryHandle("root");
    mockStorage.getDirectory = jest.fn().mockResolvedValue(mockRoot);
  });

  describe("getOPFSRoot", () => {
    it("should get the root directory handle", async () => {
      const root = await getOPFSRoot();
      expect(root).toBe(mockRoot);
      expect(mockStorage.getDirectory).toHaveBeenCalled();
    });
  });

  describe("getAllFiles", () => {
    it("should return all files from the directory", async () => {
      const mockFile = new MockFileSystemFileHandle("test.txt");
      const mockFileObj = new File(["test"], "test.txt", {
        type: "text/plain",
      });

      const mockValues = jest.fn().mockImplementation(async function* () {
        yield mockFile;
      });
      mockRoot.values = mockValues;
      jest.spyOn(mockFile, "getFile").mockResolvedValue(mockFileObj);

      const files = await getAllFiles(mockRoot as any);
      expect(files).toHaveLength(1);
      expect(files[0]).toMatchObject({
        name: "test.txt",
        size: 4,
        type: "text/plain",
      });
    });
  });

  describe("readFile", () => {
    it("should read a file from the given path", async () => {
      const mockFileHandle = new MockFileSystemFileHandle("test.txt");
      const mockFile = new File(["test content"], "test.txt", {
        type: "text/plain",
      });

      mockRoot.getDirectoryHandle.mockResolvedValue(mockRoot);
      mockRoot.getFileHandle.mockResolvedValue(mockFileHandle);
      jest.spyOn(mockFileHandle, "getFile").mockResolvedValue(mockFile);

      const file = await readFile("test.txt", mockRoot as any);
      expect(file).toBe(mockFile);
      expect(mockRoot.getFileHandle).toHaveBeenCalledWith("test.txt", {
        create: false,
      });
    });
  });

  describe("deleteFile", () => {
    it("should delete a file from the given path", async () => {
      const mockFileHandle = new MockFileSystemFileHandle("test.txt");

      // Set up the mock chain
      mockRoot.getDirectoryHandle = jest.fn().mockResolvedValue(mockRoot);
      mockRoot.removeEntry = jest.fn().mockResolvedValue(undefined);

      await deleteFile("test.txt");
      expect(mockStorage.getDirectory).toHaveBeenCalled();
      expect(mockRoot.removeEntry).toHaveBeenCalledWith("test.txt");
    });
  });
});
