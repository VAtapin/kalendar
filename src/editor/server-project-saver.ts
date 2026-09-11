import { ref } from 'vue';
import type { CalendarProject } from '../document/types';
import { createPersistentProjectSnapshot } from '../persistence/project-storage';
import { accountRequest } from '../collaboration/account-client';
interface SaveDependencies {
    project(): CalendarProject;
    userId(): string | undefined;
    switching(): boolean;
    serialize(): string;
    status(value: 'saved' | 'saving' | 'error'): void;
    notice(value: string): void;
}
/** Serializes writes and ignores responses belonging to an earlier project/account. */
export class ServerProjectSaver {
    readonly id = ref<string>();
    revision = 0;
    context = 0;
    assets = new Map<string, string>();
    snapshot: string | undefined;
    private pending: Promise<void> = Promise.resolve();
    constructor(private dependencies: SaveDependencies, private request: typeof accountRequest = accountRequest) { }
    async save(): Promise<void> {
        const user = this.dependencies.userId();
        if (!user || this.dependencies.switching())
            return;
        const current = this.dependencies.project();
        const context = this.context;
        const snapshot = createPersistentProjectSnapshot(current);
        const editableSnapshot = this.dependencies.serialize();
        const operation = this.pending.catch(() => { }).then(async () => {
            if (this.dependencies.project() !== current || this.dependencies.userId() !== user || this.context !== context)
                return;
            if (this.id.value && this.snapshot === editableSnapshot) {
                this.dependencies.status(this.dependencies.serialize() === editableSnapshot ? 'saved' : 'saving');
                return;
            }
            this.dependencies.status('saving');
            const id = this.id.value;
            const reuseAssets: string[] = [];
            const assetSources = new Map(snapshot.assets.map(asset => [asset.id, asset.source]));
            if (id)
                for (const asset of snapshot.assets) {
                    if (this.assets.get(asset.id) === asset.source) {
                        reuseAssets.push(asset.id);
                        asset.source = '';
                    }
                }
            try {
                const result = await this.request<{
                    id: string;
                    revision: number;
                }>(id ? `calendars/${id}` : 'calendars', id ? 'PUT' : 'POST', { project: snapshot, revision: this.revision, reuseAssets });
                if (this.context === context && this.dependencies.userId() === user) {
                    this.id.value = result.id;
                    this.revision = result.revision;
                    this.assets = assetSources;
                    this.snapshot = editableSnapshot;
                    this.dependencies.status(this.dependencies.serialize() === editableSnapshot ? 'saved' : 'saving');
                }
            }
            catch (error) {
                if (this.context === context && this.dependencies.userId() === user) {
                    this.dependencies.status('error');
                    this.dependencies.notice(`Не сохранено на сервере: ${String(error)}. Можно скачать копию через меню «Файл».`);
                }
                throw error;
            }
        });
        this.pending = operation;
        return operation;
    }
}
