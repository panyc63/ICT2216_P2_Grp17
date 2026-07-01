// Frontend unit tests for role → landing-route resolution.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardForRole } from '../src/utils/roles.js';

test('dashboardForRole maps each staff role to its dashboard', () => {
  assert.equal(dashboardForRole('Admin'), '/admin-dashboard');
  assert.equal(dashboardForRole('Doctor'), '/doc-dashboard');
  assert.equal(dashboardForRole('Nurse'), '/nurse-dashboard');
  assert.equal(dashboardForRole('Pharmacist'), '/pharmacist-dashboard');
});

test('dashboardForRole is case-insensitive', () => {
  assert.equal(dashboardForRole('admin'), '/admin-dashboard');
  assert.equal(dashboardForRole('DOCTOR'), '/doc-dashboard');
});

test('dashboardForRole falls back to the patient area for unknown/empty roles', () => {
  assert.equal(dashboardForRole('Patient'), '/patient');
  assert.equal(dashboardForRole(''), '/patient');
  assert.equal(dashboardForRole(undefined), '/patient');
  assert.equal(dashboardForRole('Hacker'), '/patient');
});
