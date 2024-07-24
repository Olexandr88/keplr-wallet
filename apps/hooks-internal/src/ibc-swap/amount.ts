import { AmountConfig, ISenderConfig, UIProperties } from "@keplr-wallet/hooks";
import { AppCurrency } from "@keplr-wallet/types";
import { CoinPretty, Dec, Int, RatePretty } from "@keplr-wallet/unit";
import {
  ChainGetter,
  CosmosAccount,
  CosmwasmAccount,
  IAccountStoreWithInjects,
  IQueriesStore,
  MakeTxResponse,
  WalletStatus,
} from "@keplr-wallet/stores";
import { useState } from "react";
import { action, makeObservable, observable, override } from "mobx";
import {
  SkipQueries,
  ObservableQueryIBCSwapInner,
} from "@keplr-wallet/stores-internal";
import { EthereumAccountStore } from "@keplr-wallet/stores-eth";

export class IBCSwapAmountConfig extends AmountConfig {
  @observable
  protected _outChainId: string;
  @observable.ref
  protected _outCurrency: AppCurrency;
  @observable
  protected _swapFeeBps: number;
  @observable
  protected _slippageTolerancePercent: number;

  constructor(
    chainGetter: ChainGetter,
    queriesStore: IQueriesStore,
    protected readonly accountStore: IAccountStoreWithInjects<
      [CosmosAccount, CosmwasmAccount]
    >,
    protected readonly ethereumAccountStore: EthereumAccountStore,
    protected readonly skipQueries: SkipQueries,
    initialChainId: string,
    senderConfig: ISenderConfig,
    initialOutChainId: string,
    initialOutCurrency: AppCurrency,
    initialSlippageTolerancePercent: number,
    swapFeeBps: number,
    protected readonly initialAffiliateFeeReceiver: string
  ) {
    super(chainGetter, queriesStore, initialChainId, senderConfig);

    this._outChainId = initialOutChainId;
    this._outCurrency = initialOutCurrency;
    this._swapFeeBps = swapFeeBps;
    this._slippageTolerancePercent = initialSlippageTolerancePercent;

    makeObservable(this);
  }

  get outAmount(): CoinPretty {
    const queryIBCSwap = this.getQueryIBCSwap();
    if (!queryIBCSwap) {
      return new CoinPretty(this.outCurrency, "0");
    }
    return queryIBCSwap.getQueryMsgsDirect().outAmount;
  }

  get outChainId(): string {
    return this._outChainId;
  }

  get outCurrency(): AppCurrency {
    return this._outCurrency;
  }

  get swapPriceImpact(): RatePretty | undefined {
    const queryIBCSwap = this.getQueryIBCSwap();
    if (!queryIBCSwap) {
      return undefined;
    }
    return queryIBCSwap.getQueryMsgsDirect().swapPriceImpact;
  }

  @action
  setOutChainId(chainId: string): void {
    this._outChainId = chainId;
  }

  @action
  setOutCurrency(currency: AppCurrency): void {
    this._outCurrency = currency;
  }

  @action
  setSwapFeeBps(swapFeeBps: number): void {
    this._swapFeeBps = swapFeeBps;
  }

  @action
  setSlippageTolerancePercent(percent: number): void {
    this._slippageTolerancePercent = percent;
  }

  get swapFeeBps(): number {
    return this._swapFeeBps;
  }

  get swapFee(): CoinPretty[] {
    const queryIBCSwap = this.getQueryIBCSwap();
    if (!queryIBCSwap) {
      return [new CoinPretty(this.outCurrency, "0")];
    }

    return queryIBCSwap.getQueryMsgsDirect().swapFee;
  }

  async fetch(): Promise<void> {
    const queryIBCSwap = this.getQueryIBCSwap();
    if (queryIBCSwap) {
      await queryIBCSwap.getQueryMsgsDirect().fetch();
    }
  }

  get isFetching(): boolean {
    const queryIBCSwap = this.getQueryIBCSwap();
    if (queryIBCSwap) {
      return queryIBCSwap.getQueryMsgsDirect().isFetching;
    }
    return false;
  }

