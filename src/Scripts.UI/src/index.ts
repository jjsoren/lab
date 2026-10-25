export class TransactionForm {
    public static onLoad(executionContext: Xrm.Events.EventContext): void {
        const formContext = executionContext.getFormContext();
        const date = formContext.getAttribute("lab_transactiondate");
        if (date && !date.getValue()) date.setValue(new Date());
    }

    public static async onQuantityChange(executionContext: Xrm.Events.EventContext): Promise<void> {
        const formContext = executionContext.getFormContext();
        const quantity = (formContext.getAttribute("lab_quantity") as Xrm.Attributes.NumberAttribute)?.getValue();
        const item = (formContext.getAttribute("lab_itemid") as Xrm.Attributes.LookupAttribute)?.getValue();

        if (quantity == null || !item?.length) return;

        try {
            const record = await Xrm.WebApi.retrieveRecord(
                "lab_warehouseitem",
                item[0].id.replace(/[{}]/g, ""),
                "?$select=lab_unitprice"
            );
            const unitPrice = record.lab_unitprice as number | null;
            if (unitPrice != null) {
                (formContext.getAttribute("lab_totalvalue") as Xrm.Attributes.NumberAttribute)?.setValue(quantity * unitPrice);
            }
        } catch {
            return;
        }
    }
}

export class RibbonActions {
    public static async checkStockLevels(formContext: Xrm.FormContext): Promise<void> {
        const name = (formContext.getAttribute("lab_name") as Xrm.Attributes.StringAttribute)?.getValue() ?? "Unknown";
        const quantity = (formContext.getAttribute("lab_availablequantity") as Xrm.Attributes.NumberAttribute)?.getValue() ?? 0;
        const reorderPoint = (formContext.getAttribute("lab_reorderpoint") as Xrm.Attributes.NumberAttribute)?.getValue() ?? 0;

        let message = "Stock level for " + name + ": " + quantity + " units.";
        if (quantity <= reorderPoint) {
            message += "\n⚠ Below reorder point (" + reorderPoint + "). Consider restocking.";
        } else {
            message += "\n✓ Stock is above reorder point (" + reorderPoint + ").";
        }

        await Xrm.Navigation.openAlertDialog({ text: message, title: "Stock Check" });
    }
}

export { GridApi, LocationForm } from './GridCustomizer';
