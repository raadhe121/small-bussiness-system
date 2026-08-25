const prisma = require("../config/prisma");
const { ApiError, ok, created } = require("../utils/response");
const { ALL_PERMISSIONS, PERMISSIONS } = require("../config/permissions");

/** Built-in roles exposed read-only alongside custom roles. */
function builtInRoles() {
  return [
    { id: "system:OWNER", name: "OWNER", isSystem: true, permissions: ["*"], description: "Full access to everything", userCount: null },
    ...["ADMIN", "MANAGER", "ACCOUNTANT", "EMPLOYEE"].map((r) => ({
      id: `system:${r}`,
      name: r,
      isSystem: true,
      permissions: PERMISSIONS[r],
      description: `Built-in ${r.toLowerCase()} role`,
      userCount: null,
    })),
  ];
}

async function listRoles(req, res, next) {
  try {
    const roles = await prisma.role.findMany({
      where: { businessId: req.user.businessId },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { users: true } } },
    });
    ok(res, {
      system: builtInRoles(),
      custom: roles.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        permissions: r.permissions,
        isSystem: false,
        userCount: r._count.users,
      })),
    });
  } catch (err) { next(err); }
}

async function createRole(req, res, next) {
  try {
    const exists = await prisma.role.findFirst({
      where: { businessId: req.user.businessId, name: req.body.name },
    });
    if (exists) throw new ApiError(409, `A role named "${req.body.name}" already exists`);

    const role = await prisma.role.create({
      data: {
        businessId: req.user.businessId,
        name: req.body.name,
        description: req.body.description || null,
        permissions: req.body.permissions,
      },
    });
    created(res, { id: role.id, name: role.name }, "Custom role created");
  } catch (err) { next(err); }
}

async function updateRole(req, res, next) {
  try {
    const role = await prisma.role.findFirst({
      where: { id: req.params.id, businessId: req.user.businessId },
    });
    if (!role) throw new ApiError(404, "Role not found");

    if (req.body.name && req.body.name !== role.name) {
      const clash = await prisma.role.findFirst({
        where: { businessId: req.user.businessId, name: req.body.name, NOT: { id: role.id } },
      });
      if (clash) throw new ApiError(409, `A role named "${req.body.name}" already exists`);
    }

    await prisma.role.update({
      where: { id: role.id },
      data: {
        ...(req.body.name ? { name: req.body.name } : {}),
        ...(req.body.description !== undefined ? { description: req.body.description || null } : {}),
        ...(req.body.permissions ? { permissions: req.body.permissions } : {}),
      },
    });

    // Permission changes take effect immediately; nothing cached server-side.
    ok(res, { id: role.id }, "Role updated — member access changes live instantly");
  } catch (err) { next(err); }
}

async function deleteRole(req, res, next) {
  try {
    const role = await prisma.role.findFirst({
      where: { id: req.params.id, businessId: req.user.businessId },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new ApiError(404, "Role not found");
    if (role._count.users > 0) {
      throw new ApiError(400, `${role._count.users} team member(s) still use this role. Reassign them first.`);
    }

    await prisma.role.delete({ where: { id: role.id } });
    ok(res, { id: role.id }, "Role deleted");
  } catch (err) { next(err); }
}

async function permissionCatalog(_req, res, next) {
  try {
    ok(res, ALL_PERMISSIONS);
  } catch (err) { next(err); }
}

module.exports = { listRoles, createRole, updateRole, deleteRole, permissionCatalog };
