"use strict";

import powerbi from "powerbi-visuals-api";
import "./../style/visual.less";
import IVisual = powerbi.extensibility.visual.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;

type FilterField = {
    key: string;
    title: string;
    tableName: string;
    columnName: string;
    labels: string[];
    rawValues: string[];
    valueByLabel: Map<string, powerbi.PrimitiveValue>;
};

export class Visual implements IVisual {
    private target: HTMLElement;
    private host: powerbi.extensibility.visual.IVisualHost;
    private fields: FilterField[] = [];
    private selectedByField = new Map<string, string>();
    private activeFieldKey: string | null = null;
    private expandedMoreFieldKey: string | null = null;
    private moreSearchTerm = "";
    private isMoreOpen = false;

    constructor(options: VisualConstructorOptions) {
        this.target = options.element;
        this.host = options.host;
    }

    public update(options: VisualUpdateOptions): void {
        const categories = options.dataViews?.[0]?.categorical?.categories;

        if (!categories?.length) {
            const empty = this.createElement("div", "empty", "Arrastra uno o varios campos al visual");
            this.target.replaceChildren(empty);
            return;
        }

        this.fields = categories.map(category => this.createFilterField(category));
        this.selectedByField.forEach((value, key) => {
            const field = this.fields.find(item => item.key === key);

            if (!field || !field.labels.includes(value)) {
                this.selectedByField.delete(key);
            }
        });

        this.render();
    }

    private render(): void {
        const shell = this.createElement("div", "navara-shell navara-shell--compact");

        shell.append(
            this.renderNavigation(),
            this.renderFilterBar()
        );

        this.target.replaceChildren(shell);
        this.bindEvents();
    }

    // HTML: pestañas de navegación de la izquierda.
    private renderNavigation(): HTMLElement {
        const nav = this.createElement("div", "navara-tabs");

        nav.append(
            this.createButton("Vista General", "navara-tab is-active"),
            this.createButton("Comercial", "navara-tab"),
            this.createButton("Logística", "navara-tab")
        );

        return nav;
    }

    // HTML: filtros pequeños de la derecha.
    private renderFilterBar(): HTMLElement {
        const bar = this.createElement("div", "navara-filterbar");
        const visibleFields = this.fields.slice(0, 3);

        visibleFields.forEach(field => {
            bar.append(this.renderVisibleFilter(field));
        });

        bar.append(
            this.renderMoreFilter(),
            this.createButton("× Limpiar todo", "navara-clear", "clear-all")
        );

        return bar;
    }

    // HTML: cada filtro visible con su desplegable debajo.
    private renderVisibleFilter(field: FilterField): HTMLElement {
        const wrapper = this.createElement("div", "navara-filter-item");
        const selected = this.selectedByField.get(field.key) ?? "Todos";
        const button = this.createButton(`${field.title}: ${selected}`, "navara-select", "toggle-field", field.key);

        wrapper.append(button, this.renderFieldDropdown(field));
        return wrapper;
    }

    // HTML: lista desplegable debajo de un filtro especifico.
    private renderFieldDropdown(field: FilterField): HTMLElement {
        const dropdown = this.createElement("div", this.activeFieldKey === field.key ? "navara-dropdown is-open" : "navara-dropdown");

        dropdown.append(
            this.createElement("div", "navara-dropdown__title", field.title),
            this.createButton("Todos", this.selectedByField.has(field.key) ? "navara-option" : "navara-option is-selected", "clear-field", field.key)
        );

        field.labels.forEach(label => {
            const option = this.createButton(
                label,
                this.selectedByField.get(field.key) === label ? "navara-option is-selected" : "navara-option",
                undefined,
                label
            );
            option.dataset.field = field.key;
            dropdown.append(option);
        });

        return dropdown;
    }

    // HTML: boton de mas filtros con su panel debajo.
    private renderMoreFilter(): HTMLElement {
        const wrapper = this.createElement("div", "navara-filter-item navara-filter-item--more");

        wrapper.append(
            this.createButton("Más Filtros", "navara-select navara-select--more", "toggle-more"),
            this.renderMorePanel()
        );

        return wrapper;
    }

