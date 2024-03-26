import React, { FunctionComponent } from "react";
import { Box } from "../../../../components/box";
import { ColorPalette } from "../../../../styles";

export const ItemLogo: FunctionComponent<{
  center: React.ReactElement;
  deco?: React.ReactElement;
  backgroundColor?: string;
}> = ({ center, deco, backgroundColor }) => {
  return (
    <Box
      position="relative"
      width="2rem"
      height="2rem"
      backgroundColor={backgroundColor || ColorPalette["gray-500"]}
      borderRadius="999999px"
      alignX="center"
      alignY="center"
    >
      <div
        style={{
          color: ColorPalette["gray-200"],
        }}
      >
        {center}
      </div>
      {deco ? (
        <div
          style={{
            position: "absolute",
            bottom: "-0.125rem",
            right: "-0.125rem",

            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {deco}
        </div>
      ) : null}
    </Box>
  );
};