const bcryptjs = require("bcryptjs");
const prisma = require("../config/prisma");
const { success, error } = require("../utils/response");

/**
 * GET /api/users
 * Admin only: get list of users
 */
async function listUsers(req, res) {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        is_active: true,
        created_at: true,
      },
      orderBy: { created_at: "desc" },
    });
    return success(res, { users });
  } catch (err) {
    return error(res, "Failed to fetch users", 500);
  }
}

/**
 * POST /api/users
 * Admin only: create user
 * body: { name, username, password, role }
 */
async function createUser(req, res) {
  try {
    const { name, username, password, role } = req.body;
    if (!name || !username || !password || !role)
      return error(res, "name, username, password, and role are required", 401);

    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;
    if (!regex.test(password))
      return error(
        res,
        "Password must contain at least 8 characters: 1 lowercase, 1 uppercase and one number",
      );

    const hashedPassword = await bcryptjs.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        username: username.trim(),
        password: hashedPassword,
        role: role,
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        is_active: true,
        created_at: true,
      },
    });
    return success(res, { user }, "User created successfuly", 201);
  } catch (err) {
    if (err.code === "P2002") return error(res, "Username already taken", 400);
    return error(res, "Failed to create user", 500);
  }
}

/**
 * PUT /api/users/:id
 * Admin: udpate any user
 * Casher: only update their own information
 * body: { name?, role?, username?, is_active?}
 * params: id (a user id)
 */
async function updateUser(req, res) {
  try {
    const id = req.params.id;
    const { name, role, username, is_active } = req.body;

    if (id === req.user.id && is_active === false)
      return error(res, "You cannot deactivate your own account", 400);

    const updatedUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!updatedUser) return error(res, "User not found", 404);

    if (req.user.role === "cashier") {
      if (req.user.id !== id) return error(res, "You can only change your own information", 400);
      if(role !== undefined) return error(res, 'You cannot update your own role', 400);
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(role !== undefined && { role }),
        ...(username !== undefined && { username }),
        ...(is_active !== undefined && { is_active }),
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        is_active: true,
        updated_at: true,
      },
    });
    return success(res, { user }, "User updated successfully");
  } catch (err) {
    if (err.code === "P2025") return error(res, "User not found", 404);
    if (err.code === "P2002") return error(res, "Username already taken", 400);
    return error(res, "Failed to update user", 500);
  }
}

/**
 * DELETE /api/users/:id
 * Admin only: deactivate user
 * params: id (a user id)
 */
async function deleteUser(req, res) {
  try {
    const id = req.params.id;
    if (id === req.user.id)
      return error(res, "You cannot delete your own account", 400);

    await prisma.user.update({
      where: { id },
      data: { is_active: false },
    });
    await prisma.refreshToken.deleteMany({
      where: { userId: id },
    });

    return success(res, null, "User deactivate successfully");
  } catch (err) {
    if (err.code === "P2025") return error(res, "User not found", 401);
    return error(res, "Failed to delete user", 500);
  }
}

async function changePassword(req, res) {
  try {
    const id = req.params.id;
    const { current_password, new_password } = req.body;

    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;
    if (!new_password || !regex.test(new_password))
      return error(
        res,
        "Password must contain at least 8 characters: 1 lowercase, 1 uppercase and one number",
        400,
      );

    // cashier can only change their own password
    if (req.user.role === "cashier" && id !== req.user.id)
      return error(res, "You can only change your own password", 403);

    const user = await prisma.user.findUnique({
      where: { id },
    });
    if (!user) return error(res, "User not found", 404);

    if (req.user.role === "cashier") {
      if (!current_password)
        return error(res, "Current password is required", 401);
      const isMatch = await bcryptjs.compare(current_password, user.password);
      if (!isMatch) return error(res, "Current password is incorrect", 401);
    }

    const hashedNewPassword = await bcryptjs.hash(new_password, 12);
    await prisma.user.update({
      where: { id },
      data: { password: hashedNewPassword },
    });

    // force re-login on all device
    await prisma.refreshToken.deleteMany({
      where: { userId: id },
    });

    return success(res, null, "Password changed successfuly");
  } catch (err) {
    return error(res, "Failed to change password", 500);
  }
}

module.exports = {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  changePassword,
};
