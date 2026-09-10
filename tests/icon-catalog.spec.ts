import { describe, expect, it } from 'vitest';
import { isTheotokosIconCommemoration } from '../src/calendar/api/icon-catalog';

describe('reviewed icon catalogue', () => {
  it('recognizes both source forms for commemorations of the Mother of God icons', () => {
    expect(isTheotokosIconCommemoration('Сретение Владимирской иконы Пресвятой Богородицы')).toBe(true);
    expect(isTheotokosIconCommemoration('Владимирской иконы Божией Матери')).toBe(true);
    expect(isTheotokosIconCommemoration('Рождество Пресвятой Богородицы')).toBe(false);
    expect(isTheotokosIconCommemoration('Прп. Пимена Великого')).toBe(false);
  });
});
