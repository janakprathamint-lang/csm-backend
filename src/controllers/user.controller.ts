import { Request, Response } from "express";
import {
  createUser,
  getAllUsers,
  updateUserByAdmin,
  deleteUserByAdmin,
  getAllManagers,
  getAllCounsellors,
  getCounsellorsByManagerId,
  getManagersWithCounsellors
} from "../models/user.model";
import bcrypt from "bcrypt";
import { db } from "../config/databaseConnection";
import { users } from "../schemas/users.schema";
import { refreshTokens } from "../schemas/refreshToken.schema";
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from "../utils/token";
import { eq, gt, and } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { Role } from "../types/role";
import { AuthenticatedRequest } from "../types/express-auth";
import { logActivity } from "../services/activityLog.service";
/* ================================
   REGISTER
================================ */

export const registerUser = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;

    // normalize input: accept snake_case or variants from clients
    const body = req.body || {};
    // normalize managerId: accept numeric strings, null/empty => undefined
    const managerRaw = body.managerId ?? body.manager_id;
    let managerId: number | undefined = undefined;
    if (managerRaw !== undefined && managerRaw !== null && managerRaw !== "") {
      const parsed = Number(managerRaw);
      if (!Number.isFinite(parsed) || isNaN(parsed)) {
        return res.status(400).json({ message: "managerId must be a valid number" });
      }
      managerId = parsed;
    }

    const payload = {
      fullName: body.fullName ?? body.full_name,
      email: body.email ? body.email.toLowerCase().trim() : undefined,
      password: body.password,
      role: body.role,
      empId: body.empId ?? body.emp_id,
      managerId,
      officePhone:
        body.officePhone ??
        body.office_phone ??
        body.company_phone_no ??
        body.office_phone_no,
      personalPhone:
        body.personalPhone ?? body.personal_phone ?? body.personal_phone_no,
      designation: body.designation,
      isSupervisor: body.isSupervisor ?? body.is_supervisor,
    };

    try {
      const user = await createUser(payload as any, authReq.user.role);

      // Log activity
      try {
        await logActivity(req, {
          entityType: "user",
          entityId: user.id,
          clientId: null,
          action: "CREATE",
          newValue: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            managerId: user.managerId,
          },
          description: `User created: ${user.fullName} (${user.role})`,
          performedBy: authReq.user.id,
        });
      } catch (activityError) {
        console.error("Activity log error in registerUser:", activityError);
      }

      res.status(201).json(user);
    } catch (error: any) {
      // map common DB or validation errors to 400
      return res.status(400).json({ message: error?.message ?? String(error) });
    }
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

