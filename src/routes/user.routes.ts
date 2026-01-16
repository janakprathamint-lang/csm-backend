import { Router } from "express";
import { registerUser,login,logout,refreshAccessToken,getAllUsersController,
    updateUserController,
    deleteUserController,
    getManagersDropdown,
    getAllCounsellorsAdminController,
    getCounsellorsByManagerController,
    getManagersWithCounsellorsController
} from "../controllers/user.controller";
import { requireAuth,requireRole } from "../middlewares/auth.middleware";
import { preventDuplicateRequests } from "../middlewares/requestDeduplication.middleware";
import { healthController } from "../controllers/health.controller";

const router = Router();

router.post("/login", login);
router.post("/refresh", refreshAccessToken);
router.post("/logout", requireAuth,logout);

// 🔐 ADMIN ONLY: Get all users
router.post("/register",requireAuth,requireRole("admin"), preventDuplicateRequests, registerUser);
router.get("/users",requireAuth,requireRole("admin"),getAllUsersController);
router.put("/users-update/:userId",requireAuth,requireRole("admin"), preventDuplicateRequests, updateUserController);
router.delete("/users-delete/:userId",requireAuth,requireRole("admin"), preventDuplicateRequests, deleteUserController);
/**
 * Managers dropdown (admin only)
 */
router.get("/managers",requireAuth, requireRole("admin"),getManagersDropdown);
router.get("/counsellors",requireAuth, requireRole("admin"),getAllCounsellorsAdminController);
/**
 * Get counsellors by manager ID (admin only)
 */
router.get("/managers/:managerId/counsellors",requireAuth, requireRole("admin"),getCounsellorsByManagerController);
/**
 * Get all managers with their counsellors (hierarchical view) (admin only)
 */
router.get("/managers-with-counsellors",requireAuth, requireRole("admin"),getManagersWithCounsellorsController);


// health check alias under /api/users
router.get("/health", healthController);

// /api/users/users-delete/:userId

// export the router
export default router;