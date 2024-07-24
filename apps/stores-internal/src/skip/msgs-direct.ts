import {
  ChainGetter,
  HasMapStore,
  ObservableQuery,
  QuerySharedContext,
} from "@keplr-wallet/stores";
import { MsgsDirectResponse } from "./types";
import { simpleFetch } from "@keplr-wallet/simple-fetch";
import { computed, makeObservable } from "mobx";
import { CoinPretty, Dec, RatePretty } from "@keplr-wallet/unit";
import Joi from "joi";
import { DenomHelper } from "@keplr-wallet/common";

const Schema = Joi.object<MsgsDirectResponse>({
  route: Joi.object({
    source_asset_denom: Joi.string().required(),
    source_asset_chain_id: Joi.string().required(),
    dest_asset_denom: Joi.string().required(),
    dest_asset_chain_id: Joi.string().required(),
    amount_in: Joi.string().required(),
    amount_out: Joi.string().required(),
    operations: Joi.array()
      .items(
        Joi.object({
          swap: Joi.object({
            swap_in: Joi.object({
              swap_venue: Joi.object({
                name: Joi.string().required(),
                chain_id: Joi.string().required(),
              })
                .unknown(true)
                .required(),
              swap_operations: Joi.array()
                .items(
                  Joi.object({
                    pool: Joi.string().required(),
                    denom_in: Joi.string().required(),
                    denom_out: Joi.string().required(),
                  }).unknown(true)
                )
                .required(),
              swap_amount_in: Joi.string().required(),
              price_impact_percent: Joi.string(),
            }).unknown(true),
            estimated_affiliate_fee: Joi.string().required(),
          })
            .required()
            .unknown(true),
        }).unknown(true),
        Joi.object({
          transfer: Joi.object({
            port: Joi.string().required(),
            channel: Joi.string().required(),
            chain_id: Joi.string().required(),
            pfm_enabled: Joi.boolean(),
            dest_denom: Joi.string().required(),
            supports_memo: Joi.boolean(),
          })
            .required()
            .unknown(true),
        }).unknown(true),
        Joi.object({
          axelar_transfer: Joi.object({
            asset: Joi.string(),
            bridge_id: Joi.string(),
            denom_in: Joi.string(),
            denom_out: Joi.string(),
            from_chain: Joi.string(),
            from_chain_id: Joi.string(),
            to_chain: Joi.string(),
            to_chain_id: Joi.string(),
            fee_amount: Joi.string(),
            fee_asset: Joi.object({
              chain_id: Joi.string(),
              denom: Joi.string(),
              decimals: Joi.number(),
              symbol: Joi.string(),
            }).unknown(true),
          })
            .required()
            .unknown(true),
        }).unknown(true),
        Joi.object({
          evm_swap: Joi.object({
            amount_in: Joi.string(),
            amount_out: Joi.string(),
            denom_in: Joi.string(),
            denom_out: Joi.string(),
            from_chain_id: Joi.string(),
          })
            .required()
            .unknown(true),
        }).unknown(true),
        Joi.object({
          cctp_transfer: Joi.object({
            bridge_id: Joi.string().required(),
            denom_in: Joi.string().required(),
            denom_out: Joi.string().required(),
            from_chain_id: Joi.string().required(),
            to_chain_id: Joi.string().required(),
          })
            .required()
            .unknown(true),
        }).unknown(true)
      )
      .required(),
    chain_ids: Joi.array().items(Joi.string()).required(),
    does_swap: Joi.boolean(),
    estimated_amount_out: Joi.string(),
    swap_venue: Joi.object({
      name: Joi.string().required(),
      chain_id: Joi.string().required(),
    }).unknown(true),
    swap_price_impact_percent: Joi.string(),
    txs_required: Joi.number().required(),
  }).unknown(true),
  msgs: Joi.array()
    .items(
      Joi.object({
        multi_chain_msg: Joi.object({
          chain_id: Joi.string().required(),
          path: Joi.array().items(Joi.string()).required(),
          msg: Joi.string().required(),
          msg_type_url: Joi.string().required(),
        }).unknown(true),
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
    public readonly affiliateFeeBps?: number,
    public readonly affiliateFeeReceiver?: string,
    public readonly swapVenue?: {
      readonly name: string;
      readonly chainId: string;
    }
  ) {
    super(sharedContext, skipURL, "/v2/fungible/msgs_direct");

    makeObservable(this);
  }

  protected override canFetch(): boolean {
    if (!this.amountInAmount || this.amountInAmount === "0") {
      return false;
    }
    return super.canFetch();
  }

  @computed
  get outAmount(): CoinPretty {
    if (!this.response) {
      return new CoinPretty(
        this.chainGetter
          .getChain(this.destAssetChainId)
          .forceFindCurrency(this.destAssetDenom),
        "0"
      );
    }

    return new CoinPretty(
      this.chainGetter
        .getChain(this.destAssetChainId)
        .forceFindCurrency(this.destAssetDenom),
      this.response.data.route.amount_out
    );
  }

  @computed
  get swapFee(): CoinPretty[] {
    if (!this.response) {
      return [
        new CoinPretty(
          this.chainGetter
            .getChain(this.destAssetChainId)
            .forceFindCurrency(this.destAssetDenom),
          "0"
        ),
      ];
    }

    const estimatedAffiliateFees: {
      fee: string;
      venueChainId: string;
    }[] = [];
    for (const operation of this.response.data.route.operations) {
      if ("swap" in operation) {
        estimatedAffiliateFees.push({
          fee: operation.swap.estimated_affiliate_fee,
          // QUESTION: swap_out이 생기면...?
          venueChainId: operation.swap.swap_in.swap_venue.chain_id,
        });
      }
    }

    return estimatedAffiliateFees.map(({ fee, venueChainId }) => {
      const split = fee.split(/^([0-9]+)(\s)*([a-zA-Z][a-zA-Z0-9/-]*)$/);

      if (split.length !== 5) {
        throw new Error(`Invalid fee format: ${fee}`);
      }

      const amount = split[1];
      const denom = split[3];

      return new CoinPretty(
        this.chainGetter.getChain(venueChainId).forceFindCurrency(denom),
        amount
      );
    });
  }

  @computed
  get swapPriceImpact(): RatePretty | undefined {
    if (!this.response || !this.response.data.route.swap_price_impact_percent) {
      return undefined;
    }

    return new RatePretty(
      new Dec(this.response.data.route.swap_price_impact_percent).quoTruncate(
        new Dec(100)
      )
    );
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
        msg.multi_chain_msg.msg_type_url !==
          "/ibc.applications.transfer.v1.MsgTransfer" &&
        msg.multi_chain_msg.msg_type_url !==
          "/cosmwasm.wasm.v1.MsgExecuteContract"
      ) {
        return;
      }

      const chainMsg = JSON.parse(msg.multi_chain_msg.msg);
      if (
        msg.multi_chain_msg.msg_type_url ===
        "/cosmwasm.wasm.v1.MsgExecuteContract"
      ) {
        return {
          type: "MsgExecuteContract",
          funds: chainMsg.funds.map(
            (fund: { denom: string; amount: string }) => {
              return new CoinPretty(
                this.chainGetter
                  .getChain(msg.multi_chain_msg.chain_id)
                  .forceFindCurrency(fund.denom),
                fund.amount
              );
            }
          ),
          contract: chainMsg.contract,
          msg: chainMsg.msg,
        };
      } else if (
        msg.multi_chain_msg.msg_type_url ===
        "/ibc.applications.transfer.v1.MsgTransfer"
      ) {
        if (msg.multi_chain_msg.path.length < 2) {
          return;
        }

        return {
          type: "MsgTransfer",
          receiver: chainMsg.receiver,
          sourcePort: chainMsg.source_port,
          sourceChannel: chainMsg.source_channel,
          counterpartyChainId: msg.multi_chain_msg.path[1],
          timeoutTimestamp: chainMsg.timeout_timestamp,
          token: new CoinPretty(
            this.chainGetter
              .getChain(msg.multi_chain_msg.chain_id)
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
            this.affiliateFeeBps && this.affiliateFeeBps > 0
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
      swap_venue: this.swapVenue && {
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
    affiliateFeeBps?: number,
    affiliateFeeReceiver?: string,
    swapVenue?: {
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
