import React, {FunctionComponent, useState} from 'react';
import {observer} from 'mobx-react-lite';

import {Text, View} from 'react-native';
import {useStyle} from '../../../styles';
import {Box} from '../../../components/box';
import {SVGLoadingIcon} from '../../../components/spinner';
import {RectButton} from '../../../components/rect-button';
import {Stack} from '../../../components/stack';
import {Column, Columns} from '../../../components/column';
import {useStore} from '../../../stores';
import {ProposalStatus, ViewProposal} from '../../../stores/governance/types';
import {useIntl} from 'react-intl';
import {dateToLocalString} from '../utils';
import {Chip} from '../../../components/chip';
import {CheckCircleIcon} from '../../../components/icon';
import {Gutter} from '../../../components/gutter';
import {useNavigation} from '@react-navigation/native';
import {StackNavProp} from '../../../navigation';
import {DASHBOARD_URL} from '../../../config';

export const GovernanceProposalStatusChip: FunctionComponent<{
  status: ProposalStatus;
}> = ({status}) => {
  switch (status) {
    case ProposalStatus.DEPOSIT_PERIOD:
      return <Chip text="Deposit period" />;
    case ProposalStatus.VOTING_PERIOD:
      return <Chip text="Voting period" mode="light" />;
    case ProposalStatus.PASSED:
      return <Chip text="Passed" color="success" />;
    case ProposalStatus.REJECTED:
      return <Chip text="Rejected" color="danger" />;
    case ProposalStatus.FAILED:
      return <Chip text="Failed" color="danger" />;
    default:
      return <Chip text="Unspecified" color="danger" />;
  }
};

