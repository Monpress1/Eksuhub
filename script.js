    // =================================================================================
    // --- CONFIGURATION ---
    // =================================================================================
    const SUPABASE_URL = 'https://wfhaiasdkkmwjzrndcmi.supabase.co'; 
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmaGFpYXNka2ttd2p6cm5kY21pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNTE5MDUsImV4cCI6MjA3OTcyNzkwNX0.jTBRJi4lpmbv4R5rxF_CS9GrF5UMVxiIH9Th9frGWWI';
    const REDIRECT_PAGE = 'auth.html'; 
    // NEW: RSS Feed for Reels
    const RSS_REEL_URL = "https://rss.app/feeds/v1.1/kmSUN1Tu1lXemtnl.json"; 

    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // --- FEED ALGORITHM CONFIGURATION ---
    const FEED_DISTRIBUTION_WEIGHTS = {
        post: 10.0,      
        newUser: 2,      
        marketProduct: 2,
        reel: 3          // 3 slots for Instagram Reels
    };

    const POSTS_PER_PAGE = 20; 
    let postOffset = 0;       
    let allPostsLoaded = false; 

    // --- DOM Elements ---
    const postForm = document.getElementById('postForm');
    const postStatus = document.getElementById('postStatus');
    const feedContainer = document.getElementById('feedContainer');
    const headerTitle = document.getElementById('headerTitle');
    const usernameDisplay = document.getElementById('usernameDisplay');
    const notificationBtn = document.getElementById('notificationBtn');
    const storiesContent = document.getElementById('storiesContent');
    const refreshStoriesBtn = document.getElementById('refreshStoriesBtn');
    const notificationCount = document.getElementById('notificationCount');
    const chatNotificationCount = document.getElementById('chatNotificationCount');

    // Menu Elements
    const menuToggleBtn = document.getElementById('menuToggleBtn');
    const menuSidebar = document.getElementById('menuSidebar');
    const menuProfileLink = document.getElementById('menuProfileLink');
    const menuLogoutLink = document.getElementById('menuLogoutLink');

    // Comment Modal Elements
    const commentModal = document.getElementById('commentModal');
    const commentForm = document.getElementById('commentForm');
    const postIdToComment = document.getElementById('postIdToComment');
    const commentingOnPostPreview = document.getElementById('commentingOnPostPreview');
    const commentContent = document.getElementById('commentContent');
    const commentStatus = document.getElementById('commentStatus');
    const existingComments = document.getElementById('existingComments'); 

    // Notification Modal Elements
    const notificationModal = document.getElementById('notificationModal');
    const notificationsList = document.getElementById('notificationsList');
    const markAllReadBtn = document.getElementById('markAllReadBtn');

    // PWA Elements
    const pwaInstallButton = document.getElementById("pwa-install-button");
    const androidPromptOverlay = document.getElementById('android-prompt-overlay');
    const iosPromptOverlay = document.getElementById('ios-prompt-overlay');
    let deferredPrompt;

    let currentUserId = null; 
    const PLACEHOLDER_AVATAR = 'https://via.placeholder.com/50/383838/f0f0f0?text=E'; 

    // =================================================================================
    // --- UTILITY FUNCTIONS ---
    // =================================================================================

    function getProfileUrl(userId) {
        return `profile.html?id=${userId}`;
    }

    function timeAgo(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + "y";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + "m";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + "d";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + "h";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + "min";
        return "just now";
    }

    async function compressImage(file) {
            return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = event => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const maxWidth = 800;
                    const scaleFactor = img.width > maxWidth ? maxWidth / img.width : 1;
                    canvas.width = img.width * scaleFactor;
                    canvas.height = img.height * scaleFactor;
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    canvas.toBlob(blob => {
                        if (!blob) return reject(new Error("Canvas compression failed."));
                        const compressedFile = new File([blob], file.name, {
                            type: file.type, lastModified: Date.now(),
                        });
                        resolve(compressedFile);
                    }, file.type, 0.7); 
                };
                img.onerror = error => reject(new Error("Failed to load image for compression."));
            };
            reader.onerror = error => reject(new Error("Failed to read file for compression."));
        });
    }

    async function uploadMedia(userId, file) {
        const fileExt = file.name.split('.').pop();
        const filePath = `${userId}/${Date.now()}.${fileExt}`; 
        const bucketName = 'media';
        const { error } = await supabaseClient.storage.from(bucketName).upload(filePath, file);
        if (error) throw new Error(`Media upload failed: ${error.message}`);
        const { data: publicUrlData } = supabaseClient.storage.from(bucketName).getPublicUrl(filePath);
        return publicUrlData.publicUrl;
    }

    async function checkUserSession() {
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        if (error || !user) { window.location.href = REDIRECT_PAGE; return null; }
        currentUserId = user.id;

        if (menuProfileLink) menuProfileLink.href = getProfileUrl(currentUserId);

        const { data: profile } = await supabaseClient
            .from('users')
            .select('username, avatar_url') 
            .eq('id', user.id)
            .single();
        
        if (profile) {
            if (profile.username) {
                const profileLinkUrl = getProfileUrl(user.id);
                headerTitle.innerHTML = `EksuHub<small id="usernameDisplay"><a href="${profileLinkUrl}" style="color: inherit; text-decoration: none;">@${profile.username}</a></small>`;
            }
            const liteAvatar = document.getElementById('lite-user-avatar');
            if (liteAvatar) liteAvatar.src = profile.avatar_url || PLACEHOLDER_AVATAR;
        } else {
                headerTitle.innerHTML = 'EksuHub<small>Feed</small>';
        }
        return user;
    }

    function updateThemeUI(isDarkMode) {
        document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    }

    function toggleMenu() {
        menuSidebar.classList.toggle('open');
    }

    document.addEventListener('click', (e) => {
        if (menuSidebar.classList.contains('open') && !menuSidebar.contains(e.target) && e.target !== menuToggleBtn && !menuToggleBtn.contains(e.target)) {
            menuSidebar.classList.remove('open');
        }
    });

    // --- TOP BAR STORIES LOGIC ---
    async function fetchTopBarStories() {
        const { data } = await supabaseClient.from('users').select('id, username, avatar_url').neq('id', currentUserId).limit(10);
        if (!data) return [];
        return data.sort(() => 0.5 - Math.random()).slice(0, 8);
    }

    
    // --- NEW: PEOPLE YOU MAY KNOW (PYMK) LOGIC ---
    async function fetchPYMKUsers() {
        // Fetch users with Dept and Level
        const { data } = await supabaseClient
            .from('users')
            .select('id, username, avatar_url, department, level') 
            .neq('id', currentUserId)
            .limit(20);
        
        if (!data) return [];
        // Randomize the results
        return data.sort(() => 0.5 - Math.random()).slice(0, 10);
    }

    async function renderPYMKSlider() {
        const suggestions = await fetchPYMKUsers();
        if (suggestions.length === 0) return ''; 

        const cards = suggestions.map(u => `
            <div class="pymk-card" style="flex: 0 0 140px; background: var(--card-bg); padding: 15px; border-radius: 12px; text-align: center; border: 1px solid var(--border-color); margin-right: 10px;">
                <img src="${u.avatar_url || PLACEHOLDER_AVATAR}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; margin-bottom: 8px;">
                <div style="font-weight: bold; font-size: 0.9em; color: var(--text-color); overflow:hidden; text-overflow:ellipsis;">@${u.username}</div>
                <div style="font-size: 0.75em; color: var(--text-secondary); margin-bottom: 2px; overflow:hidden; text-overflow:ellipsis;">${u.department || 'Student'}</div>
                <div style="font-size: 0.75em; color: var(--text-secondary); margin-bottom: 10px;">${u.level ? u.level + ' Lvl' : ''}</div>
                <a href="${getProfileUrl(u.id)}" style="display:block; background: var(--primary-color); color: white; padding: 6px; border-radius: 6px; text-decoration: none; font-size: 0.8em;">View Profile</a>
            </div>
        `).join('');

        return `
            <div class="pymk-section" style="margin: 20px 0; padding: 15px 0; border-top: 5px solid var(--bg-color); border-bottom: 5px solid var(--bg-color);">
                <h4 style="margin: 0 0 10px 15px; color: var(--text-color);">People You May Know</h4>
                <div class="pymk-slider" style="display: flex; overflow-x: auto; padding: 0 15px; scrollbar-width: none;">${cards}</div>
            </div>
        `;
    }

    // --- MARKETPLACE LOGIC ---
    async function fetchMarketProducts() {
        const { data, error } = await supabaseClient.from('products').select('id, name, price, image_url, created_at').order('created_at', { ascending: false }).limit(10); 
        if (error) return [];
        return data.map(p => ({
            id: p.id, type: 'marketProduct', created_at: p.created_at, name: p.name, price: p.price, image_url: p.image_url, user: { username: 'Marketplace' } 
        }));
    }

    function renderMarketCard(product) {
        return `
            <a href="market.html?product_id=${product.id}" class="market-card">
                <img src="${product.image_url || 'https://via.placeholder.com/80x80?text=Product'}" alt="${product.name}">
                <div class="market-info">
                    <h4><i class="fas fa-tag"></i> ${product.name}</h4>
                    <p>Listed ${timeAgo(product.created_at)}</p>
                    <p class="price">₦${product.price ? product.price.toLocaleString() : 'N/A'}</p>
                </div>
            </a>`;
    }

    // --- NEW: REEL RENDERER (With Safe-Crop & Permissions) ---
