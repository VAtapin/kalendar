import { ref } from 'vue';
import { describe, expect, it } from 'vitest';
import { createBlankCalendarProject } from '../src/document/factories';
import { useProjectHistory } from '../src/editor/use-project-history';

describe('editor history', () => {
  it('restores edits without reverting interface settings, and discards a branched redo', () => {
    const project = ref(createBlankCalendarProject());
    const page = ref(project.value.document.pages[0]!.id);
    const element = ref<string>();
    const layers = ref<string[]>([]);
    const history = useProjectHistory(project, page, element, layers, ref(''), () => undefined);
    const original = project.value.name;
    history.mutateProject('Rename', () => { project.value.name = 'Changed'; });
    project.value.programSettings = { interfaceLanguage: 'de' };
    history.undo();
    expect(project.value.name).toBe(original);
    expect(project.value.programSettings?.interfaceLanguage).toBe('de');
    history.redo();
    expect(project.value.name).toBe('Changed');
    history.undo();
    history.mutateProject('Branch', () => { project.value.name = 'Another'; });
    expect(history.redoStack.value).toHaveLength(0);
    history.clearProjectHistory();
    expect(history.undoStack.value).toHaveLength(0);
  });
});
