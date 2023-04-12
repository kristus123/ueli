import { FC } from "react";
import { SearchResultItemIcon } from "../../../Common/SearchResult/SearchResultItemIcon";
import { SearchResultItemIconType } from "../../../Common/SearchResult/SearchResultItemIconType";

type Props = {
    icon: SearchResultItemIcon;
};

export const SearchResultListItemIcon: FC<Props> = ({ icon }) => {
    const map: Record<SearchResultItemIconType, JSX.Element> = {
        FilePath: <img src={`file://${icon.icon}`} />,
        Base64Image: <></>,
        DataUrl: <img src={icon.icon} />,
        Dummy: <></>,
        Svg: (
            <div style={{ height: 36, width: 36, fill: "white" }} dangerouslySetInnerHTML={{ __html: icon.icon }}></div>
        ),
    };

    return map[icon.type];
};
