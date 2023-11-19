import {observer} from 'mobx-react-lite';
import React, {FunctionComponent, useCallback, useState} from 'react';
import {useStore} from '../../stores';
import {Button} from '../../components/button';
import {StackActions, useNavigation} from '@react-navigation/native';
import {TextInput} from '../../components/input';
import {useSetFocusedScreen} from '../../components/page/utils';
import {Box} from '../../components/box';
import {useStyle} from '../../styles';
import {useIntl} from 'react-intl';
import {Gutter} from '../../components/gutter';

export const LockedScreen: FunctionComponent = observer(() => {
  const {keyRingStore, keychainStore} = useStore();

  const intl = useIntl();
  const style = useStyle();
  const navigation = useNavigation();

  const [isFailed, setIsFailed] = useState(false);
  const [password, setPassword] = useState('');

  useSetFocusedScreen();

  const tryBiometric = useCallback(async () => {
    try {
      await keychainStore.tryUnlockWithBiometry();
      navigation.dispatch({
        ...StackActions.replace('Home'),
      });
    } catch (e) {
      console.log(e);
    }
  }, [keychainStore]);

  const doUnlock = async () => {
    try {
      await keyRingStore.unlock(password);
      navigation.dispatch({
        ...StackActions.replace('Home'),
      });
    } catch (error) {
      setIsFailed(true);
    }
  };
  return (
    <React.Fragment>
      <Box
        height={'100%'}
        backgroundColor={style.get('color-background-default').color}>
        <TextInput
          label="password"
          value={password}
          onChangeText={value => {
            setPassword(value);
            setIsFailed(false);
          }}
          secureTextEntry={true}
          returnKeyType="done"
          onSubmitEditing={() => {
            doUnlock();
          }}
          error={isFailed ? 'Invalid Password' : undefined}
        />
        <Button
          text={intl.formatMessage({id: 'page.unlock.unlock-button'})}
          size="large"
          onPress={doUnlock}
        />

        <Gutter size={20} />

        {keychainStore.isBiometryOn ? (
          <Button text="Use Biometric Authentication" onPress={tryBiometric} />
        ) : null}
      </Box>
    </React.Fragment>
  );
});
