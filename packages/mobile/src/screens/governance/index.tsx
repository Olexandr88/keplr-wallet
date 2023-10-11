import React, { FunctionComponent, useMemo } from "react";
import { GovernanceCardBody } from "./card";
import { observer } from "mobx-react-lite";
import { PageWithSectionList } from "../../components/page";
import { useStore } from "../../stores";
import {
  ObservableQueryProposal,
  ObservableQueryProposalV1,
} from "@keplr-wallet/stores";
import { Card, CardDivider } from "../../components/card";
import { useStyle } from "../../styles";
import { ProposalStatus } from "@keplr-wallet/stores/build/query/cosmos/governance/types";
import { ChainIdHelper } from "@keplr-wallet/cosmos";
import { GovernanceV1ChainIdentifiers } from "../../config";

export const GovernanceScreen: FunctionComponent = observer(() => {
  const { chainStore, queriesStore, scamProposalStore } = useStore();

  const style = useStyle();
  const queries = queriesStore.get(chainStore.current.chainId);

  const sections = useMemo(() => {
    const isGovernanceV1 = GovernanceV1ChainIdentifiers.includes(
      ChainIdHelper.parse(chainStore.current.chainId).identifier
    );

    // proposalQuery 의 형식은 _DeepReadonlyArray<ObservableQueryProposal> | _DeepReadonlyArray<ObservableQueryProposalV1>이다
    // _DeepReadonlyArray를 유니온 한 타입은 filter를 사용했을 때 타입이 제대로 유추되지 않는다. any로 추론된다.
    const proposals = (isGovernanceV1
      ? queries.cosmos.queryGovernanceV1.proposals
      : queries.cosmos.queryGovernance.proposals
    )
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      .filter(
        (proposal: ObservableQueryProposal | ObservableQueryProposalV1) =>
          !scamProposalStore.isScamProposal(
            chainStore.current.chainId,
            proposal.id
          )
      );

    return [
      {
        data: proposals.filter(
          (p: ObservableQueryProposal | ObservableQueryProposalV1) =>
            p.proposalStatus !== ProposalStatus.DEPOSIT_PERIOD
        ),
      },
    ];
  }, [
    queries.cosmos.queryGovernance.proposals,
    queries.cosmos.queryGovernanceV1.proposals,
  ]);

  return (
    <PageWithSectionList
      backgroundMode="gradient"
      sections={sections}
      keyExtractor={(item: ObservableQueryProposal) => {
        return item.id;
      }}
      renderItem={({
        item,
        index,
        section,
      }: {
        item: ObservableQueryProposal;
        index: number;
        section: { data: unknown[] };
      }) => {
        return (
          <React.Fragment>
            <Card
              style={style.flatten(
                [],
                [
                  index === 0 && "margin-top-card-gap",
                  index === section.data.length - 1 && "margin-bottom-card-gap",
                ]
              )}
            >
              <GovernanceCardBody proposalId={item.id} />
              {index === section.data.length - 1 ? null : <CardDivider />}
            </Card>
          </React.Fragment>
        );
      }}
    />
  );
});

export { GovernanceCardBody };
export * from "./details";