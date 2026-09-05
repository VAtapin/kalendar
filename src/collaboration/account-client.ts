export interface AccountUser { id: string; email: string; createdAt: string; blocked: boolean }
export interface AccountCalendar { id: string; name: string; year: number; revision: number; updatedAt: string; owner: string }
export async function accountRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api/v1/account/${path}`, { method, credentials: 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (response.status === 204) return undefined as T;
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || data.error || 'Ошибка сервера');
  return data as T;
}
