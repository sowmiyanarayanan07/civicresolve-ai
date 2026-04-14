/**
 * Community Service
 * Pure localStorage CRUD — no DB/Supabase needed.
 * Stores all community posts under 'civic_community_posts'.
 * Pattern mirrors disasterResourceService.ts for easy Supabase upgrade later.
 */
import { CommunityPost, PostComment } from '../types';

const LS_KEY = 'civic_community_posts';

function lsGet(): CommunityPost[] {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}
function lsSet(posts: CommunityPost[]) {
    localStorage.setItem(LS_KEY, JSON.stringify(posts));
}

export const getPosts = (): CommunityPost[] => lsGet();

export const addPost = (post: CommunityPost): void => {
    const list = lsGet();
    list.unshift(post); // newest first
    lsSet(list);
};

export const deletePost = (id: string, authorId: string): void => {
    lsSet(lsGet().filter(p => !(p.id === id && p.authorId === authorId)));
};

export const toggleLike = (postId: string, userId: string): void => {
    const list = lsGet();
    const idx = list.findIndex(p => p.id === postId);
    if (idx === -1) return;
    const post = list[idx];
    if (post.likes.includes(userId)) {
        post.likes = post.likes.filter(id => id !== userId);
    } else {
        post.likes.push(userId);
    }
    list[idx] = post;
    lsSet(list);
};

export const addComment = (postId: string, comment: PostComment): void => {
    const list = lsGet();
    const idx = list.findIndex(p => p.id === postId);
    if (idx === -1) return;
    list[idx].comments.push(comment);
    lsSet(list);
};

export const deleteComment = (postId: string, commentId: string, authorId: string): void => {
    const list = lsGet();
    const idx = list.findIndex(p => p.id === postId);
    if (idx === -1) return;
    list[idx].comments = list[idx].comments.filter(
        c => !(c.id === commentId && c.authorId === authorId)
    );
    lsSet(list);
};

/** Subscribe via polling — calls cb whenever storage changes, returns unsubscribe fn */
export const subscribeToPosts = (cb: (posts: CommunityPost[]) => void): (() => void) => {
    cb(lsGet());
    const id = window.setInterval(() => cb(lsGet()), 3000);
    const onStorage = (e: StorageEvent) => {
        if (e.key === LS_KEY) cb(lsGet());
    };
    window.addEventListener('storage', onStorage);
    return () => {
        clearInterval(id);
        window.removeEventListener('storage', onStorage);
    };
};
