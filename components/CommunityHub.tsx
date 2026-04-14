import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CommunityPost, PostComment, PostTag, Role, User } from '../types';
import {
    getPosts, addPost, deletePost, toggleLike,
    addComment, deleteComment, subscribeToPosts,
} from '../services/communityService';

// ── Tag configuration ─────────────────────────────────────────────────────────
const TAG_CONFIG: Record<PostTag, { label: string; icon: string; color: string; bg: string; border: string }> = {
    discussion:   { label: 'Discussion',   icon: 'fa-comments',         color: '#6366f1', bg: 'bg-indigo-900/30',  border: 'border-indigo-500/40' },
    photo:        { label: 'Photo',        icon: 'fa-image',            color: '#a855f7', bg: 'bg-purple-900/30',  border: 'border-purple-500/40' },
    update:       { label: 'Update',       icon: 'fa-bell',             color: '#f59e0b', bg: 'bg-amber-900/30',   border: 'border-amber-500/40' },
    alert:        { label: 'Alert',        icon: 'fa-triangle-exclamation', color: '#ef4444', bg: 'bg-red-900/30', border: 'border-red-500/40' },
    appreciation: { label: 'Appreciation', icon: 'fa-heart',            color: '#22c55e', bg: 'bg-emerald-900/30', border: 'border-emerald-500/40' },
};

