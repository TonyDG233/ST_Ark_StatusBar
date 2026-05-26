export function checkIsArknights(): boolean {
  try {
    const charName = typeof getCurrentCharacterName === 'function' ? getCurrentCharacterName() : '';
    return charName ? charName.includes('明日方舟') : false;
  } catch (e) {
    console.error('[ARK_STATUSBAR] identity check failed:', e);
    return false;
  }
}
