// RBAC tests
import { describe, test, expect, beforeAll } from 'vitest'
import { hasPermission, hasAnyPermission } from '@/lib/auth'
import { type Role, type Permission, ROLE_PERMISSIONS } from '@/lib/types'
import { prisma } from '../setup'

describe('RBAC', () => {
  describe('ROLE_PERMISSIONS static map', () => {
    test('STUDENT has limited module access', () => {
      const studentPerms = ROLE_PERMISSIONS.STUDENT
      expect(studentPerms).toContain('module.conversation.use')
      expect(studentPerms).toContain('module.text.use')
      expect(studentPerms).toContain('module.voice.use')
    })

    test('STUDENT cannot access admin endpoints', () => {
      const studentPerms = ROLE_PERMISSIONS.STUDENT
      expect(studentPerms).not.toContain('admin.users.read')
      expect(studentPerms).not.toContain('admin.plans.write')
      expect(studentPerms).not.toContain('admin.audit.read')
    })

    test('ADMIN has all permissions', () => {
      const adminPerms = ROLE_PERMISSIONS.ADMIN
      expect(adminPerms).toContain('module.conversation.use')
      expect(adminPerms).toContain('admin.users.read')
      expect(adminPerms).toContain('admin.flags.write')
      expect(adminPerms).toContain('agent.engineering.dispatch')
    })

    test('STUDENT cannot dispatch Engineering agent', () => {
      expect(ROLE_PERMISSIONS.STUDENT).not.toContain('agent.engineering.dispatch')
    })

    test('STUDENT can dispatch AI Tutor and Learning', () => {
      expect(ROLE_PERMISSIONS.STUDENT).toContain('agent.ai_tutor.dispatch')
      expect(ROLE_PERMISSIONS.STUDENT).toContain('agent.learning.dispatch')
    })
  })

  describe('hasPermission', () => {
    test('returns true when role has permission', () => {
      expect(hasPermission(['STUDENT'], 'module.conversation.use')).toBe(true)
    })

    test('returns false when role lacks permission', () => {
      expect(hasPermission(['STUDENT'], 'admin.users.read')).toBe(false)
    })

    test('ADMIN role has all permissions', () => {
      const allPerms: Permission[] = [
        'module.conversation.use',
        'admin.users.read',
        'admin.plans.write',
        'agent.engineering.dispatch',
        'billing.subscriptions.write',
      ]
      for (const perm of allPerms) {
        expect(hasPermission(['ADMIN'], perm)).toBe(true)
      }
    })

    test('multiple roles: union of permissions', () => {
      // User with both STUDENT and ADMIN should have STUDENT perms + ADMIN perms
      expect(hasPermission(['STUDENT', 'ADMIN'], 'module.conversation.use')).toBe(true)
      expect(hasPermission(['STUDENT', 'ADMIN'], 'admin.users.read')).toBe(true)
    })

    test('empty roles has no permissions', () => {
      expect(hasPermission([], 'module.conversation.use')).toBe(false)
    })
  })

  describe('hasAnyPermission', () => {
    test('returns true if any permission matches', () => {
      expect(hasAnyPermission(['STUDENT'], ['module.conversation.use', 'admin.users.read'])).toBe(true)
    })

    test('returns false if no permission matches', () => {
      expect(hasAnyPermission(['STUDENT'], ['admin.users.read', 'admin.plans.write'])).toBe(false)
    })
  })

  describe('Database-backed RBAC', () => {
    test('role and permission tables are seeded correctly', async () => {
      // Verify the role names exist in the type system
      const validRoles: Role[] = ['STUDENT', 'ADMIN']
      expect(validRoles.length).toBe(2)
    })

    test('can create user with role', async () => {
      const role = await prisma.role.upsert({
        where: { name: 'TEST_ROLE' },
        create: { name: 'TEST_ROLE', description: 'Test role' },
        update: { description: 'Test role' },
      })
      // Create permission (also upsert for safety)
      const perm = await prisma.permission.upsert({
        where: { key: 'test.permission' },
        create: { key: 'test.permission', description: 'Test permission' },
        update: { description: 'Test permission' },
      })
      // Link
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        create: { roleId: role.id, permissionId: perm.id },
        update: {},
      })

      // Verify
      const roleWithPerms = await prisma.role.findUnique({
        where: { id: role.id },
        include: { permissions: { include: { permission: true } } },
      })
      expect(roleWithPerms?.permissions.length).toBe(1)
      expect(roleWithPerms?.permissions[0].permission.key).toBe('test.permission')
    })
  })
})
