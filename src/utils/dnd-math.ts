/**
 * D&D 5E mathematical calculations and dice evaluation
 * Pure decoupled functions, tested via node:test
 */

export function calculateModifier(score: number): number {
  if (isNaN(score)) return 0;
  return Math.floor((score - 10) / 2);
}

export function formatModifier(mod: number): string {
  if (isNaN(mod)) return '+0';
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function calculateProficiencyBonus(level: number): number {
  const safeLevel = Math.max(1, Math.min(20, Math.floor(level || 1)));
  return Math.floor((safeLevel - 1) / 4) + 2;
}

export function calculatePassivePerception(
  wisScore: number,
  proficiencyLevel: 'none' | 'proficient' | 'expertise',
  profBonus: number
): number {
  const wisMod = calculateModifier(wisScore);
  const bonus =
    proficiencyLevel === 'expertise'
      ? profBonus * 2
      : proficiencyLevel === 'proficient'
      ? profBonus
      : 0;
  return 10 + wisMod + bonus;
}

export function calculateSpellSaveDC(abilityScore: number, profBonus: number): number {
  return 8 + profBonus + calculateModifier(abilityScore);
}

export function calculateSpellAttackBonus(abilityScore: number, profBonus: number): number {
  return profBonus + calculateModifier(abilityScore);
}

export function calculateCarryCapacity(strScore: number): {
  maxCarry: number;
  pushDragLift: number;
} {
  const safeStr = Math.max(1, strScore || 10);
  return {
    maxCarry: safeStr * 15,
    pushDragLift: safeStr * 30,
  };
}

export function parseDiceExpression(expression: string): {
  count: number;
  sides: number;
  modifier: number;
} {
  const cleaned = expression.replace(/\s+/g, '').toLowerCase();
  const match = cleaned.match(/^(\d*)d(\d+)([+-]\d+)?$/);

  if (!match) {
    // Check if it's just a number or simple dice
    return { count: 1, sides: 20, modifier: 0 };
  }

  const count = match[1] ? parseInt(match[1], 10) : 1;
  const sides = parseInt(match[2], 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;

  return {
    count: Math.max(1, count),
    sides: Math.max(2, sides),
    modifier: isNaN(modifier) ? 0 : modifier,
  };
}

export interface EvaluatedD20 {
  rolls: number[];
  chosenRoll: number;
  modifier: number;
  total: number;
  isCrit: boolean;
  isFumble: boolean;
}

export function evaluateD20Roll(
  modifier: number,
  mode: 'normal' | 'advantage' | 'disadvantage' = 'normal',
  forcedRolls?: number[]
): EvaluatedD20 {
  let rolls: number[];

  if (forcedRolls && forcedRolls.length > 0) {
    rolls = [...forcedRolls];
  } else {
    if (mode === 'normal') {
      rolls = [Math.floor(Math.random() * 20) + 1];
    } else {
      rolls = [
        Math.floor(Math.random() * 20) + 1,
        Math.floor(Math.random() * 20) + 1,
      ];
    }
  }

  let chosenRoll = rolls[0];
  if (mode === 'advantage') {
    chosenRoll = Math.max(rolls[0], rolls[1] ?? rolls[0]);
  } else if (mode === 'disadvantage') {
    chosenRoll = Math.min(rolls[0], rolls[1] ?? rolls[0]);
  }

  const total = chosenRoll + modifier;
  const isCrit = chosenRoll === 20;
  const isFumble = chosenRoll === 1;

  return {
    rolls,
    chosenRoll,
    modifier,
    total,
    isCrit,
    isFumble,
  };
}

export function rollDiceExpression(expression: string): { rolls: number[]; total: number; formula: string } {
  const { count, sides, modifier } = parseDiceExpression(expression);
  const rolls: number[] = [];
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const r = Math.floor(Math.random() * sides) + 1;
    rolls.push(r);
    sum += r;
  }
  const total = Math.max(1, sum + modifier);
  return {
    rolls,
    total,
    formula: `${count}d${sides}${modifier > 0 ? '+' + modifier : modifier < 0 ? modifier : ''}`,
  };
}
