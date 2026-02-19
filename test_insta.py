import instaloader
L = instaloader.Instaloader()
L.load_session_from_file('cooperdimson')
profile = instaloader.Profile.from_username(L.context, 'tiffanyandco')
print(f'Followers: {profile.followers:,}')
for i, post in enumerate(profile.get_posts()):
    if i >= 3: break
    print(f'\nPost {i+1}: {post.date_utc}')
    print(f'Likes: {post.likes:,} | Comments: {post.comments}')
    print(f'Caption: {post.caption[:200] if post.caption else "No caption"}')
