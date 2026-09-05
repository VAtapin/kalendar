export interface AccountUser { id: string; email: string; createdAt: string; blocked: boolean }
export interface AccountCalendar { id: string; name: string; year: number; revision: number; updatedAt: string; owner: string }
export class AccountRequestError extends Error {
  constructor(message: string, public status: number, public code: string) { super(message); this.name = 'AccountRequestError'; }
}
export async function accountRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api/v1/account/${path}`, { method, credentials: 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({message: response.status === 413 ? 'Файл превышает ограничение веб-сервера. Скачайте копию и обратитесь к администратору.' : `Сервер вернул HTTP ${response.status}. Повторите попытку; изменения пока не сохранены.`}));
  if (!response.ok) {
    if (response.status === 401 && data.error === 'login_required') window.dispatchEvent(new Event('calendar-account-expired'));
    throw new AccountRequestError(data.message || data.error || 'Ошибка сервера', response.status, data.error ?? 'http_error');
  }
  return data as T;
}
