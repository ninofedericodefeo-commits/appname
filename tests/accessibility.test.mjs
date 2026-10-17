import test from 'node:test';
import assert from 'node:assert/strict';
import { accessibleStyle, accessibilityDefaults, validAccessibilityPreferences } from '../src/features/accessibility/preferences.ts';
import { moveCalendarDate, moveTabIndex } from '../src/features/accessibility/calendarNavigation.ts';
import { validateStoreState } from '../src/features/data/validation.ts';

test('keyboard dates cross month/year and leap-day boundaries and keep month-end dates valid', () => {
  assert.equal(moveCalendarDate('2024-02-28','ArrowRight'),'2024-02-29');
  assert.equal(moveCalendarDate('2024-02-29','ArrowRight'),'2024-03-01');
  assert.equal(moveCalendarDate('2026-01-01','ArrowLeft'),'2025-12-31');
  assert.equal(moveCalendarDate('2026-01-31','PageDown'),'2026-02-28');
  assert.equal(moveCalendarDate('2024-03-31','PageUp'),'2024-02-29');
  assert.equal(moveCalendarDate('2026-10-16','ArrowUp'),'2026-10-09');
  assert.equal(moveCalendarDate('2026-10-16','ArrowDown'),'2026-10-23');
  assert.equal(moveCalendarDate('2026-10-16','Home'),'2026-10-11');
  assert.equal(moveCalendarDate('2026-10-16','End'),'2026-10-17');
});
test('keyboard dates cannot escape allowed dates or silently roll invalid dates over', () => {
  assert.equal(moveCalendarDate('2026-10-16','ArrowRight',undefined,'2026-10-16'),'2026-10-16');
  assert.equal(moveCalendarDate('2026-10-16','ArrowUp','2026-10-15'),'2026-10-15');
  for (const [date,key] of [['2026-02-30','ArrowRight'],['invalid','ArrowLeft'],['2026-10-16','Enter'],['9999-12-31','ArrowRight'],['0001-01-01','ArrowLeft']]) assert.equal(moveCalendarDate(date,key),null);
});
test('keyboard tabs wrap at either edge and support first/last navigation', () => {
  assert.equal(moveTabIndex(3,4,'ArrowRight'),0); assert.equal(moveTabIndex(0,4,'ArrowLeft'),3);
  assert.equal(moveTabIndex(2,4,'Home'),0); assert.equal(moveTabIndex(0,4,'End'),3);
  assert.equal(moveTabIndex(2,4,'Enter'),2); assert.equal(moveTabIndex(0,0,'End'),0);
});
test('larger controls grow actual tap bounds while preserving decorative shapes and existing large controls', () => {
  const input={minHeight:48,fontSize:16,color:'#123',fontWeight:'400'};
  assert.deepEqual(accessibleStyle(input,true,true),{...input,minHeight:56,fontWeight:'600'});
  assert.equal(input.minHeight,48); assert.equal(input.fontWeight,'400');
  assert.deepEqual(accessibleStyle({width:48,height:48,borderRadius:24},false,true),{width:56,height:56,borderRadius:28});
  assert.deepEqual(accessibleStyle({minWidth:44,minHeight:44},false,true),{minWidth:56,minHeight:56});
  for(const style of [{width:38,height:38,borderRadius:19},{minHeight:86},{fontSize:24,fontWeight:'800'}]) assert.deepEqual(accessibleStyle(style,true,true),style);
  assert.deepEqual(accessibleStyle(input,false,false),input);
});
test('accessibility preferences retain system defaults and reject corrupt restored values', () => {
  assert.equal(accessibilityDefaults.reduceMotion,'system');
  assert.equal(validAccessibilityPreferences({}),true);
  assert.equal(validAccessibilityPreferences({...accessibilityDefaults,reduceMotion:'reduce'}),true);
  for(const values of [{boldText:'yes'},{largerControls:1},{preferStationList:null},{reduceMotion:'animate'}]) {
    assert.equal(validAccessibilityPreferences(values),false);
    assert.throws(()=>validateStoreState('gasfinder-settings',values,{}));
  }
  assert.doesNotThrow(()=>validateStoreState('gasfinder-settings',accessibilityDefaults,{}));
});
