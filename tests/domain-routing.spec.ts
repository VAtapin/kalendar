import { describe, it, expect } from 'vitest';
import { domainRoute } from '../src/i18n/domain-routing';
describe('domain language routes', () => {
  const ru='https://kalender.georg-kloster.ru', de='https://kalender.georg-kloster.de';
  it('uses plain paths for native domain languages', () => {
    expect(domainRoute('/ru/impressum','ru',ru)).toBe('/impressum');
    expect(domainRoute('/de/account','de',de)).toBe('/account');
    expect(domainRoute('/','ru',ru)).toBe('/');
    expect(domainRoute('/','de',de)).toBe('/');
  });
  it('switches domains while preserving the section', () => {
    expect(domainRoute('/admin/pages','de',ru)).toBe(de+'/admin/pages');
    expect(domainRoute('/account','ru',de)).toBe(ru+'/account');
    expect(domainRoute('/calendar/123','en',de)).toBe(ru+'/en/calendar/123');
    expect(domainRoute('/impressum','uk',ru)).toBe('/uk/impressum');
  });
});