function renderReelCard(reel) {
    return `
        <div class="post-card" style="background: #000; color: white; padding: 0; overflow: hidden; border-radius: 15px; margin-bottom: 20px;">
            <div class="post-header" style="padding: 12px; border-bottom: 1px solid #222; background: #000;">
                <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888); display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                    <i class="fab fa-instagram" style="color: white; font-size: 20px;"></i>
                </div>
                <div class="post-info">
                    <strong style="color: white; font-size: 0.9rem;">Campus Reels</strong>
                    <span style="color: #888; font-size: 0.75rem;">Instagram Suggestion</span>
                </div>
            </div>

            <div style="width: 100%; position: relative; padding-top: 150%; background: #000; overflow: hidden;">
                <iframe 
                    src="https://www.instagram.com/reel/${reel.id}/embed" 
                    style="position: absolute; top: -50px; left: 0; width: 100%; height: calc(100% + 100px); border: none;" 
                    frameborder="0" 
                    scrolling="no" 
                    allowfullscreen 
                    allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                ></iframe>
            </div>

            <div style="padding: 12px; background: #000; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #222;">
                <span style="color: #888; font-size: 11px;"><i class="fas fa-play"></i> Tap to watch</span>
                <a href="https://www.instagram.com/reels/${reel.id}" target="_blank" style="color: var(--primary-color); text-decoration: none; font-size: 11px; font-weight: bold;">View Original</a>
            </div>
        </div>`;
}


    // --- POSTING LOGIC ---
    async function handlePostCreation(event) {
        event.preventDefault();
        const postStatus = document.getElementById('postStatus');
        const postContent = document.getElementById('postContent');
        if (!currentUserId) { if (postStatus) postStatus.textContent = 'Error: Log in to post.'; return; }
        if (postStatus) postStatus.textContent = 'Processing...';
        
        const content = postContent.value.trim();
        const mediaFile = document.getElementById('postMediaFile').files[0];
        let mediaUrl = null; 
        
        if (content.length === 0 && !mediaFile) { if (postStatus) postStatus.textContent = 'Enter text or add a photo.'; return; }
        
        let fileToUpload = mediaFile;
        if (mediaFile && mediaFile.type.startsWith('image/')) {
            try { if (postStatus) postStatus.textContent = 'Compressing...'; fileToUpload = await compressImage(mediaFile); } 
            catch (e) { if (postStatus) postStatus.textContent = `Error: ${e.message}`; return; }
        }
        
        if (mediaFile) {
            try { if (postStatus) postStatus.textContent = 'Uploading...'; mediaUrl = await uploadMedia(currentUserId, fileToUpload); } 
            catch (e) { if (postStatus) postStatus.textContent = `Upload failed.`; return; }
        }

        const { error: msgError } = await supabaseClient.from('messages').insert([{ user_id: currentUserId, content: content, image_url: mediaUrl }]);

        if (msgError) {
            if (postStatus) postStatus.textContent = `Error: ${msgError.message}`;
        } else {
            if (postStatus) postStatus.textContent = 'Success!';
            postForm.reset(); 
            document.getElementById('postMediaFile').value = '';
            setTimeout(() => { if (postStatus) postStatus.textContent = ''; }, 2000);
            fetchFeedPosts(0, true);
        }
    }

    // --- ANNOUNCEMENT LOGIC ---
    async function fetchNewUserAnnouncements() {
        const { data: newUsers, error } = await supabaseClient.from('users').select('username, created_at').order('created_at', { ascending: false }).limit(5);
        if (error) return [];
        return newUsers.map(user => ({
            id: `new-user-${user.username}`, type: 'newUser', created_at: user.created_at,
            content: `🎉 Welcome! **@${user.username}** just joined the Hub! Give them a follow.`, user: { username: 'EksuHub Admin' }
        }));
    }

    function renderNewUserAnnouncement(announcement) {
            return `
            <div class="post-card" style="border: 2px solid var(--primary-color); background-color: var(--primary-color)1a;">
                <div class="post-header">
                    <i class="fas fa-bullhorn post-avatar" style="line-height: 45px; border: none; background-color: var(--primary-color); color: white;"></i>
                    <div class="post-info"><strong>EksuHub Admin</strong><span>System Announcement</span></div>
                </div>
                <p class="post-content-text" style="font-weight: 600;">${announcement.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>
            </div>`;
    }

    // --- STANDARD POST RENDERER ---
    function createPostElement(post, commentsMap) {
        const userId = post.user ? post.user.id : null;
        const username = post.user ? post.user.username : 'Anonymous';
        const department = post.user ? post.user.department : '';
        const avatarUrl = post.user && post.user.avatar_url;
        const time = timeAgo(post.created_at);
        
        const heartReactions = post.reactions ? post.reactions.filter(r => r.emoji === 'heart') : [];
        const postLikes = heartReactions.length;
        const hasUserLiked = heartReactions.some(r => r.user_id === currentUserId); 
        const postComments = commentsMap[post.id] || [];
        
        const inlineComment = postComments.length > 0 ? `<div class="random-comment"><strong>@${postComments[0].user.username}</strong>: ${postComments[0].content.substring(0, 50)}...</div>` : '';
        
        let mediaHtml = '';
        if (post.image_url) {
            const url = post.image_url.toLowerCase();
            const mediaClass = (url.endsWith('.mp4') || url.endsWith('.webm')) ? 'post-video' : 'post-image';
            mediaHtml = mediaClass === 'post-video' ? `<video src="${post.image_url}" controls class="${mediaClass}"></video>` : `<img src="${post.image_url}" class="${mediaClass}" onerror="this.onerror=null; this.src='${PLACEHOLDER_AVATAR}'">`;
        }
        
        const avatarHtml = avatarUrl ? `<img src="${avatarUrl}" class="post-avatar" onerror="this.onerror=null; this.src='${PLACEHOLDER_AVATAR}'">` : `<i class="fas fa-user-circle post-avatar" style="line-height: 45px; border: none;"></i>`;
        const postContentHtml = post.content.trim() ? `<p class="post-content-text">${post.content}</p>` : `<p class="post-content-text" style="color:var(--text-secondary);font-style:italic;">No description.</p>`;

        const el = document.createElement('div');
        el.className = 'post-card';
        el.id = `post-${post.id}`;
        el.innerHTML = `
            <div class="post-header">
                <a href="${getProfileUrl(userId)}" style="text-decoration: none; display: contents;">${avatarHtml}</a>
                <div class="post-info">
                    <a href="${getProfileUrl(userId)}" style="color: inherit; text-decoration: none;"><strong>@${username}</strong></a>
                    <span>${department} | ${time}</span>
                </div>
            </div>
            ${postContentHtml} ${mediaHtml}
            <div class="post-actions">
                <span class="action-button like-toggle" data-post-id="${post.id}" onclick="handleLikeClick('${post.id}')">
                    <i class="fas fa-heart like-icon ${hasUserLiked ? 'liked' : ''}"></i> <span class="like-count">${postLikes}</span>
                </span>
                <span class="action-button comment-btn" data-post-id="${post.id}" onclick="handleCommentClick('${post.id}')">
                    <i class="fas fa-comment-dots"></i> <span class="comment-count">${postComments.length}</span>
                </span>
            </div>
            ${inlineComment}`;
        return el;
    }

    // --- MAIN FEED FETCH FUNCTION ---
    async function fetchFeedPosts(offset = 0, isInitialLoad = true) {
        const loadMoreButton = document.getElementById('load-more-btn');
        if (isInitialLoad) {
            feedContainer.innerHTML = '<p style="color: var(--text-secondary);">Loading latest posts...</p>';
            if (loadMoreButton) loadMoreButton.style.display = 'none';
            postOffset = 0;
            allPostsLoaded = false;
        } else if (loadMoreButton) {
            loadMoreButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
            loadMoreButton.disabled = true;
        }
        
        // Concurrent Fetching
        const [{ data: posts, error: postError }, newUserAnnouncements, marketProducts, reelsData, pymkHtml] = await Promise.all([
            supabaseClient.from('messages').select(`id, content, image_url, created_at, user:users (id, username, avatar_url, faculty, department), reactions(id, user_id, emoji)`).is('replied_to_id', null).order('created_at', { ascending: false }).range(offset, offset + POSTS_PER_PAGE - 1),
            isInitialLoad ? fetchNewUserAnnouncements() : Promise.resolve([]),
            isInitialLoad ? fetchMarketProducts() : Promise.resolve([]),
            
            // Fetch RSS Reels
            isInitialLoad ? fetch(RSS_REEL_URL).then(r => r.json()).catch(() => ({items: []})) : Promise.resolve({items: []}),
            // Fetch PYMK HTML
            isInitialLoad ? renderPYMKSlider() : Promise.resolve('')
        ]);
        
        if (postError) { 
            if (isInitialLoad) feedContainer.innerHTML = `<p style="color: red;">Error: ${postError.message}</p>`;
            updateLoadMoreButtonState(); return; 
        }
        if (posts.length < POSTS_PER_PAGE) allPostsLoaded = true;

      // --- IMPROVED REELS PROCESSING ---
const reelPool = (reelsData?.items || []).reduce((acc, item) => {
    if (!item.url) return acc;

    // Matches 'reel/', 'reels/', or 'p/' followed by the alphanumeric ID
    const regex = /(?:reel|reels|p)\/([a-zA-Z0-9_-]+)/;
    const match = item.url.match(regex);

    if (match && match[1]) {
        acc.push({
            id: match[1],
            type: 'reel',
            // Default to current time if date_published is missing
            created_at: item.date_published || new Date().toISOString(),
            // Optional: Store the original title or thumbnail if needed
            title: item.title || '' 
        });
    }
    return acc;
}, []);

// --- POST POOL ---
// Using .map is fine, but ensure posts exists
const postPool = (posts || []).map(p => ({ ...p, type: 'post' }));

        // --- DISTRIBUTION ALGORITHM ---
        let combinedFeed = [];
        const availableItems = { post: postPool, newUser: newUserAnnouncements, marketProduct: marketProducts, reel: reelPool };
        const distributionSlots = [];
        for (const type in FEED_DISTRIBUTION_WEIGHTS) {
            if (!isInitialLoad && type !== 'post') continue; // Only mix extras on first load
            for (let i = 0; i < FEED_DISTRIBUTION_WEIGHTS[type]; i++) distributionSlots.push(type);
        }
        
        const totalItems = Object.values(availableItems).reduce((a, b) => a + b.length, 0);
        
        while (combinedFeed.length < totalItems) {
            if (distributionSlots.length === 0) {
                // If slots empty, dump remaining posts
                    if (availableItems.post.length > 0) combinedFeed.push(availableItems.post.shift());
                    else break; 
                    continue;
            }
            const rIndex = Math.floor(Math.random() * distributionSlots.length);
            const type = distributionSlots[rIndex];
            
            if (availableItems[type] && availableItems[type].length > 0) {
                combinedFeed.push(availableItems[type].shift());
                distributionSlots.splice(rIndex, 1);
            } else {
                distributionSlots.splice(rIndex, 1);
            }
        }
        combinedFeed.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // Fetch comments for posts
        const postIds = combinedFeed.filter(i => i.type === 'post').map(p => p.id);
        let commentsMap = {};
        if (postIds.length > 0) {
                const { data: cData } = await supabaseClient.from('messages').select(`replied_to_id, content, created_at, user:users(username)`).in('replied_to_id', postIds).order('created_at', { ascending: false }); 
                commentsMap = cData ? cData.reduce((acc, c) => { acc[c.replied_to_id] = acc[c.replied_to_id] || []; acc[c.replied_to_id].push(c); return acc; }, {}) : {};
        }

        if (isInitialLoad) feedContainer.innerHTML = '';
        
        
        
        // --- RENDER FEED ---
        if (combinedFeed.length === 0 && isInitialLoad) feedContainer.innerHTML = '<p style="color: var(--text-secondary);">No content available.</p>'; 
        
        combinedFeed.forEach((item, index) => {
            // Inject PYMK slider after the 3rd item (index 3)
            if (isInitialLoad && index === 3 && pymkHtml) {
                feedContainer.insertAdjacentHTML('beforeend', pymkHtml);
            }

            if (item.type === 'post') feedContainer.appendChild(createPostElement(item, commentsMap));
            else if (item.type === 'reel') feedContainer.insertAdjacentHTML('beforeend', renderReelCard(item));
            else if (item.type === 'newUser') feedContainer.insertAdjacentHTML('beforeend', renderNewUserAnnouncement(item));
            else if (item.type === 'marketProduct') feedContainer.insertAdjacentHTML('beforeend', renderMarketCard(item));
        });

        if (posts.length > 0) postOffset += posts.length;
        updateLoadMoreButtonState();
    }

    function loadNextPage() { fetchFeedPosts(postOffset, false); }

    function updateLoadMoreButtonState() {
        const loadMoreButton = document.getElementById('load-more-btn');
        if (!loadMoreButton) return;
        if (allPostsLoaded) {
            loadMoreButton.style.display = 'none'; 
            if (!document.getElementById('end-of-feed-msg')) {
                const endMsg = document.createElement('p');
                endMsg.id = 'end-of-feed-msg';
                endMsg.textContent = 'You have reached the end of the feed.';
                endMsg.style.cssText = 'text-align: center; color: var(--text-secondary); margin-top: 20px;';
                feedContainer.insertAdjacentElement('afterend', endMsg); 
            }
        } else {
            loadMoreButton.style.display = 'block';
            loadMoreButton.innerHTML = 'Load More Posts';
            loadMoreButton.disabled = false;
            const endMsg = document.getElementById('end-of-feed-msg');
            if (endMsg) endMsg.remove();
        }
    }

    async function handleLikeClick(postId) {
        if (!currentUserId) { alert("Login to like."); return; }
        const span = document.querySelector(`.like-toggle[data-post-id="${postId}"]`);
        if (!span) return;
        const icon = span.querySelector('.like-icon');
        const countSpan = span.querySelector('.like-count');
        span.style.pointerEvents = 'none';

        const { data: exists } = await supabaseClient.from('reactions').select('id').eq('message_id', postId).eq('user_id', currentUserId).eq('emoji', 'heart').maybeSingle();
        let newCount = parseInt(countSpan.textContent);
        let error = null;

        if (exists) {
            const res = await supabaseClient.from('reactions').delete().eq('id', exists.id);
            if (!res.error) { newCount--; icon.classList.remove('liked'); } error = res.error;
        } else {
            const res = await supabaseClient.from('reactions').insert([{ message_id: postId, user_id: currentUserId, emoji: 'heart' }]);
            if (!res.error) { newCount++; icon.classList.add('liked'); } error = res.error;
        }
        if (error) { alert('Action failed'); icon.classList.toggle('liked'); }
        else { countSpan.textContent = newCount; }
        span.style.pointerEvents = 'auto';
    }

    // --- COMMENT LOGIC ---
    function renderExistingComments(comments) {
        if (comments.length === 0) { existingComments.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No comments yet.</p>'; return; }
        existingComments.innerHTML = '';
        comments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        comments.forEach(c => {
            const u = c.user ? c.user.username : 'Deleted';
            const av = c.user && c.user.avatar_url ? `<img src="${c.user.avatar_url}" style="width:35px;height:35px;border-radius:50%;object-fit:cover;">` : `<i class="fas fa-user-circle" style="font-size:35px;color:#ccc;"></i>`;
            existingComments.innerHTML += `<div style="display:flex;gap:10px;margin-bottom:10px;">${av}<div><strong>@${u}</strong><p>${c.content}</p></div></div>`;
        });
    }

    async function handleCommentClick(postId) {
        if (!currentUserId) { alert("Login to comment."); return; }
        commentStatus.textContent = 'Loading...';
        existingComments.innerHTML = 'Loading...'; 
        const { data: post } = await supabaseClient.from('messages').select(`content, user:users(username)`).eq('id', postId).single();
        if (!post) return;
        const { data: comments } = await supabaseClient.from('messages').select(`id, content, created_at, user:users(username, avatar_url)`).eq('replied_to_id', postId).order('created_at', { ascending: true }); 
        postIdToComment.value = postId;
        commentingOnPostPreview.innerHTML = `Replying to @${post.user.username}: ${post.content.substring(0, 50)}...`;
        renderExistingComments(comments || []);
        commentModal.style.display = 'flex';
        commentContent.focus(); 
        commentStatus.textContent = '';
    }

    async function handleCommentSubmission(e) {
        e.preventDefault();
        const content = commentContent.value.trim();
        const pid = postIdToComment.value;
        if (!content) return;
        const { error } = await supabaseClient.from('messages').insert([{ user_id: currentUserId, content: content, replied_to_id: pid }]);
        if (!error) { 
            commentContent.value = ''; 
            handleCommentClick(pid);
            const btn = document.querySelector(`.comment-btn[data-post-id="${pid}"] .comment-count`);
            if(btn) btn.textContent = parseInt(btn.textContent) + 1;
        }
    }

    // --- NOTIFICATION & CHAT BADGES ---
    async function fetchUnreadChatCount() {
        if (!currentUserId) return 0;
        const { data: conversations } = await supabaseClient.from('conversations').select('id').or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`);
        if (!conversations || conversations.length === 0) return 0;
        const conversationIds = conversations.map(c => c.id);
        const { count, error } = await supabaseClient.from('chat_messages').select('id', { count: 'exact', head: true }).in('conversation_id', conversationIds).neq('sender_id', currentUserId).eq('is_read', false);
        if (error) return 0;
        if (chatNotificationCount) {
            chatNotificationCount.textContent = count > 0 ? count : '';
            chatNotificationCount.style.display = count > 0 ? 'inline' : 'none';
        }
        return count;
    }

    async function fetchUnreadNotificationCount() {
        if (!currentUserId) return;
        const { count: generalCount } = await supabaseClient.from('notifications').select('id', { count: 'exact', head: true }).eq('recipient_id', currentUserId).eq('is_read', false);
        const unreadChatCount = await fetchUnreadChatCount();
        const totalUnread = (generalCount || 0) + unreadChatCount;
        if (notificationCount) {
            notificationCount.textContent = totalUnread > 0 ? totalUnread : '';
            notificationCount.style.display = totalUnread > 0 ? 'inline' : 'none';
        }
    }

    async function renderNotifications() {
        notificationsList.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Loading...</p>';
        const { data: notifs, error } = await supabaseClient.from('notifications').select(`id, type, created_at, is_read, message_id, sender:users!notifications_sender_id_fkey(username)`).eq('recipient_id', currentUserId).order('created_at', { ascending: false }).limit(20);
        if (error) { notificationsList.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`; return; }
        
        const unreadChatCount = await fetchUnreadChatCount();
        let chatNotifs = [];
        if (unreadChatCount > 0) {
            chatNotifs = [{ id: 'chat-summary-temp', type: 'chat', created_at: new Date().toISOString(), is_read: false, sender: { username: 'System' }, message_id: null, message: { content: `${unreadChatCount} unread chat message(s). Click to view.` } }];
        }
        const combinedNotifs = [...chatNotifs, ...notifs];
        if (combinedNotifs.length === 0) { notificationsList.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No new notifications.</p>'; return; }
        
        let html = '';
        combinedNotifs.forEach(n => {
            const senderName = n.type === 'chat' ? 'Chat' : (n.sender ? `@${n.sender.username}` : 'A user');
            let iconClass = 'fas fa-info-circle', text = 'Notification', targetLink = '#';
            if(n.type === 'like') { iconClass = 'fas fa-heart'; text = `${senderName} liked your post.`; targetLink = `feed.html#post-${n.message_id}`; }
            else if(n.type === 'comment') { iconClass = 'fas fa-comment-dots'; text = `${senderName} commented on your post.`; targetLink = `feed.html#post-${n.message_id}`; }
            else if(n.type === 'chat') { iconClass = 'fas fa-comment-alt'; text = `${senderName}: ${n.message ? n.message.content : 'New messages.'}`; targetLink = 'chat.html'; }
            html += `<a href="${targetLink}" class="notification-item ${n.is_read ? '' : 'unread'}" style="text-decoration: none;"><i class="${iconClass}"></i><span class="notification-text">${text}</span><span class="notification-time">${timeAgo(n.created_at)}</span></a>`;
        });
        notificationsList.innerHTML = html;
    }

    async function markAllNotificationsAsRead() {
        if (!currentUserId) return;
        const { error } = await supabaseClient.from('notifications').update({ is_read: true }).eq('recipient_id', currentUserId).eq('is_read', false);
        if (!error) { 
            if (notificationCount) { notificationCount.textContent = ''; notificationCount.style.display = 'none'; }
            renderNotifications(); 
        }
    }

    function toggleNotificationModal() {
        if (!currentUserId) { alert("You must be logged in."); return; }
        if (notificationModal.style.display === 'flex') { notificationModal.style.display = 'none'; document.body.style.overflow = 'auto'; } 
        else { renderNotifications(); notificationModal.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
    }

    
// --- ENHANCED MULTI-STEP BOT GUIDE ---
function showBotGuide() {
    if (localStorage.getItem('guide_done')) return;

    const steps = [
        {
            title: "Hey Scholar!",
            msg: "Welcome to EksuHub! Let's take a quick tour of your campus app.",
            btn: "Start Tour",
            targetId: null
        },
        {
            title: "Navigation Menu",
            msg: "Click here to access your profile, marketplace, and settings.",
            btn: "Next",
            targetId: "menuToggleBtn" 
        },
        {
            title: "Share Updates",
            msg: "Use this area to post text, images, or videos to the campus feed.",
            btn: "Next",
            targetId: "postForm" 
        },
        {
            title: "Find People",
            msg: "Connect with students from your department and level here.",
            btn: "Next",
            targetId: "storiesContent" 
        },
        {
            title: "Stay Notified 📳",
            msg: "To get notification alerts: Open Menu and click 'Enable Notifications'. Never miss a message!",
            btn: "Finish",
            targetId: "menuToggleBtn" 
        }
    ];

    let currentStep = 0;
    let typingTimer;

    const overlay = document.createElement('div');
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:9998;";
    
    const alertBox = document.createElement('div');
    // Initial centering for step 1
    alertBox.style.cssText = "position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:var(--card-bg); padding:20px; border-radius:12px; text-align:center; width:95%; max-width:400px; z-index:10000; border:1px solid var(--primary-color); box-shadow: 0 4px 15px rgba(0,0,0,0.3); transition: all 0.5s ease;";
    
    const arrow = document.createElement('div');
    arrow.style.cssText = "position:fixed; z-index:9999; font-size:35px; transition: all 0.3s ease; pointer-events:none; display:none;";
    arrow.innerHTML = "⬆️";

    function typeWriter(text, element) {
        element.innerHTML = "";
        let i = 0;
        clearInterval(typingTimer);
        
        // Highlight logic: replace keywords with styled spans
        const highlightedText = text.replace(/(EksuHub|notification|notifications|message)/gi, '<span style="color:orangered; font-weight:bold;">$1</span>');
        
        // We use a temporary div to handle HTML tags correctly during typing
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = highlightedText;
        const nodes = Array.from(tempDiv.childNodes);
        
        let nodeIndex = 0;
        let charIndex = 0;

        typingTimer = setInterval(() => {
            if (nodeIndex < nodes.length) {
                const currentNode = nodes[nodeIndex];
                if (currentNode.nodeType === Node.TEXT_NODE) {
                    element.innerHTML += currentNode.textContent.charAt(charIndex);
                    charIndex++;
                    if (charIndex >= currentNode.textContent.length) {
                        nodeIndex++;
                        charIndex = 0;
                    }
                } else {
                    // It's a span (highlighted word), append it instantly
                    element.appendChild(currentNode.cloneNode(true));
                    nodeIndex++;
                }
            } else {
                clearInterval(typingTimer);
            }
        }, 30);
    }

    function updateStep() {
        const step = steps[currentStep];
        
        // Position Adjustment: Center for step 0, Bottom for others
        if (currentStep === 0) {
            alertBox.style.top = "50%";
            alertBox.style.bottom = "auto";
            alertBox.style.transform = "translate(-50%, -50%)";
        } else {
            alertBox.style.top = "auto";
            alertBox.style.bottom = "25px";
            alertBox.style.transform = "translateX(-50%)";
        }

        alertBox.innerHTML = `
            <img src="bot.jpg" style="width:90px; height:90px; border-radius:50%; border:2px solid var(--primary-color); object-fit:cover; margin-bottom:10px;" onerror="this.src='https://via.placeholder.com/80?text=🤖'">
            <h2 style="color:var(--primary-color); margin:5px 0;">${step.title}</h2>
            <p id="guide-msg-content" style="margin-bottom:15px; font-size:0.95em; line-height:1.4; min-height:3em;"></p>
            <button id="guide-next-btn" style="background:var(--primary-color); color:white; border:none; padding:12px; border-radius:8px; width:100%; font-weight:bold; cursor:pointer;">${step.btn}</button>
        `;

        const msgContainer = document.getElementById('guide-msg-content');
        typeWriter(step.msg, msgContainer);

        // Arrow Logic
        if (step.targetId) {
            const target = document.getElementById(step.targetId);
            if (target) {
                const rect = target.getBoundingClientRect();
                arrow.style.display = "block";
                arrow.style.left = (rect.left + (rect.width / 2) - 17) + "px";
                arrow.style.top = (rect.bottom + 10) + "px";
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } else {
            arrow.style.display = "none";
        }

        document.getElementById('guide-next-btn').onclick = () => {
            currentStep++;
            if (currentStep < steps.length) {
                updateStep();
            } else {
                overlay.remove();
                alertBox.remove();
                arrow.remove();
                localStorage.setItem('guide_done', 'true');
            }
        };
    }

    document.body.appendChild(overlay);
    document.body.appendChild(alertBox);
    document.body.appendChild(arrow);
    updateStep();
}

    function setupInfiniteScroll() {
        if (document.getElementById('scroll-sentinel')) return;
        const sentinel = document.createElement('div'); sentinel.id = 'scroll-sentinel';
        sentinel.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
        feedContainer.after(sentinel);
        new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !allPostsLoaded) loadNextPage();
        }, { threshold: 0.1 }).observe(sentinel);
    }

    // --- PWA LOGIC ---
    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
        return outputArray;
    }

    document.addEventListener('DOMContentLoaded', async () => {
        updateThemeUI(localStorage.getItem('theme') === 'dark'); 
        const user = await checkUserSession();
        
        if (user) {
            fetchFeedPosts(0, true); 
            
            fetchUnreadNotificationCount();
            setupInfiniteScroll(); 
            setTimeout(showBotGuide, 3000); 

            // Realtime Subs
            supabaseClient.channel('public:notifications').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${currentUserId}` }, fetchUnreadNotificationCount).subscribe();
            supabaseClient.channel('public:chat_messages').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, fetchUnreadNotificationCount).subscribe();
        }
        
        postForm.addEventListener('submit', handlePostCreation);
        notificationBtn.addEventListener('click', toggleNotificationModal);
        commentForm.addEventListener('submit', handleCommentSubmission);
        markAllReadBtn.addEventListener('click', markAllNotificationsAsRead);
        
        if (menuToggleBtn) menuToggleBtn.addEventListener('click', toggleMenu);
        if (menuLogoutLink) menuLogoutLink.addEventListener('click', async () => { await supabaseClient.auth.signOut(); window.location.href = REDIRECT_PAGE; });
        
        // PWA Install
        window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; if(!/iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase())) androidPromptOverlay.style.display = 'flex'; });
        if (pwaInstallButton) pwaInstallButton.addEventListener('click', async () => { if(deferredPrompt){ deferredPrompt.prompt(); deferredPrompt = null; androidPromptOverlay.style.display='none'; }});

        // PWA Push
        const enableNotifBtn = document.getElementById("enableNotifications");
        if (enableNotifBtn) {
            enableNotifBtn.addEventListener("click", async () => {
                if (!("Notification" in window)) return alert("Not supported");
                let perm = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
                if (perm === "granted") {
                    const reg = await navigator.serviceWorker.register('sw.js');
                    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array('BCsdeMpKPh58L1p16fhaZvmIwyQF9mgp1IRwO39bxSc6qtefudhOlSSgdk5sILLtgUsoEqbNu5NccmCjt_RBkU4') });
                    await supabaseClient.from('push_subscriptions').upsert({ user_id: currentUserId, subscription_json: sub.toJSON(), last_updated: new Date().toISOString() }, { onConflict: 'subscription_json' });
                    alert("Notifications Enabled!");
                }
            });
        }
    });
// 1. Helper function (Matches your placement)
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// 2. Main logic
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("enableNotifications");

  if (!btn) {
    console.error("Button with ID 'enableNotifications' not found in HTML!");
    return;
  }

  btn.addEventListener("click", async () => {
    const publicVapidKey = 'BCsdeMpKPh58L1p16fhaZvmIwyQF9mgp1IRwO39bxSc6qtefudhOlSSgdk5sILLtgUsoEqbNu5NccmCjt_RBkU4';

    try {
      if (!("Notification" in window)) {
        alert("This browser does not support notifications");
        return;
      }

      let permission = Notification.permission;

      // 1. If we haven't asked yet, ask now
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }
      
      // 2. If granted (either just now or previously)
      if (permission === "granted") {
        console.log("Permission is granted. Syncing with database...");
        
        // Use '/sw.js' if 'sw.js' gives a file not found error
        const registration = await navigator.serviceWorker.register('sw.js');
        await navigator.serviceWorker.ready;

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
        });

        // Get user from Supabase Auth
        const { data: { user } } = await supabaseClient.auth.getUser();

        // 3. Save/Update in Database
        const { error } = await supabaseClient
          .from('push_subscriptions')
          .upsert({ 
            user_id: user ? user.id : null, 
            subscription_json: subscription.toJSON(),
            last_updated: new Date().toISOString()
          }, { onConflict: 'subscription_json' });

        if (error) throw error;
        
        alert("Device Synced! You are ready for notifications. 🎉");
      } else {
        alert("Notifications are blocked in your settings.");
      }
    } catch (err) {
      console.error(err);
      alert("Sync Error: " + err.message);
    }
  });
});

    
