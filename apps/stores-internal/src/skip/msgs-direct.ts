import {
  ChainGetter,
  HasMapStore,
  ObservableQuery,
  QuerySharedContext,
} from "@keplr-wallet/stores";
import { MsgsDirectResponse } from "./types";
import { simpleFetch } from "@keplr-wallet/simple-fetch";
import { computed, makeObservable } from "mobx";
import { CoinPretty } from "@keplr-wallet/unit";
import Joi from "joi";
import { DenomHelper } from "@keplr-wallet/common";

const Schema = Joi.object<MsgsDirectResponse>({
  msgs: Joi.array()
    .items(
      Joi.object({
        chain_id: Joi.string().required(),
        path: Joi.array().items(Joi.string()).required(),
        msg: Joi.string().required(),
        msg_type_url: Joi.string().required(),
      }).unknown(true),
      Joi.object({
        evm_tx: Joi.object({
          chain_id: Joi.string().required(),
          data: Joi.string().required(),
          required_erc20_approvals: Joi.array().items(Joi.string()),
          signer_address: Joi.string().required(),
          to: Joi.string().required(),
          value: Joi.string().required(),
        }).unknown(true),
      }).unknown(true)
    )
    .required(),
}).unknown(true);

export class ObservableQueryMsgsDirectInner extends ObservableQuery<MsgsDirectResponse> {
  constructor(
    sharedContext: QuerySharedContext,
    protected readonly chainGetter: ChainGetter,
    skipURL: string,
    public readonly amountInDenom: string,
    public readonly amountInAmount: string,
    public readonly sourceAssetChainId: string,
    public readonly destAssetDenom: string,
    public readonly destAssetChainId: string,
    public readonly chainIdsToAddresses: Record<string, string>,
    public readonly slippageTolerancePercent: number,
    public readonly affiliateFeeBps: number,
    public readonly affiliateFeeReceiver: string,
    public readonly swapVenue: {
      readonly name: string;
      readonly chainId: string;
    }
  ) {
    super(sharedContext, skipURL, "/v2/fungible/msgs_direct");

    makeObservable(this);
  }

  @computed
  get msg():
    | {
        type: "MsgTransfer";
        receiver: string;
        sourcePort: string;
        sourceChannel: string;
        counterpartyChainId: string;
        timeoutTimestamp: number;
        token: CoinPretty;
        memo: string;
      }
    | {
        type: "MsgExecuteContract";
        funds: CoinPretty[];
        contract: string;
        msg: object;
      }
    | {
        type: "EvmTx";
        evmChainId: string;
        data: string;
        to: string;
        value: string;
      }
    | undefined {
    if (!this.response) {
      return;
    }

    if (this.response.data.msgs.length === 0) {
      return;
    }

    if (this.response.data.msgs.length >= 2) {
      return;
    }

    const msg = this.response.data.msgs[0];

    if ("evm_tx" in msg) {
      return {
        type: "EvmTx",
        evmChainId: msg.evm_tx.chain_id,
        data: msg.evm_tx.data,
        to: msg.evm_tx.to,
        value: msg.evm_tx.value,
      };
    } else {
      if (
        msg.msg_type_url !== "/ibc.applications.transfer.v1.MsgTransfer" &&
        msg.msg_type_url !== "/cosmwasm.wasm.v1.MsgExecuteContract"
      ) {
        return;
      }

      const chainMsg = JSON.parse(msg.msg);
      if (msg.msg_type_url === "/cosmwasm.wasm.v1.MsgExecuteContract") {
        return {
          type: "MsgExecuteContract",
          funds: chainMsg.funds.map(
            (fund: { denom: string; amount: string }) => {
              return new CoinPretty(
                this.chainGetter
                  .getChain(msg.chain_id)
                  .forceFindCurrency(fund.denom),
                fund.amount
              );
            }
          ),
          contract: chainMsg.contract,
          msg: chainMsg.msg,
        };
      } else if (
        msg.msg_type_url === "/ibc.applications.transfer.v1.MsgTransfer"
      ) {
        if (msg.path.length < 2) {
          return;
        }

        return {
          type: "MsgTransfer",
          receiver: chainMsg.receiver,
          sourcePort: chainMsg.source_port,
          sourceChannel: chainMsg.source_channel,
          counterpartyChainId: msg.path[1],
          timeoutTimestamp: chainMsg.timeout_timestamp,
          token: new CoinPretty(
            this.chainGetter
              .getChain(msg.chain_id)
              .forceFindCurrency(chainMsg.token.denom),
            chainMsg.token.amount
          ),
          memo: chainMsg.memo,
        };
      }

      throw new Error("Unknown error");
    }
  }

  getMsgOrThrow():
    | {
        type: "MsgTransfer";
        receiver: string;
        sourcePort: string;
        sourceChannel: string;
        timeoutTimestamp: number;
        token: CoinPretty;
        memo: string;
      }
    | {
        type: "MsgExecuteContract";
        funds: CoinPretty[];
        contract: string;
        msg: object;
      }
    | {
        type: "EvmTx";
        evmChainId: string;
        data: string;
        to: string;
        value: string;
      } {
    if (!this.response) {
      throw new Error("Response is empty");
    }

    if (this.response.data.msgs.length === 0) {
      throw new Error("Msgs is empty");
    }

    if (this.response.data.msgs.length >= 2) {
      throw new Error("Msgs is too many");
    }

    const msg = this.msg;
    if (!msg) {
      throw new Error("Can't calculate msg");
    }

    return msg;
  }

