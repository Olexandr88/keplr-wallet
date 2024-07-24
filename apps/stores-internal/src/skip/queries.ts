import { QuerySharedContext } from "@keplr-wallet/stores";
import { DeepReadonly } from "utility-types";
import { ObservableQueryAssetsFromSource } from "./assets-from-source";
import { ObservableQueryChains } from "./chains";
import { ObservableQueryIbcPfmTransfer } from "./ibc-pfm-transfer";
import { ObservableQueryAssets } from "./assets";
import { ObservableQueryIbcSwap } from "./ibc-swap";
import { ObservableQueryMsgsDirect } from "./msgs-direct";
import { InternalChainStore } from "../internal";
import { SwapUsageQueries } from "../swap-usage";

export class SkipQueries {
  public readonly queryChains: DeepReadonly<ObservableQueryChains>;
  public readonly queryAssets: DeepReadonly<ObservableQueryAssets>;
  public readonly queryAssetsFromSource: DeepReadonly<ObservableQueryAssetsFromSource>;
  public readonly queryMsgsDirect: DeepReadonly<ObservableQueryMsgsDirect>;

  public readonly queryIBCPacketForwardingTransfer: DeepReadonly<ObservableQueryIbcPfmTransfer>;
  public readonly queryIBCSwap: DeepReadonly<ObservableQueryIbcSwap>;

  constructor(
    sharedContext: QuerySharedContext,
    chainStore: InternalChainStore,
    swapUsageQueries: SwapUsageQueries,
    swapVenue: {
      name: string;
      chainId: string;
    }
  ) {
    this.queryChains = new ObservableQueryChains(
      sharedContext,
      chainStore,
      "https://api.skip.money"
    );
    this.queryAssets = new ObservableQueryAssets(
      sharedContext,
      chainStore,
      swapUsageQueries,
      "https://api.skip.money"
    );
    this.queryAssetsFromSource = new ObservableQueryAssetsFromSource(
      sharedContext,
      chainStore,
      "https://api.skip.money"
    );
    this.queryMsgsDirect = new ObservableQueryMsgsDirect(
      sharedContext,
      chainStore,
      "https://api.skip.money"
    );

    this.queryIBCPacketForwardingTransfer = new ObservableQueryIbcPfmTransfer(
      chainStore,
      this.queryChains,
      this.queryAssetsFromSource
    );
    this.queryIBCSwap = new ObservableQueryIbcSwap(
      chainStore,
      this.queryAssets,
      this.queryAssetsFromSource,
      this.queryChains,
      this.queryMsgsDirect,
      this.queryIBCPacketForwardingTransfer,
      swapVenue
    );
  }
}