// ── Role badge config ─────────────────────────────────────────────────────────
const ROLE_CONFIG: Record<Role, { label: string; color: string; bg: string }> = {
    [Role.CITIZEN]:  { label: 'Citizen',  color: '#818cf8', bg: 'rgba(99,102,241,0.18)'  },
    [Role.EMPLOYEE]: { label: 'Employee', color: '#34d399', bg: 'rgba(16,185,129,0.18)' },
    [Role.ADMIN]:    { label: 'Admin',    color: '#f87171', bg: 'rgba(239,68,68,0.18)'   },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(ts: number): string {
    const diff = Date.now() - ts;
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return `${Math.floor(diff / 86_400_000)}d ago`;
}

function Avatar({ name, avatar, size = 10 }: { name: string; avatar?: string; size?: number }) {
    if (avatar) return (
        <img src={avatar} alt={name}
            className={`w-${size} h-${size} rounded-full object-cover border-2 border-slate-600 flex-shrink-0`} />
    );
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return (
        <div className={`w-${size} h-${size} rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold flex-shrink-0 text-${size >= 10 ? 'sm' : 'xs'} border-2 border-slate-600`}>
            {initials}
        </div>
    );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
    user: User;
    onBack: () => void;
}

// ── Main Component ────────────────────────────────────────────────────────────
const CommunityHub: React.FC<Props> = ({ user, onBack }) => {
    const [posts, setPosts] = useState<CommunityPost[]>([]);
    const [filterTag, setFilterTag] = useState<PostTag | 'all'>('all');

    // Compose state
    const [showCompose, setShowCompose] = useState(false);
    const [composeText, setComposeText] = useState('');
    const [composeImage, setComposeImage] = useState<string | null>(null);
    const [composeTag, setComposeTag] = useState<PostTag>('discussion');
    const [isPosting, setIsPosting] = useState(false);

    // Comment state: postId -> visible, input text
    const [openComments, setOpenComments] = useState<Set<string>>(new Set());
    const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

    const fileRef = useRef<HTMLInputElement>(null);
    const composeRef = useRef<HTMLDivElement>(null);

    // Subscribe to posts
    useEffect(() => {
        const unsub = subscribeToPosts(setPosts);
        return unsub;
    }, []);

    // Scroll compose into view when opened
    useEffect(() => {
        if (showCompose) composeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [showCompose]);

    // Image upload
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => setComposeImage(reader.result as string);
        reader.readAsDataURL(file);
    };

    // Submit new post
    const handlePost = useCallback(async () => {
        if (!composeText.trim()) return;
        setIsPosting(true);
        const post: CommunityPost = {
            id: `CP-${Date.now()}`,
            authorId: user.id,
            authorName: user.name,
            authorRole: user.role,
            authorAvatar: user.avatar,
            content: composeText.trim(),
            image: composeImage || undefined,
            tag: composeTag,
            likes: [],
            comments: [],
            createdAt: Date.now(),
        };
        addPost(post);
        setPosts(getPosts());
        setComposeText('');
        setComposeImage(null);
        setComposeTag('discussion');
        setShowCompose(false);
        setIsPosting(false);
    }, [composeText, composeImage, composeTag, user]);

    // Like toggle
    const handleLike = (postId: string) => {
        toggleLike(postId, user.id);
        setPosts(getPosts());
    };

    // Delete post
    const handleDeletePost = (postId: string) => {
        if (!window.confirm('Delete this post?')) return;
        deletePost(postId, user.id);
        setPosts(getPosts());
    };

    // Toggle comments
    const toggleComments = (postId: string) => {
        setOpenComments(prev => {
            const next = new Set(prev);
            next.has(postId) ? next.delete(postId) : next.add(postId);
            return next;
        });
    };

    // Add comment
    const handleAddComment = (postId: string) => {
        const text = commentInputs[postId]?.trim();
        if (!text) return;
        const comment: PostComment = {
            id: `CMT-${Date.now()}`,
            authorId: user.id,
            authorName: user.name,
            authorAvatar: user.avatar,
            text,
            createdAt: Date.now(),
        };
        addComment(postId, comment);
        setPosts(getPosts());
        setCommentInputs(prev => ({ ...prev, [postId]: '' }));
    };

    // Delete comment
    const handleDeleteComment = (postId: string, commentId: string) => {
        deleteComment(postId, commentId, user.id);
        setPosts(getPosts());
    };

    const filteredPosts = filterTag === 'all' ? posts : posts.filter(p => p.tag === filterTag);

    return (
        <div className="community-hub-bg min-h-screen pb-24">
            <style>{`
                @keyframes post-in {
                    from { opacity: 0; transform: translateY(-16px) scale(0.98); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes compose-slide-down {
                    from { opacity: 0; transform: translateY(-20px); max-height: 0; }
                    to   { opacity: 1; transform: translateY(0); max-height: 900px; }
                }
                .post-in { animation: post-in 0.35s cubic-bezier(0.34,1.2,0.64,1) both; }
                .compose-panel { animation: compose-slide-down 0.35s ease both; overflow: hidden; }
            `}</style>

            {/* ── Header ── */}
            <header className="community-header sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
                        title="Back"
                    >
                        <i className="fas fa-arrow-left text-sm"></i>
                    </button>
                    <div>
                        <h1 className="font-extrabold text-white text-lg leading-tight" style={{ fontFamily: 'Space Grotesk' }}>
                            <i className="fas fa-people-group mr-2 text-indigo-300"></i>Community Hub
                        </h1>
                        <p className="text-white/50 text-[11px]">{posts.length} post{posts.length !== 1 ? 's' : ''} · Connect, share & discuss</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowCompose(p => !p)}
                    className={`community-compose-btn ${showCompose ? 'active' : ''}`}
                >
                    <i className={`fas ${showCompose ? 'fa-xmark' : 'fa-plus'} mr-1.5`}></i>
                    {showCompose ? 'Cancel' : 'New Post'}
                </button>
            </header>

            <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">

                {/* ── Compose Panel ── */}
                {showCompose && (
                    <div ref={composeRef} className="compose-panel community-card p-5 space-y-4 border border-indigo-500/30">
                        <div className="flex items-center gap-3">
                            <Avatar name={user.name} avatar={user.avatar} size={10} />
                            <div>
                                <p className="font-bold text-white text-sm">{user.name}</p>
                                <p className="text-[11px]" style={{ color: ROLE_CONFIG[user.role].color }}>{ROLE_CONFIG[user.role].label}</p>
                            </div>
                        </div>

                        {/* Text area */}
                        <textarea
                            className="community-textarea"
                            placeholder="What's on your mind? Share an update, a concern, or appreciation for our community…"
                            rows={4}
                            value={composeText}
                            onChange={e => setComposeText(e.target.value)}
                            autoFocus
                        />

                        {/* Image preview */}
                        {composeImage && (
                            <div className="relative">
                                <img src={composeImage} alt="Preview" className="w-full max-h-64 object-cover rounded-xl border border-slate-600/50" />
                                <button
                                    onClick={() => { setComposeImage(null); if (fileRef.current) fileRef.current.value = ''; }}
                                    className="absolute top-2 right-2 w-7 h-7 bg-red-700 hover:bg-red-600 rounded-full text-white flex items-center justify-center text-xs shadow-lg"
                                >
                                    <i className="fas fa-xmark"></i>
                                </button>
                            </div>
                        )}

                        {/* Controls row */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Photo upload */}
                            <label className="community-action-btn cursor-pointer" title="Add photo">
                                <i className="fas fa-camera mr-1.5"></i>Photo
                                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                            </label>

                            {/* Tag select */}
                            <div className="relative flex-1 min-w-[140px]">
                                <select
                                    value={composeTag}
                                    onChange={e => setComposeTag(e.target.value as PostTag)}
                                    className="community-tag-select w-full"
                                >
                                    {(Object.entries(TAG_CONFIG) as [PostTag, typeof TAG_CONFIG[PostTag]][]).map(([tag, cfg]) => (
                                        <option key={tag} value={tag}>{cfg.label}</option>
                                    ))}
                                </select>
                                <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
                            </div>

                            {/* Post button */}
                            <button
                                onClick={handlePost}
                                disabled={!composeText.trim() || isPosting}
                                className="community-post-btn disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isPosting
                                    ? <><i className="fas fa-spinner fa-spin mr-1.5"></i>Posting…</>
                                    : <><i className="fas fa-paper-plane mr-1.5"></i>Post</>
                                }
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Filter Tabs ── */}
                <div className="flex gap-1.5 flex-wrap">
                    <button
                        onClick={() => setFilterTag('all')}
                        className={`community-filter-tab ${filterTag === 'all' ? 'active-all' : ''}`}
                    >
                        All <span className="ml-1 text-[10px] opacity-60">{posts.length}</span>
                    </button>
                    {(Object.entries(TAG_CONFIG) as [PostTag, typeof TAG_CONFIG[PostTag]][]).map(([tag, cfg]) => {
                        const count = posts.filter(p => p.tag === tag).length;
                        return (
                            <button
                                key={tag}
                                onClick={() => setFilterTag(tag)}
                                className={`community-filter-tab ${filterTag === tag ? 'active-tag' : ''}`}
                                style={filterTag === tag ? { background: cfg.color + '25', borderColor: cfg.color + '60', color: cfg.color } : {}}
                            >
                                <i className={`fas ${cfg.icon} mr-1`}></i>{cfg.label}
                                {count > 0 && <span className="ml-1 text-[10px] opacity-60">{count}</span>}
                            </button>
                        );
                    })}
                </div>

                {/* ── Feed ── */}
                {filteredPosts.length === 0 ? (
                    <div className="community-empty">
                        <div className="w-20 h-20 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-4">
                            <i className="fas fa-people-group text-3xl text-slate-500"></i>
                        </div>
                        <p className="font-bold text-slate-300 text-lg mb-1">
                            {filterTag === 'all' ? 'Be the first to post!' : `No ${TAG_CONFIG[filterTag as PostTag]?.label} posts yet`}
                        </p>
                        <p className="text-slate-500 text-sm">Share an update, photo, or start a discussion with your community.</p>
                        <button
                            onClick={() => setShowCompose(true)}
                            className="mt-5 community-post-btn"
                        >
                            <i className="fas fa-plus mr-1.5"></i>Create Post
                        </button>
                    </div>
                ) : filteredPosts.map((post, idx) => {
                    const tagCfg = TAG_CONFIG[post.tag];
                    const roleCfg = ROLE_CONFIG[post.role as Role] ?? ROLE_CONFIG[post.authorRole];
                    const hasLiked = post.likes.includes(user.id);
                    const isOwn = post.authorId === user.id;
                    const commentsOpen = openComments.has(post.id);

                    return (
                        <div
                            key={post.id}
                            className="community-card post-in"
                            style={{ animationDelay: `${idx * 40}ms` }}
                        >
                            {/* Post header */}
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <Avatar name={post.authorName} avatar={post.authorAvatar} size={10} />
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-bold text-white text-sm">{post.authorName}</p>
                                            <span
                                                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                                style={{ background: (ROLE_CONFIG[post.authorRole] ?? ROLE_CONFIG[Role.CITIZEN]).bg, color: (ROLE_CONFIG[post.authorRole] ?? ROLE_CONFIG[Role.CITIZEN]).color }}
                                            >
                                                {(ROLE_CONFIG[post.authorRole] ?? ROLE_CONFIG[Role.CITIZEN]).label}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-0.5">{timeAgo(post.createdAt)}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* Tag chip */}
                                    <span
                                        className={`post-tag-chip ${tagCfg.bg} ${tagCfg.border}`}
                                        style={{ color: tagCfg.color }}
                                    >
                                        <i className={`fas ${tagCfg.icon} mr-1`}></i>{tagCfg.label}
                                    </span>
                                    {/* Delete (own posts only) */}
                                    {isOwn && (
                                        <button
                                            onClick={() => handleDeletePost(post.id)}
                                            className="w-7 h-7 rounded-lg bg-slate-700/60 hover:bg-red-700 text-slate-400 hover:text-white flex items-center justify-center transition-all"
                                            title="Delete post"
                                        >
                                            <i className="fas fa-trash-can text-[10px]"></i>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Content */}
                            <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap mb-3">{post.content}</p>

                            {/* Image */}
                            {post.image && (
                                <div className="mb-3 rounded-xl overflow-hidden border border-slate-700/50">
                                    <img src={post.image} alt="Post" className="w-full max-h-80 object-cover" />
                                </div>
                            )}

                            {/* Divider */}
                            <div className="border-t border-slate-700/40 pt-3 mt-1">
                                <div className="flex items-center gap-1">
                                    {/* Like */}
                                    <button
                                        onClick={() => handleLike(post.id)}
                                        className={`post-action-btn ${hasLiked ? 'liked' : ''}`}
                                    >
                                        <i className={`fas fa-heart ${hasLiked ? 'text-red-400' : ''}`}></i>
                                        <span>{post.likes.length > 0 ? post.likes.length : ''}</span>
                                        {hasLiked ? 'Liked' : 'Like'}
                                    </button>

                                    {/* Comment */}
                                    <button
                                        onClick={() => toggleComments(post.id)}
                                        className={`post-action-btn ${commentsOpen ? 'text-indigo-400' : ''}`}
                                    >
                                        <i className="fas fa-comment"></i>
                                        <span>{post.comments.length > 0 ? post.comments.length : ''}</span>
                                        Comments
                                    </button>

                                    {/* Share (copy link) */}
                                    <button
                                        onClick={() => {
                                            navigator.clipboard?.writeText(`CivicHub Post by ${post.authorName}: ${post.content.slice(0, 80)}`);
                                        }}
                                        className="post-action-btn ml-auto"
                                        title="Copy post text"
                                    >
                                        <i className="fas fa-share-nodes"></i>Share
                                    </button>
                                </div>

                                {/* Comments section */}
                                {commentsOpen && (
                                    <div className="mt-3 space-y-3 border-t border-slate-700/30 pt-3">
                                        {/* Existing comments */}
                                        {post.comments.length === 0 && (
                                            <p className="text-xs text-slate-500 text-center py-2">No comments yet. Be the first!</p>
                                        )}
                                        {post.comments.map(c => (
                                            <div key={c.id} className="flex items-start gap-2.5 group">
                                                <Avatar name={c.authorName} avatar={c.authorAvatar} size={7} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="bg-slate-700/50 rounded-xl px-3 py-2">
                                                        <p className="text-xs font-bold text-slate-300 mb-0.5">{c.authorName}</p>
                                                        <p className="text-xs text-slate-300 leading-relaxed">{c.text}</p>
                                                    </div>
                                                    <p className="text-[10px] text-slate-600 ml-2 mt-0.5">{timeAgo(c.createdAt)}</p>
                                                </div>
                                                {c.authorId === user.id && (
                                                    <button
                                                        onClick={() => handleDeleteComment(post.id, c.id)}
                                                        className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full bg-red-900/40 hover:bg-red-700 text-red-400 hover:text-white flex items-center justify-center transition-all mt-1"
                                                    >
                                                        <i className="fas fa-xmark text-[9px]"></i>
                                                    </button>
                                                )}
                                            </div>
                                        ))}

                                        {/* New comment input */}
                                        <div className="flex items-center gap-2 pt-1">
                                            <Avatar name={user.name} avatar={user.avatar} size={7} />
                                            <div className="flex-1 flex gap-2">
                                                <input
                                                    type="text"
                                                    className="community-comment-input flex-1"
                                                    placeholder={`Reply as ${user.name}…`}
                                                    value={commentInputs[post.id] || ''}
                                                    onChange={e => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                                                    onKeyDown={e => { if (e.key === 'Enter') handleAddComment(post.id); }}
                                                />
                                                <button
                                                    onClick={() => handleAddComment(post.id)}
                                                    disabled={!commentInputs[post.id]?.trim()}
                                                    className="w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white flex items-center justify-center transition-all flex-shrink-0"
                                                >
                                                    <i className="fas fa-paper-plane text-xs"></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CommunityHub;