    // HTML: panel extra para cuando haya más campos o quieras verlos todos.
    private renderMorePanel(): HTMLElement {
        const panel = this.createElement("div", this.isMoreOpen ? "navara-more is-open" : "navara-more");
        const filteredFields = this.fields.filter(field => field.title.toLowerCase().includes(this.moreSearchTerm.trim().toLowerCase()));

        const header = this.createElement("div", "navara-more__header");
        header.append(
            this.createElement("div", "navara-more__heading", "Filtros"),
            this.createButton("×", "navara-more__close", "toggle-more")
        );

        const searchWrap = this.createElement("div", "navara-more__search-wrap");
        const search = document.createElement("input");
        search.className = "navara-more__search";
        search.type = "search";
        search.placeholder = "Buscar filtros...";
        search.value = this.moreSearchTerm;
        searchWrap.append(search);

        const list = this.createElement("div", "navara-more__list");

        filteredFields.forEach(field => {
            const group = this.createElement("div", "navara-more__group");
            const isExpanded = this.expandedMoreFieldKey === field.key;
            const selected = this.selectedByField.get(field.key);
            const row = this.createButton(field.title, selected ? "navara-more__row has-selection" : "navara-more__row", "toggle-more-field", field.key);

            row.append(this.createElement("span", "navara-more__plus", isExpanded ? "−" : "+"));
            group.append(row);

            const values = this.createElement("div", "navara-more__values");
            if (isExpanded) {
                const allChip = this.createButton("Todos", this.selectedByField.has(field.key) ? "navara-chip" : "navara-chip is-selected", "clear-field", field.key);
                allChip.dataset.keepOpen = "true";
                values.append(allChip);

                field.labels.forEach(label => {
                    const chip = this.createButton(
                        label,
                        this.selectedByField.get(field.key) === label ? "navara-chip is-selected" : "navara-chip",
                        undefined,
                        label
                    );
                    chip.dataset.field = field.key;
                    chip.dataset.keepOpen = "true";
                    values.append(chip);
                });
            }

            group.append(values);
            list.append(group);
        });

        if (filteredFields.length === 0) {
            list.append(this.createElement("div", "navara-more__empty", "No hay filtros con ese nombre"));
        }

        panel.append(
            header,
            searchWrap,
            list,
            this.createButton("Aplicar Filtros", "navara-more__apply", "apply-more")
        );

        return panel;
    }

    private bindEvents(): void {
        this.target.querySelectorAll<HTMLElement>("[data-action='toggle-field']").forEach(button => {
            button.addEventListener("click", () => {
                const fieldKey = button.dataset.value ?? null;
                this.activeFieldKey = this.activeFieldKey === fieldKey ? null : fieldKey;
                this.isMoreOpen = false;
                this.render();
            });
        });

        this.target.querySelectorAll<HTMLElement>("[data-action='toggle-more']").forEach(button => {
            button.addEventListener("click", () => {
                this.isMoreOpen = !this.isMoreOpen;
                this.activeFieldKey = null;
                this.render();
            });
        });

        const moreSearch = this.target.querySelector<HTMLInputElement>(".navara-more__search");
        moreSearch?.addEventListener("input", () => {
            this.moreSearchTerm = moreSearch.value;
            this.render();
        });

        this.target.querySelectorAll<HTMLElement>("[data-action='toggle-more-field']").forEach(button => {
            button.addEventListener("click", () => {
                const fieldKey = button.dataset.value ?? null;
                this.expandedMoreFieldKey = this.expandedMoreFieldKey === fieldKey ? null : fieldKey;
                this.render();
            });
        });

        this.target.querySelectorAll<HTMLElement>("[data-action='apply-more']").forEach(button => {
            button.addEventListener("click", () => {
                this.isMoreOpen = false;
                this.expandedMoreFieldKey = null;
                this.render();
            });
        });

        this.target.querySelectorAll<HTMLElement>("[data-action='clear-all']").forEach(button => {
            button.addEventListener("click", () => {
                this.selectedByField.clear();
                this.activeFieldKey = null;
                this.isMoreOpen = false;
                this.applyFilters();
                this.render();
            });
        });

        this.target.querySelectorAll<HTMLElement>("[data-action='clear-field']").forEach(button => {
            button.addEventListener("click", () => {
                const fieldKey = button.dataset.value;

                if (fieldKey) {
                    this.selectedByField.delete(fieldKey);
                    if (button.dataset.keepOpen !== "true") {
                        this.activeFieldKey = null;
                        this.isMoreOpen = false;
                    }
                    this.applyFilters();
                    this.render();
                }
            });
        });

        this.target.querySelectorAll<HTMLElement>("[data-field]").forEach(button => {
            button.addEventListener("click", () => {
                const fieldKey = button.dataset.field;
                const value = button.dataset.value;

                if (!fieldKey || !value) {
                    return;
                }

                if (this.selectedByField.get(fieldKey) === value) {
                    this.selectedByField.delete(fieldKey);
                } else {
                    this.selectedByField.set(fieldKey, value);
                }

                if (button.dataset.keepOpen !== "true") {
                    this.activeFieldKey = null;
                    this.isMoreOpen = false;
                }
                this.applyFilters();
                this.render();
            });
        });
    }

