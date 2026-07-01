import { test, expect } from '@playwright/test'

// Credentials are seeded with known passwords by scripts/e2e-up.sh (the seeded DB hashes'
// plaintexts are intentionally unknown, so the boot script resets them for these two
// accounts only). Override via env to run against another environment.
const PATIENT = {
  email: process.env.E2E_PATIENT_EMAIL || 'john@gmail.com',
  password: process.env.E2E_PATIENT_PASSWORD || 'E2ePassw0rd!',
}
const DOCTOR = {
  email: process.env.E2E_DOCTOR_EMAIL || 'doctor@mediflow.com',
  password: process.env.E2E_DOCTOR_PASSWORD || 'E2ePassw0rd!',
}

async function login(page, { email, password }) {
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  return resp
}

test('homepage renders the marketing hero and both auth entry points', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/doctor/i)
  await expect(page.getByRole('link', { name: /create an account/i })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible()
})

test('patient can sign in and is routed to the patient portal', async ({ page }) => {
  const resp = await login(page, PATIENT)
  expect(resp.status()).toBe(200)
  await expect(page).toHaveURL(/\/patient/)
  // We left the login form behind — the password field is gone once authenticated.
  await expect(page.locator('#password')).toHaveCount(0)
})

test('patient books a consultation end-to-end via the triage questionnaire', async ({ page }) => {
  await login(page, PATIENT)
  await page.goto('/patient/book-consultation')
  await page.getByRole('button', { name: /start new consultation/i }).click()

  // Answer the pre-consultation questionnaire. Each question is a wrapper <div> whose
  // direct-child <label> holds the question text.
  const yesNo = (question, value) =>
    page.locator(`div:has(> label:has-text("${question}"))`).locator(`label:has(input[value="${value}"])`).click()
  await yesNo('Do you have a fever?', 'Yes')
  await yesNo('Do you have a cough?', 'No')
  await yesNo('Do you have shortness of breath?', 'No')
  await page.locator('div:has(> label:has-text("Are you experiencing chest pain?")) select').selectOption('None')
  await page.locator('div:has(> label:has-text("How long have you had these symptoms?")) input[type="text"]').fill('2 days')

  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/triage') && r.request().method() === 'POST'),
    page.getByRole('button', { name: /submit & open consultation/i }).click(),
  ])
  expect(resp.status()).toBe(201)
  // The portal surfaces the opened, prioritized consultation.
  await expect(page.getByRole('status')).toContainText(/triage priority/i)
})

test('doctor can sign in and load the doctor-scoped consultation queue', async ({ page }) => {
  const resp = await login(page, DOCTOR)
  expect(resp.status()).toBe(200)
  await expect(page).toHaveURL(/\/doc-dashboard/)
  // The consult console pulls the doctor's queue from the real API.
  const [listResp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/consultations') && r.request().method() === 'GET'),
    page.goto('/doc-consult'),
  ])
  expect(listResp.status()).toBe(200)
})
