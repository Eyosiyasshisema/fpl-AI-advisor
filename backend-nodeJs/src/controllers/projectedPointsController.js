import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

// Configuration
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent";
const FPL_BASE_URL = "https://fantasy.premierleague.com/api";
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY; 
const getPlayerMap = async () => {
    try {
        const bootstrapResponse = await axios.get(`${FPL_BASE_URL}/bootstrap-static/`);
        const { elements: players, teams, element_types: positions } = bootstrapResponse.data;
        const teamMap = teams.reduce((acc, team) => {
            acc[team.id] = team.name;
            return acc;
        }, {});

        const positionMap = positions.reduce((acc, pos) => {
            acc[pos.id] = pos.singular_name_short; 
            return acc;
        }, {});

        const playerMap = players.reduce((acc, player) => {
            acc[player.id] = {
                name: `${player.first_name} ${player.second_name}`,
                team: teamMap[player.team],
                position: positionMap[player.element_type],
                cost: `£${(player.now_cost / 10).toFixed(1)}m` 
            };
            return acc;
        }, {});

        return playerMap;

    } catch (error) {
        console.error("FPL API Bootstrap Fetch Error:", error.message);
        throw new Error("Failed to retrieve static FPL player data for ID mapping.");
    }
};

const fetchAndFormatFplTeamData = async (managerId) => {
    try {
        const playerMap = await getPlayerMap();
        const entryResponse = await axios.get(`${FPL_BASE_URL}/entry/${managerId}/`);
        const entryData = entryResponse.data;
        const currentGameweek = entryData.current_event;

        if (!currentGameweek) {
            return "FPL Team Context: Manager ID found, but current gameweek could not be determined. Point projection cannot be performed.";
        }

        const picksResponse = await axios.get(`${FPL_BASE_URL}/entry/${managerId}/event/${currentGameweek}/picks/`);
        const picksData = picksResponse.data;

        const formatPicks = (picks, isStartingXI) => {
            return picks.map(p => {
                const details = playerMap[p.element] || { name: `ID ${p.element} (Unknown Player)`, team: 'Unknown', position: 'UNK', cost: 'N/A' };
                let line = `${details.name} (${details.position}, ${details.team}, ${details.cost})`;

                if (isStartingXI) {
                    const status = [];
                    if (p.is_captain) status.push('CAPTAIN');
                    if (p.is_vice_captain) status.push('V-CAPTAIN');
                    
                    const statusStr = status.length > 0 ? ` [${status.join(', ')}]` : '';
                    line += statusStr;
                } else {
                    line += ` (Bench Pos: ${p.position - 11})`;
                }

                return line.replace(/'/g, ""); 
            }).join('\n');
        };

        const startingPicks = picksData.picks.filter(p => p.position <= 11);
        const benchPicks = picksData.picks.filter(p => p.position > 11).sort((a, b) => a.position - b.position);

        const startingPicksString = formatPicks(startingPicks, true);
        const benchPicksString = formatPicks(benchPicks, false);

        const moneyInBank = picksData.entry_history?.bank !== undefined ? `£${(picksData.entry_history.bank / 10).toFixed(1)}m` : 'N/A';
        const transfersLeft = entryData.event_transfers_left !== undefined ? entryData.event_transfers_left : 'N/A';
        
        const contextString = `
CURRENT FPL SQUAD CONTEXT FOR GAMEWEEK ${currentGameweek}:
Team Name: ${entryData.name}
Manager: ${entryData.player_first_name} ${entryData.player_last_name}
Money in the Bank: ${moneyInBank}
Free Transfers Left: ${transfersLeft}

Starting XI (Name | Position | Club | Cost | Status):
${startingPicksString}

Bench Players (Name | Position | Club | Cost | Bench Position):
${benchPicksString}

INSTRUCTIONS: The squad above is the one to project points for. Use the Player Names and Clubs in the Starting XI to analyze form, fixtures, and news. Base your point projection ONLY on this squad.
`;
        return contextString;

    } catch (error) {
        console.error("FPL API Fetch Error:", error.message);
        return "FPL Team Context: Could not fetch and fully map your current team data from the FPL API.";
    }
};

const callGeminiApi = async (fplTeamContext) => {
    const maxRetries = 3; 

    const systemInstructionRole = "The current Premier League season is 2025/26. You are a witty, expert, and up-to-date Fantasy Premier League (FPL) Projected team point calculator. You must calculate points based on the latest available football news, form, and fixture difficulty. Always Use Google Search grounding to find the most current information.";

    const finalSystemInstruction = `
[FPL ADVISOR ROLE]
${systemInstructionRole}

[CURRENT FPL TEAM CONTEXT]
<<CONTEXT>>
${fplTeamContext}
<<END_CONTEXT>>

[FINAL INSTRUCTION]
Based on the context delimited by <<CONTEXT>> and <<END_CONTEXT>>, analyze the team and fixtures, use Google Search, and provide the final projected score. Your response must **start** with the projected score on its own line using this exact format: **Projected Points: [NUMBER]**. After the required line, you may add a single, brief, witty sentence of analysis.
`.trim();

    const contents = [
        { role: 'user', parts: [{ text: "Please analyze the FPL team and provide the projected score for the next gameweek. Begin with the required format." }] } 
    ];
    const payload = {
        systemInstruction: {
            parts: [{ text: finalSystemInstruction }]
        }, 
        contents: contents,
        tools: [{ google_search: {} }],
    };

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await axios.post(`${GEMINI_API_URL}?key=${GOOGLE_API_KEY}`, payload, {
                 headers: { 'Content-Type': 'application/json' },
            });

            const candidate = response.data.candidates?.[0];

            if (candidate && candidate.content?.parts?.[0]?.text) {
                const text = candidate.content.parts[0].text;
                let sources = [];
                const groundingMetadata = candidate.groundingMetadata;
                
                if (groundingMetadata && groundingMetadata.groundingAttributions) {
                    sources = groundingMetadata.groundingAttributions
                        .map(attribution => ({
                            uri: attribution.web?.uri,
                            title: attribution.web?.title,
                        }))
                        .filter(source => source.uri && source.title);
                }
                return { text, sources };

            } else {
                throw new Error("Received an empty or invalid content response from the AI model.");
            }

        } catch (error) {
            const isRetryable = error.response?.status === 503 || error.response?.status === 500;
            
            if (isRetryable && attempt < maxRetries) {
                const waitTime = Math.pow(2, attempt) * 1000; 
                console.warn(`Attempt ${attempt} failed with status ${error.response?.status || 'unknown'}. Retrying in ${waitTime / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue; 
            }
            
            console.error("Final attempt failed or received non-retryable error:", error.response?.data || error.message);
            throw new Error(`Failed to get FPL advice after ${attempt} attempts. Server error: ${error.response?.data?.error?.message || 'Check logs for details.'}`);
        }
    }
};

export const getProjectedPoints = async (req, res) => {
    const { managerId } = req.body; 
    
    if (!managerId) {
          return res.status(400).json({ 
              error: "FPL Manager ID is missing. Please enter your FPL ID in the settings to enable personalized advice." 
          });
    }
    
    try {
        const fplTeamContext = await fetchAndFormatFplTeamData(managerId); 

        if (fplTeamContext.startsWith("FPL Team Context:")) {
             return res.status(500).json({ 
                 error: fplTeamContext 
             });

        }
        
        const { text, sources } = await callGeminiApi( fplTeamContext);
        
        return res.status(200).json({ 
            projectedPoints: text,
            sources: sources 
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};