  get type(): "swap" | "transfer" | "not-ready" {
    const queryIBCSwap = this.getQueryIBCSwap();
    if (!queryIBCSwap) {
      return "not-ready";
    }

    const res = queryIBCSwap.getQueryMsgsDirect().response;
    if (!res) {
      return "not-ready";
    }

    if (res.data.route.does_swap === false) {
      return "transfer";
    }

    return "swap";
  }

  async getTx(priorOutAmount?: Int): Promise<
    | MakeTxResponse
    | {
        chainId: number;
        to: string;
        value: string;
        data: string;
        simulate: () => Promise<{ gasUsed: number }>;
      }
  > {
    const queryIBCSwap = this.getQueryIBCSwap();
    if (!queryIBCSwap) {
      throw new Error("Query IBC Swap is not initialized");
    }

    const queryMsgsDirect = queryIBCSwap.getQueryMsgsDirect();
    if (!queryMsgsDirect.response) {
      throw new Error("Failed to fetch msgs_direct");
    }

    if (queryMsgsDirect.error) {
      throw new Error(queryMsgsDirect.error.message);
    }

    const tx = this.getTxIfReady();
    if (!tx) {
      throw new Error("Tx is not ready");
    }

    if (priorOutAmount) {
      if (!queryMsgsDirect.response) {
        throw new Error("Can't happen: queryMsgsDirect is not ready");
      }

      const currentAmountOut = new Int(
        queryMsgsDirect.response.data.route.amount_out
      );

      if (
        currentAmountOut.lt(priorOutAmount) &&
        currentAmountOut
          .sub(priorOutAmount)
          .abs()
          .toDec()
          .quo(priorOutAmount.toDec())
          .gte(new Dec(0.01))
      ) {
        throw new Error(
          "Price change has been detected while building your transaction. Please try again"
        );
      }
    }

    return tx;
  }

  getTxIfReady():
    | MakeTxResponse
    | {
        chainId: number;
        to: string;
        value: string;
        data: string;
        simulate: () => Promise<{ gasUsed: number }>;
      }
    | undefined {
    if (!this.currency) {
      return;
    }

    if (this.amount.length !== 1) {
      return;
    }

    if (this.amount[0].toDec().lte(new Dec(0))) {
      return;
    }

    const queryIBCSwap = this.getQueryIBCSwap();
    if (!queryIBCSwap) {
      return;
    }

    const queryMsgsDirect = queryIBCSwap.getQueryMsgsDirect();
    const msg = queryMsgsDirect.msg;
    if (!queryMsgsDirect.response || !msg) {
      return;
    }

    const sourceAccount = this.accountStore.getAccount(this.chainId);
    if (sourceAccount.walletStatus === WalletStatus.NotInit) {
      sourceAccount.init();
    }

    for (const swapVenue of queryIBCSwap.swapVenues) {
      const swapAccount = this.accountStore.getAccount(swapVenue.chainId);
      if (swapAccount.walletStatus === WalletStatus.NotInit) {
        swapAccount.init();
      }
    }

    const destinationChainIds = queryMsgsDirect.response.data.route.chain_ids;
    for (const destinationChainId of destinationChainIds) {
      const destinationAccount =
        this.accountStore.getAccount(destinationChainId);
      if (destinationAccount.walletStatus === WalletStatus.NotInit) {
        destinationAccount.init();
      }
    }

    if (msg.type === "MsgTransfer") {
      const tx = sourceAccount.cosmos.makeIBCTransferTx(
        {
          portId: msg.sourcePort,
          channelId: msg.sourceChannel,
          counterpartyChainId: msg.counterpartyChainId,
        },
        this.amount[0].toDec().toString(),
        this.amount[0].currency,
        msg.receiver,
        msg.memo
      );
      tx.ui.overrideType("ibc-swap");
      return tx;
    } else if (msg.type === "MsgExecuteContract") {
      const tx = sourceAccount.cosmwasm.makeExecuteContractTx(
        "unknown",
        msg.contract,
        msg.msg,
        msg.funds.map((fund) => fund.toCoin())
      );
      tx.ui.overrideType("ibc-swap");
      return tx;
    } else if (msg.type === "EvmTx") {
      const evmTx = {
        chainId: parseInt(msg.evmChainId, 10),
        to: msg.to,
        value: `0x${BigInt(msg.value).toString(16)}`,
        data: `0x${msg.data}`,
      };

      return {
        ...evmTx,
        simulate: () =>
          this.ethereumAccountStore
            .getAccount(this.chainId)
            .simulateGas(sourceAccount.ethereumHexAddress, evmTx),
      };
    }
  }

