import React, { FunctionComponent, useMemo } from "react";
import { Box } from "../../../../components/box";
import { ColorPalette } from "../../../../styles";
import { XAxis, YAxis } from "../../../../components/axis";
import { Body3, Subtitle3 } from "../../../../components/typography";
import { Gutter } from "../../../../components/gutter";
import { observer } from "mobx-react-lite";
import { useStore } from "../../../../stores";
import { CoinPretty, Dec, PricePretty } from "@keplr-wallet/unit";
import { MsgHistory } from "../types";
import { useTheme } from "styled-components";

export const MsgItemBase: FunctionComponent<{
  logo: React.ReactElement;
  chainId: string;
  title: string;
  paragraph?: string;
  paragraphStyle?: React.CSSProperties;
  amount: CoinPretty | string;
  overrideAmountColor?: string;
  prices: Record<string, Record<string, number | undefined> | undefined>;
  msg: MsgHistory;
  targetDenom: string;
  amountDeco?: {
    prefix: "none" | "plus" | "minus";
    color: "none" | "green";
  };
}> = observer(
  ({
    logo,
    chainId,
    title,
    paragraph,
    paragraphStyle,
    amount,
    overrideAmountColor,
    prices,
    msg,
    targetDenom,
    amountDeco,
  }) => {
    const { chainStore, priceStore } = useStore();

    const theme = useTheme();

    const chainInfo = chainStore.getChain(chainId);

    // mobx와 useMemo의 조합 문제로... 값 몇개를 밖으로 뺀다.
    const foundCurrency = chainInfo.findCurrency(targetDenom);
    const defaultVsCurrency = priceStore.defaultVsCurrency;
    const sendAmountPricePretty = useMemo(() => {
      if (typeof amount === "string") {
        return undefined;
      }

      if (foundCurrency && foundCurrency.coinGeckoId) {
        const price = prices[foundCurrency.coinGeckoId];
        if (price != null && price[defaultVsCurrency] != null) {
          const dec = amount.toDec();
          const priceDec = new Dec(price[defaultVsCurrency]!.toString());
          const fiatCurrency = priceStore.getFiatCurrency(defaultVsCurrency);
          if (fiatCurrency) {
            return new PricePretty(fiatCurrency, dec.mul(priceDec));
          }
        }
      }
      return;
    }, [defaultVsCurrency, foundCurrency, priceStore, prices, amount]);

    return (
      <Box
        backgroundColor={
          theme.mode === "light"
            ? ColorPalette["white"]
            : ColorPalette["gray-600"]
        }
        style={{
          boxShadow:
            theme.mode === "light"
              ? "0 1px 4px 0 rgba(43,39,55,0.1)"
              : undefined,
        }}
        borderRadius="0.375rem"
        paddingX="1rem"
        paddingY="0.875rem"
        minHeight="4rem"
        alignY="center"
      >
        <XAxis alignY="center">
          <Box marginRight="0.75rem">
            <XAxis alignY="center">{logo}</XAxis>
          </Box>
          <div
            style={{
              flex: 1,
              minWidth: "0.75rem",
            }}
          >
            <XAxis alignY="center">
              <Box style={{ overflow: "hidden" }}>
                <YAxis>
                  <Subtitle3
                    color={
                      theme.mode === "light"
                        ? ColorPalette["black"]
                        : ColorPalette["gray-10"]
                    }
                  >
                    {title}
                  </Subtitle3>
                  {paragraph ? (
                    <React.Fragment>
                      <Gutter size="0.25rem" />
                      <Body3
                        color={ColorPalette["gray-300"]}
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          ...paragraphStyle,
                        }}
                      >
                        {paragraph}
                      </Body3>
                    </React.Fragment>
                  ) : null}
                </YAxis>
              </Box>

              <div
                style={{
                  flex: 1,
                }}
              />
              <YAxis alignX="right">
                {(() => {
                  if (msg.code !== 0) {
                    return (
                      <Subtitle3 color={ColorPalette["yellow-400"]}>
                        Failed
                      </Subtitle3>
                    );
                  }

                  return (
                    <React.Fragment>
                      <Subtitle3
                        color={(() => {
                          if (!amountDeco) {
                            return theme.mode === "light"
                              ? ColorPalette["black"]
                              : ColorPalette["white"];
                          }

                          if (amountDeco.color === "green") {
                            return theme.mode === "light"
                              ? ColorPalette["green-500"]
                              : ColorPalette["green-400"];
                          }
                        })()}
                        style={{
                          whiteSpace: "nowrap",
                          color: overrideAmountColor,
                        }}
                      >
                        {(() => {
                          if (!amountDeco) {
                            return "";
                          }

                          if (amountDeco.prefix === "plus") {
                            return "+";
                          }

                          if (amountDeco.prefix === "minus") {
                            return "-";
                          }

                          return "";
                        })()}
                        {typeof amount === "string"
                          ? amount
                          : amount
                              .maxDecimals(2)
                              .shrink(true)
                              .hideIBCMetadata(true)
                              .inequalitySymbol(true)
                              .inequalitySymbolSeparator("")
                              .toString()}
                      </Subtitle3>
                      {sendAmountPricePretty ? (
                        <React.Fragment>
                          <Gutter size="0.25rem" />
                          <Body3
                            color={ColorPalette["gray-300"]}
                            style={{
                              whiteSpace: "nowrap",
                            }}
                          >
                            {sendAmountPricePretty.toString()}
                          </Body3>
                        </React.Fragment>
                      ) : null}
                    </React.Fragment>
                  );
                })()}
              </YAxis>
            </XAxis>
          </div>
        </XAxis>
      </Box>
    );
  }
);