/* ================================
   LOGIN
================================ */

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const emailNormalized = email ? String(email).toLowerCase().trim() : email;

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "username and password are required" });
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, emailNormalized));

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  // Get count of previous tokens before revoking (for logging)
  const previousTokensCount = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.userId, user.id));

  // revoke all previous refresh tokens (ensures single-device session)
  if (previousTokensCount.length > 0) {
    await db
      .update(refreshTokens)
      .set({ revoked: true })
      .where(eq(refreshTokens.userId, user.id));

    if (process.env.NODE_ENV !== "production") {
      console.log(`🔄 Revoked ${previousTokensCount.length} previous refresh token(s) for user ${user.id}`);
    }
  }

  // create a new refresh token and store its hash
  const refreshToken = generateRefreshToken({ userId: user.id });

  const [inserted] = await db
    .insert(refreshTokens)
    .values({
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    .returning({ id: refreshTokens.id });

  const sessionId = inserted.id;

  // generate access token tied to this session id
  const accessToken = generateAccessToken({
    userId: user.id,
    role: user.role as Role,
    sessionId,
  });

  // set cookies (access short lived, refresh long lived)
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 15 * 60 * 1000,
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  if (process.env.NODE_ENV !== "production") {
    console.log(`✅ Login successful for user ${user.id} (${user.email})`);
    console.log(`   New refresh token created with session ID: ${sessionId}`);
  }

  // Log activity
  try {
    await logActivity(req, {
      entityType: "user",
      entityId: user.id,
      clientId: null,
      action: "LOGIN",
      newValue: {
        userId: user.id,
        email: user.email,
        role: user.role,
        sessionId: sessionId,
      },
      description: `User logged in: ${user.email} (${user.role})`,
      metadata: {
        sessionId: sessionId,
        revokedPreviousSessions: previousTokensCount.length,
      },
      performedBy: user.id,
    });
  } catch (activityError) {
    // Don't fail the request if activity log fails
    console.error("Activity log error in login:", activityError);
  }

  res.json({
    message: "Login successful",
    fullname: user.fullName,
    email: user.email,
    empid: user.emp_id,
    officePhone: user.officePhone,
    personalPhone: user.personalPhone,
    designation: user.designation,
    role: user.role,
    accessToken,
  });
};

/* ================================
   REFRESH TOKEN
================================ */

export const refreshAccessToken = async (req: Request, res: Response) => {
  // Try to get refresh token from cookie, body, or Authorization header (for Postman/testing)
  const refreshToken =
    req.cookies.refreshToken ||
    req.body.refreshToken ||
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : null);

  if (!refreshToken) {
    return res.status(401).json({ message: "Refresh token missing" });
  }

  // Trim token to avoid whitespace issues
  const trimmedToken = refreshToken.trim();

  let decoded: { userId: number };
  try {
    decoded = jwt.verify(
      trimmedToken,
      process.env.JWT_REFRESH_SECRET!
    ) as { userId: number };
  } catch (jwtError: any) {
    // JWT verification failed (expired, invalid signature, etc.)
    const errorMessage =
      jwtError.name === "TokenExpiredError"
        ? "Refresh token expired"
        : "Invalid refresh token format";

    if (process.env.NODE_ENV !== "production") {
      console.error("JWT verification failed:", jwtError.message);
    }

    return res.status(401).json({ message: errorMessage });
  }

  // Hash the token for database lookup
  const tokenHash = hashToken(trimmedToken);
  const now = new Date();

  // First, try to find the token by hash only (to get detailed error info)
  const [tokenByHash] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash));

  if (!tokenByHash) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Token hash not found in database:", {
        tokenHash: tokenHash.substring(0, 20) + "...",
        userId: decoded.userId,
      });
    }
    return res.status(401).json({ message: "Refresh token not found" });
  }

  // Check if token is revoked
  if (tokenByHash.revoked) {
    if (process.env.NODE_ENV !== "production") {
      console.error("❌ Token is revoked:", {
        tokenId: tokenByHash.id,
        userId: decoded.userId,
        createdAt: tokenByHash.createdAt,
        expiresAt: tokenByHash.expiresAt,
        message: "This token was revoked, likely because user logged in again. Use the refresh token from the most recent login.",
      });
    }
    return res.status(401).json({
      message: "Refresh token has been revoked",
      hint: "This token was revoked because you logged in from another device or session. Please login again to get a new refresh token."
    });
  }

  // Check if token is expired (using UTC for consistency)
  const expiresAt = new Date(tokenByHash.expiresAt);
  if (expiresAt <= now) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Token expired in database:", {
        tokenId: tokenByHash.id,
        expiresAt: expiresAt.toISOString(),
        now: now.toISOString(),
        userId: decoded.userId,
      });
    }
    return res.status(401).json({ message: "Refresh token has expired" });
  }

  // Verify user ID matches
  if (tokenByHash.userId !== decoded.userId) {
    if (process.env.NODE_ENV !== "production") {
      console.error("User ID mismatch:", {
        tokenUserId: tokenByHash.userId,
        decodedUserId: decoded.userId,
      });
    }
    return res.status(401).json({ message: "Token user mismatch" });
  }

  // Load the user's current role from the database
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, decoded.userId));

  if (!dbUser) {
    return res.status(401).json({ message: "User not found" });
  }

  // Generate new access token
  const newAccessToken = generateAccessToken({
    userId: decoded.userId,
    role: dbUser.role as Role,
    sessionId: tokenByHash.id,
  });

  // Set cookie with new access token
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie("accessToken", newAccessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 15 * 60 * 1000,
  });

  res.json({
    message: "Token refreshed",
    accessToken: newAccessToken,
    role: dbUser.role,
  });
};

/* ================================
   LOGOUT
================================ */

export const logout = async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;

  const refreshToken = req.cookies.refreshToken;

  if (refreshToken) {
    try {
      await db
        .update(refreshTokens)
        .set({ revoked: true })
        .where(eq(refreshTokens.tokenHash, hashToken(refreshToken)));
    } catch (err) {
      // log and continue
      console.error("Failed to revoke refresh token on logout", err);
    }
  }

  // Log activity (before clearing cookies)
  if (userId) {
    try {
      await logActivity(req, {
        entityType: "user",
        entityId: userId,
        clientId: null,
        action: "LOGOUT",
        description: `User logged out`,
        performedBy: userId,
      });
    } catch (activityError) {
      // Don't fail the request if activity log fails
      console.error("Activity log error in logout:", activityError);
    }
  }

  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.json({ message: "Logged out successfully" });
};

