import { Role } from "./role";
import "express";

declare global {
  namespace Express {
    interface User {
      id: number;
      role: Role;
    }

    interface Request {
      user?: User;
    }
  }
}

export {};
