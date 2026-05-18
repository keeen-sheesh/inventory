import React, { useState, useEffect } from 'react';
import { Head, router } from '@inertiajs/react';
import { ChefHat, Volume2, VolumeX, Bell, Maximize, ChevronUp, ChevronDown, LogOut } from 'lucide-react';
import { nowPH, formatPHTime } from '@/utils/phTime';

export default function KitchenDashboard({ stats: initialStats = {} }) {
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [audioReady, setAudioReady] = useState(true);
    const [showControls, setShowControls] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [stats, setStats] = useState({
        today: initialStats.today || 0,
        thisWeek: initialStats.thisWeek || 0,
        thisMonth: initialStats.thisMonth || 0,
    });

    const handleLogout = () => {
        router.post('/logout');
    };

    // Test alarm function
    const testAlarm = () => {
        if (soundEnabled && audioReady) {
            // Create audio context and play a beep
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // Set frequency and duration
            oscillator.frequency.value = 800; // Hz
            oscillator.type = 'sine';

            // Envelope
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);

            // Show notification
            showNotification('🔔 Alarm Test Triggered!');
        } else {
            showNotification('⚠️ Sound is disabled or audio not ready');
        }
    };

    // Fullscreen toggle
    const toggleFullScreen = async () => {
        try {
            if (!isFullScreen) {
                if (document.documentElement.requestFullscreen) {
                    await document.documentElement.requestFullscreen();
                    setIsFullScreen(true);
                } else if (document.documentElement.webkitRequestFullscreen) {
                    await document.documentElement.webkitRequestFullscreen();
                    setIsFullScreen(true);
                }
            } else {
                if (document.fullscreenElement) {
                    await document.exitFullscreen();
                    setIsFullScreen(false);
                } else if (document.webkitFullscreenElement) {
                    await document.webkitExitFullscreen();
                    setIsFullScreen(false);
                }
            }
        } catch (error) {
            console.error('Fullscreen error:', error);
        }
    };

    // Show notification
    const showNotification = (message) => {
        const div = document.createElement('div');
        div.textContent = message;
        div.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-bounce';
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 3000);
    };

    return (
        <>
            <Head title="Kitchen Dashboard" />

            <div className={`${isFullScreen ? 'h-screen' : 'min-h-screen'} bg-gradient-to-br from-blue-900 to-blue-800 p-4 md:p-8`}>
                <div className="max-w-7xl mx-auto h-full flex flex-col">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="mb-4 flex justify-end">
                            <button
                                onClick={handleLogout}
                                className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 font-semibold text-white shadow-lg transition-all duration-300 hover:bg-rose-600"
                            >
                                <LogOut className="h-4 w-4" />
                                <span>Logout</span>
                            </button>
                        </div>
                        <div className="text-center">
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <ChefHat className="w-10 h-10 text-yellow-300" />
                            <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-lg">Kitchen Dashboard</h1>
                            <ChefHat className="w-10 h-10 text-yellow-300" />
                        </div>
                        <p className="text-blue-100 text-lg">Real-time Order Management System</p>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        {/* Today Card */}
                        <div className="bg-white rounded-2xl shadow-2xl p-8 transform hover:scale-105 transition-transform duration-300 border-4 border-green-400">
                            <div className="text-center">
                                <p className="text-gray-600 text-sm font-semibold uppercase tracking-widest mb-2">Today</p>
                                <p className="text-5xl font-black text-green-500 mb-2">{stats.today}</p>
                                <p className="text-gray-500 text-sm">Orders Processed</p>
                                <div className="mt-4 h-2 bg-green-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500 rounded-full" style={{ width: '75%' }}></div>
                                </div>
                            </div>
                        </div>

                        {/* This Week Card */}
                        <div className="bg-white rounded-2xl shadow-2xl p-8 transform hover:scale-105 transition-transform duration-300 border-4 border-blue-400">
                            <div className="text-center">
                                <p className="text-gray-600 text-sm font-semibold uppercase tracking-widest mb-2">This Week</p>
                                <p className="text-5xl font-black text-blue-500 mb-2">{stats.thisWeek}</p>
                                <p className="text-gray-500 text-sm">Orders Processed</p>
                                <div className="mt-4 h-2 bg-blue-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: '60%' }}></div>
                                </div>
                            </div>
                        </div>

                        {/* This Month Card */}
                        <div className="bg-white rounded-2xl shadow-2xl p-8 transform hover:scale-105 transition-transform duration-300 border-4 border-purple-400">
                            <div className="text-center">
                                <p className="text-gray-600 text-sm font-semibold uppercase tracking-widest mb-2">This Month</p>
                                <p className="text-5xl font-black text-purple-500 mb-2">{stats.thisMonth}</p>
                                <p className="text-gray-500 text-sm">Orders Processed</p>
                                <div className="mt-4 h-2 bg-purple-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-purple-500 rounded-full" style={{ width: '80%' }}></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Audio Status Bar */}
                    <div className="bg-white rounded-2xl shadow-2xl p-6 mb-8">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                            {/* Audio Ready Status */}
                            <div className="flex items-center gap-4 w-full md:w-auto">
                                <div className="flex-shrink-0">
                                    <div className={`w-4 h-4 rounded-full ${audioReady ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 font-semibold">Audio Status</p>
                                    <p className={`text-lg font-bold ${audioReady ? 'text-green-600' : 'text-red-600'}`}>
                                        {audioReady ? '🎵 Audio Ready' : '🔇 Not Ready'}
                                    </p>
                                </div>
                            </div>

                            {/* Sound Toggle */}
                            <button
                                onClick={() => setSoundEnabled(!soundEnabled)}
                                className={`flex items-center gap-3 px-6 py-3 rounded-lg font-bold transition-all duration-300 transform hover:scale-110 flex-shrink-0 ${
                                    soundEnabled
                                        ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg'
                                        : 'bg-red-500 hover:bg-red-600 text-white shadow-lg'
                                }`}
                            >
                                {soundEnabled ? (
                                    <>
                                        <Volume2 className="w-5 h-5" />
                                        <span>Sound ON</span>
                                    </>
                                ) : (
                                    <>
                                        <VolumeX className="w-5 h-5" />
                                        <span>Sound OFF</span>
                                    </>
                                )}
                            </button>

                            {/* Controls Toggle Button */}
                            <button
                                onClick={() => setShowControls(!showControls)}
                                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-all duration-300 transform hover:scale-110 flex-shrink-0 ${
                                    showControls
                                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg'
                                        : 'bg-gray-800 hover:bg-gray-900 text-white shadow-lg'
                                }`}
                            >
                                {showControls ? (
                                    <>
                                        <ChevronUp className="w-5 h-5" />
                                        <span>Hide Controls</span>
                                    </>
                                ) : (
                                    <>
                                        <ChevronDown className="w-5 h-5" />
                                        <span>Show Controls</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Hidden Controls */}
                        {showControls && (
                            <div className="mt-6 pt-6 border-t-2 border-gray-300 flex flex-col md:flex-row gap-4">
                                {/* Test Alarm Button */}
                                <button
                                    onClick={testAlarm}
                                    className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg active:scale-95"
                                >
                                    <Bell className="w-6 h-6" />
                                    <span>Test Alarm</span>
                                </button>

                                {/* Fullscreen Button */}
                                <button
                                    onClick={toggleFullScreen}
                                    className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 font-bold rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg active:scale-95 ${
                                        isFullScreen
                                            ? 'bg-red-500 hover:bg-red-600 text-white'
                                            : 'bg-cyan-500 hover:bg-cyan-600 text-white'
                                    }`}
                                >
                                    <Maximize className="w-6 h-6" />
                                    <span>{isFullScreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Footer Info */}
                    <div className="text-center text-blue-100 text-sm">
                        <p>🍳 All systems operational • Last updated: <span className="font-mono">{formatPHTime(nowPH())}</span></p>
                    </div>
                </div>
            </div>
        </>
    );
}
