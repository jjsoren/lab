import type { IColumn, IDataset, IRecord } from '@talxis/client-libraries';

const LOW_STOCK_FALLBACK = 10;
const LOW_STOCK_BACKGROUND = '#FDE7E9';

const initialized = new Map<string, IDataset>();
const waiters = new Map<string, ((dataset: IDataset) => void)[]>();
const anyWaiters: ((dataset: IDataset) => void)[] = [];

export class GridApi {
    public static onDatasetControlInitialized(parameters: { controlId: string; dataset: IDataset }): void {
        const { controlId, dataset } = parameters;
        initialized.set(controlId, dataset);
        waiters.get(controlId)?.forEach(resolve => resolve(dataset));
        waiters.delete(controlId);
        anyWaiters.splice(0).forEach(resolve => resolve(dataset));
        dataset.addEventListener('onDestroyed', () => initialized.delete(controlId));
        GridApi.customizeItemsGrid(dataset);
    }

    public static getDataset(controlId?: string): Promise<IDataset> {
        if (!controlId) {
            const firstDataset = Array.from(initialized.values())[0];
            if (firstDataset) return Promise.resolve(firstDataset);
            return new Promise(resolve => anyWaiters.push(resolve));
        }

        const existing = initialized.get(controlId);
        if (existing) return Promise.resolve(existing);
        return new Promise(resolve => {
            const controlWaiters = waiters.get(controlId) ?? [];
            controlWaiters.push(resolve);
            waiters.set(controlId, controlWaiters);
        });
    }

    private static customizeItemsGrid(dataset: IDataset): void {
        dataset.setInterceptor('columns', (columns: IColumn[]) => columns.map(column =>
            column.name === 'lab_availablequantity'
                ? { ...column, displayName: 'Qty on hand' }
                : column));

        dataset.addEventListener('onRecordLoaded', (record: IRecord) => {
            record.expressions?.ui.setCustomFormattingExpression('lab_availablequantity', () => {
                if (record.getSummarizationType() === 'grouping') return undefined;
                const quantity = record.getValue('lab_availablequantity');
                if (quantity == null) return undefined;
                const reorderPoint = (record.getValue('lab_reorderpoint') as number) ?? LOW_STOCK_FALLBACK;
                if ((quantity as number) > reorderPoint) return undefined;
                return { backgroundColor: LOW_STOCK_BACKGROUND };
            });
        });
    }
}

export class LocationForm {
    public static async onLoad(executionContext: Xrm.Events.EventContext): Promise<void> {
        const formContext = executionContext.getFormContext();
        const dataset = await GridApi.getDataset();
        let notificationShown = false;
        const showCount = () => {
            if (notificationShown) return;
            notificationShown = true;
            formContext.ui.setFormNotification(
                'TALXIS Grid ready — ' + dataset.sortedRecordIds.length + ' warehouse item(s) loaded',
                'INFO',
                'talxisgrid'
            );
        };

        dataset.addEventListener('onFirstDataLoaded', showCount);
        if (!dataset.loading) showCount();
    }
}