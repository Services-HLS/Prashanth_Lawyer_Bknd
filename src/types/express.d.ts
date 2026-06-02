declare global {
  namespace Express {
    interface Request {
      adminUser?: string;
      adminUserId?: string;
    }
  }
}

export {};
