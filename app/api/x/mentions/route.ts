// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET /api/x/mentions — fetch recent mentions from X API with full context
import { NextResponse } from 'next/server';
import { getTwitterClient } from '@/lib/twitterClient';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const client = await getTwitterClient();
    if (!client) {
      return NextResponse.json({ error: 'Twitter not configured', mentions: [] }, { status: 200 });
    }

    // Get user ID
    const me = await client.v2.me();
    if (!me.data?.id) {
      return NextResponse.json({ error: 'Could not get user profile', mentions: [] }, { status: 200 });
    }
    const myId = me.data.id;

    // Fetch mentions with FULL context — reply detection + referenced tweets
    const mentions = await client.v2.userMentionTimeline(myId, {
      max_results: 50,
      'tweet.fields': [
        'created_at',
        'public_metrics',
        'author_id',
        'conversation_id',
        'in_reply_to_user_id',
        'referenced_tweets',
        'reply_settings',
      ],
      expansions: ['author_id', 'referenced_tweets.id', 'referenced_tweets.id.author_id'],
      'user.fields': ['name', 'username', 'profile_image_url', 'public_metrics'],
    });

    const tweets = mentions.data?.data || [];
    const users = mentions.includes?.users || [];
    const referencedTweets = mentions.includes?.tweets || [];
    const userMap = new Map(users.map(u => [u.id, u]));
    const tweetMap = new Map(referencedTweets.map(t => [t.id, t]));

    const enriched = tweets.map(tweet => {
      const author = userMap.get(tweet.author_id as string);
      const refTweets = (tweet.referenced_tweets || []).map((ref: any) => {
        const refTweet = tweetMap.get(ref.id);
        const refAuthor = refTweet ? userMap.get(refTweet.author_id as string) : undefined;
        return {
          type: ref.type, // 'replied_to' | 'quoted' | 'retweeted'
          id: ref.id,
          text: refTweet?.text || null,
          author: refAuthor ? { id: refAuthor.id, username: refAuthor.username, name: refAuthor.name } : null,
        };
      });

      // Determine mention type
      const isReplyToUs = tweet.in_reply_to_user_id === myId;
      const isReplyToOther = !!tweet.in_reply_to_user_id && tweet.in_reply_to_user_id !== myId;
      const hasQuote = refTweets.some((r: any) => r.type === 'quoted');

      let mentionType: 'reply' | 'quote' | 'mention' = 'mention';
      if (isReplyToUs || isReplyToOther) mentionType = 'reply';
      else if (hasQuote) mentionType = 'quote';

      // Find parent tweet for replies
      const parentRef = refTweets.find((r: any) => r.type === 'replied_to');

      return {
        ...tweet,
        author: author || { id: tweet.author_id },
        referenced_tweets: refTweets,
        mention_type: mentionType,
        is_reply_to_us: isReplyToUs,
        parent_tweet: parentRef || null,
        our_user_id: myId,
      };
    });

    return NextResponse.json({
      ok: true,
      mentions: enriched,
      meta: mentions.data?.meta,
      our_user_id: myId,
    });
  } catch (err) {
    console.error('[x/mentions]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