    private createFilterField(category: powerbi.DataViewCategoryColumn): FilterField {
        const queryName = category.source.queryName ?? category.source.displayName;
        const target = this.parseQueryName(queryName);
        const rawValues = category.values.map(value => this.toLabel(value));
        const labels = this.unique(rawValues);

        return {
            key: queryName,
            title: category.source.displayName ?? "Filtro",
            tableName: target.tableName,
            columnName: target.columnName,
            labels,
            rawValues,
            valueByLabel: this.buildValueMap(category.values, rawValues),
        };
    }

    private applyFilters(): void {
        const filters = this.fields
            .map(field => {
                const selected = this.selectedByField.get(field.key);
                const rawValue = selected ? field.valueByLabel.get(selected) : undefined;

                if (!selected || rawValue === undefined || !field.tableName || !field.columnName) {
                    return null;
                }

                return {
                    $schema: "https://powerbi.com/product/schema#basic",
                    target: {
                        table: field.tableName,
                        column: field.columnName,
                    },
                    operator: "In",
                    values: [rawValue],
                    filterType: 1,
                };
            })
            .filter(filter => filter !== null);

        if (filters.length === 0) {
            this.host.applyJsonFilter(null as any, "general", "filter", powerbi.FilterAction.remove);
            return;
        }

        this.host.applyJsonFilter(filters as any, "general", "filter", powerbi.FilterAction.merge);
    }

    private createElement<K extends keyof HTMLElementTagNameMap>(tagName: K, className = "", textContent = ""): HTMLElementTagNameMap[K] {
        const element = document.createElement(tagName);

        if (className) {
            element.className = className;
        }

        if (textContent) {
            element.textContent = textContent;
        }

        return element;
    }

    private createButton(label: string, className: string, action?: string, value?: string): HTMLButtonElement {
        const button = document.createElement("button");
        button.type = "button";
        button.className = className;
        button.textContent = label;

        if (action) {
            button.dataset.action = action;
        }

        if (value !== undefined) {
            button.dataset.value = value;
        }

        return button;
    }

    private unique(values: string[]): string[] {
        return [...new Set(values)];
    }

    private toLabel(value: unknown): string {
        if (value === null || value === undefined || value === "") {
            return "(Vacío)";
        }

        return String(value);
    }

    private buildValueMap(rawValues: powerbi.PrimitiveValue[], values: string[]): Map<string, powerbi.PrimitiveValue> {
        const map = new Map<string, powerbi.PrimitiveValue>();

        values.forEach((value, index) => {
            if (!map.has(value)) {
                map.set(value, rawValues[index]);
            }
        });

        return map;
    }

    private parseQueryName(queryName: string): { tableName: string; columnName: string } {
        const index = queryName.lastIndexOf(".");

        if (index <= 0 || index >= queryName.length - 1) {
            return { tableName: "", columnName: "" };
        }

        return {
            tableName: queryName.slice(0, index),
            columnName: queryName.slice(index + 1),
        };
    }

    
}
