require("@testing-library/jest-dom");

// Mock chrome API
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
    },
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
  scripting: {
    executeScript: jest.fn(),
  },
};

// Mock FileSystem API
global.FileSystemDirectoryHandle = class {
  constructor() {
    this.name = "root";
  }
  getFileHandle = jest.fn();
  getDirectoryHandle = jest.fn();
  values = jest.fn();
};

global.FileSystemFileHandle = class {
  constructor() {
    this.name = "file";
  }
  getFile = jest.fn();
  createWritable = jest.fn();
  remove = jest.fn();
};

// Add Jest mock types to FileSystemHandle methods
Object.getOwnPropertyNames(FileSystemDirectoryHandle.prototype).forEach(
  (prop) => {
    if (typeof FileSystemDirectoryHandle.prototype[prop] === "function") {
      FileSystemDirectoryHandle.prototype[prop] = jest.fn();
    }
  }
);

Object.getOwnPropertyNames(FileSystemFileHandle.prototype).forEach((prop) => {
  if (typeof FileSystemFileHandle.prototype[prop] === "function") {
    FileSystemFileHandle.prototype[prop] = jest.fn();
  }
});
