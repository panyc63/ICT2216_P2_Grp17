// Frontend unit tests for the pure medication/delivery helpers.
// Run with Node's built-in test runner (no browser, no extra dependencies):
//   node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DELIVERY_STEPS,
  COLLECT_STEPS,
  isDelivery,
  stepsFor,
  stageIndex,
  statusLabel,
  canChooseDelivery,
  canConfirmReceipt,
} from '../src/utils/medication.js';

test('stepsFor picks the delivery vs self-collect track', () => {
  assert.deepEqual(stepsFor({ collection_method: 'Delivery' }), DELIVERY_STEPS);
  assert.deepEqual(stepsFor({ collection_method: 'SelfCollect' }), COLLECT_STEPS);
  assert.deepEqual(stepsFor({}), COLLECT_STEPS); // default
});

test('stageIndex tracks status through the self-collect flow', () => {
  assert.equal(stageIndex({ status: 'Issued', collection_method: 'SelfCollect' }), 1);
  assert.equal(stageIndex({ status: 'Fulfilled', collection_method: 'SelfCollect' }), 2);
  assert.equal(stageIndex({ status: 'Cancelled', collection_method: 'SelfCollect' }), 0);
});

test('stageIndex advances a delivery only to Delivered once confirmed', () => {
  assert.equal(stageIndex({ status: 'Fulfilled', collection_method: 'Delivery', delivered_at: null }), 2);
  assert.equal(stageIndex({ status: 'Fulfilled', collection_method: 'Delivery', delivered_at: '2026-07-01T00:00:00Z' }), 3);
});

test('statusLabel reflects method and delivery confirmation', () => {
  assert.equal(statusLabel({ status: 'Issued', collection_method: 'SelfCollect' }), 'In Progress');
  assert.equal(statusLabel({ status: 'Fulfilled', collection_method: 'SelfCollect' }), 'Ready for Collection');
  assert.equal(statusLabel({ status: 'Fulfilled', collection_method: 'Delivery', delivered_at: null }), 'Out for Delivery');
  assert.equal(statusLabel({ status: 'Fulfilled', collection_method: 'Delivery', delivered_at: 'x' }), 'Delivered');
  assert.equal(statusLabel({ status: 'Cancelled' }), 'Cancelled');
});

test('canChooseDelivery requires a non-empty address', () => {
  assert.equal(canChooseDelivery(''), false);
  assert.equal(canChooseDelivery('   '), false);
  assert.equal(canChooseDelivery(undefined), false);
  assert.equal(canChooseDelivery('1 Test Ave'), true);
});

test('canConfirmReceipt only offers for dispatched, unconfirmed deliveries', () => {
  assert.equal(canConfirmReceipt({ collection_method: 'Delivery', status: 'Fulfilled', delivered_at: null }), true);
  assert.equal(canConfirmReceipt({ collection_method: 'Delivery', status: 'Issued', delivered_at: null }), false);
  assert.equal(canConfirmReceipt({ collection_method: 'Delivery', status: 'Fulfilled', delivered_at: 'x' }), false);
  assert.equal(canConfirmReceipt({ collection_method: 'SelfCollect', status: 'Fulfilled', delivered_at: null }), false);
});

test('isDelivery guards against nullish input', () => {
  assert.equal(isDelivery(null), false);
  assert.equal(isDelivery({ collection_method: 'Delivery' }), true);
});