export const GovernanceCardBody: FunctionComponent<{
  proposal: ViewProposal;
  chainId: string;
  isGovV1Supported?: boolean;
}> = observer(({proposal, chainId, isGovV1Supported}) => {
  const {chainStore, queriesStore, accountStore} = useStore();

  const style = useStyle();
  const intl = useIntl();
  const vote = isGovV1Supported
    ? queriesStore
        .get(chainId)
        .governanceV1.queryVotes.getVote(
          proposal.id,
          accountStore.getAccount(chainId).bech32Address,
        ).vote
    : queriesStore
        .get(chainId)
        .governance.queryVotes.getVote(
          proposal.id,
          accountStore.getAccount(chainId).bech32Address,
        ).vote;
  const navigation = useNavigation<StackNavProp>();
  const voted = vote !== 'Unspecified';

  const renderProposalDateString = (proposal: ViewProposal) => {
    switch (proposal.proposalStatus) {
      case ProposalStatus.DEPOSIT_PERIOD:
        return `Voting ends: ${dateToLocalString(
          intl,
          proposal.raw.deposit_end_time,
        )}`;
      case ProposalStatus.VOTING_PERIOD:
      case ProposalStatus.FAILED:
      case ProposalStatus.PASSED:
      case ProposalStatus.REJECTED:
      case ProposalStatus.UNSPECIFIED:
        return `Voting ends: ${dateToLocalString(
          intl,
          proposal.raw.voting_end_time,
        )}`;
    }
  };

  const [current] = useState(() => new Date().getTime());

  // Relative time is not between the end time and actual current time.
  // Relative time is between the end time and "the time that the component is mounted."
  const proposalRelativeEndTimeString = (() => {
    if (!proposal) {
      return '';
    }

    switch (proposal.proposalStatus) {
      case ProposalStatus.DEPOSIT_PERIOD:
        const relativeDepositEndTime =
          (new Date(proposal.raw.deposit_end_time).getTime() - current) / 1000;
        const relativeDepositEndTimeDays = Math.floor(
          relativeDepositEndTime / (3600 * 24),
        );
        const relativeDepositEndTimeHours = Math.ceil(
          relativeDepositEndTime / 3600,
        );

        if (relativeDepositEndTimeDays) {
          return (
            intl
              .formatRelativeTime(relativeDepositEndTimeDays, 'days', {
                numeric: 'always',
              })
              .replace('in ', '') + ' left'
          );
        } else if (relativeDepositEndTimeHours) {
          return (
            intl
              .formatRelativeTime(relativeDepositEndTimeHours, 'hours', {
                numeric: 'always',
              })
              .replace('in ', '') + ' left'
          );
        }
        return '';
      case ProposalStatus.VOTING_PERIOD:
        const relativeVotingEndTime =
          (new Date(proposal.raw.voting_end_time).getTime() - current) / 1000;
        const relativeVotingEndTimeDays = Math.floor(
          relativeVotingEndTime / (3600 * 24),
        );
        const relativeVotingEndTimeHours = Math.ceil(
          relativeVotingEndTime / 3600,
        );

        if (relativeVotingEndTimeDays) {
          return (
            intl
              .formatRelativeTime(relativeVotingEndTimeDays, 'days', {
                numeric: 'always',
              })
              .replace('in ', '') + ' left'
          );
        } else if (relativeVotingEndTimeHours) {
          return (
            intl
              .formatRelativeTime(relativeVotingEndTimeHours, 'hours', {
                numeric: 'always',
              })
              .replace('in ', '') + ' left'
          );
        }
        return '';
      case ProposalStatus.FAILED:
      case ProposalStatus.PASSED:
      case ProposalStatus.REJECTED:
      case ProposalStatus.UNSPECIFIED:
        return '';
    }
  })();

  return (
    <Box
      borderRadius={6}
      style={style.flatten(['overflow-hidden', 'background-color-gray-600'])}>
      {proposal ? (
        <RectButton
          style={style.flatten(['padding-16'])}
          onPress={() => {
            //NOTE cronose pos 같은 공백이 있는 체인이름 대시보드애서
            // cronose-pos으로 연결해서 공백이 있는경우 -으로 join 함
            const url = `${DASHBOARD_URL}/chains/${chainStore
              .getChain(chainId)
              .chainName.toLowerCase()
              .split(' ')
              .join('-')}/proposals/${[proposal.id]}`;

            if (url) {
              navigation.navigate('Web', {
                url,
              });
            }
          }}>
          <Stack gutter={9}>
            <Columns sum={1}>
              <Text style={style.flatten(['subtitle3', 'color-text-high'])}>
                {proposal.id}
              </Text>
              <Column weight={1} />
              {voted ? (
                <React.Fragment>
                  <Chip
                    text={
                      <Box alignX="center" alignY="center">
                        <Columns sum={1} gutter={2}>
                          <Text
                            style={style.flatten([
                              'color-text-middle',
                              'text-caption1',
                            ])}>
                            Voted
                          </Text>
                          <CheckCircleIcon
                            size={16}
                            color={style.get('color-text-middle').color}
                          />
                        </Columns>
                      </Box>
                    }
                  />
                  <Gutter size={4} />
                </React.Fragment>
              ) : null}
              <GovernanceProposalStatusChip status={proposal.proposalStatus} />
            </Columns>

            <View style={style.flatten(['margin-bottom-8'])}>
              <Text style={style.flatten(['subtitle3', 'color-text-high'])}>
                {proposal.title}
                title
              </Text>
            </View>
            <Columns sum={1}>
              <Text style={style.flatten(['body3', 'color-text-low'])}>
                {renderProposalDateString(proposal)}
                {}
              </Text>
              <Column weight={1} />
              {proposalRelativeEndTimeString ? (
                <Text
                  style={style.flatten(['text-caption1', 'color-text-middle'])}>
                  {proposalRelativeEndTimeString}
                </Text>
              ) : null}
            </Columns>
          </Stack>
        </RectButton>
      ) : (
        <View
          style={style.flatten([
            'height-governance-card-body-placeholder',
            'justify-center',
            'items-center',
          ])}>
          <SVGLoadingIcon
            color={style.get('color-loading-spinner').color}
            size={22}
          />
        </View>
      )}
    </Box>
  );
});