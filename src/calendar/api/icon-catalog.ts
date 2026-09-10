export function isTheotokosIconCommemoration(title: string): boolean {
  return /икон[а-яё]*\s+(?:(?:Пресвятой|Пречистой)\s+)?(?:Богородиц[а-яё]*|Богоматер[а-яё]*|(?:Божией|Божьей)\s+Матери)/iu.test(title);
}
