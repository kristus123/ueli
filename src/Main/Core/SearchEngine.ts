import Fuse from "fuse.js";
import { Logger } from "../../Common/Logger/Logger";
import { SearchResultItem } from "../../Common/SearchResult/SearchResultItem";
import { Settings } from "../../Common/Settings";
import { SearchPluginUtility } from "../Plugins/SearchPluginUtility";
import { SearchPlugin } from "../Plugins/SearchPlugin";
import { Searchable } from "./Searchable";
import { SearchEngineRescanError } from "./SearchEngineRescanError";

export class SearchEngine {
    private rescanPromise?: Promise<void[]>;
    private scheduledRescanTimeout?: number | NodeJS.Timeout;

    constructor(
        private settings: Settings,
        private readonly searchPlugins: SearchPlugin[],
        private readonly logger: Logger
    ) {}

    public search(searchTerm: string): SearchResultItem[] {
        if (SearchEngine.isEmptySearchTerm(searchTerm)) {
            return [];
        }

        return new Fuse(
            this.getAllSearchables().map((searchable) => searchable.toSearchResultItem()),
            {
                threshold: this.settings["searchEngine.threshold"] as number,
                keys: ["name"],
            }
        )
            .search(searchTerm)
            .map((fuseSearchResult) => fuseSearchResult.item);
    }

    public async rescan(): Promise<void> {
        if (this.rescanIsCurrentlyRunning()) {
            throw new SearchEngineRescanError("Rescan is currently running.");
        }

        this.logger.info("Starting rescan");

        try {
            this.rescanPromise = Promise.all(this.searchPlugins.map((searchPlugin) => searchPlugin.rescan()));
            await this.rescanPromise;
            this.logger.info(`Successfully rescanned`);
        } catch (error) {
            this.handleError(new SearchEngineRescanError(error));
        } finally {
            this.rescanPromise = undefined;
            if (
                (this.settings["searchEngine.automaticRescanEnabled"] as boolean) &&
                (this.settings["searchEngine.automaticRescanIntervalInSeconds"] as number)
            ) {
                this.scheduleRescan(this.settings["searchEngine.automaticRescanIntervalInSeconds"] as number);
            }
        }
    }

    public async clearCaches(): Promise<void> {
        try {
            await Promise.all(
                this.searchPlugins.map((searchPlugin) => SearchPluginUtility.cleanPluginFolder(searchPlugin))
            );
        } catch (error) {
            throw new Error(`SearchEngine failed to clear caches. Reason: ${error}`);
        }
    }

    public async updateSettings(updatedSettings: Settings): Promise<void> {
        if (this.automaticRescanOptionChanged(updatedSettings)) {
            if (
                (updatedSettings["searchEngine.automaticRescanEnabled"] as boolean) &&
                (updatedSettings["searchEngine.automaticRescanIntervalInSeconds"] as number)
            ) {
                await this.rescan();
            } else {
                this.cancelScheduledRescan();
            }
        }

        this.settings = updatedSettings;
    }

    private rescanIsCurrentlyRunning(): boolean {
        return this.rescanPromise !== undefined;
    }

    private cancelScheduledRescan(): void {
        if (this.scheduledRescanTimeout) {
            clearTimeout(<number>this.scheduledRescanTimeout);
            this.logger.info("Scheduled rescan cancelled");
        }
    }

    private scheduleRescan(automaticRescanIntervalInSeconds: number): void {
        this.logger.info(`Scheduled next rescan in ${automaticRescanIntervalInSeconds} seconds`);
        this.scheduledRescanTimeout = setTimeout(() => this.rescan(), automaticRescanIntervalInSeconds * 1000);
    }

    private getAllSearchables(): Searchable[] {
        return this.searchPlugins
            .map((searchPlugin) => searchPlugin.getAllSearchables())
            .reduce((previous, current) => previous.concat(current), []);
    }

    private handleError(error: Error): void {
        this.logger.error(`Handled error: ${error.message}`);
    }

    private automaticRescanOptionChanged(updatedSettings: Settings): boolean {
        const automaticRescanIntervalInSecondsOptionChanged =
            (updatedSettings["searchEngine.automaticRescanIntervalInSeconds"] as number) !==
            this.settings["searchEngine.automaticRescanIntervalInSeconds"];

        const automaticRescanEnabledOptionChanged =
            (updatedSettings["searchEngine.automaticRescanEnabled"] as boolean) !==
            this.settings["searchEngine.automaticRescanEnabled"];

        return automaticRescanIntervalInSecondsOptionChanged || automaticRescanEnabledOptionChanged;
    }

    private static isEmptySearchTerm(searchTerm: string): boolean {
        return searchTerm.trim().length === 0;
    }
}
