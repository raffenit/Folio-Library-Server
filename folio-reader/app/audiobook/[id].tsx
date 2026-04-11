// Root-level audiobook player — re-exports the tabs version so this screen
// can be pushed onto the root navigation stack. This allows the epub reader
// (a fullScreenModal on the root stack) to stay in the stack when the user
// opens the audiobook player, so pressing back returns to the epub.
export { default } from '../(tabs)/audiobook/[id]';
