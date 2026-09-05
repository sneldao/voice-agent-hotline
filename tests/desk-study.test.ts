import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deskStudyReducer, initialDeskStudy, isStudyQuantityValid, isDeskStudyPath } from '../lib/desk-study';

describe('Desk study boundaries', () => {
  it('starts as an unacknowledged arrival with no live session or payment state', () => {
    assert.deepEqual(initialDeskStudy, { stage: 'arrival', side: 'buy', quantity: '10', acknowledged: false });
  });

  it('only acknowledges a valid instruction in the confirmation stage', () => {
    assert.equal(deskStudyReducer(initialDeskStudy, { type: 'acknowledge' }).acknowledged, false);
    const review = deskStudyReducer(initialDeskStudy, { type: 'stage', stage: 'confirmation' });
    assert.equal(deskStudyReducer(review, { type: 'acknowledge' }).acknowledged, true);
    const invalid = deskStudyReducer(review, { type: 'quantity', quantity: '0' });
    assert.equal(deskStudyReducer(invalid, { type: 'acknowledge' }).acknowledged, false);
  });

  it('invalidates acknowledgement when either instruction field changes', () => {
    const acknowledged = { ...initialDeskStudy, stage: 'confirmation' as const, acknowledged: true };
    assert.equal(deskStudyReducer(acknowledged, { type: 'quantity', quantity: '20' }).acknowledged, false);
    assert.equal(deskStudyReducer(acknowledged, { type: 'side', side: 'sell' }).acknowledged, false);
  });

  it('does not carry acknowledgement between preview stages', () => {
    const acknowledged = { ...initialDeskStudy, acknowledged: true };
    assert.equal(deskStudyReducer(acknowledged, { type: 'stage', stage: 'conversation' }).acknowledged, false);
    assert.deepEqual(deskStudyReducer(acknowledged, { type: 'reset' }), initialDeskStudy);
  });

  it('accepts whole quantities from 1 through 1000, not blanks or numeric shorthand', () => {
    for (const value of ['1', '10', '1000']) assert.equal(isStudyQuantityValid(value), true, value);
    for (const value of ['', '0', '-1', '1.5', '1e2', ' 10', '1001', 'NaN', 'Infinity']) {
      assert.equal(isStudyQuantityValid(value), false, value);
    }
  });

  it('bypasses service providers only on the exact study route', () => {
    assert.equal(isDeskStudyPath('/desk-study'), true);
    assert.equal(isDeskStudyPath('/desk-study/'), true);
    for (const path of ['/', '/broker/general_helper', '/desk-study-other', '/desk-study/admin', null]) {
      assert.equal(isDeskStudyPath(path), false, String(path));
    }
  });
});