  protected override async fetchResponse(
    abortController: AbortController
  ): Promise<{ headers: any; data: MsgsDirectResponse }> {
    const sourceChainInfo = this.chainGetter.getChain(this.sourceAssetChainId);
    const isSourceChainEvmOnly =
      this.sourceAssetChainId.startsWith("eip155:") &&
      sourceChainInfo.evm != null;
    const sourceDenomHelper = new DenomHelper(this.amountInDenom);
    const destChainInfo = this.chainGetter.getChain(this.destAssetChainId);
    const isDestChainEvmOnly =
      this.destAssetChainId.startsWith("eip155:") && destChainInfo.evm != null;
    const destDenomHelper = new DenomHelper(this.destAssetDenom);

    const result = await simpleFetch<MsgsDirectResponse>(
      this.baseURL,
      this.url,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          source_asset_denom:
            sourceDenomHelper.type === "erc20"
              ? sourceDenomHelper.contractAddress
              : this.amountInDenom,
          source_asset_chain_id: isSourceChainEvmOnly
            ? this.sourceAssetChainId.replace("eip155:", "")
            : this.sourceAssetChainId,
          dest_asset_denom:
            destDenomHelper.type === "erc20"
              ? destDenomHelper.contractAddress
              : this.destAssetDenom,
          dest_asset_chain_id: isDestChainEvmOnly
            ? this.destAssetChainId.replace("eip155:", "")
            : this.destAssetChainId,
          amount_in: this.amountInAmount,
          chain_ids_to_addresses: this.chainIdsToAddresses,
          slippage_tolerance_percent: this.slippageTolerancePercent.toString(),
          affiliates:
            this.affiliateFeeBps > 0
              ? [
                  {
                    basis_points_fee: this.affiliateFeeBps.toString(),
                    address: this.affiliateFeeReceiver,
                  },
                ]
              : [],
          ...((isSourceChainEvmOnly || isDestChainEvmOnly) && {
            smart_swap_options: {
              evm_swaps: true,
            },
          }),
          ...(!isSourceChainEvmOnly &&
            !isDestChainEvmOnly &&
            this.swapVenue != null && {
              swap_venue: {
                name: this.swapVenue.name,
                chain_id: this.swapVenue.chainId,
              },
            }),
        }),
        signal: abortController.signal,
      }
    );

    const validated = Schema.validate(result.data);
    if (validated.error) {
      console.log("Failed to validate msgs direct response", validated.error);
      throw validated.error;
    }

    return {
      headers: result.headers,
      data: validated.value,
    };
  }

  protected override getCacheKey(): string {
    return `${super.getCacheKey()}-${JSON.stringify({
      amountInDenom: this.amountInDenom,
      amountInAmount: this.amountInAmount,
      sourceAssetChainId: this.sourceAssetChainId,
      destAssetDenom: this.destAssetDenom,
      destAssetChainId: this.destAssetChainId,
      chainIdsToAddresses: this.chainIdsToAddresses,
      slippageTolerancePercent: this.slippageTolerancePercent,
      affiliateFeeBps: this.affiliateFeeBps,
      affiliateFeeReceiver: this.affiliateFeeReceiver,
      swap_venue: {
        name: this.swapVenue.name,
        chain_id: this.swapVenue.chainId,
      },
    })}`;
  }
}

export class ObservableQueryMsgsDirect extends HasMapStore<ObservableQueryMsgsDirectInner> {
  constructor(
    protected readonly sharedContext: QuerySharedContext,
    protected readonly chainGetter: ChainGetter,
    protected readonly skipURL: string
  ) {
    super((str) => {
      const parsed = JSON.parse(str);
      return new ObservableQueryMsgsDirectInner(
        this.sharedContext,
        this.chainGetter,
        this.skipURL,
        parsed.amountInDenom,
        parsed.amountInAmount,
        parsed.sourceAssetChainId,
        parsed.destAssetDenom,
        parsed.destAssetChainId,
        parsed.chainIdsToAddresses,
        parsed.slippageTolerancePercent,
        parsed.affiliateFeeBps,
        parsed.affiliateFeeReceiver,
        parsed.swapVenue
      );
    });
  }

  getRoute(
    amountIn: CoinPretty,
    sourceAssetChainId: string,
    destAssetDenom: string,
    destAssetChainId: string,
    chainIdsToAddresses: Record<string, string>,
    slippageTolerancePercent: number,
    affiliateFeeBps: number,
    affiliateFeeReceiver: string,
    swapVenue: {
      readonly name: string;
      readonly chainId: string;
    }
  ): ObservableQueryMsgsDirectInner {
    const amountInCoin = amountIn.toCoin();
    const str = JSON.stringify({
      amountInDenom: amountInCoin.denom,
      amountInAmount: amountInCoin.amount,
      sourceAssetChainId,
      destAssetDenom,
      destAssetChainId,
      chainIdsToAddresses,
      slippageTolerancePercent,
      affiliateFeeBps,
      affiliateFeeReceiver,
      swapVenue,
    });
    return this.get(str);
  }
}
