import { App, GlobalShortcut, IpcMain } from "electron";
import { IpcChannel } from "../Common/IpcChannel";
import { Logger } from "../Common/Logger/Logger";
import { OperatingSystem } from "../Common/OperatingSystem/OperatingSystem";
import { SearchResultItem } from "../Common/SearchResult/SearchResultItem";
import { Settings } from "../Common/Settings";
import { ExecutionService } from "./Core/ExecutionService";
import { LocationOpeningService } from "./Core/LocationOpeningService";
import { SearchEngine } from "./Core/SearchEngine";
import { ExecutionContext } from "../Common/ExecutionContext";
import { SettingsManager } from "./Settings/SettingsManager";
import { TrayIconEvent } from "./TrayIconEvent";
import { TrayIconManager } from "./TrayIconManager";
import { UeliCommandEvent } from "./UeliCommandEvent";
import { WindowManager } from "./WindowManager";

export class MainApplication {
    constructor(
        private readonly electronApp: App,
        private readonly ipcMain: IpcMain,
        private readonly globalShortcut: GlobalShortcut,
        private readonly executionContext: ExecutionContext,
        private readonly windowManager: WindowManager,
        private readonly trayIconManager: TrayIconManager,
        private readonly searchEngine: SearchEngine,
        private readonly executionService: ExecutionService,
        private readonly locationOpeningService: LocationOpeningService,
        private readonly settingsManager: SettingsManager,
        private readonly logger: Logger
    ) {}

    public start(): void {
        this.appendCommandlineSwitches();
        this.registerElectronAppEventListeners();
    }

    private registerElectronAppEventListeners(): void {
        this.electronApp.on("ready", async () => await this.startApp());
        this.electronApp.on("window-all-closed", async () => await this.quitApp());
    }

    private async startApp(): Promise<void> {
        this.registerIpcEventListeners();
        this.createTrayIcon();
        await this.windowManager.createMainWindow();
        this.registerGlobalKeyEventListeners();
        await this.searchEngine.rescan();
    }

    private async quitApp(): Promise<void> {
        this.electronApp.quit();
    }

    private appendCommandlineSwitches(): void {
        const operatingSystemSpecificCommandlineSwitches: Record<OperatingSystem, string[]> = {
            Windows: ["wm-window-animations-disabled"],
            macOS: [],
        };

        operatingSystemSpecificCommandlineSwitches[this.executionContext.operatingSystem].forEach((commandlineSwitch) =>
            this.electronApp.commandLine.appendSwitch(commandlineSwitch)
        );
    }

    private createTrayIcon(): void {
        this.trayIconManager.createTrayIcon();
    }

    private registerGlobalKeyEventListeners(): void {
        this.globalShortcut.register("Alt+Space", () => this.windowManager.toggleMainWindow());
    }

    private registerIpcEventListeners(): void {
        this.ipcMain.handle(
            IpcChannel.Search,
            (_, args: string[]): Promise<SearchResultItem[]> =>
                args.length > 0
                    ? Promise.resolve(this.searchEngine.search(args[0]))
                    : Promise.reject("Failed to handle search term. Reason: no search term specified.")
        );

        this.ipcMain.handle(
            IpcChannel.Execute,
            async (_, args: SearchResultItem[]): Promise<void> =>
                args.length > 0
                    ? this.execute(args[0])
                    : Promise.reject("Failed to execute search result item. Reason: no search result items given.")
        );

        this.ipcMain.handle(
            IpcChannel.OpenLocation,
            (_, args: SearchResultItem[]): Promise<void> =>
                args.length > 0
                    ? this.openLocation(args[0])
                    : Promise.reject("Unable to open location. Reason: no search result items given.")
        );

        this.ipcMain.handle(IpcChannel.ClearCaches, () => this.clearCaches());

        this.ipcMain.handle(
            IpcChannel.UpdateSettings,
            (_, args: Settings[]): Promise<void> =>
                args.length > 0
                    ? this.updateSettings(args[0])
                    : Promise.reject("Unable to update settings. Reason: no settings given.")
        );

        this.ipcMain.on(IpcChannel.EscapePressed, () => this.windowManager.hideMainWindow());

        this.ipcMain.on(
            IpcChannel.TrayIconEvent,
            async (_, trayIconEvent: TrayIconEvent) => await this.handleTrayIconEvent(trayIconEvent)
        );

        this.ipcMain.on(
            IpcChannel.UeliCommandEvent,
            async (_, ueliCommandEvent: UeliCommandEvent) => await this.handleUeliCommandEvent(ueliCommandEvent)
        );

        this.ipcMain.on(IpcChannel.GetSettings, (event) => (event.returnValue = this.settingsManager.getSettings()));
        this.ipcMain.on(IpcChannel.GetExecutionContext, (event) => (event.returnValue = this.executionContext));
    }

    private execute(searchResultItem: SearchResultItem): Promise<void> {
        this.windowManager.hideMainWindow();
        return this.executionService.execute(searchResultItem);
    }

    private openLocation(searchResultItem: SearchResultItem): Promise<void> {
        this.windowManager.hideMainWindow();
        return this.locationOpeningService.openLocation(searchResultItem);
    }

    private async rescan(): Promise<void> {
        this.windowManager.sendMessageToAllWindows(IpcChannel.RescanStarted);
        await this.searchEngine.rescan();
        this.windowManager.sendMessageToAllWindows(IpcChannel.RescanFinished);
    }

    private async clearCaches(): Promise<void> {
        try {
            await this.searchEngine.clearCaches();
            this.logger.info("Successfully cleared caches");
        } catch (error) {
            this.logger.error(`Failed to clear caches. Reason: ${error}`);
        }
    }

    private async handleTrayIconEvent(event: TrayIconEvent): Promise<void> {
        const trayIconEventHandlers: Record<TrayIconEvent, () => Promise<void>> = {
            ClearCachesClicked: () => this.clearCaches(),
            QuitClicked: () => this.quitApp(),
            RescanClicked: () => this.rescan(),
            SettingsClicked: () => this.windowManager.showSettingsWindow(),
            ShowClicked: () => {
                this.windowManager.showMainWindow();
                return Promise.resolve();
            },
        };

        return trayIconEventHandlers[event]();
    }

    private async handleUeliCommandEvent(event: UeliCommandEvent): Promise<void> {
        const eventHandlers: Record<UeliCommandEvent, () => Promise<void>> = {
            OpenSettings: () => this.windowManager.showSettingsWindow(),
            QuitApp: () => this.quitApp(),
            Rescan: () => this.rescan(),
        };

        return eventHandlers[event]();
    }

    private async updateSettings(updatedSettings: Settings): Promise<void> {
        await this.searchEngine.updateSettings(updatedSettings);
        this.windowManager.sendMessageToAllWindows(IpcChannel.SettingsUpdated, updatedSettings);
        return this.settingsManager.updateSettings(updatedSettings);
    }
}
