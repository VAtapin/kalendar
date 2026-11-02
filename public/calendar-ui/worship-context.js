// Only dated endpoints accept the date and temple. Templates are date-independent.
export function validWorshipDate(value) {
  const date = new Date(value + 'T12:00:00Z');
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && value >= '1900-01-01' && value <= '2200-12-31'
    && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function hourContext(state) {
  if (state.office === 'first-hour') return { matinsDismissalDone: '1', afterHourHymn: state.afterHourHymn };
  if (state.office === 'ninth-hour' && state.sequence === 'before-vespers') return { nextOffice: 'vespers', location: state.location };
  return {};
}

export function datedWorshipParams(state, language) {
  if (!validWorshipDate(state.date)) throw new Error('Invalid worship date');
  return { date: state.date, language, calendarStyle: 'julian', sequence: state.sequence, temple: state.temple, ...hourContext(state) };
}

export function matchesWorshipContext(context, state) {
  if (context?.date !== state.date || context.office !== state.office || context.calendarStyle !== 'julian'
    || (state.sequence !== 'default' && context.sequence !== state.sequence)) return false;
  // Both published representations identify the same dedication. Reject conflicts.
  const temples = [context.temple, context.templeProfile?.id].filter(value => value !== undefined);
  if (!temples.length || temples.some(value => value !== state.temple)) return false;
  return Object.entries(hourContext(state)).every(([key, value]) =>
    key === 'matinsDismissalDone' ? context[key] === true : context[key] === value);
}

export function worshipRequestSignal(signal) {
  return signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000);
}
