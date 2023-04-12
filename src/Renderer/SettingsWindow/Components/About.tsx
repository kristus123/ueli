import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from "@fluentui/react-components";
import { FC, useContext } from "react";
import { Context } from "../SettingsContext";

export const About: FC = () => {
    const { executionContext } = useContext(Context);

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHeaderCell key="application.version">Application Version</TableHeaderCell>
                    <TableHeaderCell key="application.version">Electron Version</TableHeaderCell>
                    <TableHeaderCell key="application.version">Packaged</TableHeaderCell>
                </TableRow>
            </TableHeader>
            <TableBody>
                <TableRow>
                    <TableCell>{executionContext.applicationVersion}</TableCell>
                    <TableCell>{executionContext.electronVersion}</TableCell>
                    <TableCell>{executionContext.isPackaged ? "Yes" : "No"}</TableCell>
                </TableRow>
            </TableBody>
        </Table>
    );
};
