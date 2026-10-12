import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fillBlankSportsYearFromFirstLook,
  firstYearOf,
  normalizeSportsSetName,
  sportsYearFillEnabled,
} from './sportsIdentityNormalize';
import { setNamesEquivalent } from '../identity/setNameEquivalence';

const set = (name: string | null | undefined, year: unknown) => normalizeSportsSetName(name, year).value;

describe('normalizeSportsSetName — the forms owners kept correcting', () => {
  it('drops a leading year the year field carries and a trailing sport word', () => {
    expect(set('2025 Panini Phoenix Football', '2025')).toBe('Panini Phoenix');
    expect(set('1969 Topps', '1969')).toBe('Topps');
    expect(set('Phoenix Football', '2025')).toBe('Phoenix');
    expect(set('Donruss Optic Football', '2023')).toBe('Donruss Optic');
    expect(set('Panini Prizm Basketball', '2023')).toBe('Panini Prizm');
    expect(set('Topps Chrome Hockey', null)).toBe('Topps Chrome');
  });

  it('keeps the brand (catalog matching scores it; most owners keep it)', () => {
    expect(set('Panini Prizm', '2024')).toBe('Panini Prizm');
    expect(set('Topps Chrome', '2024')).toBe('Topps Chrome');
  });

  it('treats a season as carrying either of its years', () => {
    expect(set('1994-95 Flair', '1995')).toBe('Flair');
    expect(set('2020-21 Panini Donruss Optic Basketball', '2020')).toBe('Panini Donruss Optic');
    expect(set('1999-00 SkyBox E-X', '2000')).toBe('SkyBox E-X');
    expect(set('1985 - 86 Prism Jewel', '1985')).toBe('Prism Jewel');
  });

  it('keeps a leading year that disagrees with the year field, or when there is no year', () => {
    expect(set('2025 All Topps Team', '2026')).toBe('2025 All Topps Team');
    expect(set('1971 Topps', '2019')).toBe('1971 Topps');
    expect(set('1972 Rookie Stars', null)).toBe('1972 Rookie Stars');
    expect(set('1972 Rookie Stars', '')).toBe('1972 Rookie Stars');
    // ...but still drops the sport word.
    expect(set('2023 Panini Select Football', '2024')).toBe('2023 Panini Select');
  });

  it('keeps a sport word that is part of a name', () => {
    expect(set('USA Basketball', '1994')).toBe('USA Basketball');
    expect(set('Major League Baseball', '1990')).toBe('Major League Baseball');
    expect(set('Topps Pro Football', '1965')).toBe('Topps Pro Football');
    expect(set('1984 USA Baseball Team', '1985')).toBe('1984 USA Baseball Team');
  });

  it('never empties a name or touches a name that is only a year/sport', () => {
    expect(set('Football', '2024')).toBe('Football');
    expect(set('2024 Football', '2024')).toBe('Football');
    expect(set('2024', '2024')).toBe('2024');
    expect(set('', '2024')).toBe('');
    expect(set(null, '2024')).toBe(null);
    expect(set(undefined, '2024')).toBe(null);
  });

  it('does not touch a sport word or year in the middle, or a product year at the end', () => {
    expect(set('Fleer Basketball Stickers', '1987')).toBe('Fleer Basketball Stickers');
    expect(set('FIFA World Cup 2026', '2026')).toBe('FIFA World Cup 2026');
    expect(set('Topps 2025', '2025')).toBe('Topps 2025');
  });

  it('reports what it removed, and leaves unchanged values byte-identical', () => {
    const r = normalizeSportsSetName('2025 Panini Phoenix Football', '2025');
    expect(r.changed).toBe(true);
    expect(r.removed).toEqual(['2025', 'Football']);
    const same = normalizeSportsSetName('  Topps  ', '1969');
    expect(same.changed).toBe(false);
    expect(same.value).toBe('  Topps  ');
  });

  it('only ever changes naming: the result names the same product', () => {
    for (const [name, year] of [
      ['2025 Panini Phoenix Football', '2025'], ['1994-95 Flair', '1995'], ['Mosaic Football', '2023'],
      ['2023 Panini Select Football', '2024'], ['1969 Topps', '1969'],
    ] as const) {
      expect(setNamesEquivalent(set(name, year), name)).toBe(true);
    }
  });
});

describe('fillBlankSportsYearFromFirstLook', () => {
  afterEach(() => vi.unstubAllEnvs());
  const info = (year: unknown, value: string | null, source: string) => ({ year, first_look_year: { value, source } }) as Record<string, any>;

  it('fills a blank year from a printed or inferred read', () => {
    const a = info(null, '1989', 'printed');
    expect(fillBlankSportsYearFromFirstLook(a)).toEqual({ filled: true, value: '1989' });
    expect(a.year).toBe('1989');
    expect(a.year_source).toBe('first_look');
    const b = info('', '1972', 'inferred');
    expect(fillBlankSportsYearFromFirstLook(b).value).toBe('1972');
    expect(fillBlankSportsYearFromFirstLook(info('unknown', '1990', 'printed')).filled).toBe(true);
  });

  it('fills a season as its first year', () => {
    const a = info(null, '1992-93', 'printed');
    fillBlankSportsYearFromFirstLook(a);
    expect(a.year).toBe('1992');
  });

  it('never fills from a recognized or unknown year, and never overwrites a year', () => {
    expect(fillBlankSportsYearFromFirstLook(info(null, '1989', 'recognized')).filled).toBe(false);
    expect(fillBlankSportsYearFromFirstLook(info(null, null, 'unknown')).filled).toBe(false);
    const kept = info('1971', '1972', 'printed');
    expect(fillBlankSportsYearFromFirstLook(kept).filled).toBe(false);
    expect(kept.year).toBe('1971');
  });

  it('ignores missing evidence and implausible years', () => {
    expect(fillBlankSportsYearFromFirstLook({ year: null }).filled).toBe(false);
    expect(fillBlankSportsYearFromFirstLook(null).filled).toBe(false);
    expect(fillBlankSportsYearFromFirstLook(info(null, '3024', 'printed')).filled).toBe(false);
    expect(fillBlankSportsYearFromFirstLook(info(null, 'Series 2', 'printed')).filled).toBe(false);
  });

  it('firstYearOf and the kill switch', () => {
    expect(firstYearOf('1999-00')).toBe('1999');
    expect(firstYearOf(' 2024 ')).toBe('2024');
    expect(firstYearOf('circa 1990')).toBe(null);
    expect(sportsYearFillEnabled()).toBe(true);
    vi.stubEnv('SPORTS_YEAR_FILL', '0');
    expect(sportsYearFillEnabled()).toBe(false);
  });
});
