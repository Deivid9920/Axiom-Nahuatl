// Billing + plan gating tests
import { describe, test, expect, beforeAll } from 'vitest'
import { PLAN_CONFIG, checkFeatureAccess, getEffectivePlan } from '@/lib/billing'
import { prisma } from '../setup'
import { seedPlans } from '@/lib/billing'

describe('Billing', () => {
  describe('PLAN_CONFIG', () => {
    test('has 4 plans with correct MXN prices', () => {
      expect(PLAN_CONFIG.basico.priceMxnCents).toBe(19900)   // $199.00
      expect(PLAN_CONFIG.pro.priceMxnCents).toBe(39900)      // $399.00
      expect(PLAN_CONFIG.equipo.priceMxnCents).toBe(99900)   // $999.00
      expect(PLAN_CONFIG.enterprise.priceMxnCents).toBe(299900) // $2,999.00
    })

    test('Básico has no RAG, no voice', () => {
      expect(PLAN_CONFIG.basico.features.ragEnabled).toBe(false)
      expect(PLAN_CONFIG.basico.features.voiceEnabled).toBe(false)
    })

    test('Pro has RAG + voice', () => {
      expect(PLAN_CONFIG.pro.features.ragEnabled).toBe(true)
      expect(PLAN_CONFIG.pro.features.voiceEnabled).toBe(true)
    })

    test('Básico limits sessions per month', () => {
      expect(PLAN_CONFIG.basico.features.maxSessionsPerMonth).toBe(30)
    })

    test('Pro has unlimited sessions', () => {
      // "unlimited" is represented as a very high number (9999)
      expect(PLAN_CONFIG.pro.features.maxSessionsPerMonth).toBeGreaterThanOrEqual(9999)
    })

    test('Equipo and Enterprise have team features', () => {
      expect(PLAN_CONFIG.equipo.features.teamEnabled).toBe(true)
      expect(PLAN_CONFIG.enterprise.features.teamEnabled).toBe(true)
    })
  })

  describe('checkFeatureAccess', () => {
    beforeAll(async () => {
      await seedPlans()
    })

    test('Básico user cannot access RAG', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'basico@example.com',
          passwordHash: 'hash',
          profile: { create: {} },
        },
      })
      const basicoPlan = await prisma.plan.findUnique({ where: { code: 'basico' } })
      await prisma.subscription.create({
        data: {
          userId: user.id,
          planId: basicoPlan!.id,
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      })

      const access = await checkFeatureAccess(user.id, 'ragEnabled')
      expect(access.allowed).toBe(false)
      expect(access.reason).toContain('Pro')
    })

    test('Pro user can access RAG', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'pro@example.com',
          passwordHash: 'hash',
          profile: { create: {} },
        },
      })
      const proPlan = await prisma.plan.findUnique({ where: { code: 'pro' } })
      await prisma.subscription.create({
        data: {
          userId: user.id,
          planId: proPlan!.id,
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      })

      const access = await checkFeatureAccess(user.id, 'ragEnabled')
      expect(access.allowed).toBe(true)
    })

    test('Trial expired denies access', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'expired@example.com',
          passwordHash: 'hash',
          profile: { create: {} },
        },
      })
      const proPlan = await prisma.plan.findUnique({ where: { code: 'pro' } })
      await prisma.subscription.create({
        data: {
          userId: user.id,
          planId: proPlan!.id,
          status: 'trialing',
          currentPeriodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          currentPeriodEnd: new Date(Date.now() - 1000),  // expired
        },
      })

      const access = await checkFeatureAccess(user.id, 'ragEnabled')
      expect(access.allowed).toBe(false)
      expect(access.reason).toContain('prueba')
    })

    test('User without subscription defaults to Básico (no RAG)', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'nosub@example.com',
          passwordHash: 'hash',
          profile: { create: {} },
        },
      })

      const { planCode, features } = await getEffectivePlan(user.id)
      expect(planCode).toBe('basico')
      expect(features.ragEnabled).toBe(false)
    })
  })
})
