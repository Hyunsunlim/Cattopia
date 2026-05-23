import { useRef, useState } from 'react';
import { Share, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createInvite, removeFriend as removeFriendAPI } from '../services/friends';

export function useInviteFriend() {
  const insets = useSafeAreaInsets();
  const [toastMessage, setToastMessage] = useState('');
  const toastAnim = useRef(new Animated.Value(-80)).current;

  const showToast = (message) => {
    setToastMessage(message);
    Animated.sequence([
      Animated.spring(toastAnim, { toValue: insets.top + 12, useNativeDriver: false, tension: 80 }),
      Animated.delay(2200),
      Animated.timing(toastAnim, { toValue: -80, duration: 300, useNativeDriver: false }),
    ]).start();
  };

  // 공유했으면 'sent', 취소했으면 'cancelled' 반환
  const sendInvite = async () => {
    let inviteId = null;
    try {
      const { id, invite_link } = await createInvite();
      inviteId = id;
      const result = await Share.share({
        message: `함께 고양이를 키워봐요! 🐱\nMeow 앱에서 매일 이야기를 쓰면 고양이가 자라요.\n${invite_link}`,
        url: invite_link,
        title: 'Meow — 함께 키우기',
      });
      if (result.action === Share.sharedAction) {
        showToast('초대장을 보냈어요! 🐱');
        return 'sent';
      }
      await removeFriendAPI(inviteId).catch(e => console.warn('Failed to cancel invite:', e));
      return 'cancelled';
    } catch (e) {
      // Share.share()가 취소 시 throw 하는 경우 (iOS)
      if (inviteId) {
        await removeFriendAPI(inviteId).catch(err => console.warn('Failed to cancel invite:', err));
      }
      if (e?.message !== 'User did not share') {
        console.warn('Share error:', e);
      }
      return 'cancelled';
    }
  };

  return { toastAnim, toastMessage, sendInvite };
}
