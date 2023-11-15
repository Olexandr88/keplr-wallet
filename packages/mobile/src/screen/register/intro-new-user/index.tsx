import React, {FunctionComponent} from 'react';
import {useStyle} from '../../../styles';
import {Text} from 'react-native';
import {FormattedMessage, useIntl} from 'react-intl';
import {Gutter} from '../../../components/gutter';
import {XAxis} from '../../../components/axis';
import {Button} from '../../../components/button';
import {TextButton} from '../../../components/text-button';
import {
  NavigationProp,
  StackActions,
  useNavigation,
} from '@react-navigation/native';
import {OptionContainer, RegisterContainer} from '../components';
import {
  AppleIcon,
  GoogleIcon,
  BoltIcon,
  ShieldIcon,
} from '../../../components/icon';
import {Box} from '../../../components/box';
import {RootStackParamList} from '../../../navigation';

export const RegisterIntroNewUserScreen: FunctionComponent = () => {
  const intl = useIntl();
  const style = useStyle();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  return (
    <RegisterContainer
      title={intl.formatMessage({
        id: 'pages.register.intro-new-user.title',
      })}>
      <Box alignX="center" padding={20}>
        <Text style={style.flatten(['color-text-low', 'body1'])}>
          <FormattedMessage id="pages.register.intro-new-user.paragraph" />
        </Text>

        <Gutter size={12} />

        <OptionContainer
          title={intl.formatMessage({
            id: 'pages.register.intro-new-user.recovery-path-title',
          })}
          paragraph={intl.formatMessage({
            id: 'pages.register.intro-new-user.recovery-path-paragraph',
          })}>
          <Gutter size={20} />

          <XAxis alignY="center">
            <ShieldIcon />
            <ShieldIcon />
            <ShieldIcon />

            <Gutter size={4} />

            <Text style={style.flatten(['text-caption1', 'color-text-low'])}>
              <FormattedMessage id="pages.register.intro-new-user.high-security-text" />
            </Text>
          </XAxis>

          <Gutter size={20} />

          <Button
            text={intl.formatMessage({
              id: 'pages.register.intro-new-user.new-recovery-path-button',
            })}
            size="large"
            onPress={() => {
              navigation.navigate('Register.NewMnemonic');
            }}
          />

          <Gutter size={20} />

          <TextButton
            containerStyle={{height: 32}}
            text={intl.formatMessage({
              id: 'pages.register.intro-new-user.import-recovery-path-button',
            })}
            size="large"
            onPress={() => {
              navigation.dispatch(
                StackActions.replace('Register.Intro.ExistingUser'),
              );
            }}
          />
        </OptionContainer>

        <Gutter size={16} />

        <OptionContainer
          title={intl.formatMessage({
            id: 'pages.register.intro-new-user.sign-up-social-title',
          })}
          paragraph={intl.formatMessage({
            id: 'pages.register.intro-new-user.sign-up-social-paragraph',
          })}>
          <Gutter size={20} />

          <XAxis alignY="center">
            <BoltIcon />
            <BoltIcon />
            <BoltIcon />

            <Gutter size={4} />

            <Text style={style.flatten(['text-caption1', 'color-text-low'])}>
              <FormattedMessage id="pages.register.intro-new-user.more-convenience-text" />
            </Text>
          </XAxis>

          <Gutter size={20} />

          <Button
            text={intl.formatMessage({
              id: 'pages.register.intro-new-user.sign-up-apple-button',
            })}
            size="large"
            color="secondary"
            leftIcon={<AppleIcon />}
          />

          <Gutter size={12} />

          <Button
            text={intl.formatMessage({
              id: 'pages.register.intro-new-user.sign-up-google-button',
            })}
            size="large"
            color="secondary"
            leftIcon={<GoogleIcon />}
          />
        </OptionContainer>
      </Box>
    </RegisterContainer>
  );
};