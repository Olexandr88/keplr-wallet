import React, { ErrorInfo, FunctionComponent } from "react";
import { MsgHistory } from "../types";
import { MsgRelationSend } from "./send";
import { MsgRelationReceive } from "./receive";
import { MsgRelationDelegate } from "./delegate";
import { MsgRelationUndelegate } from "./undelegate";
import { MsgRelationMergedClaimRewards } from "./merged-claim-rewards";
import { MsgRelationIBCSend } from "./ibc-send";
import { MsgRelationIBCSendRefunded } from "./ibc-send-refunded";
import { MsgRelationIBCSendReceive } from "./ibc-send-receive";
import { MsgRelationVote } from "./vote";
import { MsgRelationIBCSwap } from "./ibc-swap";
import { MsgRelationIBCSwapReceive } from "./ibc-swap-receive";
import { Box } from "../../../../components/box";
import { ColorPalette } from "../../../../styles";
import { XAxis, YAxis } from "../../../../components/axis";
import { Subtitle3 } from "../../../../components/typography";
import { useTheme } from "styled-components";
import { MsgRelationRedelegate } from "./redelegate";
import { MsgRelationCancelUndelegate } from "./cancel-undelegate";
import { MsgRelationIBCSwapRefunded } from "./ibc-swap-refunded";

export const MsgItemRender: FunctionComponent<{
  msg: MsgHistory;
  prices?: Record<string, Record<string, number | undefined> | undefined>;
  targetDenom: string;
}> = ({ msg, prices, targetDenom }) => {
  return (
    <ErrorBoundary>
      <MsgItemRenderInner msg={msg} prices={prices} targetDenom={targetDenom} />
    </ErrorBoundary>
  );
};

const MsgItemRenderInner: FunctionComponent<{
  msg: MsgHistory;
  prices?: Record<string, Record<string, number | undefined> | undefined>;
  targetDenom: string;
}> = ({ msg, prices, targetDenom }) => {
  switch (msg.relation) {
    case "send": {
      return (
        <MsgRelationSend msg={msg} prices={prices} targetDenom={targetDenom} />
      );
    }
    case "receive": {
      return (
        <MsgRelationReceive
          msg={msg}
          prices={prices}
          targetDenom={targetDenom}
        />
      );
    }
    case "ibc-send": {
      return (
        <MsgRelationIBCSend
          msg={msg}
          prices={prices}
          targetDenom={targetDenom}
        />
      );
    }
    case "ibc-send-receive": {
      return (
        <MsgRelationIBCSendReceive
          msg={msg}
          prices={prices}
          targetDenom={targetDenom}
        />
      );
    }
    case "ibc-send-refunded": {
      return (
        <MsgRelationIBCSendRefunded
          msg={msg}
          prices={prices}
          targetDenom={targetDenom}
        />
      );
    }
    case "ibc-swap-skip-osmosis": {
      return (
        <MsgRelationIBCSwap
          msg={msg}
          prices={prices}
          targetDenom={targetDenom}
        />
      );
    }
    case "ibc-swap-skip-osmosis-receive": {
      return (
        <MsgRelationIBCSwapReceive
          msg={msg}
          prices={prices}
          targetDenom={targetDenom}
        />
      );
    }
    case "ibc-swap-skip-osmosis-refunded": {
      return (
        <MsgRelationIBCSwapRefunded
          msg={msg}
          prices={prices}
          targetDenom={targetDenom}
        />
      );
    }
    case "delegate": {
      return (
        <MsgRelationDelegate
          msg={msg}
          prices={prices}
          targetDenom={targetDenom}
        />
      );
    }
    case "undelegate": {
      return (
        <MsgRelationUndelegate
          msg={msg}
          prices={prices}
          targetDenom={targetDenom}
        />
      );
    }
    case "redelegate": {
      return (
        <MsgRelationRedelegate
          msg={msg}
          prices={prices}
          targetDenom={targetDenom}
        />
      );
    }
    case "cancel-undelegate": {
      return (
        <MsgRelationCancelUndelegate
          msg={msg}
          prices={prices}
          targetDenom={targetDenom}
        />
      );
    }
    case "vote": {
      return (
        <MsgRelationVote msg={msg} prices={prices} targetDenom={targetDenom} />
      );
    }
    case "custom/merged-claim-rewards": {
      return (
        <MsgRelationMergedClaimRewards
          msg={msg}
          prices={prices}
          targetDenom={targetDenom}
        />
      );
    }
  }

  // 임시적인 alternative임.
  // 여기까지 도달하면 먼가 잘못된거임.
  return <UnknownMsgItem title="Unknown message" />;
};

const UnknownMsgItem: FunctionComponent<{
  title: string;
}> = ({ title }) => {
  const theme = useTheme();

  return (
    <Box
      backgroundColor={
        theme.mode === "light"
          ? ColorPalette["white"]
          : ColorPalette["gray-600"]
      }
      style={{
        boxShadow:
          theme.mode === "light" ? "0 1px 4px 0 rgba(43,39,55,0.1)" : undefined,
      }}
      borderRadius="0.375rem"
      paddingX="1rem"
      paddingY="0.875rem"
      minHeight="4rem"
      alignY="center"
    >
      <XAxis alignY="center">
        <Box marginRight="0.75rem">
          <XAxis alignY="center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              fill="none"
              viewBox="0 0 20 20"
            >
              <path
                fill={ColorPalette["red-400"]}
                d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
              />
            </svg>
          </XAxis>
        </Box>
        <div
          style={{
            flex: 1,
            minWidth: "0.75rem",
          }}
        >
          <XAxis alignY="center">
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
            </YAxis>

            <div
              style={{
                flex: 1,
              }}
            />
          </XAxis>
        </div>
      </XAxis>
    </Box>
  );
};

class ErrorBoundary extends React.Component<
  unknown,
  {
    hasError: boolean;
  }
> {
  constructor(props: unknown) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.log(error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      return <UnknownMsgItem title="Unknown error occured" />;
    }

    return this.props.children;
  }
}