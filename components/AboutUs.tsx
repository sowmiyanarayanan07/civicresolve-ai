import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import teamPhoto from '../src/assets/team-photo.jpg';

const AboutUs: React.FC = () => {
    const navigate = useNavigate();

    // Scroll to top on mount
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const TEAM_PHOTO = teamPhoto;

    return (
        <div className="min-h-screen bg-green-50/50 pb-20">
            {/* Minimal Header */}
            <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-green-100 shadow-sm px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-green-600 to-emerald-500 shadow-sm">
                        <i className="fas fa-leaf text-white text-sm"></i>
                    </div>
                    <span className="font-extrabold text-lg tracking-tight text-green-800" style={{ fontFamily: 'Space Grotesk' }}>
                        CivicResolve <span className="text-green-600">AI</span>
                    </span>
                </div>
                <button 
                    onClick={() => navigate(-1)} 
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-green-200 text-sm font-semibold text-green-700 hover:bg-green-50 transition-colors shadow-sm"
                >
                    <i className="fas fa-arrow-left"></i>
                    Go Back
                </button>
            </header>

            <main className="max-w-3xl mx-auto mt-8 px-4 sm:px-6">
                
                {/* Hero Section */}
                <div className="text-center mb-10 fade-in-up">
                    <span className="inline-block py-1.5 px-3 rounded-full bg-green-100 text-green-700 text-xs font-bold tracking-wide uppercase mb-3">
                        About Us
                    </span>
                    <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800 tracking-tight leading-tight mb-4" style={{ fontFamily: 'Space Grotesk' }}>
                        From Five Failures to <br className="hidden md:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-400">Finding Our Purpose</span>
                    </h1>
                    <p className="text-lg text-slate-500 max-w-xl mx-auto">
                        The real, unfiltered story of how CivicResolve AI came to life.
                    </p>
                </div>

                {/* Team Photo */}
                <div className="w-full rounded-3xl overflow-hidden shadow-2xl mb-12 relative fade-in-up border-4 border-white" style={{ animationDelay: '0.1s' }}>
                    <div className="absolute inset-0 bg-green-900/10 mix-blend-overlay z-10 pointer-events-none"></div>
                    <img 
                        src={TEAM_PHOTO} 
                        alt="The CivicResolve AI Team: Sowmiya Narayanan S, Vigneshwaran, and Sai" 
                        className="w-full h-auto object-cover max-h-[500px]"
                    />
                </div>

                {/* Story Content */}
                <article className="prose prose-lg prose-slate max-w-none fade-in-up" style={{ animationDelay: '0.2s' }}>
                    
                    <div className="bg-white p-8 md:p-12 rounded-3xl shadow-xl shadow-green-900/5 mb-8 border border-green-50 relative overflow-hidden">
                        {/* Decorative quote mark */}
                        <div className="absolute top-4 left-6 text-9xl text-green-50 font-serif leading-none select-none opacity-50 z-0">"</div>

                        <div className="relative z-10 space-y-6 text-slate-700 leading-relaxed">
                            <p className="text-xl font-medium text-slate-800">
                                Hey everyone, I’m <strong className="text-green-700">Sowmiya Narayanan S</strong>, the team lead behind CivicResolve AI. 
                                I want to take a moment to pull back the curtain and share the real, unfiltered story of how this platform came to life, alongside my incredible teammates, <strong>Vigneshwaran</strong> and <strong>Sai</strong>.
                            </p>

                            <p>
                                If you look at our project now, you might think it was a smooth, straight path. The reality? It was anything but.
                            </p>

                            <p>
                                Picture this: it’s our final year. The pressure is heavy, the expectations are high, and it’s time to submit our final project idea. We didn't just pitch one idea—we pitched almost <em>four different concepts</em> to our staff. And one by one, every single idea was rejected.
                            </p>

                            <div className="bg-red-50 border-l-4 border-red-400 p-5 rounded-r-xl my-6">
                                <p className="text-red-800 italic m-0">
                                    "We were completely burnt out. The final, non-negotiable deadline for idea submission was literally the very next day, and we had an empty whiteboard."
                                </p>
                            </div>

                            <p>
                                Sometimes, the best ideas don’t come from forced brainstorming sessions; they come from real-world frustration. That evening, Vignesh and I were just randomly talking to take our minds off the stress. I casually asked him, <span className="text-slate-900 font-medium">"Why isn't your area being maintained properly? It's been a mess for a while."</span>
                            </p>

                            <p>
                                His answer was the spark we needed. He sighed and said, <span className="text-slate-900 font-medium whitespace-nowrap">"We’ve complained to the municipality so many times, but absolutely zero action has been taken."</span>
                            </p>

                            <p className="text-xl font-bold text-center py-4 text-green-700 font-serif">
                                Right then, it clicked. I looked at him and asked, <br/>"Why don't we make a site to fix exactly this?"
                            </p>

                            <p>
                                It was a perfect concept, but there was one massive roadblock staring us in the face: Vignesh and I are hardcore Machine Learning and Data Science guys. We were incredibly passionate about data, but we knew absolutely nothing about web development.
                            </p>

                            <p>
                                But with our backs against the wall, we decided to just go for it. We practically lived on the internet for the next few days. We scoured tutorials, read forums, and learned web development from scratch on the fly. Sai, Vignesh, and I poured all our energy into connecting the dots, writing the code, and bringing this platform to life. 
                            </p>
                            
                            <div className="bg-green-50 p-6 rounded-2xl border border-green-100 my-8">
                                <h3 className="text-green-800 font-bold mb-2 flex items-center gap-2" style={{ fontFamily: 'Space Grotesk' }}>
                                    <i className="fas fa-lightbulb text-yellow-500"></i> The Core Lesson
                                </h3>
                                <p className="m-0 text-green-900">
                                    That’s how CivicResolve AI was born—built by a team of ML students who refused to let a lack of web dev experience stop them from solving a real-world problem. Looking back, it’s crazy to think about where we started. We faced four flat-out rejections. This project was born out of our fear of a fifth failure.
                                </p>
                            </div>

                            <p className="text-lg font-medium text-slate-800">
                                If there is one thing we’ve learned from this journey that we want to pass on to you, it’s this: <br/><br/>
                                <strong className="text-green-600 text-xl block leading-snug">Never stop after a failure. Whether you've failed once, five times, or ten times—keep trying. Keep pushing. Sometimes, a string of rejections isn't a sign to give up; it's just the universe redirecting you toward the exact problem you were meant to solve.</strong>
                            </p>
                        </div>
                    </div>
                </article>

                {/* Footer simple mark */}
                <div className="text-center pb-12 opacity-50 text-sm font-medium">
                    <i className="fas fa-heart text-red-500 mr-1"></i>
                    Built by Sowmiya, Vignesh & Sai
                </div>
            </main>
        </div>
    );
};

export default AboutUs;
