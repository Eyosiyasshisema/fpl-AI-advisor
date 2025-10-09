"use client";
import { useState, useEffect, useRef } from 'react'; 
import axios from 'axios';
import { Chrome, Send, UserRound, Loader2, ArrowRight, Gamepad2, LogOut, Settings, BarChart3, TrendingUp, Calendar, Heart, Sun, Moon, ArrowLeft, Trophy, Wallet, MessageSquare } from 'lucide-react'; 
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';


function App() {
    const [page, setPage] = useState('landing');
    const [username, setUserName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authMethod, setAuthMethod] = useState(null);
    const [managerId, setManagerId] = useState('');
    const [managerName, setManagerName] = useState('Loading...');
    const [teamName, setTeamName] = useState('My Team FC');
    const [gameWeekPoints,setGameWeekPoints]= useState('');
    const [Projected_points,setProjectedPoints]=useState('');
    const [overallPoints, setOverallPoints]= useState('');
    const [leagues, setLeagues] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [dashboardView, setDashboardView] = useState('dashboard');
    const [authToken, setAuthToken] = useState(null);
    const [isLeaguesHovered, setIsLeaguesHovered] = useState(false);
    const [gameweekPointsData, setGameweekPointsData] = useState([]);
    const [isInitialAuthCheckComplete, setIsInitialAuthCheckComplete] = useState(false);
    const BACKEND_URL = 'http://localhost:3001';
    const TRANSFER_ADVICE_ENDPOINT = `${BACKEND_URL}/chat/advice`;
    const initialMessage = {
        role: 'model',
        text: `Welcome to your FPL Advisor, ${managerName}. I can help you with player selection, injury news, fixture analysis, and transfer strategies. Ask me anything FPL related!`,
        sources: []
    };

    const [messages, setMessages] = useState([initialMessage]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const clearUserData = () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        localStorage.removeItem('email');
        localStorage.removeItem('managerId');
        setAuthToken(null);
        setManagerId('');
        setManagerName('Manager not found');
        setTeamName('My Team FC');
        setGameWeekPoints('--');
        setProjectedPoints('--');
        setOverallPoints('--');
        setLeagues([]);
        setIsAuthenticated(false);
    };
    
    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    
 const handleAuth = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        const endpoint = authMethod === 'signup'
            ? `${BACKEND_URL}/auth/register`
            : `${BACKEND_URL}/auth/login`;

        const body = authMethod === 'signup'
            ? { email, password, username }
            : { email, password };

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Authentication failed');
            }

            const data = await response.json();

            localStorage.setItem('authToken', data.token);
            localStorage.setItem('refreshToken', data.refreshToken);
            localStorage.setItem('userId', data.userId);
            localStorage.setItem('username', data.username);
            localStorage.setItem('email', data.email);
            setAuthToken(data.token);
            setIsAuthenticated(true);

            if (data.managerId && data.managerId.length > 0) {
                localStorage.setItem('managerId', data.managerId);
                setManagerId(data.managerId);
                setPage('dashboard');
            } else {
                localStorage.removeItem('managerId');
                setManagerId('');
                setPage('get-started');
            }

        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
            setEmail('');
            setPassword('');
            setUserName('');
        }
    };

    const handleManagerIdSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        if (!managerId) {
            setError('Please enter a valid FPL manager ID.');
            setIsLoading(false);
            return;
        }

        const currentAuthToken = localStorage.getItem('authToken');
        if (!currentAuthToken) {
            setError('Authentication token not found. Please log in again.');
            setIsLoading(false);
            setPage('landing');
            return;
        }

        try {
            const endpoint = `${BACKEND_URL}/users/managerId`;
            const body = { managerId };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentAuthToken}`
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Saving manager ID failed');
            }

            const data = await response.json();
            localStorage.setItem('managerId', data.managerId);
            setManagerId(data.managerId);

            setPage('dashboard');
        } catch (error) {
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };
    
    const toggleTheme = () => {
        setIsDarkMode(!isDarkMode);
    };

    const handleFetchManagerName = async (managerId) => {
        if (!managerId) {
            throw new Error('Manager ID is missing.');
        }

        const token = localStorage.getItem('authToken');
        if (!token) {
            throw new Error('Authentication token not found.');
        }

        const endpoint = `${BACKEND_URL}/users/fpl-manager/${managerId}`;

        try {
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
            });

            if (!response.ok) {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Error fetching manager data from backend');
                } else {
                    throw new Error('Server returned an unexpected response format. Please check the backend.');
                }
            }

            const data = await response.json();
            return { managerName: data.managerName, teamName: data.teamName };
        } catch (error) {
            console.error('API call error:', error);
            throw new Error('Could not fetch manager data. Please try again.');
        }
    };

    const handlePOints = async (managerId) => {
        if (!managerId) {
            throw new Error('Manager ID is missing.');
        }

        const token = localStorage.getItem('authToken');
        if (!token) {
            throw new Error('Authentication token not found.');
        }

        const endpoint = `${BACKEND_URL}/users/points/${managerId}`;

        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
        });

        if (!response.ok) {
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error fetching manager data from backend');
            } else {
                throw new Error('Server returned an unexpected response format. Please check the backend.');
            }
        }

        const data = await response.json();
        return { gameWeekPoints: data.gameWeekPoints, overallPoints: data.overallPoints };
    };

    const handleLeagues = async (managerId) => {
        if (!managerId) {
            throw new Error('Manager ID is missing.');
        }

        const token = localStorage.getItem('authToken');
        if (!token) {
            throw new Error('Authentication token not found.');
        }

        const endpoint = `${BACKEND_URL}/users/ranks/${managerId}`;

        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
        });

        if (!response.ok) {
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error fetching manager data from backend');
            } else {
                throw new Error('Server returned an unexpected response format. Please check the backend.');
            }
        }
        const data = await response.json();
        return { leagues: data.leagues.map(league => ({
            name: league.name,
            rank: league.rank,
        }))}
    };

    const handleChart = async (managerId) => {
        if (!managerId) {
            throw new Error('Manager ID is missing.');
        }

        const token = localStorage.getItem('authToken');
        if (!token) {
            throw new Error('Authentication token not found.');
        }

        const endpoint = `${BACKEND_URL}/users/gameweekChart/${managerId}`;

        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
        });

        if (!response.ok) {
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error fetching manager data from backend');
            } else {
                throw new Error('Server returned an unexpected response format. Please check the backend.');
            }
        }
        console.log('Response status:', response.status, 'Content-Type:', response.headers.get("content-type"));
        const data = await response.json();
        
        return { gameweekPointsData: data.gameWeekPointsChart.map(point => ({
            gw: point.gw,
            gwPoint: point.gwPoint
        }))}
    };

    const handleLogout = () => {
        clearUserData();
        setPage('landing');
    };
    const MessageBubble = ({ message }) => {
        const isUser = message.role === 'user';
        return (
            <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-3/4 p-3 my-1 rounded-xl shadow-md ${
                    isUser 
                        ? 'bg-emerald-600 text-white rounded-br-none' 
                        : 'bg-gray-100 text-gray-800 rounded-tl-none'
                }`}>
                    <p className="whitespace-pre-wrap">{message.text}</p>
                    {message.sources && message.sources.length > 0 && (
                        <div className="mt-2 text-xs text-gray-500 border-t border-gray-200 pt-1">
                            <p className="font-semibold text-gray-600 mb-1">Sources:</p>
                            <ul className="list-disc list-inside space-y-0.5">
                                {message.sources.slice(0, 3).map((source, index) => (
                                    <li key={index} className="truncate">
                                        <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                            {source.title || 'Source Link'}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!input.trim() || loading || !authToken) return;

    const userPrompt = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userPrompt }]);
    setInput('');
    setLoading(true);
    const historyForApi = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model', 
        parts: [{ text: msg.text }] 
    }));

    try {
        const payload = {
            prompt: userPrompt,
            history: historyForApi,
            managerId: managerId,
        };

        const response = await axios.post(TRANSFER_ADVICE_ENDPOINT, payload, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        const { advice, sources } = response.data;
        const modelMessageObject = { 
            role: 'advice', 
            text: advice, 
            sources: sources || [] 
        };
        setMessages(prev => [...prev, modelMessageObject]);

    } catch (error) {
        console.error("Chatbot Backend Error:", error);
        
        let errorMessage = "Sorry, the FPL Advisor is currently unavailable.";
        
        if (error.response?.data?.error) {
            errorMessage = error.response.data.error;
        } else if (error.message) {
             errorMessage = `Network Error: ${error.message}`;
        }

        setMessages(prev => [...prev, {
            role: 'advice',
            text: errorMessage,
            sources: []
        }]);
    } finally {
        setLoading(false);
    }
};

 const handleProjectedPoints = async (managerId) => {
        if (!managerId) {
            throw new Error('Manager ID is missing.');
        }

        const token = localStorage.getItem('authToken');
        if (!token) {
            throw new Error('Authentication token not found.');
        }

        const endpoint = `${BACKEND_URL}/projectedPoints/points`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ managerId }),
        });

        if (!response.ok) {
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error fetching manager data from backend');
            } else {
                throw new Error('Server returned an unexpected response format. Please check the backend.');
            }
        }
        console.log('Response status:', response.status, 'Content-Type:', response.headers.get("content-type"));
        const data = await response.json();
       return { Projected_points : data.projectedPoints };
    };

    useEffect(() => {
        const token = localStorage.getItem('authToken');
        const storedManagerId = localStorage.getItem('managerId');

        if (token) {
            setAuthToken(token);
            setIsAuthenticated(true);
            if (storedManagerId && storedManagerId.length > 0) {
                setManagerId(storedManagerId);
                setPage('dashboard');
            } else {
                setPage('get-started');
            }
        } else {
            clearUserData();
            setPage('landing');
        }
        setIsInitialAuthCheckComplete(true); 
    }, []);