  // /route query의 결과와 /msgs_direct query의 결과를 비교하기 위한 키를 생성한다.
  // createSwapRouteKeyFromRouteResponse(response: RouteResponse): string {
  //   let key = "";

  //   for (const operation of response.operations) {
  //     if ("swap" in operation) {
  //       for (const swapOperation of operation.swap.swap_in.swap_operations) {
  //         key += `/${swapOperation.pool}/${swapOperation.denom_in}/${swapOperation.denom_out}`;
  //       }
  //     }
  //   }

  //   return key;
  // }

  // /route query의 결과와 /msgs_direct query의 결과를 비교하기 위한 키를 생성한다.
  // createSwapRouteKeyFromMsgsDirectResponse(
  //   response: MsgsDirectResponse
  // ): string {
  //   let key = "";

  //   for (const msg of response.msgs) {
  //     if ("evm_tx" in msg) {
  //       // TODO
  //     } else {
  //       if (
  //         msg.multi_chain_msg.msg_type_url ===
  //         "/ibc.applications.transfer.v1.MsgTransfer"
  //       ) {
  //         const memo = JSON.parse(msg.multi_chain_msg.msg).memo;
  //         if (memo) {
  //           const obj = JSON.parse(memo);
  //           const wasms: any = [];

  //           if (obj.wasm) {
  //             wasms.push(obj.wasm);
  //           }

  //           let forward = obj.forward;
  //           if (forward) {
  //             while (true) {
  //               if (forward) {
  //                 if (forward.memo) {
  //                   const obj = JSON.parse(forward.memo);
  //                   if (obj.wasm) {
  //                     wasms.push(obj.wasm);
  //                   }
  //                 }

  //                 if (forward.wasm) {
  //                   wasms.push(forward.wasm);
  //                 }

  //                 if (forward.next) {
  //                   const obj =
  //                     typeof forward.next === "string"
  //                       ? JSON.parse(forward.next)
  //                       : forward.next;

  //                   if (obj.forward) {
  //                     forward = obj.forward;
  //                   } else {
  //                     forward = obj;
  //                   }
  //                 } else {
  //                   break;
  //                 }
  //               } else {
  //                 break;
  //               }
  //             }
  //           }

  //           for (const wasm of wasms) {
  //             for (const operation of wasm.msg.swap_and_action.user_swap
  //               .swap_exact_asset_in.operations) {
  //               key += `/${operation.pool}/${operation.denom_in}/${operation.denom_out}`;
  //             }
  //           }
  //         }
  //       }
  //       if (
  //         msg.multi_chain_msg.msg_type_url ===
  //         "/cosmwasm.wasm.v1.MsgExecuteContract"
  //       ) {
  //         const obj = JSON.parse(msg.multi_chain_msg.msg);
  //         for (const operation of obj.msg.swap_and_action.user_swap
  //           .swap_exact_asset_in.operations) {
  //           key += `/${operation.pool}/${operation.denom_in}/${operation.denom_out}`;
  //         }
  //       }
  //     }
  //   }

  //   return key;
  // }

