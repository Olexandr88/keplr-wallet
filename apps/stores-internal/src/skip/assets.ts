import {
  HasMapStore,
  ObservableQuery,
  QuerySharedContext,
} from "@keplr-wallet/stores";
import { AssetsResponse } from "./types";
import { computed, makeObservable } from "mobx";
import Joi from "joi";
import { InternalChainStore } from "../internal";
import { SwapUsageQueries } from "../swap-usage";

const Schema = Joi.object<AssetsResponse>({
  chain_to_assets_map: Joi.object().pattern(
    Joi.string(),
    Joi.object({
      assets: Joi.array().items(
        Joi.object({
          denom: Joi.string().required(),
          chain_id: Joi.string().required(),
          origin_denom: Joi.string().required(),
          origin_chain_id: Joi.string().required(),
          is_evm: Joi.boolean().required(),
          token_contract: Joi.string().optional(),
        }).unknown(true)
      ),
    }).unknown(true)
  ),
}).unknown(true);

export class ObservableQueryAssetsInner extends ObservableQuery<AssetsResponse> {
  constructor(
    sharedContext: QuerySharedContext,
    protected readonly chainStore: InternalChainStore,
    protected readonly swapUsageQueries: SwapUsageQueries,
    skipURL: string,
    public readonly chainId: string
  ) {
    super(
      sharedContext,
      skipURL,
      `/v2/fungible/assets?chain_id=${chainId.replace(
        "eip155:",
        ""
      )}&native_only=false&include_evm_assets=true`
    );

    makeObservable(this);
  }

  @computed
  get assets(): {
    denom: string;
    chainId: string;
    originDenom: string;
    originChainId: string;
  }[] {
    if (
      !this.response ||
      !this.response.data ||
      !this.response.data.chain_to_assets_map
    ) {
      return [];
    }

    if (!this.chainStore.hasChain(this.chainId)) {
      return [];
    }

    const chainInfo = this.chainStore.getChain(this.chainId);
    if (!this.chainStore.isInChainInfosInListUI(chainInfo.chainId)) {
      return [];
    }

    const assetsInResponse =
      this.response.data.chain_to_assets_map[
        chainInfo.chainId.replace("eip155:", "")
      ];
    if (assetsInResponse) {
      const res: {
        denom: string;
        chainId: string;
        originDenom: string;
        originChainId: string;
      }[] = [];

      for (const asset of assetsInResponse.assets) {
        if (
          this.chainStore.hasChain(asset.chain_id) &&
          this.chainStore.hasChain(asset.origin_chain_id)
        ) {
          // IBC asset일 경우 그냥 넣는다.
          if (asset.denom.startsWith("ibc/")) {
            res.push({
              denom: asset.denom,
              chainId: asset.chain_id,
              originDenom: asset.origin_denom,
              originChainId: asset.origin_chain_id,
            });
            // IBC asset이 아니라면 알고있는 currency만 넣는다.
          } else if (
            chainInfo.findCurrencyWithoutReaction(
              asset.is_evm && !!asset.token_contract
                ? `erc20:${asset.token_contract}`
                : asset.denom
            )
          ) {
            res.push({
              denom: asset.denom,
              chainId: asset.chain_id,
              originDenom: asset.origin_denom,
              originChainId: asset.origin_chain_id,
            });
          }
        }
      }

      return res;
    }

    return [];
  }

  @computed
  get assetsOnlySwapUsages(): {
    denom: string;
    chainId: string;
    originDenom: string;
    originChainId: string;
  }[] {
    if (
      !this.response ||
      !this.response.data ||
      !this.response.data.chain_to_assets_map
    ) {
      return [];
    }

    if (!this.chainStore.hasChain(this.chainId)) {
      return [];
    }

    const chainInfo = this.chainStore.getChain(this.chainId);
    if (!this.chainStore.isInChainInfosInListUI(chainInfo.chainId)) {
      return [];
    }

    const assetsInResponse =
      this.response.data.chain_to_assets_map[
        chainInfo.chainId.replace("eip155:", "")
      ];
    if (assetsInResponse) {
      const res: {
        denom: string;
        chainId: string;
        originDenom: string;
        originChainId: string;
      }[] = [];

      for (const asset of assetsInResponse.assets) {
        if (
          this.chainStore.hasChain(asset.chain_id) &&
          this.chainStore.hasChain(asset.origin_chain_id)
        ) {
          if (
            !this.chainId.startsWith("eip155:") &&
            !this.swapUsageQueries.querySwapUsage
              .getSwapUsage(this.chainId)
              .isSwappable(asset.denom)
          ) {
            continue;
          }

          // IBC asset일 경우 그냥 넣는다.
          if (asset.denom.startsWith("ibc/")) {
            res.push({
              denom: asset.denom,
              chainId: asset.chain_id,
              originDenom: asset.origin_denom,
              originChainId: asset.origin_chain_id,
            });
            // IBC asset이 아니라면 알고있는 currency만 넣는다.
          } else if (
            chainInfo.findCurrencyWithoutReaction(
              asset.is_evm && !!asset.token_contract
                ? `erc20:${asset.token_contract}`
                : asset.denom
            )
          ) {
            res.push({
              denom:
                asset.is_evm && !!asset.token_contract
                  ? `erc20:${asset.token_contract}`
                  : asset.denom,
              chainId: asset.chain_id,
              originDenom: asset.origin_denom,
              originChainId: asset.origin_chain_id,
            });
          }
        }
      }

      return res;
    }

    return [];
  }

  protected override async fetchResponse(
    abortController: AbortController
  ): Promise<{ headers: any; data: AssetsResponse }> {
    const result = await super.fetchResponse(abortController);

    const validated = Schema.validate(result.data);
    if (validated.error) {
      console.log("Failed to validate assets response", validated.error);
      throw validated.error;
    }

    return {
      headers: result.headers,
      data: validated.value,
    };
  }
}

export class ObservableQueryAssets extends HasMapStore<ObservableQueryAssetsInner> {
  constructor(
    protected readonly sharedContext: QuerySharedContext,
    protected readonly chainStore: InternalChainStore,
    protected readonly swapUsageQueries: SwapUsageQueries,
    protected readonly skipURL: string
  ) {
    super((chainId) => {
      return new ObservableQueryAssetsInner(
        this.sharedContext,
        this.chainStore,
        this.swapUsageQueries,
        this.skipURL,
        chainId
      );
    });
  }

  getAssets(chainId: string): ObservableQueryAssetsInner {
    return this.get(chainId);
  }
}
