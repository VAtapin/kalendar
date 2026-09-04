<script setup lang="ts">
import { computed, ref } from "vue";
import type { PageLayerNode, PageModel } from "../document/types";
import { countObjectLayers } from "../document/layer-operations";

interface DisplayRow {
  node: PageLayerNode;
  depth: number;
  inheritedHidden: boolean;
  inheritedLocked: boolean;
}

const props = defineProps<{
  page: PageModel;
  selectedLayerIds: string[];
}>();

const emit = defineEmits<{
  select: [nodeId: string, additive: boolean];
  toggleVisible: [nodeId: string];
  toggleLocked: [nodeId: string];
  toggleExpanded: [nodeId: string];
  add: [];
  addGroup: [];
  groupSelected: [];
  deleteSelected: [];
  bringFront: [];
  sendBack: [];
  move: [sourceId: string, targetId: string, placement: "before" | "after" | "inside"];
  rename: [nodeId: string, name: string];
}>();

const draggedNodeId = ref<string>();
const editingNodeId = ref<string>();
const editingName = ref("");

const displayRows = computed<DisplayRow[]>(() => {
  const rows: DisplayRow[] = [];

  function visit(
    nodes: PageLayerNode[],
    depth: number,
    inheritedHidden: boolean,
    inheritedLocked: boolean,
  ): void {
    for (const node of [...nodes].sort((a, b) => b.order - a.order)) {
      rows.push({ node, depth, inheritedHidden, inheritedLocked });
      if (node.kind === "group" && node.expanded) {
        visit(
          node.children,
          depth + 1,
          inheritedHidden || !node.visible,
          inheritedLocked || node.locked,
        );
      }
    }
  }

  visit(props.page.layers, 0, false, false);
  return rows;
});

const primarySelectionId = computed(
  () => props.selectedLayerIds[props.selectedLayerIds.length - 1],
);

function objectCount(node: PageLayerNode): number {
  return node.kind === "group" ? countObjectLayers(node.children) : node.elementId ? 1 : 0;
}

function beginRename(nodeId: string | undefined): void {
  if (!nodeId) return;
  const node = displayRows.value.find((row) => row.node.id === nodeId)?.node;
  if (!node) return;
  editingNodeId.value = nodeId;
  editingName.value = node.name;
}

function commitRename(): void {
  const nodeId = editingNodeId.value;
  const name = editingName.value.trim();
  editingNodeId.value = undefined;
  if (nodeId && name) emit("rename", nodeId, name);
}

function cancelRename(): void {
  editingNodeId.value = undefined;
  editingName.value = "";
}

function dropOn(target: PageLayerNode, event: DragEvent): void {
  const sourceId = draggedNodeId.value;
  draggedNodeId.value = undefined;
  if (!sourceId || sourceId === target.id) return;
  const bounds = (event.currentTarget as HTMLElement | null)?.getBoundingClientRect();
  const after = bounds ? event.clientY > bounds.top + bounds.height / 2 : false;
  const placement = target.kind === "group" && !event.shiftKey
    ? "inside"
    : after
      ? "after"
      : "before";
  emit("move", sourceId, target.id, placement);
}

function beginDrag(nodeId: string, event: DragEvent): void {
  draggedNodeId.value = nodeId;
  event.dataTransfer?.setData("text/plain", nodeId);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
}
</script>

