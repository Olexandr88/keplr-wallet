export interface AssetsFromSourceResponse {
  dest_assets: {
    [chainId: string]:
      | {
          assets: {
            denom: string;
            chain_id: string;
            origin_denom: string;
            origin_chain_id: string;
          }[];
        }
      | undefined;
  };
}

export interface AssetsResponse {
  chain_to_assets_map: {
    [chainId: string]:
      | {
          assets: {
            denom: string;
            chain_id: string;
            origin_denom: string;
            origin_chain_id: string;
            is_evm: boolean;
            token_contract?: string;
          }[];
        }
      | undefined;
  };
}

export interface MsgsDirectResponse {
  msgs: (
    | {
        multi_chain_msg: {
          chain_id: string;
          path: string[];
          msg: string;
          msg_type_url: string;
        };
      }
    | {
        evm_tx: {
          chain_id: string;
          data: string;
          required_erc20_approvals: string[];
          signer_address: string;
          to: string;
          value: string;
        };
      }
  )[];
  route: {
    source_asset_denom: string;
    source_asset_chain_id: string;
    dest_asset_denom: string;
    dest_asset_chain_id: string;
    amount_in: string;
    amount_out: string;
    operations: (
      | {
          transfer: {
            port: string;
            channel: string;
            chain_id: string;
            pfm_enabled?: boolean;
            dest_denom: string;
            supports_memo?: boolean;
          };
        }
      | {
          swap: {
            swap_in: {
              swap_venue: {
                name: string;
                chain_id: string;
              };
              swap_operations: {
                pool: string;
                denom_in: string;
                denom_out: string;
              }[];
              swap_amount_in: string;
              price_impact_percent?: string;
            };
            estimated_affiliate_fee: string;
          };
        }
      | {
          axelar_transfer: {
            asset: string;
            bridge_id: string;
            denom_in: string;
            denom_out: string;
            from_chain: string;
            from_chain_id: string;
            to_chain: string;
            to_chain_id: string;
            fee_amount: string;
            fee_asset: {
              chain_id: string;
              denom: string;
              decimals: number;
              symbol: string;
            };
          };
        }
    )[];
    chain_ids: string[];
    does_swap?: boolean;
    estimated_amount_out?: string;
    swap_price_impact_percent?: string;
    swap_venue?: {
      name: string;
      chain_id: string;
    };
    txs_required: number;
  };
}

export interface ChainsResponse {
  chains: {
    chain_id: string;
    pfm_enabled: boolean;
    supports_memo?: boolean;
  }[];
}
