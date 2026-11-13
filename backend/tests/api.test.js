/**
 * End to end API tests. Requires a local MongoDB; uses its own `sint_test`
 * database and drops it before and after the run.
 *
 * Usage: npm test
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import mongoose from 'mongoose';

process.env.MONGO_URI = process.env.TEST_MONGO_URI ?? 'mongodb://127.0.0.1:27017/sint_test';
process.env.NODE_ENV = 'test';
// The trial/paywall tests need enforcement on; development runs with it off.
process.env.BILLING_ENFORCED = 'true';
// Offline payments need a merchant code to be offered, and an admin to approve.
process.env.OFFLINE_PAYMENT_CODE = '600123';
process.env.ADMIN_EMAILS = 'admin@test.sb';

const { createApp } = await import('../src/app.js');
const { connectDb, disconnectDb } = await import('../src/config/db.js');

let baseUrl;
let server;

async function api(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = response.status === 204 ? {} : await response.json();
  return { status: response.status, data };
}

async function signUp(fullName, email, accountType, extra = {}) {
  const isPublisher = ['business', 'company', 'freelancer'].includes(accountType);
  const { status, data } = await api('/auth/signup', {
    method: 'POST',
    body: {
      fullName,
      email,
      password: 'password123',
      accountType,
      acceptedTerms: true,
      // Publishers must declare these at signup.
      ...(isPublisher ? { category: 'Food & Drinks', location: 'Honiara, Guadalcanal' } : {}),
      ...extra,
    },
  });
  assert.equal(status, 201, JSON.stringify(data));
  return data;
}

before(async () => {
  await connectDb();
  await mongoose.connection.dropDatabase();
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await mongoose.connection.dropDatabase();
  server?.close();
  await disconnectDb();
});

describe('SINT API', () => {
  let business;
  let shopper;
  let postId;

  it('signs up a business and a normal user', async () => {
    business = await signUp('Lime Lounge', 'business@test.sb', 'business');
    shopper = await signUp('Peter Sale', 'shopper@test.sb', 'user');

    assert.equal(business.user.isPublisher, true);
    assert.equal(shopper.user.isPublisher, false);
    assert.ok(business.accessToken && business.refreshToken);
  });

  it('keeps the business details captured at signup on the profile', async () => {
    const created = await signUp('Auki Bakery', 'bakery@test.sb', 'business', {
      category: 'Retail Shops',
      location: 'Auki, Malaita',
      address: 'Market Road',
      phone: '+677 40222',
      contactEmail: 'orders@aukibakery.example',
      bio: 'Fresh bread every morning.',
      links: [{ label: 'Facebook', url: 'https://facebook.com/aukibakery' }],
    });

    assert.equal(created.user.category, 'Retail Shops');
    assert.equal(created.user.location, 'Auki, Malaita');
    assert.equal(created.user.contactEmail, 'orders@aukibakery.example');

    // The public profile shows them without another request from the client.
    const profile = await api(`/users/${created.user.id}`);
    assert.equal(profile.data.user.address, 'Market Road');
    assert.equal(profile.data.user.phone, '+677 40222');
    assert.equal(profile.data.user.bio, 'Fresh bread every morning.');
    assert.equal(profile.data.user.links[0].label, 'Facebook');
  });

  it('asks publishers for a category and location, but never normal users', async () => {
    const noCategory = await api('/auth/signup', {
      method: 'POST',
      body: {
        fullName: 'No Category',
        email: 'nocategory@test.sb',
        password: 'password123',
        accountType: 'business',
        location: 'Gizo, Western',
      },
    });
    assert.equal(noCategory.status, 400);

    const badCategory = await api('/auth/signup', {
      method: 'POST',
      body: {
        fullName: 'Bad Category',
        email: 'badcategory@test.sb',
        password: 'password123',
        accountType: 'business',
        category: 'Spaceships',
        location: 'Gizo, Western',
      },
    });
    assert.equal(badCategory.status, 400);

    // Normal users keep the short form.
    const plain = await signUp('Mary Buyer', 'mary@test.sb', 'user');
    assert.equal(plain.user.category, '');
    assert.equal(plain.user.subscription, null);
  });

  it('rejects a duplicate email and a short password', async () => {
    const duplicate = await api('/auth/signup', {
      method: 'POST',
      body: { fullName: 'Copy', email: 'business@test.sb', password: 'password123' },
    });
    assert.equal(duplicate.status, 409);

    const weak = await api('/auth/signup', {
      method: 'POST',
      body: { fullName: 'Weak', email: 'weak@test.sb', password: '123' },
    });
    assert.equal(weak.status, 400);
  });

  it('signs in and rejects bad credentials', async () => {
    const ok = await api('/auth/login', {
      method: 'POST',
      body: { email: 'business@test.sb', password: 'password123' },
    });
    assert.equal(ok.status, 200);

    const bad = await api('/auth/login', {
      method: 'POST',
      body: { email: 'business@test.sb', password: 'wrong' },
    });
    assert.equal(bad.status, 401);
  });

  it('locks sign-in after five failed attempts and says how long to wait', async () => {
    const email = 'throttle@test.sb';
    const attempt = () =>
      api('/auth/login', { method: 'POST', body: { email, password: 'wrong-password' } });

    for (let index = 0; index < 5; index += 1) {
      const failed = await attempt();
      assert.equal(failed.status, 401, `attempt ${index + 1} should be a plain rejection`);
    }

    const blocked = await attempt();
    assert.equal(blocked.status, 429);
    assert.match(blocked.data.message, /Try again in \d+ minutes/);
  });

  it('refreshes an expired session', async () => {
    const { status, data } = await api('/auth/refresh', {
      method: 'POST',
      body: { refreshToken: business.refreshToken },
    });
    assert.equal(status, 200);
    assert.ok(data.accessToken);
  });

  it('lets only publishers create posts', async () => {
    const denied = await api('/posts', {
      method: 'POST',
      token: shopper.accessToken,
      body: { content: 'I am a shopper' },
    });
    assert.equal(denied.status, 403);

    const created = await api('/posts', {
      method: 'POST',
      token: business.accessToken,
      body: {
        content: 'Fresh tuna poke bowls today',
        category: 'Food & Drinks',
        location: 'Honiara',
        media: [{ type: 'image', url: 'https://example.com/tuna.jpg' }],
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.data));
    postId = created.data.post.id;
    assert.equal(created.data.post.category, 'Food & Drinks');
    assert.equal(created.data.post.media.length, 1);
  });

  it('rejects unsafe media URLs and unknown categories', async () => {
    const unsafe = await api('/posts', {
      method: 'POST',
      token: business.accessToken,
      body: { content: 'bad', media: [{ type: 'image', url: 'javascript:alert(1)' }] },
    });
    assert.equal(unsafe.status, 400);

    const unknown = await api('/posts', {
      method: 'POST',
      token: business.accessToken,
      body: { content: 'bad', category: 'Rockets' },
    });
    assert.equal(unknown.status, 400);
  });

  it('likes and unlikes a post once per user', async () => {
    const liked = await api(`/posts/${postId}/like`, { method: 'POST', token: shopper.accessToken });
    assert.equal(liked.data.post.likeCount, 1);
    assert.equal(liked.data.post.isLiked, true);

    const again = await api(`/posts/${postId}/like`, { method: 'POST', token: shopper.accessToken });
    assert.equal(again.data.post.likeCount, 1);

    const unliked = await api(`/posts/${postId}/like`, {
      method: 'DELETE',
      token: shopper.accessToken,
    });
    assert.equal(unliked.data.post.likeCount, 0);

    // Taking the like back also withdraws the author's notification, so an
    // alert never points at a like that no longer exists.
    const afterUnlike = await api('/notifications', { token: business.accessToken });
    assert.equal(
      afterUnlike.data.items.some((item) => item.type === 'like' && item.postId === postId),
      false,
    );
  });

  it('saves a post to the viewer collection', async () => {
    await api(`/posts/${postId}/save`, { method: 'POST', token: shopper.accessToken });
    const saved = await api('/users/me/saved', { token: shopper.accessToken });
    assert.equal(saved.data.items.length, 1);
    assert.equal(saved.data.items[0].isSaved, true);
  });

  it('comments and replies one level deep', async () => {
    const comment = await api(`/posts/${postId}/comments`, {
      method: 'POST',
      token: shopper.accessToken,
      body: { text: 'Best in Honiara' },
    });
    assert.equal(comment.status, 201);

    const reply = await api(`/posts/${postId}/comments`, {
      method: 'POST',
      token: business.accessToken,
      body: { text: 'Thank you!', parentId: comment.data.comment.id },
    });
    assert.equal(reply.status, 201);

    const nested = await api(`/posts/${postId}/comments`, {
      method: 'POST',
      token: shopper.accessToken,
      body: { text: 'too deep', parentId: reply.data.comment.id },
    });
    assert.equal(nested.status, 400);

    const listed = await api(`/posts/${postId}/comments`);
    assert.equal(listed.data.items.length, 1);
    assert.equal(listed.data.items[0].replies.length, 1);
  });

  it('accepts images on comments and validates them', async () => {
    const withImage = await api(`/posts/${postId}/comments`, {
      method: 'POST',
      token: shopper.accessToken,
      body: {
        text: '',
        media: [{ type: 'image', url: 'https://example.com/plate.jpg' }],
      },
    });
    assert.equal(withImage.status, 201, JSON.stringify(withImage.data));
    assert.equal(withImage.data.comment.media.length, 1);
    assert.equal(withImage.data.comment.text, '');

    const empty = await api(`/posts/${postId}/comments`, {
      method: 'POST',
      token: shopper.accessToken,
      body: { text: '   ' },
    });
    assert.equal(empty.status, 400);

    const video = await api(`/posts/${postId}/comments`, {
      method: 'POST',
      token: shopper.accessToken,
      body: { text: 'clip', media: [{ type: 'video', url: 'https://example.com/a.mp4' }] },
    });
    assert.equal(video.status, 400);

    const tooMany = await api(`/posts/${postId}/comments`, {
      method: 'POST',
      token: shopper.accessToken,
      body: {
        text: 'lots',
        media: Array.from({ length: 5 }, (_, index) => ({
          type: 'image',
          url: `https://example.com/${index}.jpg`,
        })),
      },
    });
    assert.equal(tooMany.status, 400);

    const unsafe = await api(`/posts/${postId}/comments`, {
      method: 'POST',
      token: shopper.accessToken,
      body: { text: 'bad', media: [{ type: 'image', url: 'javascript:alert(1)' }] },
    });
    assert.equal(unsafe.status, 400);
  });

  it('follows a business and filters the Following feed', async () => {
    const followed = await api(`/users/${business.user.id}/follow`, {
      method: 'POST',
      token: shopper.accessToken,
    });
    assert.equal(followed.data.user.followerCount, 1);
    assert.equal(followed.data.user.isFollowing, true);

    const following = await api('/posts?tab=following', { token: shopper.accessToken });
    assert.equal(following.data.items.length, 1);

    await api(`/users/${business.user.id}/follow`, {
      method: 'DELETE',
      token: shopper.accessToken,
    });
    const empty = await api('/posts?tab=following', { token: shopper.accessToken });
    assert.equal(empty.data.items.length, 0);
  });

  it('maps search keywords to categories', async () => {
    // A business is found by keyword once it declares its profile category.
    await api('/users/me', {
      method: 'PATCH',
      token: business.accessToken,
      body: { category: 'Food & Drinks', location: 'Honiara' },
    });

    const food = await api('/search?q=food');
    assert.equal(food.status, 200);
    assert.deepEqual(food.data.mappedCategories, ['Food & Drinks']);
    assert.equal(food.data.items.length, 1);

    const byName = await api('/search?q=lime');
    assert.equal(byName.data.items[0].fullName, 'Lime Lounge');

    const none = await api('/search?q=zzzznothing');
    assert.equal(none.data.items.length, 0);
  });

  it('suggests businesses from the categories the viewer explores', async () => {
    // A second publisher in another category gives the ranking something to sort.
    const hotel = await signUp('Coral Sea Hotel', 'hotel@test.sb', 'company');
    await api('/users/me', {
      method: 'PATCH',
      token: hotel.accessToken,
      body: { category: 'Accommodations' },
    });

    // Searching "food" maps to Food & Drinks and records that interest.
    await api('/search?q=food', { token: shopper.accessToken });

    const suggested = await api('/suggestions', { token: shopper.accessToken });
    assert.equal(suggested.status, 200);
    assert.deepEqual(suggested.data.interests, ['Food & Drinks']);
    assert.equal(suggested.data.items[0].fullName, 'Lime Lounge');
    // Other publishers still fill the rest of the strip.
    assert.ok(suggested.data.items.some((item) => item.fullName === 'Coral Sea Hotel'));

    const anonymous = await api('/suggestions');
    assert.equal(anonymous.status, 401);
  });

  it('filters the feed by category and free text', async () => {
    const byCategory = await api(`/posts?category=${encodeURIComponent('Food & Drinks')}`);
    assert.equal(byCategory.data.items.length, 1);


    const byOther = await api(`/posts?category=${encodeURIComponent('Accommodations')}`);
    assert.equal(byOther.data.items.length, 0);

    const byText = await api('/posts?q=poke');
    assert.equal(byText.data.items.length, 1);
  });

  it('exchanges messages and tracks unread counts', async () => {
    const opened = await api('/conversations', {
      method: 'POST',
      token: shopper.accessToken,
      body: { userId: business.user.id },
    });
    assert.equal(opened.status, 201);
    const conversationId = opened.data.conversation.id;

    await api(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      token: shopper.accessToken,
      body: { text: 'Do you cater for 30 people?' },
    });

    const inbox = await api('/conversations', { token: business.accessToken });
    assert.equal(inbox.data.items[0].unreadCount, 1);
    assert.equal(inbox.data.items[0].otherUser.fullName, 'Peter Sale');

    const read = await api(`/conversations/${conversationId}/read`, {
      method: 'POST',
      token: business.accessToken,
    });
    assert.equal(read.data.conversation.unreadCount, 0);

    const thread = await api(`/conversations/${conversationId}/messages`, {
      token: business.accessToken,
    });
    assert.equal(thread.data.items.length, 1);
    assert.equal(thread.data.items[0].isMine, false);
  });

  it('sends pictures and videos as messages and validates the media', async () => {
    const inbox = await api('/conversations', { token: shopper.accessToken });
    const conversationId = inbox.data.items[0].id;

    const photos = await api(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      token: shopper.accessToken,
      body: {
        media: [
          { type: 'image', url: 'https://cdn.test.sb/one.jpg' },
          { type: 'image', url: 'https://cdn.test.sb/two.jpg' },
        ],
      },
    });
    assert.equal(photos.status, 201);
    assert.equal(photos.data.message.text, '');
    assert.equal(photos.data.message.media.length, 2);

    const photoPreview = await api('/conversations', { token: shopper.accessToken });
    assert.equal(photoPreview.data.items[0].lastMessage.text, '2 photos');

    const clip = await api(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      token: shopper.accessToken,
      body: { media: [{ type: 'video', url: 'https://cdn.test.sb/clip.mp4' }] },
    });
    assert.equal(clip.status, 201);
    assert.equal(clip.data.message.media[0].type, 'video');

    const videoPreview = await api('/conversations', { token: shopper.accessToken });
    assert.equal(videoPreview.data.items[0].lastMessage.text, 'Video');

    const unsafe = await api(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      token: shopper.accessToken,
      body: { media: [{ type: 'image', url: 'javascript:alert(1)' }] },
    });
    assert.equal(unsafe.status, 400);

    const unknownType = await api(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      token: shopper.accessToken,
      body: { media: [{ type: 'audio', url: 'https://cdn.test.sb/song.mp3' }] },
    });
    assert.equal(unknownType.status, 400);

    const tooManyImages = await api(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      token: shopper.accessToken,
      body: {
        media: [1, 2, 3, 4, 5].map((index) => ({
          type: 'image',
          url: `https://cdn.test.sb/${index}.jpg`,
        })),
      },
    });
    assert.equal(tooManyImages.status, 400);

    const tooManyVideos = await api(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      token: shopper.accessToken,
      body: {
        media: [
          { type: 'video', url: 'https://cdn.test.sb/a.mp4' },
          { type: 'video', url: 'https://cdn.test.sb/b.mp4' },
        ],
      },
    });
    assert.equal(tooManyVideos.status, 400);

    const empty = await api(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      token: shopper.accessToken,
      body: { text: '   ' },
    });
    assert.equal(empty.status, 400);
  });

  it('blocks outsiders from reading a conversation', async () => {
    const outsider = await signUp('Nosy Neighbour', 'nosy@test.sb', 'user');
    const inbox = await api('/conversations', { token: shopper.accessToken });
    const conversationId = inbox.data.items[0].id;

    const denied = await api(`/conversations/${conversationId}/messages`, {
      token: outsider.accessToken,
    });
    assert.equal(denied.status, 403);
  });

  it('raises like, comment, follow and message notifications', async () => {
    // The like test above unliked and cleared its notification, so create a
    // live like again before checking the types that reach the author.
    await api(`/posts/${postId}/like`, { method: 'POST', token: shopper.accessToken });

    const notifications = await api('/notifications', { token: business.accessToken });
    const types = new Set(notifications.data.items.map((item) => item.type));

    assert.ok(types.has('like'));
    assert.ok(types.has('comment'));
    assert.ok(types.has('follow'));
    assert.ok(types.has('message'));
    assert.ok(notifications.data.unreadCount > 0);

    await api('/notifications/read-all', { method: 'POST', token: business.accessToken });
    const cleared = await api('/notifications/unread-count', { token: business.accessToken });
    assert.equal(cleared.data.unreadCount, 0);
  });

  it('never notifies the actor about their own actions', async () => {
    await api(`/posts/${postId}/like`, { method: 'POST', token: business.accessToken });
    const own = await api('/notifications', { token: business.accessToken });
    const selfLike = own.data.items.find(
      (item) => item.type === 'like' && item.actor?.id === business.user.id,
    );
    assert.equal(selfLike, undefined);
  });

  it('updates and deletes a post only for its owner', async () => {
    const denied = await api(`/posts/${postId}`, {
      method: 'PATCH',
      token: shopper.accessToken,
      body: { content: 'hijacked' },
    });
    assert.equal(denied.status, 403);

    const updated = await api(`/posts/${postId}`, {
      method: 'PATCH',
      token: business.accessToken,
      body: { content: 'Updated menu today', category: 'Food & Drinks' },
    });
    assert.equal(updated.data.post.content, 'Updated menu today');

    const removed = await api(`/posts/${postId}`, {
      method: 'DELETE',
      token: business.accessToken,
    });
    assert.equal(removed.status, 200);

    const gone = await api(`/posts/${postId}`);
    assert.equal(gone.status, 404);
  });

  it('edits the signed in profile and validates URLs', async () => {
    const updated = await api('/users/me', {
      method: 'PATCH',
      token: business.accessToken,
      body: {
        bio: 'Island cuisine',
        phone: '+677 21123',
        links: [
          { label: 'Website', url: 'https://limelounge.sb' },
          { label: '', url: 'https://facebook.com/limelounge' },
          { label: 'Empty row', url: '' },
        ],
      },
    });
    assert.equal(updated.data.user.bio, 'Island cuisine');
    assert.equal(updated.data.user.links.length, 2);
    assert.equal(updated.data.user.links[0].url, 'https://limelounge.sb/');
    assert.equal(updated.data.user.links[1].label, 'facebook.com');

    const badUrl = await api('/users/me', {
      method: 'PATCH',
      token: business.accessToken,
      body: { links: [{ label: 'Bad', url: 'javascript:alert(1)' }] },
    });
    assert.equal(badUrl.status, 400);

    const tooMany = await api('/users/me', {
      method: 'PATCH',
      token: business.accessToken,
      body: {
        links: [1, 2, 3, 4, 5, 6].map((index) => ({
          label: `Link ${index}`,
          url: `https://example.sb/${index}`,
        })),
      },
    });
    assert.equal(tooMany.status, 400);
  });

  it('lets a normal user list profile links too', async () => {
    const updated = await api('/users/me', {
      method: 'PATCH',
      token: shopper.accessToken,
      body: { links: [{ label: 'Blog', url: 'https://petersale.example' }] },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.user.links[0].label, 'Blog');
  });

  it('pushes paid businesses above newer free posts in the feed', async () => {
    const paid = await signUp('Paid Shop', 'paid@test.sb', 'business');
    const free = await signUp('Free Shop', 'free@test.sb', 'business');

    const older = await api('/posts', {
      method: 'POST',
      token: paid.accessToken,
      body: { content: 'Paid shop opening sale', category: 'Retail Shops' },
    });
    const newer = await api('/posts', {
      method: 'POST',
      token: free.accessToken,
      body: { content: 'Free shop opening sale', category: 'Retail Shops' },
    });
    assert.equal(older.status, 201, JSON.stringify(older.data));
    assert.equal(newer.status, 201, JSON.stringify(newer.data));

    const shops = `/posts?category=${encodeURIComponent('Retail Shops')}`;
    const onTrial = await api(shops);
    assert.equal(onTrial.data.items[0].id, newer.data.post.id);

    // Stripe would do this through the webhook; here we set the paid state directly.
    await mongoose.connection.collection('users').updateOne(
      { email: 'paid@test.sb' },
      {
        $set: {
          'subscription.status': 'active',
          'subscription.plan': 'monthly',
          'subscription.currentPeriodEnd': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      },
    );

    const boosted = await api(shops);
    assert.equal(boosted.data.items[0].id, older.data.post.id);

    const profile = await api(`/users/${paid.user.id}`);
    assert.equal(profile.data.user.subscription.isBoosted, true);
  });

  it('gives the verified badge to yearly subscribers only', async () => {
    const yearly = await signUp('Yearly Shop', 'yearly@test.sb', 'business');
    const post = await api('/posts', {
      method: 'POST',
      token: yearly.accessToken,
      body: { content: 'On the yearly plan', category: 'Retail Shops' },
    });
    assert.equal(post.status, 201, JSON.stringify(post.data));

    const setPlan = (plan) =>
      mongoose.connection.collection('users').updateOne(
        { email: 'yearly@test.sb' },
        {
          $set: {
            'subscription.status': 'active',
            'subscription.plan': plan,
            'subscription.currentPeriodEnd': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      );

    // The trial alone does not earn the badge.
    const onTrial = await api(`/users/${yearly.user.id}`);
    assert.equal(onTrial.data.user.isVerified, false);

    await setPlan('yearly');
    const verified = await api(`/users/${yearly.user.id}`);
    assert.equal(verified.data.user.isVerified, true);

    // Author refs carry it too, so the feed can show the tick.
    const posts = await api(`/users/${yearly.user.id}/posts`);
    assert.equal(posts.data.items[0].author.isVerified, true);

    await setPlan('monthly');
    const monthly = await api(`/users/${yearly.user.id}`);
    assert.equal(monthly.data.user.isVerified, false);

    // Each plan describes its own "what you get" list.
    const plans = (await api('/subscription', { token: yearly.accessToken })).data.plans;
    const byId = Object.fromEntries(plans.map((plan) => [plan.id, plan]));
    assert.equal(byId.monthly.verified, false);
    assert.equal(byId.yearly.verified, true);
    assert.ok(byId.monthly.benefits.length > 0);
    assert.notDeepEqual(byId.monthly.benefits, byId.yearly.benefits);
  });

  it('trials businesses for 14 days and stops new posts once that lapses', async () => {
    const trial = await api('/subscription', { token: business.accessToken });
    assert.equal(trial.status, 200);
    assert.equal(trial.data.trialDays, 14);
    assert.equal(trial.data.subscription.status, 'trialing');
    assert.equal(trial.data.subscription.canPublish, true);
    assert.deepEqual(
      trial.data.plans.map((plan) => plan.priceText),
      ['SBD 150 / month', 'SBD 1,500 / year'],
    );

    // Normal users never see a subscription and cannot start one.
    const shopperState = await api('/subscription', { token: shopper.accessToken });
    assert.equal(shopperState.data.subscription, null);
    const shopperCheckout = await api('/subscription/checkout', {
      method: 'POST',
      token: shopper.accessToken,
      body: { plan: 'monthly' },
    });
    assert.equal(shopperCheckout.status, 403);

    await mongoose.connection
      .collection('users')
      .updateOne(
        { email: 'business@test.sb' },
        { $set: { 'subscription.trialEndsAt': new Date(Date.now() - 1000) } },
      );

    const blocked = await api('/posts', {
      method: 'POST',
      token: business.accessToken,
      body: { content: 'Open again tomorrow' },
    });
    assert.equal(blocked.status, 402);

    const lapsed = await api('/subscription', { token: business.accessToken });
    assert.equal(lapsed.data.subscription.status, 'canceled');
    assert.equal(lapsed.data.subscription.canPublish, false);

    // Posts published earlier are still readable.
    const feed = await api(`/posts?category=${encodeURIComponent('Retail Shops')}`);
    assert.ok(feed.data.items.length >= 2);
  });

  it('lifts the categories a shopper picks at onboarding, without hiding the rest', async () => {
    const beauty = await signUp('Probe Salon', 'probesalon@test.sb', 'business', {
      category: 'Beauty & Fashion',
    });
    const health = await signUp('Probe Clinic', 'probeclinic@test.sb', 'business', {
      category: 'Health Care',
    });

    const older = await api('/posts', {
      method: 'POST',
      token: beauty.accessToken,
      body: { content: 'interestprobe haircuts', category: 'Beauty & Fashion' },
    });
    const newer = await api('/posts', {
      method: 'POST',
      token: health.accessToken,
      body: { content: 'interestprobe check ups', category: 'Health Care' },
    });
    assert.equal(older.status, 201, JSON.stringify(older.data));
    assert.equal(newer.status, 201, JSON.stringify(newer.data));

    const viewer = await signUp('Probe Shopper', 'probeshopper@test.sb', 'user');

    // No interests yet: plain newest first.
    const before = await api('/posts?q=interestprobe', { token: viewer.accessToken });
    assert.equal(before.data.items[0].id, newer.data.post.id);

    const saved = await api('/users/me/interests', {
      method: 'POST',
      token: viewer.accessToken,
      body: { categories: ['Beauty & Fashion'] },
    });
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.data.interests, ['Beauty & Fashion']);

    // The chosen category now outranks the newer post, but both stay in the feed.
    const after = await api('/posts?q=interestprobe', { token: viewer.accessToken });
    assert.equal(after.data.items[0].id, older.data.post.id);
    assert.equal(after.data.items.length, 2);

    // Skipping records nothing at all.
    const skipper = await signUp('Probe Skipper', 'probeskipper@test.sb', 'user');
    const skipped = await api('/users/me/interests', {
      method: 'POST',
      token: skipper.accessToken,
      body: { categories: [] },
    });
    assert.deepEqual(skipped.data.interests, []);
    const skipperFeed = await api('/posts?q=interestprobe', { token: skipper.accessToken });
    assert.equal(skipperFeed.data.items[0].id, newer.data.post.id);
  });

  it('rejects checkout when Dodo is not configured, and offline payment routes are removed', async () => {
    const publisher = await signUp('Bakery Shop', `bakery${Date.now()}@test.sb`, 'business');

    // Billing is disabled when Dodo credentials are not set.
    const plans = await api('/subscription', { token: publisher.accessToken });
    assert.equal(plans.data.billingEnabled, false);
    assert.equal(plans.data.pendingPayment, null);

    // Checkout fails with a clear message.
    const checkout = await api('/subscription/checkout', {
      method: 'POST',
      token: publisher.accessToken,
      body: { plan: 'monthly' },
    });
    assert.equal(checkout.status, 400, JSON.stringify(checkout.data));
    assert.ok(checkout.data.message.includes('not configured'));

    // Offline payment routes are removed.
    const offlinePost = await api('/subscription/payments', {
      method: 'POST',
      token: publisher.accessToken,
      body: { plan: 'monthly', reference: 'TEST123' },
    });
    assert.equal(offlinePost.status, 404);

    const adminQueue = await api('/subscription/admin/payments', { token: publisher.accessToken });
    assert.equal(adminQueue.status, 404);

    // The webhook is mounted, but does nothing until credentials exist.
    const webhook = await api('/subscription/webhook', {
      method: 'POST',
      body: { event_type: 'BILLING.SUBSCRIPTION.ACTIVATED' },
    });
    assert.equal(webhook.status, 503);
  });

  it('requires a token for protected routes', async () => {
    const anonymous = await api('/notifications');
    assert.equal(anonymous.status, 401);

    const badToken = await api('/notifications', { token: 'not-a-jwt' });
    assert.equal(badToken.status, 401);
  });
});