<template>
  <div class="layers-panel">
    <div class="layers-toolbar">
      <button type="button" title="Новый пустой слой" @click="emit('add')">＋</button>
      <button type="button" title="Новая папка" @click="emit('addGroup')">▣＋</button>
      <button
        type="button"
        title="Объединить выбранные слои в папку"
        :disabled="selectedLayerIds.length < 2"
        @click="emit('groupSelected')"
      >
        ⊞
      </button>
      <button type="button" title="Переименовать" @click="beginRename(primarySelectionId)">✎</button>
      <button type="button" title="На самый верх" :disabled="!primarySelectionId" @click="emit('bringFront')">⇈</button>
      <button type="button" title="На самый низ" :disabled="!primarySelectionId" @click="emit('sendBack')">⇊</button>
      <button type="button" title="Удалить выбранное (Delete)" :disabled="selectedLayerIds.length === 0" @click="emit('deleteSelected')">⌫</button>
    </div>

    <div class="layer-list" role="tree" aria-label="Слои страницы">
      <div
        v-if="draggedNodeId && displayRows[0]"
        class="layer-drop-edge"
        @dragover.prevent
        @drop.prevent="emit('move', draggedNodeId, displayRows[0]!.node.id, 'before'); draggedNodeId = undefined"
      >
        Переместить на самый верх
      </div>
      <div
        v-for="row in displayRows"
        :key="row.node.id"
        class="layer-row"
        :class="{
          'layer-row--selected': selectedLayerIds.includes(row.node.id),
          'layer-row--dragging': row.node.id === draggedNodeId,
          'layer-row--inherited-hidden': row.inheritedHidden,
        }"
        :style="{ '--layer-depth': row.depth }"
        :draggable="!row.inheritedLocked && !row.node.locked"
        role="treeitem"
        :aria-level="row.depth + 1"
        :aria-expanded="row.node.kind === 'group' ? row.node.expanded : undefined"
        @click="emit('select', row.node.id, $event.ctrlKey || $event.metaKey)"
        @dragstart="beginDrag(row.node.id, $event)"
        @dragend="draggedNodeId = undefined"
        @dragover.prevent
        @drop.prevent="dropOn(row.node, $event)"
      >
        <span class="layer-row__indent"></span>
        <button
          v-if="row.node.kind === 'group'"
          class="layer-row__disclosure"
          type="button"
          :title="row.node.expanded ? 'Свернуть папку' : 'Развернуть папку'"
          @click.stop="emit('toggleExpanded', row.node.id)"
        >
          {{ row.node.expanded ? "⌄" : "›" }}
        </button>
        <span v-else class="layer-row__handle" aria-hidden="true">⠿</span>
        <button
          class="layer-row__icon"
          type="button"
          :title="row.node.visible ? 'Скрыть' : 'Показать'"
          @click.stop="emit('toggleVisible', row.node.id)"
        >
          {{ row.node.visible ? "◉" : "○" }}
        </button>
        <button
          class="layer-row__icon"
          type="button"
          :title="row.node.locked ? 'Разблокировать' : 'Заблокировать'"
          @click.stop="emit('toggleLocked', row.node.id)"
        >
          {{ row.node.locked || row.inheritedLocked ? "◆" : "◇" }}
        </button>
        <span class="layer-row__color" :style="{ backgroundColor: row.node.color }"></span>
        <span class="layer-row__kind" aria-hidden="true">
          {{ row.node.kind === "group" ? "▰" : row.node.elementId ? "◆" : "□" }}
        </span>
        <input
          v-if="editingNodeId === row.node.id"
          v-model="editingName"
          class="layer-row__name-input"
          type="text"
          aria-label="Название слоя или папки"
          autofocus
          @click.stop
          @keydown.enter.prevent="commitRename"
          @keydown.esc.prevent="cancelRename"
          @blur="commitRename"
        />
        <span v-else class="layer-row__name" @dblclick.stop="beginRename(row.node.id)">
          {{ row.node.name }}
        </span>
        <span class="layer-row__count">{{ objectCount(row.node) }}</span>
      </div>
      <div
        v-if="draggedNodeId && displayRows.at(-1)"
        class="layer-drop-edge"
        @dragover.prevent
        @drop.prevent="emit('move', draggedNodeId, displayRows.at(-1)!.node.id, 'after'); draggedNodeId = undefined"
      >
        Переместить на самый низ
      </div>
    </div>
    <p class="layers-hint">Ctrl/⌘ — несколько слоёв. Shift при переносе — не вкладывать в папку.</p>
  </div>
</template>
