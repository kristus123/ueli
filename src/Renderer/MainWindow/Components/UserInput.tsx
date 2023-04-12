import { Input, Spinner } from "@fluentui/react-components";
import { FC, KeyboardEvent, useRef, useState } from "react";
import { IpcChannel } from "../../../Common/IpcChannel";
import { NavigationDirection } from "../SearchResultListUtility";

const navigationDirectionMap: Record<"ArrowUp" | "ArrowDown", NavigationDirection> = {
    ArrowDown: NavigationDirection.Next,
    ArrowUp: NavigationDirection.Previous,
};

type Props = {
    onSearchTermChanged: (searchTerm: string) => void;
    onNavigate: (direction: NavigationDirection) => void;
    onEnterPressed: (ctrlOrMetaKeyPressed: boolean) => void;
};

export const UserInput: FC<Props> = ({ onSearchTermChanged, onNavigate, onEnterPressed }) => {
    const userInputRef = useRef<HTMLInputElement>(null);
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [rescanIsRunning, setRescanIsRunning] = useState<boolean>(false);

    const onSearchTermChange = (updatedSearchTerm: string): void => {
        setSearchTerm(updatedSearchTerm);
        onSearchTermChanged(updatedSearchTerm ?? "");
    };

    const onKeyDown = async (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            onNavigate(navigationDirectionMap[event.key]);
        } else if (event.key === "Enter") {
            onEnterPressed(event.ctrlKey || event.metaKey);
        }
    };

    window.Bridge.ipcRenderer.on(IpcChannel.MainWindowShown, () => {
        userInputRef?.current?.focus();
        userInputRef?.current?.select();
    });

    window.Bridge.ipcRenderer.on(IpcChannel.RescanStarted, () => setRescanIsRunning(true));
    window.Bridge.ipcRenderer.on(IpcChannel.RescanFinished, () => setRescanIsRunning(false));

    return (
        <div style={{ position: "relative" }}>
            <Input
                ref={userInputRef}
                appearance="underline"
                size="large"
                value={searchTerm}
                onChange={(_, { value }) => onSearchTermChange(value)}
                onKeyDown={onKeyDown}
                style={{ width: "100%" }}
            />
            <div style={{ position: "absolute", top: 9, right: 8, display: rescanIsRunning ? "block" : "none" }}>
                <Spinner size="tiny" />
            </div>
        </div>
    );
};