useEffect(() => {
    let isMounted = true;
    
    const fetchDashboardData = async () => {
        if (!isAuthenticated || !managerId || page !== 'dashboard') return;
        setError(null);
        setIsLoading(true);

        try {
            const [
                managerInfo,
                points,
                leagues,
                chart,
                projected
            ] = await Promise.all([
                handleFetchManagerName(managerId),
                handlePOints(managerId),
                handleLeagues(managerId),
                handleChart(managerId),
                handleProjectedPoints(managerId)
            ]);

            if (isMounted) {
                setIsLoading(false); 
            }

        } catch (err) {
            console.error('Dashboard Fetch Error:', err);
            if (isMounted) {
                setError(err.message);
                setIsLoading(false);
                if (err.message.includes('token') || err.message.includes('re-login')) {
                     handleLogout();
                }
            }

        }
    };

    fetchDashboardData();

    return () => {
        isMounted = false;
    };

}, [isAuthenticated, managerId, page, handleFetchManagerName, handlePOints, handleLeagues, handleChart, handleProjectedPoints]);

    useEffect(() => {
        const fetchManagerData = async () => {
            if (!isInitialAuthCheckComplete) return; 
            if (!managerId || !authToken) {
                setManagerName('Manager not found');
                setTeamName('My Team FC');
                return;
            }
            setManagerName('Loading...');
            setTeamName('Loading...');
            try {
                const { managerName, teamName } = await handleFetchManagerName(managerId);
                setManagerName(managerName);
                setTeamName(teamName);
            } catch (err) {
                setManagerName('Manager not found');
                setTeamName('Team not found');
                console.error(err);
            }
        };
        fetchManagerData();
    }, [managerId, authToken,isInitialAuthCheckComplete]);
    
    useEffect(() => {
        const fetchManagerPoints = async () => {
            if (!isInitialAuthCheckComplete) return; 
            if (!managerId || !authToken) {
                setGameWeekPoints('--');
                setOverallPoints('--');
                return;
            }
            setGameWeekPoints('loading...');
            setOverallPoints('loading...');
            try {
                const { gameWeekPoints, overallPoints } = await handlePOints(managerId);
                setGameWeekPoints(gameWeekPoints);
                setOverallPoints(overallPoints);
            } catch (err) {
                setGameWeekPoints('--');
                setOverallPoints('--');
                console.error(err);
            }
        };
        fetchManagerPoints();
    }, [managerId, authToken,isInitialAuthCheckComplete]);

    useEffect(() => {
    const fetchLeagues = async () => {
        if (!isInitialAuthCheckComplete) {
            return;
        }
        
        if (!managerId || !authToken) {
            setError('Manager ID or token not found'); 
            return;
        }    
        setIsLoading(true);
        setError(null);
        try {
            const { leagues } = await handleLeagues(managerId);
            setLeagues(leagues);
        } catch (err) {
            setError(err.message);
            setLeagues([]);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    fetchLeagues();
}, [managerId, authToken, isInitialAuthCheckComplete]); 
    useEffect(() => {
        const fetchGameweekHistory = async () => {
            if (!isInitialAuthCheckComplete) return; 
            if (!managerId || !authToken) {
                setGameweekPointsData([]);
                return;
            }
            try {
                const { gameweekPointsData } = await handleChart(managerId);
                setGameweekPointsData(gameweekPointsData);
            } catch (err) {
                console.error('Error fetching gameweek history:', err);
                setGameweekPointsData([]);
            }finally {
                setIsLoading(false);
            }
        };
        fetchGameweekHistory();
    }, [managerId, authToken,isInitialAuthCheckComplete]);

    useEffect(scrollToBottom, [messages]); 

      useEffect(() => {
        const fetchProjectedPoints = async () => {
            if (!isInitialAuthCheckComplete) return; 
            if (!managerId || !authToken) {
                setProjectedPoints('--');
                return;
            }
            setProjectedPoints('loading...');
            try {
                const { Projected_points } = await handleProjectedPoints(managerId);
                setProjectedPoints(Projected_points);
            } catch (err) {
                setProjectedPoints('--');
                console.error(err);
            }
        };
        fetchProjectedPoints();
    }, [managerId, authToken,isInitialAuthCheckComplete]);

    const renderAuthForm = () => {
        return (
            <form onSubmit={handleAuth} className="w-full max-w-sm flex flex-col gap-4">
                <input
                    type="email"
                    placeholder="Email"
                    className="w-full px-4 py-3 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-300"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                {authMethod === 'signup' && (
                    <input
                        type="text"
                        placeholder="Username"
                        className="w-full px-4 py-3 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-300"
                        value={username}
                        onChange={(e) => setUserName(e.target.value)}
                        required
                    />
                )}
                <input
                    type="password"
                    placeholder="Password"
                    className="w-full px-4 py-3 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-300"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                <button
                    type="submit"
                    className="w-full bg-emerald-600 text-white font-semibold py-3 rounded-lg shadow-md hover:bg-emerald-500 transition-all duration-300 flex items-center justify-center"
                    disabled={isLoading}
                >
                    {isLoading ? 'Processing...' : (authMethod === 'login' ? 'Log In' : 'Sign Up')}
                </button>
            </form>
        );
    };

    const renderDashboardContent = () => {
        switch (dashboardView) {
            case 'dashboard':
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Card 1: Team Overview */}
                        <div onClick={() => setDashboardView('team-overview')} className={`${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} rounded-xl p-6 shadow-lg border-2 border-transparent hover:border-emerald-500 transition-all duration-300 flex flex-col cursor-pointer`}>
                            <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-2 flex items-center`}>
                                <BarChart3 className="mr-2 text-emerald-400" size={24} /> Team Overview
                            </h3>
                            <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} flex-grow`}>Live gameweek score, overall rank, and squad value.</p>
                        </div>
                        {/* Card 2: Transfer Advisor */}
                        <div onClick={() => setDashboardView('transfer-advisor')} className={`${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} rounded-xl p-6 shadow-lg border-2 border-transparent hover:border-emerald-500 transition-all duration-300 flex flex-col`}>
                            <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-2 flex items-center`}>
                                <TrendingUp className="mr-2 text-emerald-400" size={24} /> Transfer Advisor
                            </h3>
                            <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} flex-grow`}>Chat with your Ai powered Fpl advisor . </p>
                        </div>
                        {/* Card 3: Gameweek Planner */}
                        <div onClick={() => setDashboardView('gameweek-planner')} className={`${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} rounded-xl p-6 shadow-lg border-2 border-transparent hover:border-emerald-500 transition-all duration-300 flex flex-col`}>
                            <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-2 flex items-center`}>
                                <Calendar className="mr-2 text-emerald-400" size={24} /> Gameweek Planner
                            </h3>
                            <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} flex-grow`}>Projected points for your team in the upcoming gameweek.</p>
                        </div>
                    </div>
                );
            case 'team-overview':
                return (
                    <div className="flex flex-col p-6 w-full">
                        <button onClick={() => setDashboardView('dashboard')} className="flex items-center self-start mb-6 text-gray-400 hover:text-emerald-500 transition-colors duration-200">
                            <ArrowLeft size={20} className="mr-2" /> Back to Dashboard
                        </button>
                        <h2 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-4 text-center`}>Team Overview</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                            {/* Card 1: Live Gameweek Score */}
                            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} rounded-xl p-6 shadow-lg border-2 border-transparent hover:border-emerald-500 transition-all duration-300 flex flex-col items-center text-center`}>
                                <div className="flex items-center justify-center space-x-2 mb-4">
                                    <BarChart3 className="text-emerald-400" size={32} />
                                    <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Live Gameweek Score</h3>
                                </div>
                                <p className={`text-5xl font-extrabold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{gameWeekPoints}</p>
                                <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>Game Week Points</p>
                                <p className={`text-5xl font-extrabold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{overallPoints}</p>
                                <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>Overall Points</p>
                            </div>

                            {/* Card 2: Overall Rank (with hover popup) */}
                            <div
                                className={`relative ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} rounded-xl p-6 shadow-lg border-2 border-transparent hover:border-yellow-500 transition-all duration-300 flex flex-col items-center text-center`}
                                onMouseEnter={() => setIsLeaguesHovered(true)}
                                onMouseLeave={() => setIsLeaguesHovered(false)}
                            >
                                <div className="flex items-center justify-center space-x-2 mb-4">
                                    <Trophy className="text-yellow-400" size={32} />
                                    <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Leagues</h3>
                                </div>
                                <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} text-center mt-2`}>
                                    Hover to view rankings
                                </p>
                                {isLeaguesHovered && leagues.length > 0 && (
                                    <div className={`absolute inset-0 p-4 rounded-xl shadow-2xl z-10
                                        ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'}
                                        border ${isDarkMode ? 'border-gray-600' : 'border-gray-200'} max-h-60 overflow-y-auto custom-scrollbar`}>
                                        <h4 className="font-bold mb-2">My Leagues & Ranks</h4>
                                        {leagues.map((league, index) => (
                                            <div key={index} className={`py-1 ${isDarkMode ? 'border-b border-gray-600' : 'border-b border-200'} last:border-b-0`}>
                                                <p className="text-sm">
                                                    <span className="font-semibold">{league.name}:</span>
                                                    <span className="ml-2 font-mono">{typeof league.rank === 'number' ? league.rank.toLocaleString() : '--'}</span>
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {isLeaguesHovered && leagues.length === 0 && (
                                    <div className={`absolute inset-0 p-4 rounded-xl shadow-2xl z-10
                                        ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'}
                                        border ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                                        <p className="text-sm">No leagues found.</p>
                                    </div>
                                )}
                            </div>
                            
                            {/* Card 3: Gameweek Points Chart */}
                            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} rounded-xl p-6 shadow-lg border-2 border-transparent hover:border-sky-500 transition-all duration-300 flex flex-col items-center text-center`}>
                                <div className="flex items-center justify-center space-x-2 mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="text-sky-400" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 3v18h18" />
                                        <path d="M18.7 8a5 5 0 0 1-5.6 0" />
                                        <path d="M12.7 12a3 3 0 0 1-3.6 0" />
                                        <path d="M5.7 16a1 1 0 0 1 1.6 0" />
                                    </svg>
                                    <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Gameweek Points</h3>
                                </div>
                                {/* Check if gameweekPointsData is available before rendering the chart */}
                                {gameweekPointsData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={200}>
                                        <LineChart data={gameweekPointsData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#4B5563" : "#E5E7EB"} />
                                            <XAxis
                                                dataKey="gw"
                                                stroke={isDarkMode ? "#9CA3AF" : "#6B7280"}
                                                minTickGap={10}
                                                tickFormatter={(value, index) => (index === 0 || (index + 1) % 5 === 0 || index === gameweekPointsData.length - 1) ? value : ''}
                                            />
                                            <YAxis stroke={isDarkMode ? "#9CA3AF" : "#6B7280"} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF', border: isDarkMode ? '1px solid #374151' : '1px solid #E5E7EB' }}
                                                labelStyle={{ color: isDarkMode ? '#F9FAFB' : '#111827' }}
                                                itemStyle={{ color: isDarkMode ? '#E5E7EB' : '#1F2937' }}
                                            />
                                            <Line type="monotone" dataKey="gwPoint" stroke="#06B6D4" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-[200px]">
                                        <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} text-center mt-2`}>
                                            No gameweek data available yet.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            case 'transfer-advisor': 
                return ( 
                    <div className="flex flex-col h-full w-full bg-white rounded-xl shadow-2xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <button 
                                onClick={() => setDashboardView('dashboard')} 
                                className="flex items-center self-start text-gray-500 hover:text-emerald-600 transition-colors duration-200 text-sm font-medium"
                            >
                                <ArrowLeft size={20} className="mr-2" /> Back to Dashboard
                            </button>
                            <h1 className="text-xl font-bold text-gray-800 flex items-center">
                                <MessageSquare className="w-5 h-5 mr-2 text-emerald-600" /> FPL Advisor Chat
                            </h1>
                            <div className="w-32"></div> {/* Spacer */}
                        </div>

                        <h2 className="text-2xl font-bold text-gray-800 mb-6">
                            Welcome to the chatbot <span className="text-emerald-600">{managerName}</span>. Ask your bot anything related to FPL.
                        </h2>
                        
                        {/* Chat History Display */}
                        <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50 space-y-4">
                            {messages.map((msg, index) => (
                                <MessageBubble key={index} message={msg} />
                            ))}
                            {loading && (
                                <div className="flex justify-start">
                                    <div className="p-3 my-1 rounded-xl bg-gray-100 text-gray-800 rounded-tl-none">
                                         <Loader2 className="w-5 h-5 animate-spin text-emerald-600 inline mr-2" /> Thinking...
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Chat Input Field (Wrapped in form for submit) */}
                        <form onSubmit={handleSendMessage} className="flex space-x-3">
                            <input
                                type="text"
                                value={input} 
                                onChange={(e) => setInput(e.target.value)} 
                                placeholder="Ask for transfer advice, injury updates, or fixture analysis..."
                                 className="
        flex-1 p-3 border border-gray-300 rounded-lg 
        focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm
        text-gray-900 
        placeholder-gray-500
    "
                                disabled={isLoading}
                            />
                            <button
                                type="submit" 
                                disabled={!input.trim() || loading} 
                                className={`p-3 rounded-lg text-white font-semibold flex items-center justify-center transition-all duration-300 ${
                                    !input.trim() || loading
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-md'
                                }`}
                            >
                                {loading ? (
                                    <Loader2 size={10} className="animate-spin" />
                                ) : (
                                    <Send size={20} />
                                )}
                            </button>
                        </form>
                    </div>
                );
            case 'gameweek-planner':
                return (
                    <div className="flex flex-col items-center p-6">
                        <button onClick={() => setDashboardView('dashboard')} className="flex items-center self-start mb-6 text-gray-400 hover:text-emerald-500 transition-colors duration-200">
                            <ArrowLeft size={20} className="mr-2" /> Back to Dashboard
                        </button>
                            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} rounded-xl p-6 shadow-lg border-2 border-transparent hover:border-emerald-500 transition-all duration-300 flex flex-col items-center text-center`}>
                                <div className="flex items-center justify-center space-x-2 mb-4">
                                    <BarChart3 className="text-emerald-400" size={32} />
                                    <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Your projected points </h3>
                                </div>
                                <p className={`text-3xl font-extrabold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{Projected_points}</p>
                                <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>projected Points</p>
                            </div>
                    </div>
                );

            // case 'profile':
            //     return (
            //         <div className="flex flex-col items-center p-6">
            //             <button onClick={() => setDashboardView('dashboard')} className="flex items-center self-start mb-6 text-gray-400 hover:text-emerald-500 transition-colors duration-200">
            //                 <ArrowLeft size={20} className="mr-2" /> Back to Dashboard
            //             </button>
            //             <h2 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-4`}>User Profile</h2>
            //             <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} text-center`}>Profile</p>
            //         </div>
            //     );
            // case 'settings':
            //     return (
            //         <div className="flex flex-col items-center p-6">
            //             <button onClick={() => setDashboardView('dashboard')} className="flex items-center self-start mb-6 text-gray-400 hover:text-emerald-500 transition-colors duration-200">
            //                 <ArrowLeft size={20} className="mr-2" /> Back to Dashboard
            //             </button>
            //             <h2 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-4`}>Settings</h2>
            //             <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} text-center`}>setings</p>
            //         </div>
            //     );
            default:
                return null;
        }
    };

    const renderPage = () => {
    //      if (!isInitialAuthCheckComplete) {
    //     return (
    //         <div className="flex items-center justify-center min-h-screen">
    //             {/* Loader2 should be imported from 'lucide-react' */}
    //             <Loader2 className="w-8 h-8 animate-spin text-emerald-400" /> 
    //             <span className="ml-3 text-white">Checking authentication...</span>
    //         </div>
    //     );
    // }
        switch (page) {
            case 'landing':
                return (
                    <div className="flex flex-col items-center justify-center p-8 text-center">
                        <h1 className="text-4xl sm:text-6xl font-bold text-white mb-4 drop-shadow-md">FPL Scout AI</h1>
                        <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mb-8 drop-shadow-sm">
                            Your personal fantasy football advisor. Powered by AI to analyze your team and recommend winning transfers.
                        </p>
                        {authMethod ? (
                            <div className="flex flex-col items-center gap-4">
                                {renderAuthForm()}
                                <button
                                    onClick={() => setAuthMethod(null)}
                                    className="text-emerald-400 hover:text-emerald-300 transition-colors duration-200 text-sm"
                                >
                                    Back
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
                                <button
                                    onClick={() => setAuthMethod('signup')}
                                    className="w-full bg-white text-gray-900 font-semibold py-3 px-6 rounded-xl shadow-lg hover:bg-gray-200 transition-all duration-300"
                                >
                                    Sign Up with Email
                                </button>
                                <button
                                    onClick={() => setAuthMethod('login')}
                                    className="w-full bg-gray-900 text-white font-semibold py-3 px-6 rounded-xl shadow-lg border border-gray-700 hover:bg-gray-800 transition-all duration-300"
                                >
                                    Log In with Email
                                </button>
                            </div>
                        )}
                        {/* <div className="flex items-center justify-center gap-2 mt-4 text-gray-400">
                            <span className="h-px w-20 bg-gray-600"></span>
                            <span className="text-sm">or</span>
                            <span className="h-px w-20 bg-gray-600"></span>
                        </div> */}
                        {/* <button
                            onClick={(e)=> {
                                setIsLoading(true);
                                handleSigninWithGoogle(e);
                            }}
                            className="bg-white text-gray-900 font-semibold py-3 px-6 rounded-xl shadow-lg hover:bg-gray-200 transition-all duration-300 flex items-center justify-center mt-4 w-full max-w-sm"
                        >
                            <Chrome className="mr-2" size={20} />
                            Sign In with Google
                        </button> */}
                    </div>
                );

            case 'get-started':
                return (
                    <div className="flex flex-col items-center justify-center p-8 text-center">
                        <button onClick={handleLogout} className="flex items-center self-start mb-6 text-gray-400 hover:text-emerald-500 transition-colors duration-200">
                            <ArrowLeft size={20} className="mr-2" /> Log out
                        </button>
                        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Get Started</h2>
                        <p className="text-lg text-gray-300 mb-6 max-w-md">
                            Please enter your FPL manager ID to connect your team.
                        </p>
                        <div className="w-full max-w-md bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
                            <form onSubmit={handleManagerIdSubmit} className="flex flex-col gap-4">
                                <input
                                    type="text"
                                    value={managerId}
                                    onChange={(e) => setManagerId(e.target.value)}
                                    placeholder="Enter your FPL Manager ID"
                                    className="w-full px-4 py-3 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-300"
                                    required
                                />
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full bg-emerald-600 text-white font-semibold py-3 rounded-lg shadow-md hover:bg-emerald-500 transition-all duration-300 disabled:bg-emerald-700 disabled:cursor-not-allowed flex items-center justify-center"
                                >
                                    {isLoading ? (
                                        <Loader2 className="animate-spin mr-2" size={20} />
                                    ) : (
                                        <ArrowRight className="mr-2" size={20} />
                                    )}
                                    {isLoading ? 'Connecting...' : 'Connect My Team'}
                                </button>
                                <p className="text-sm text-gray-400 mt-2">
                                    <span className="font-semibold text-emerald-300">Where to find your ID:</span> Go to your FPL team page. Your ID is the number in the URL (e.g., fantasy.premierleague.com/entry/
                                    <span className="font-bold text-emerald-300">123456</span>/event/1).
                                </p>
                            </form>
                        </div>
                    </div>
                );

            case 'dashboard':
                if(isAuthenticated){
                    return (
                        <div className="flex flex-col p-8 w-full">
                            {/* Dashboard Header */}
                            <header className="flex justify-between items-center mb-8">
                                <div>
                                    <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{teamName}</h1>
                                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Manager: {managerName}</p>
                                </div>
                                <div className="relative">
                                    <button onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)} className={`flex items-center space-x-2 p-2 rounded-full ${isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-200'} transition-colors duration-200`}>
                                        <UserRound size={24} className="text-emerald-500" />
                                    </button>
                                    {isProfileMenuOpen && (
                                        <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'} absolute right-0 mt-2 w-48 rounded-lg shadow-xl border z-10`}>
                                            <div className="py-1">
                                                {/* <button onClick={() => { setDashboardView('profile'); setIsProfileMenuOpen(false); }} className={`block w-full text-left px-4 py-2 text-sm ${isDarkMode ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'} flex items-center`}>
                                                    <UserRound size={16} className="mr-2" />
                                                    Profile
                                                </button>
                                                <button onClick={() => { setDashboardView('settings'); setIsProfileMenuOpen(false); }} className={`block w-full text-left px-4 py-2 text-sm ${isDarkMode ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'} flex items-center`}>
                                                    <Settings size={16} className="mr-2" />
                                                    Settings
                                                </button> */}
                                                <button onClick={toggleTheme} className={`block w-full text-left px-4 py-2 text-sm ${isDarkMode ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'} flex items-center`}>
                                                    {isDarkMode ? (
                                                        <Sun size={16} className="mr-2" />
                                                    ) : (
                                                        <Moon size={16} className="mr-2" />
                                                    )}
                                                    {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                                                </button>
                                                <hr className={`${isDarkMode ? 'border-gray-700' : 'border-gray-300'} my-1`} />
                                                <button onClick={handleLogout} className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500 hover:text-white transition-colors duration-200 flex items-center rounded-b-lg">
                                                    <LogOut size={16} className="mr-2" />
                                                    Logout
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </header>

                            {/* Dashboard Content */}
                            {renderDashboardContent()}
                        </div>
                    );
                }else {
                    setPage('landing');
                    return null;
                }
            default:
                return null;
        }
    };

    return (
        <div className={`flex items-center justify-center min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'} font-inter`} style={{ backgroundImage: `url(https://placehold.co/1920x1080/${isDarkMode ? '1a202c' : 'e5e7eb'}/ffffff?text=Football%20Pitch)`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
            <div className={`backdrop-blur-md ${isDarkMode ? 'bg-gray-950 bg-opacity-70' : 'bg-white bg-opacity-80'} rounded-3xl shadow-2xl p-8 sm:p-12 max-w-6xl w-full mx-4`}>
                {renderPage()}
            </div>
        </div>
    );
}

export default App;