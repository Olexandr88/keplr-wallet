import React, {useLayoutEffect, useMemo, useState} from 'react';
import {observer} from 'mobx-react-lite';
import {useStore} from '../../stores';
import {useStyle} from '../../styles';
import {BaseModalHeader} from './modal';
import {useIntl} from 'react-intl';
import {Text} from 'react-native';
import {XAxis} from '../axis';
import {Button} from '../button';
import {Gutter} from '../gutter';
import {PermissionData} from '@keplr-wallet/background';
import {WCMessageRequester} from '../../stores/wallet-connect/msg-requester';
import FastImage from 'react-native-fast-image';
import {Box} from '../box';
import {registerCardModal} from './card';

export const WalletConnectAccessModal = registerCardModal(
  observer<{
    id: string;
    data: PermissionData;

    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
  }>(({id, data}) => {
    const intl = useIntl();
    const style = useStyle();
    const {permissionStore, walletConnectStore} = useStore();

    const [peerMeta, setPeerMeta] = useState<
      {name?: string; url?: string; icons?: string[]} | undefined
    >(undefined);

    useLayoutEffect(() => {
      if (data.origins.length !== 1) {
        throw new Error('Invalid origins');
      }

      walletConnectStore
        .getSessionMetadata(
          WCMessageRequester.getIdFromVirtualURL(data.origins[0]),
        )
        .then(r => setPeerMeta(r));
    }, [data.origins, walletConnectStore]);

    const appName = peerMeta?.name || peerMeta?.url || 'unknown';
    const chainIds = useMemo(() => {
      return data.chainIds.join(', ');
    }, [data]);

    const logoUrl = useMemo(() => {
      if (peerMeta?.icons && peerMeta.icons.length > 0) {
        return peerMeta.icons[peerMeta.icons.length - 1];
      }
    }, [peerMeta?.icons]);

    return (
      <Box paddingX={12} paddingBottom={12}>
        <BaseModalHeader
          title={intl.formatMessage({
            id: 'page.permission.requesting-connection-title',
          })}
        />

        <Gutter size={32} />

        <Box alignX="center">
          <FastImage
            style={{width: 74, height: 75}}
            resizeMode={FastImage.resizeMode.contain}
            source={{
              uri: logoUrl,
              cache: FastImage.cacheControl.web,
            }}
          />
        </Box>

        <Gutter size={16} />

        <Text
          style={style.flatten([
            'body2',
            'color-text-middle',
            'text-center',
          ])}>{`${appName} is requesting to connect to your Keplr account on ${chainIds}`}</Text>

        <Gutter size={16} />

        <XAxis>
          <Button
            size="large"
            text="Reject"
            color="secondary"
            containerStyle={{flex: 1, width: '100%'}}
            onPress={async () => {
              await permissionStore.rejectPermissionAll();
            }}
          />

          <Gutter size={16} />

          <Button
            size="large"
            text="Approve"
            containerStyle={{flex: 1, width: '100%'}}
            onPress={async () => {
              await permissionStore.approvePermissionWithProceedNext(
                id,
                () => {},
              );
            }}
          />
        </XAxis>
      </Box>
    );
  }),
);