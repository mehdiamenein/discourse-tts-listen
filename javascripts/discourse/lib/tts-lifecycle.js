// Pure helpers for keeping the player alive across post re-renders.
//
// Discourse "cloaks" posts that scroll out of view — it removes the post's
// cooked element from the DOM and renders it again when it scrolls back.
// Without this module, that re-render would tear the player down and cut the
// voice off mid-sentence. These functions decide when a re-rendered post may
// reuse its existing player and how the reading position carries over.
//
// Kept separate from the UI code so it can be unit-tested in isolation, like
// `tts-selection.js`.

/**
 * Picks the player for a freshly rendered post element.
 *
 * @param {Map<number, object>} players
 *   Registry of live players keyed by post id.
 * @param {number|null} postId
 *   The post's id; null when the post model is unavailable (no stable
 *   identity across re-renders — fall back to a per-element player).
 * @param {() => object} create
 *   Builds a fresh player.
 * @returns {{ player: object, reused: boolean }}
 *   `reused: true` when the existing player is still speaking/paused and
 *   should be re-attached to the new element instead of replaced.
 */
export function playerForElement(players, postId, create) {
  if (postId == null) {
    return { player: create(), reused: false };
  }

  const existing = players.get(postId);
  if (
    existing &&
    (existing.state === "playing" || existing.state === "paused")
  ) {
    return { player: existing, reused: true };
  }

  // A finished, stopped or never-started player has nothing worth keeping.
  if (existing) {
    players.delete(postId);
  }

  const player = create();
  players.set(postId, player);
  return { player, reused: false };
}

/**
 * Carries the reading position over to a freshly rendered post.
 *
 * The old chunk list holds references to detached DOM nodes. When the
 * re-rendered post has identical content (the common case: the same post
 * scrolled out of view and back), swap in the fresh chunks so highlighting
 * and the remaining speech track the new DOM. When the content changed (the
 * post was edited), keep reading the text that was captured when playback
 * started.
 *
 * @param {Array<{ el: object, text: string }>} previous
 *   Chunks collected from the previous render.
 * @param {Array<{ el: object, text: string }>} fresh
 *   Chunks collected from the freshly rendered post.
 * @returns {Array<{ el: object, text: string }>}
 *   The chunk list to keep speaking from.
 */
export function remapChunks(previous, fresh) {
  if (!fresh.length || fresh.length !== previous.length) {
    return previous;
  }
  const identical = fresh.every((chunk, i) => chunk.text === previous[i].text);
  return identical ? fresh : previous;
}