  @override
  override get uiProperties(): UIProperties {
    const prev = super.uiProperties;
    if (prev.error || prev.loadingState) {
      return prev;
    }

    const queryIBCSwap = this.getQueryIBCSwap();
    if (!queryIBCSwap) {
      return {
        ...prev,
        error: new Error("Query IBC Swap is not initialized"),
      };
    }

    if (queryIBCSwap.getQueryMsgsDirect().isFetching) {
      return {
        ...prev,
        loadingState: "loading-block",
      };
    }

    const routeError = queryIBCSwap.getQueryMsgsDirect().error;
    if (routeError) {
      return {
        ...prev,
        error: new Error(routeError.message),
      };
    }

    if (
      this.amount.length > 0 &&
      this.amount[0].currency.coinMinimalDenom ===
        this.outAmount.currency.coinMinimalDenom &&
      this.chainGetter.getChain(this.chainId).chainIdentifier ===
        this.chainGetter.getChain(this.outChainId).chainIdentifier
    ) {
      return {
        ...prev,
        error: new Error("In and out currency is same"),
      };
    }

    if (this.amount.length > 0) {
      if (
        !this.skipQueries.queryIBCSwap.isSwappableCurrency(
          this.chainId,
          this.amount[0].currency
        )
      ) {
        return {
          ...prev,
          error: new Error(
            "The currency you are swapping from is currently not supported"
          ),
        };
      }
    }

    if (
      !this.skipQueries.queryIBCSwap.isSwapDestinationOrAlternatives(
        this.outChainId,
        this.outAmount.currency
      )
    ) {
      return {
        ...prev,
        error: new Error(
          "The currency you are swapping to is currently not supported"
        ),
      };
    }

    if (
      queryIBCSwap.getQueryMsgsDirect().response?.data.route.txs_required !== 1
    ) {
      return {
        ...prev,
        error: new Error("Swap can't be executed with ibc pfm"),
      };
    }

    return {
      ...prev,
    };
  }

  getQueryIBCSwap(): ObservableQueryIBCSwapInner | undefined {
    if (this.amount.length === 0) {
      return;
    }
    const initialChainIdsToAddresses: Record<string, string> = {};

    const sourceAccount = this.accountStore.getAccount(this.chainId);
    const isSourceChainEVMOnly =
      this.chainId.startsWith("eip155:") && this.chainInfo.evm != null;
    initialChainIdsToAddresses[
      isSourceChainEVMOnly ? this.chainId.replace("eip155:", "") : this.chainId
    ] = isSourceChainEVMOnly
      ? sourceAccount.ethereumHexAddress
      : sourceAccount.bech32Address;

    for (const swapVenue of this.skipQueries.queryIBCSwap.swapVenues) {
      const swapAccount = this.accountStore.getAccount(swapVenue.chainId);

      const isSwapChainEVMOnly = !isNaN(parseInt(swapVenue.chainId, 10));
      initialChainIdsToAddresses[swapVenue.chainId] = isSwapChainEVMOnly
        ? swapAccount.ethereumHexAddress
        : swapAccount.bech32Address;
    }

    const destinationAccount = this.accountStore.getAccount(this.outChainId);
    const isDestChainEvmOnly = !isNaN(parseInt(this.outChainId, 10));
    initialChainIdsToAddresses[this.outChainId] = isDestChainEvmOnly
      ? destinationAccount.ethereumHexAddress
      : destinationAccount.bech32Address;

    return this.skipQueries.queryIBCSwap.getIBCSwap(
      this.chainId,
      this.amount[0],
      this.outChainId,
      this.outCurrency.coinMinimalDenom,
      initialChainIdsToAddresses,
      this._slippageTolerancePercent,
      this.swapFeeBps,
      this.initialAffiliateFeeReceiver
    );
  }
}

export const useIBCSwapAmountConfig = (
  chainGetter: ChainGetter,
  queriesStore: IQueriesStore,
  accountStore: IAccountStoreWithInjects<[CosmosAccount, CosmwasmAccount]>,
  ethereumAccountStore: EthereumAccountStore,
  skipQueries: SkipQueries,
  chainId: string,
  senderConfig: ISenderConfig,
  outChainId: string,
  outCurrency: AppCurrency,
  initialSlippageTolerancePercent: number,
  swapFeeBps: number,
  initialAffiliateFeeReceiver: string
) => {
  const [txConfig] = useState(
    () =>
      new IBCSwapAmountConfig(
        chainGetter,
        queriesStore,
        accountStore,
        ethereumAccountStore,
        skipQueries,
        chainId,
        senderConfig,
        outChainId,
        outCurrency,
        initialSlippageTolerancePercent,
        swapFeeBps,
        initialAffiliateFeeReceiver
      )
  );
  txConfig.setChain(chainId);
  txConfig.setOutChainId(outChainId);
  txConfig.setOutCurrency(outCurrency);
  txConfig.setSwapFeeBps(swapFeeBps);
  txConfig.setSlippageTolerancePercent(initialSlippageTolerancePercent);

  return txConfig;
};
