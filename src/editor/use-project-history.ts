import { ref, type Ref } from 'vue';
import type { CalendarProject } from '../document/types';
import { ProjectHistoryCodec } from '../persistence/project-history';
import { normalizeCalendarProject } from '../persistence/project-storage';
import { compactProjectAssets } from '../document/project-assets';
import { ensureCalendarWorkshopBranding } from '../document/branding';
interface HistoryEntry {
    snapshot: string;
    label: string;
    pageId: string;
}
export function useProjectHistory(project: Ref<CalendarProject>, selectedPageId: Ref<string>, selectedElementId: Ref<string | undefined>, selectedLayerIds: Ref<string[]>, operationNotice: Ref<string>, getContinuousSnapshot: () => string | undefined) {
    const undoStack = ref<HistoryEntry[]>([]);
    const redoStack = ref<HistoryEntry[]>([]);
    const historyCodec = new ProjectHistoryCodec();
    function serializeEditableProject(): string {
        return historyCodec.serialize(project.value);
    }
    function clearProjectHistory(): void {
        undoStack.value = [];
        redoStack.value = [];
        historyCodec.clear();
    }
    function pruneProjectHistoryAssets(): void {
        const continuousSnapshot = getContinuousSnapshot();
        historyCodec.prune([
            ...undoStack.value.map((entry) => entry.snapshot),
            ...redoStack.value.map((entry) => entry.snapshot),
            ...(continuousSnapshot ? [continuousSnapshot] : []),
        ], project.value);
    }
    function mutateProject<T>(label: string, mutation: () => T): T {
        const before = serializeEditableProject();
        const result = mutation();
        compactProjectAssets(project.value);
        const after = serializeEditableProject();
        if (before !== after) {
            undoStack.value.push({ snapshot: before, label, pageId: selectedPageId.value });
            if (undoStack.value.length > 40)
                undoStack.value.shift();
            redoStack.value = [];
            pruneProjectHistoryAssets();
        }
        return result;
    }
    function restoreProjectSnapshot(snapshot: string, pageId?: string): void {
        const currentProgramSettings = project.value.programSettings;
        const restored = normalizeCalendarProject(historyCodec.deserialize(snapshot));
        restored.programSettings = currentProgramSettings;
        ensureCalendarWorkshopBranding(restored);
        project.value = restored;
        selectedPageId.value =
            restored.document.pages.find((page) => page.id === pageId)?.id ??
                restored.document.pages[0]?.id ??
                "";
        selectedElementId.value = undefined;
        selectedLayerIds.value = [];
    }
    function undo(): void {
        const entry = undoStack.value.pop();
        if (!entry)
            return;
        redoStack.value.push({ snapshot: serializeEditableProject(), label: entry.label, pageId: selectedPageId.value });
        restoreProjectSnapshot(entry.snapshot, entry.pageId);
        pruneProjectHistoryAssets();
        operationNotice.value = `Отменено: ${entry.label}`;
    }
    function redo(): void {
        const entry = redoStack.value.pop();
        if (!entry)
            return;
        undoStack.value.push({ snapshot: serializeEditableProject(), label: entry.label, pageId: selectedPageId.value });
        restoreProjectSnapshot(entry.snapshot, entry.pageId);
        pruneProjectHistoryAssets();
        operationNotice.value = `Повторено: ${entry.label}`;
    }
    return { undoStack, redoStack, serializeEditableProject, clearProjectHistory, pruneProjectHistoryAssets, mutateProject, undo, redo };
}
