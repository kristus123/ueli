import { createHash } from "crypto";
import { join, normalize } from "path";
import { MacOsApplication } from "./MacOsApplication";
import { FileSystemUtility } from "../../Utility/FileSystemUtility";
import { ExecutionContext } from "../../../Common/ExecutionContext";
import { SearchPlugin } from "../SearchPlugin";
import { Searchable } from "../../Core/Searchable";
import { CommandlineUtility } from "../../Utility/CommandlineUtility";
import { SearchPluginUtility } from "../SearchPluginUtility";

export class MacOsApplicationSearchPlugin implements SearchPlugin {
    protected readonly defaultSettings: Record<string, unknown> = {};

    private readonly applicationFolders = ["/System/Applications/", "/Applications/"];
    private applications: MacOsApplication[] = [];

    public constructor(private readonly executionContext: ExecutionContext) {}

    public getPluginId(): string {
        return "MacOsApplicationSearchPlugin";
    }

    public async rescan(): Promise<void> {
        await SearchPluginUtility.ensurePluginFolderExists(this);
        const appFilePaths = await this.retrieveAllApplicationFilePaths();
        await this.generateMacAppIcons(appFilePaths);

        this.applications = appFilePaths.map(
            (appFilePath) => new MacOsApplication(appFilePath, this.getApplicationIconFilePath(appFilePath))
        );
    }

    public getAllSearchables(): Searchable[] {
        return this.applications;
    }

    public getExecutionContext(): ExecutionContext {
        return this.executionContext;
    }

    private async generateMacAppIcons(filePaths: string[]): Promise<void> {
        await Promise.allSettled(filePaths.map((filePath) => this.generateMacAppIcon(filePath)));
    }

    private async generateMacAppIcon(appFilePath: string): Promise<void> {
        const pngFilePath = this.getApplicationIconFilePath(appFilePath);

        if (await FileSystemUtility.pathExists(pngFilePath)) {
            return;
        }

        const relativeIcnsFilePath = (
            await CommandlineUtility.executeCommandWithOutput(
                `defaults read "${join(appFilePath, "Contents", "Info.plist")}" CFBundleIconFile`
            )
        ).trim();

        const potentialIcnsFilePath = join(appFilePath, "Contents", "Resources", relativeIcnsFilePath);

        const icnsIconFilePath = potentialIcnsFilePath.endsWith(".icns")
            ? potentialIcnsFilePath
            : `${potentialIcnsFilePath}.icns`;

        await CommandlineUtility.executeCommand(`sips -s format png "${icnsIconFilePath}" -o "${pngFilePath}"`);
    }

    private getApplicationIconFilePath(applicationFilePath: string): string {
        const hash = createHash("sha256").update(`${applicationFilePath}`).digest("hex").slice(0, 16);
        return `${join(this.getTemporaryFolderPath(), hash)}.png`;
    }

    private getTemporaryFolderPath(): string {
        return join(this.executionContext.userDataPath, this.getPluginId());
    }

    private async retrieveAllApplicationFilePaths(): Promise<string[]> {
        return (await CommandlineUtility.executeCommandWithOutput(`mdfind "kMDItemKind == 'Application'"`))
            .split("\n")
            .map((filePath) => normalize(filePath).trim())
            .filter((filePath) =>
                this.applicationFolders.some((applicationFolder) => filePath.startsWith(applicationFolder))
            )
            .filter((filePath) => [".", ".."].indexOf(filePath) === -1);
    }
}
