import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateModifier,
  formatModifier,
  calculateProficiencyBonus,
  calculatePassivePerception,
  calculateSpellSaveDC,
  calculateSpellAttackBonus,
  calculateCarryCapacity,
  parseDiceExpression,
  evaluateD20Roll,
} from './dnd-math.ts';

test('calculateModifier computes 5E ability modifiers accurately', () => {
  assert.equal(calculateModifier(1), -5);
  assert.equal(calculateModifier(8), -1);
  assert.equal(calculateModifier(9), -1);
  assert.equal(calculateModifier(10), 0);
  assert.equal(calculateModifier(11), 0);
  assert.equal(calculateModifier(12), 1);
  assert.equal(calculateModifier(14), 2);
  assert.equal(calculateModifier(18), 4);
  assert.equal(calculateModifier(20), 5);
});

test('formatModifier formats positive, zero, and negative signs', () => {
  assert.equal(formatModifier(3), '+3');
  assert.equal(formatModifier(0), '+0');
  assert.equal(formatModifier(-2), '-2');
});

test('calculateProficiencyBonus matches 5E level progression', () => {
  // Lvl 1-4: +2
  assert.equal(calculateProficiencyBonus(1), 2);
  assert.equal(calculateProficiencyBonus(4), 2);
  // Lvl 5-8: +3
  assert.equal(calculateProficiencyBonus(5), 3);
  assert.equal(calculateProficiencyBonus(8), 3);
  // Lvl 9-12: +4
  assert.equal(calculateProficiencyBonus(9), 4);
  // Lvl 13-16: +5
  assert.equal(calculateProficiencyBonus(13), 5);
  // Lvl 17-20: +6
  assert.equal(calculateProficiencyBonus(17), 6);
  assert.equal(calculateProficiencyBonus(20), 6);
});

test('calculatePassivePerception computes base, proficiency and expertise', () => {
  // WIS 10 (+0), None, prof +2 => 10 + 0 + 0 = 10
  assert.equal(calculatePassivePerception(10, 'none', 2), 10);
  // WIS 14 (+2), Proficient, prof +3 => 10 + 2 + 3 = 15
  assert.equal(calculatePassivePerception(14, 'proficient', 3), 15);
  // WIS 16 (+3), Expertise, prof +3 => 10 + 3 + (3*2) = 19
  assert.equal(calculatePassivePerception(16, 'expertise', 3), 19);
});

test('calculateSpellSaveDC and attack bonus work accurately', () => {
  // INT 16 (+3), Prof +2 => DC = 8 + 2 + 3 = 13, Attack = 2 + 3 = 5
  assert.equal(calculateSpellSaveDC(16, 2), 13);
  assert.equal(calculateSpellAttackBonus(16, 2), 5);
});

test('calculateCarryCapacity complies with 5E rules', () => {
  const cap = calculateCarryCapacity(15);
  assert.equal(cap.maxCarry, 225);
  assert.equal(cap.pushDragLift, 450);
});

test('parseDiceExpression parses standard dice notation', () => {
  assert.deepEqual(parseDiceExpression('1d20+4'), { count: 1, sides: 20, modifier: 4 });
  assert.deepEqual(parseDiceExpression('2d6-1'), { count: 2, sides: 6, modifier: -1 });
  assert.deepEqual(parseDiceExpression('d8'), { count: 1, sides: 8, modifier: 0 });
});

test('evaluateD20Roll handles normal, advantage, and disadvantage', () => {
  // Advantage: [12, 19] with +3 => 19 + 3 = 22
  const adv = evaluateD20Roll(3, 'advantage', [12, 19]);
  assert.equal(adv.chosenRoll, 19);
  assert.equal(adv.total, 22);
  assert.equal(adv.isCrit, false);

  // Disadvantage: [18, 4] with +2 => 4 + 2 = 6
  const dis = evaluateD20Roll(2, 'disadvantage', [18, 4]);
  assert.equal(dis.chosenRoll, 4);
  assert.equal(dis.total, 6);

  // Crit natural 20
  const crit = evaluateD20Roll(5, 'normal', [20]);
  assert.equal(crit.isCrit, true);
  assert.equal(crit.total, 25);

  // Fumble natural 1
  const botch = evaluateD20Roll(5, 'normal', [1]);
  assert.equal(botch.isFumble, true);
  assert.equal(botch.total, 6);
});

import { folderMatchesFilter, getFolderDepth } from './storage.ts';

test('getFolderDepth returns correct level from 1 to 3', () => {
  assert.equal(getFolderDepth('Ciudad Olvidada'), 1);
  assert.equal(getFolderDepth('Ciudad Olvidada / Taberna del Jabalí'), 2);
  assert.equal(getFolderDepth('Ciudad Olvidada / Taberna del Jabalí / Sótano Secreto'), 3);
});

test('folderMatchesFilter returns true for all child subfolders and exact matches', () => {
  // 'all' matches everything
  assert.equal(folderMatchesFilter('Cualquier Cosa', 'all'), true);
  assert.equal(folderMatchesFilter(undefined, 'all'), true);

  // Exact match
  assert.equal(folderMatchesFilter('Ciudad Olvidada', 'Ciudad Olvidada'), true);

  // Parent matches subfolder (depth 2)
  assert.equal(folderMatchesFilter('Ciudad Olvidada / Taberna del Jabalí', 'Ciudad Olvidada'), true);

  // Parent matches sub-subfolder (depth 3)
  assert.equal(folderMatchesFilter('Ciudad Olvidada / Taberna del Jabalí / Sótano', 'Ciudad Olvidada'), true);

  // Subfolder matches sub-subfolder
  assert.equal(folderMatchesFilter('Ciudad Olvidada / Taberna del Jabalí / Sótano', 'Ciudad Olvidada / Taberna del Jabalí'), true);

  // Subfolder does NOT match parent
  assert.equal(folderMatchesFilter('Ciudad Olvidada', 'Ciudad Olvidada / Taberna del Jabalí'), false);

  // Unrelated folder does not match
  assert.equal(folderMatchesFilter('Campamento del Valle', 'Ciudad Olvidada'), false);
});