/* ================================
   ADMIN CONTROLLERS
================================ */

export const getAllUsersController = async (_req: Request, res: Response) => {
  const users = await getAllUsers();
  res.json({ success: true, count: users.length, data: users });
};

export const updateUserController = async (req: Request, res: Response) => {
  const userId = Number(req.params.userId);

  const body = req.body || {};

  // normalize managerId: accept numeric strings, null/empty => undefined
  const managerRaw = body.managerId ?? body.manager_id;
  let managerId: number | undefined = undefined;
  if (managerRaw !== undefined && managerRaw !== null && managerRaw !== "") {
    const parsed = Number(managerRaw);
    if (!Number.isFinite(parsed) || isNaN(parsed)) {
      return res.status(400).json({ message: "managerId must be a valid number" });
    }
    managerId = parsed;
  }

  const payload = {
    fullName: body.fullName ?? body.full_name,
    email: body.email ? body.email.toLowerCase().trim() : undefined,
    password: body.password,
    role: body.role,
    empId: body.empId ?? body.emp_id,
    managerId,
    officePhone:
      body.officePhone ??
      body.office_phone ??
      body.company_phone_no ??
      body.office_phone_no,
    personalPhone:
      body.personalPhone ?? body.personal_phone ?? body.personal_phone_no,
    designation: body.designation,
    isSupervisor: body.isSupervisor ?? body.is_supervisor,
  };

  try {
    const authReq = req as AuthenticatedRequest;

    // Fetch old value before updating
    let oldValue = null;
    try {
      const [oldUser] = await db
        .select({
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          role: users.role,
          empId: users.emp_id,
          managerId: users.managerId,
          officePhone: users.officePhone,
          personalPhone: users.personalPhone,
          designation: users.designation,
        })
        .from(users)
        .where(eq(users.id, userId));
      if (oldUser) {
        oldValue = oldUser;
      }
    } catch (error) {
      console.error("Error fetching old user value:", error);
    }

    const updatedUser = await updateUserByAdmin(userId, payload as any);

    // Log activity
    try {
      await logActivity(req, {
        entityType: "user",
        entityId: userId,
        clientId: null,
        action: "UPDATE",
        oldValue: oldValue,
        newValue: {
          id: updatedUser.id,
          email: updatedUser.email,
          fullName: updatedUser.fullName,
          role: updatedUser.role,
          managerId: updatedUser.managerId,
        },
        description: `User updated: ${updatedUser.fullName} (${updatedUser.role})`,
        performedBy: authReq.user.id,
      });
    } catch (activityError) {
      console.error("Activity log error in updateUserController:", activityError);
    }

    res.json({ success: true, data: updatedUser });
  } catch (error: any) {
    // Validation and uniqueness errors are returned as 400
    res
      .status(400)
      .json({ success: false, message: error?.message ?? String(error) });
  }
};

export const deleteUserController = async (req: Request, res: Response) => {
  const targetUserId = Number(req.params.userId);
  const authReq = req as AuthenticatedRequest;
  const adminUserId = authReq.user.id;

  const result = await deleteUserByAdmin(targetUserId, adminUserId);

  // Log activity
  try {
    await logActivity(req, {
      entityType: "user",
      entityId: targetUserId,
      clientId: null,
      action: "DELETE",
      description: `User deleted: ID ${targetUserId}`,
      performedBy: adminUserId,
    });
  } catch (activityError) {
    console.error("Activity log error in deleteUserController:", activityError);
  }

  res.json({ success: true, message: result.message });
};

export const getManagersDropdown = async (_req: Request, res: Response) => {
  const managers = await getAllManagers();
  res.json({ success: true, count: managers.length, data: managers });
};

export const getAllCounsellorsAdminController = async (_req: Request, res: Response) => {
  const counsellors = await getAllCounsellors();
  res.json({ success: true, count: counsellors.length, data: counsellors });
};

export const getCounsellorsByManagerController = async (req: Request, res: Response) => {
  try {
    const managerId = Number(req.params.managerId);

    if (!Number.isFinite(managerId) || isNaN(managerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid manager ID"
      });
    }

    const result = await getCounsellorsByManagerId(managerId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error?.message ?? String(error)
    });
  }
};

export const getManagersWithCounsellorsController = async (_req: Request, res: Response) => {
  try {
    const managersWithCounsellors = await getManagersWithCounsellors();
    res.json({
      success: true,
      count: managersWithCounsellors.length,
      data: managersWithCounsellors
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error?.message ?? String(error)
    });
  }
};
