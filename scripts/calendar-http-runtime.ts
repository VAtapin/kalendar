// Bundled at build time. PHP invokes this shared engine only on a cache miss.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOrthodoxCalendarApiFromXml, type FastingProfileId } from '../src/calendar/fasting/fasting-api';
import { createCalendarPublicApi } from '../src/calendar/api/public-api';
import { installSlavonicCorpus } from '../src/calendar/localization/slavonic-corpus';
import type { CalendarLanguage } from '../src/document/types';

const [yearText, profile, language] = process.argv.slice(2);
const year = Number(yearText);
if (!/^\d{4}$/.test(yearText ?? '') || year < 1900 || year > 2200
  || !['typikon-strict', 'parish'].includes(profile) || !['ru', 'cu', 'de', 'uk', 'pl'].includes(language)) {
  throw new Error('Invalid calendar runtime arguments');
}
const publicRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (language === 'cu') installSlavonicCorpus(JSON.parse(readFileSync(resolve(publicRoot, 'data/church-slavonic/catalogue.json'), 'utf8')));
const api = createCalendarPublicApi(createOrthodoxCalendarApiFromXml(
  readFileSync(resolve(publicRoot, 'data/MemoryDays.xml'), 'utf8'), 'MemoryDays.xml', { profileId: profile as FastingProfileId },
), language as CalendarLanguage);
process.stdout.write(JSON.stringify(api.getYear(year)));
