import notifier from 'node-notifier';

/**
 * Dispatches a native OS desktop notification if supported and not running in headless/test environments.
 * @param {object} options
 * @param {string} [options.title='Polaris VPN']
 * @param {string} options.message
 * @param {'info'|'warn'|'error'} [options.type='info']
 */
export const sendNotification = ({ title = 'Polaris VPN', message, type = 'info' }) => {
  if (
    process.env.POLARIS_NO_NOTIFY ||
    process.env.CI ||
    process.env.NODE_ENV === 'test' ||
    Boolean(process.env.POLARIS_TEST)
  ) {
    return;
  }

  try {
    notifier.notify({
      title,
      message,
      sound: type === 'error',
      wait: false
    });
  } catch (_) {
    // Gracefully ignore failure in environments without a notification server (e.g. headless SSH)
  }
};
