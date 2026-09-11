import { expect, it } from 'vitest';
import { createBlankCalendarProject } from '../src/document/factories';
import { ServerProjectSaver } from '../src/editor/server-project-saver';

it('serializes revisions and retains edits made during a pending save', async () => {
  const project = createBlankCalendarProject();
  const requests: Array<{ body: any; release(value: unknown): void }> = [];
  let state = '';
  const saver = new ServerProjectSaver({ project: () => project, userId: () => 'user',
    switching: () => false, serialize: () => JSON.stringify(project),
    status: value => { state = value; }, notice: () => {},
  }, async <T>(_path: string, _method?: string, body?: unknown) =>
    await new Promise<unknown>(resolve => requests.push({ body, release: resolve })) as T);
  const first = saver.save();
  await new Promise<unknown>(resolve => setTimeout(resolve, 0));
  project.name = 'Changed while saving';
  const second = saver.save();
  expect(requests).toHaveLength(1);
  requests[0]!.release({ id: 'calendar', revision: 1 });
  await first;
  await new Promise<unknown>(resolve => setTimeout(resolve, 0));
  expect(requests[1]!.body.revision).toBe(1);
  expect(requests[1]!.body.project.name).toBe('Changed while saving');
  requests[1]!.release({ id: 'calendar', revision: 2 });
  await second;
  expect(saver.revision).toBe(2);
  expect(state).toBe('saved');
  await saver.save();
  expect(requests).toHaveLength(2);
});

it('ignores a response after changing the active project context', async () => {
  const project = createBlankCalendarProject();
  let release!: (value: unknown) => void;
  const saver = new ServerProjectSaver({ project: () => project, userId: () => 'user',
    switching: () => false, serialize: () => JSON.stringify(project), status: () => {}, notice: () => {},
  }, async <T>() => await new Promise<unknown>(resolve => { release = resolve; }) as T);
  const pending = saver.save();
  await new Promise<unknown>(resolve => setTimeout(resolve, 0));
  saver.context++;
  release({ id: 'old-calendar', revision: 10 });
  await pending;
  expect(saver.id.value).toBeUndefined();
  expect(saver.revision).toBe(0);
});
