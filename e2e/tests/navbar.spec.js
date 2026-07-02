import { test, expect } from '@playwright/test'

// The marketing header must be auth-aware: hidden over authenticated dashboards, and on
// public pages it offers a way back to the dashboard + logout instead of "Get Started".
const DOCTOR = {
  email: process.env.E2E_DOCTOR_EMAIL || 'doctor@mediflow.com',
  password: process.env.E2E_DOCTOR_PASSWORD || 'E2ePassw0rd!',
}

async function login(page, { email, password }) {
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
}

test('a guest sees the "Get Started" CTA on the marketing home', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Get Started' })).toBeVisible()
})

test('the marketing header does not render over an authenticated dashboard', async ({ page }) => {
  await login(page, DOCTOR)
  await expect(page).toHaveURL(/\/doc-dashboard/)
  await expect(page.getByRole('link', { name: 'Get Started' })).toHaveCount(0)
})

test('a signed-in user on a marketing page gets a route back to their dashboard, not a login CTA', async ({ page }) => {
  await login(page, DOCTOR)
  await page.goto('/about')
  await expect(page.getByRole('link', { name: 'My Dashboard' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Get Started' })).toHaveCount(0)
  await page.getByRole('link', { name: 'My Dashboard' }).click()
  await expect(page).toHaveURL(/\/doc-dashboard/)
})
