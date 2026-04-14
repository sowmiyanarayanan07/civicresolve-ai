/**
 * Community Service
 * Uses Supabase (PostgreSQL + Realtime) when configured,
 * falls back to localStorage for local dev / demo mode.
 */
import { CommunityPost, PostComment, Role } from '../types';
import { getSupabaseClient } from './supabaseConfig';

const LS_KEY = 'civic_community_posts';

// ─── localStorage fallback ─────────────────────────────────────────────────
function lsGet(): CommunityPost[] {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}
function lsSet(posts: CommunityPost[]) {
    localStorage.setItem(LS_KEY, JSON.stringify(posts));
}

const lsListeners: Array<(posts: CommunityPost[]) => void> = [];
function lsNotify() { const posts = lsGet(); lsListeners.forEach(fn => fn(posts)); }

// ─── Helpers: map DB row ↔ CommunityPost ─────────────────────────────────
function rowToPost(row: Record<string, unknown>): CommunityPost {
    return {
        id: row.id as string,
        authorId: row.author_id as string,
        authorName: row.author_name as string,
        authorRole: row.author_role as Role,
        authorAvatar: row.author_avatar as string | undefined,
        content: row.content as string,
        image: row.image as string | undefined,
        tag: row.tag as CommunityPost['tag'],
        likes: (row.likes as string[]) || [],
        comments: (row.comments as PostComment[]) || [],
        createdAt: new Date(row.created_at as string).getTime(),
    };
}

function postToRow(post: CommunityPost): Record<string, unknown> {
    return {
        id: post.id,
        author_id: post.authorId,
        author_name: post.authorName,
        author_role: post.authorRole,
        author_avatar: post.authorAvatar ?? null,
        content: post.content,
        image: post.image ?? null,
        tag: post.tag,
        likes: post.likes,
        comments: post.comments,
        created_at: new Date(post.createdAt).toISOString(),
    };
}

// ─── CRUD Operations ─────────────────────────────────────────────────────

export const getPosts = async (): Promise<CommunityPost[]> => {
    const sb = getSupabaseClient();
    if (!sb) return lsGet();

    const { data, error } = await sb.from('community_posts')
        .select('*')
        .order('created_at', { ascending: false });
        
    if (error) {
        console.error('[Supabase] getPosts:', error.message);
        return [];
    }
    return (data || []).map(rowToPost);
};

export const addPost = async (post: CommunityPost): Promise<void> => {
    const sb = getSupabaseClient();
    if (!sb) {
        const list = lsGet();
        list.unshift(post); // newest first
        lsSet(list);
        lsNotify();
        return;
    }

    const { error } = await sb.from('community_posts').insert(postToRow(post));
    if (error) console.error('[Supabase] addPost:', error.message);
};

export const deletePost = async (id: string, authorId: string): Promise<void> => {
    const sb = getSupabaseClient();
    if (!sb) {
        lsSet(lsGet().filter(p => !(p.id === id && p.authorId === authorId)));
        lsNotify();
        return;
    }

    const { error } = await sb.from('community_posts')
        .delete()
        .eq('id', id)
        .eq('author_id', authorId);
    if (error) console.error('[Supabase] deletePost:', error.message);
};

export const toggleLike = async (postId: string, userId: string): Promise<void> => {
    const sb = getSupabaseClient();
    if (!sb) {
        const list = lsGet();
        const idx = list.findIndex(p => p.id === postId);
        if (idx !== -1) {
            const post = list[idx];
            if (post.likes.includes(userId)) post.likes = post.likes.filter(id => id !== userId);
            else post.likes.push(userId);
            list[idx] = post;
            lsSet(list);
            lsNotify();
        }
        return;
    }

    // We fetch the current likes and update. (In a truly concurrent app you'd use a postgres function).
    const { data } = await sb.from('community_posts').select('likes').eq('id', postId).maybeSingle();
    if (!data) return;

    let currentLikes: string[] = data.likes || [];
    if (currentLikes.includes(userId)) {
        currentLikes = currentLikes.filter(id => id !== userId);
    } else {
        currentLikes.push(userId);
    }

    const { error } = await sb.from('community_posts').update({ likes: currentLikes }).eq('id', postId);
    if (error) console.error('[Supabase] toggleLike:', error.message);
};

export const addComment = async (postId: string, comment: PostComment): Promise<void> => {
    const sb = getSupabaseClient();
    if (!sb) {
        const list = lsGet();
        const idx = list.findIndex(p => p.id === postId);
        if (idx !== -1) {
            list[idx].comments.push(comment);
            lsSet(list);
            lsNotify();
        }
        return;
    }

    const { data } = await sb.from('community_posts').select('comments').eq('id', postId).maybeSingle();
    if (!data) return;

    const currentComments: PostComment[] = data.comments || [];
    currentComments.push(comment);

    const { error } = await sb.from('community_posts').update({ comments: currentComments }).eq('id', postId);
    if (error) console.error('[Supabase] addComment:', error.message);
};

export const deleteComment = async (postId: string, commentId: string, authorId: string): Promise<void> => {
    const sb = getSupabaseClient();
    if (!sb) {
        const list = lsGet();
        const idx = list.findIndex(p => p.id === postId);
        if (idx !== -1) {
            list[idx].comments = list[idx].comments.filter(c => !(c.id === commentId && c.authorId === authorId));
            lsSet(list);
            lsNotify();
        }
        return;
    }

    const { data } = await sb.from('community_posts').select('comments').eq('id', postId).maybeSingle();
    if (!data) return;

    const currentComments: PostComment[] = data.comments || [];
    const newComments = currentComments.filter(c => !(c.id === commentId && c.authorId === authorId));

    const { error } = await sb.from('community_posts').update({ comments: newComments }).eq('id', postId);
    if (error) console.error('[Supabase] deleteComment:', error.message);
};

/** Subscribe via realtime (Supabase) or polling/events (localStorage) */
export const subscribeToPosts = (cb: (posts: CommunityPost[]) => void): (() => void) => {
    const sb = getSupabaseClient();
    
    if (!sb) {
        lsListeners.push(cb);
        cb(lsGet());
        const id = window.setInterval(() => cb(lsGet()), 3000);
        const onStorage = (e: StorageEvent) => { if (e.key === LS_KEY) cb(lsGet()); };
        window.addEventListener('storage', onStorage);
        return () => {
            const i = lsListeners.indexOf(cb);
            if (i !== -1) lsListeners.splice(i, 1);
            clearInterval(id);
            window.removeEventListener('storage', onStorage);
        };
    }

    // Fetch initial data
    sb.from('community_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
            if (error) console.error('[Supabase] fetch community posts:', error.message);
            else cb((data || []).map(rowToPost));
        });

    // Subscribe to realtime changes
    const channel = sb
        .channel('community-posts-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'community_posts' },
            async () => {
                const { data } = await sb.from('community_posts').select('*').order('created_at', { ascending: false });
                cb((data || []).map(rowToPost));
            }
        )
        .subscribe();

    return () => { sb.removeChannel(channel); };
};
