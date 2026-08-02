# Speech lifecycle: never autoplay, one active player, sentence chunking

The player follows lifecycle rules that a future reader might otherwise
"simplify" away: it never autoplays; only one post speaks at a time (a global
active-player lock stops the previous player); speech stops on navigation and
when a post is re-rendered or removed. Long blocks are split into sentence-
bounded chunks (max 250 characters) because Chrome silently cuts off longer
utterances, and a periodic `resume()` keeps Chrome desktop from silently pausing
long playback. These are deliberate reliability decisions, not bugs.
