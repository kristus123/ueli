import { app, globalShortcut, ipcMain, shell } from "electron";
import { platform } from "os";
import { OperatingSystemHelper } from "../common/OperatingSystemHelper";
import { ExecutionService } from "./Core/ExecutionService";
import { FilePathExecutor } from "./Executors/FilePathExecutor";
import { FilePathLocationOpener } from "./LocationOpeners/FilePathLocationOpener";
import { MainApplication } from "./MainApplication";
import { LocationOpeningService } from "./Core/LocationOpeningService";
import { SearchEngine } from "./Core/SearchEngine";
import { WindowManager } from "./WindowManager";
import { TrayIconManager } from "./TrayIconManager";
import { ApplicationRuntimeInformation } from "./ApplicationRuntimeInformation";
import { UeliCommandExecutor } from "./Executors/UeliCommandExecutor";
import { OperatingSystem } from "../common/OperatingSystem";
import { WindowsPluginRepository } from "./PluginRepository/WindowsPluginRepository";
import { MacOsPluginRepository } from "./PluginRepository/MacOsPluginRepository";

const operatingSystem = OperatingSystemHelper.getOperatingSystem(platform());

const applicationRuntimeInformation: ApplicationRuntimeInformation = {
    executablePath: app.getPath("exe"),
    temporaryDirectoryPath: app.getPath("temp"),
    userDataPath: app.getPath("userData"),
    userHomePath: app.getPath("home"),
};

const windowManager = new WindowManager();
const trayIconManager = new TrayIconManager(operatingSystem, ipcMain);

const pluginRepository =
    operatingSystem === OperatingSystem.Windows
        ? new WindowsPluginRepository(applicationRuntimeInformation)
        : new MacOsPluginRepository(applicationRuntimeInformation);

const searchEngine = new SearchEngine({}, pluginRepository.getAllPlugins());

const openFilePath = async (filePath: string): Promise<void> => {
    const errorMessage = await shell.openPath(filePath);

    if (errorMessage) {
        throw new Error(errorMessage);
    }
};

const openFileLocation = async (filePath: string): Promise<void> => {
    shell.showItemInFolder(filePath);
};

const executionService = new ExecutionService([new FilePathExecutor(openFilePath), new UeliCommandExecutor(ipcMain)]);
const locationOpeningService = new LocationOpeningService([new FilePathLocationOpener(openFileLocation)]);

new MainApplication(
    app,
    ipcMain,
    globalShortcut,
    windowManager,
    trayIconManager,
    operatingSystem,
    searchEngine,
    executionService,
    locationOpeningService
).start();
