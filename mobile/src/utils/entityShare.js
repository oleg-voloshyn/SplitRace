import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';

async function shareEntityImage(cardRef, { title, message, url, dialogTitle }) {
  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable || !cardRef.current) {
      shareEntityLink({ title, message, url });
      return;
    }

    const uri = await cardRef.current.capture();
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle });
  } catch {
    shareEntityLink({ title, message, url });
  }
}

function shareEntityLink({ title, message, url }) {
  Share.share({ title, message: `${message}\n${url}`, url }).catch(() => {
    // Native share can be cancelled.
  });
}

export { shareEntityImage, shareEntityLink };
