import { IMock, Mock, Times } from "moq.ts";
import { join } from "path";
import { Logger } from "../../Common/Logger/Logger";
import { SearchResultItemDummy } from "../../Common/SearchResult/SearchResultItemDummy";
import { Settings } from "../../Common/Settings";
import { SearchPlugin } from "../Plugins/SearchPlugin";
import { FileSystemUtility } from "../Utility/FileSystemUtility";
import { DummySearchable } from "./DummySearchable";
import { Searchable } from "./Searchable";
import { SearchEngine } from "./SearchEngine";

describe(SearchEngine, () => {
    let logger: IMock<Logger>;
    let searchPlugin: IMock<SearchPlugin>;

    const tempFolderPath = join(__dirname, "temp");

    const searchEngineSettings: Settings = <Settings>{
        "searchEngine.automaticRescanEnabled": false,
        "searchEngine.automaticRescanIntervalInSeconds": 0,
        "searchEngine.threshold": 0.4,
    };

    const searchables: Searchable[] = [
        new DummySearchable(SearchResultItemDummy.withName("Search Result Item 1")),
        new DummySearchable(SearchResultItemDummy.withName("Search Result Item 2")),
        new DummySearchable(SearchResultItemDummy.withName("Search Result Item 3")),
        new DummySearchable(SearchResultItemDummy.withName("Search Result Item 4")),
    ];

    const setUpLoggerMock = (): IMock<Logger> =>
        new Mock<Logger>()
            .setup((instance) => instance.debug("Debug"))
            .returns()
            .setup((instance) => instance.info("Info"))
            .returns()
            .setup((instance) => instance.warning("Warning"))
            .returns()
            .setup((instance) => instance.error("Error"))
            .returns();

    const setUpSearchPluginMock = (): IMock<SearchPlugin> =>
        new Mock<SearchPlugin>()
            .setup((instance) => instance.getAllSearchables())
            .returns(searchables)
            .setup((instance) => instance.rescan())
            .returns(Promise.resolve());

    const verifyLoggerLoggedInfo = (message: string, times?: Times) =>
        logger.verify((instance) => instance.info(message), times);

    beforeEach(async () => {
        await FileSystemUtility.createFolderIfDoesntExist(tempFolderPath);
        logger = setUpLoggerMock();
        searchPlugin = setUpSearchPluginMock();
    });

    afterEach(async () => await FileSystemUtility.deleteFolderRecursively(tempFolderPath));

    describe(SearchEngine.prototype.search, () => {
        it("should return an empty array if the search term is an empty string", async () => {
            const searchEngine = new SearchEngine(searchEngineSettings, [searchPlugin.object()], logger.object());

            await searchEngine.rescan();
            const actual = searchEngine.search("");

            expect(actual.length).toBe(0);
            verifyLoggerLoggedInfo("Staring rescan", Times.Never());
        });

        it("should return all items that match the search term", async () => {
            const searchEngine = new SearchEngine(searchEngineSettings, [searchPlugin.object()], logger.object());

            await searchEngine.rescan();
            const actual = searchEngine.search("Search Result Item");

            expect(actual).toEqual(searchables.map((searchable) => searchable.toSearchResultItem()));
            verifyLoggerLoggedInfo("Starting rescan", Times.Once());
        });

        it("should be case insensitive", async () => {
            const searchEngine = new SearchEngine(searchEngineSettings, [searchPlugin.object()], logger.object());

            await searchEngine.rescan();
            const actual = searchEngine.search("search result item");

            expect(actual).toEqual(searchables.map((searchable) => searchable.toSearchResultItem()));
            verifyLoggerLoggedInfo("Starting rescan", Times.Once());
        });

        it("should return an empty array if the search term does not match any of the items", async () => {
            const searchEngine = new SearchEngine(searchEngineSettings, [searchPlugin.object()], logger.object());

            await searchEngine.rescan();
            const actual = searchEngine.search("whatever");

            expect(actual).toEqual([]);
            verifyLoggerLoggedInfo("Starting rescan", Times.Once());
        });

        it("should support fuzzy search if threshold is high enough", async () => {
            const searchEngine = new SearchEngine(
                <Settings>{
                    "searchEngine.threshold": 0.6,
                    "searchEngine.automaticRescanIntervalInSeconds": 0,
                    "searchEngine.automaticRescanEnabled": false,
                },
                [searchPlugin.object()],
                logger.object()
            );

            await searchEngine.rescan();
            const actual = searchEngine.search("srch rslt");

            expect(actual).toEqual(searchables.map((searchable) => searchable.toSearchResultItem()));
            verifyLoggerLoggedInfo("Starting rescan", Times.Once());
        });

        it("should not supporty fuzzy search if threshold is 0", async () => {
            const searchEngine = new SearchEngine(
                <Settings>{
                    "searchEngine.threshold": 0,
                    "searchEngine.automaticRescanIntervalInSeconds": 0,
                    "searchEngine.automaticRescanEnabled": false,
                },
                [searchPlugin.object()],
                logger.object()
            );

            await searchEngine.rescan();
            const actual = searchEngine.search("srch rslt");

            expect(actual).toEqual([]);
            verifyLoggerLoggedInfo("Starting rescan", Times.Once());
        });
    });
});
