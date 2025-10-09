import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";
const FPL_BASE_URL = "https://fantasy.premierleague.com/api";
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// --- Map player IDs to detailed info including form and upcoming fixture ---
const getPlayerMap = async () => {
  try {
    const res = await axios.get(`${FPL_BASE_URL}/bootstrap-static/`);
    const { elements: players, teams, element_types: positions } = res.data;

    const teamMap = teams.reduce((acc, t) => { acc[t.id] = t.name; return acc; }, {});
    const positionMap = positions.reduce((acc, p) => { acc[p.id] = p.singular_name_short; return acc; }, {});

    const playerMap = players.reduce((acc, p) => {
      acc[p.id] = {
        name: `${p.first_name} ${p.second_name}`,
        position: positionMap[p.element_type] || "UNK",
        team: teamMap[p.team] || "UNK",
        form: p.form,              
        nextFixture: p.next_fixture || "N/A",
      };
      return acc;
    }, {});

    return playerMap;
  } catch (err) {
    console.error("FPL Bootstrap Error:", err.message);
    throw new Error("Failed to get FPL static data.");
  }
};

// --- Fetch manager squad and format minimal context for AI ---
const fetchAndFormatFplTeamData = async (managerId) => {
  try {
    const playerMap = await getPlayerMap();
    const entryRes = await axios.get(`${FPL_BASE_URL}/entry/${managerId}/`);
    const currentGW = entryRes.data.current_event;
    if (!currentGW) return { context: "FPL Team Context: current gameweek unknown.", currentGW: 1 };

    const picksRes = await axios.get(`${FPL_BASE_URL}/entry/${managerId}/event/${currentGW}/picks/`);
    const picks = picksRes.data.picks;

    const starting = picks.filter(p => p.position <= 11);
    const bench = picks.filter(p => p.position > 11).sort((a,b)=>a.position-b.position);

    const formatPicks = (picks, isStarting) =>
      picks.map(p => {
        const details = playerMap[p.element] || { name: `ID ${p.element}`, position: "UNK", team:"UNK", form:"N/A" };
        let line = `${details.name} (${details.position}, ${details.team}, form:${details.form})`;
        if (isStarting) { if (p.is_captain) line += " [C]"; else if (p.is_vice_captain) line += " [VC]"; }
        else { line += ` (B${p.position-11})`; }
        return line;
      }).join("; ");

    const contextString = `CURRENT GW${currentGW} | STARTING XI: ${formatPicks(starting,true)}\nBENCH: ${formatPicks(bench,false)}`;
    return { context: contextString, currentGW };
  } catch (err) {
    console.error("FPL Fetch Error:", err.message);
    return { context: "FPL Team Context: could not fetch squad.", currentGW: 1 };
  }
};

// --- Call Gemini API with Google Search grounding ---
const callGeminiApi = async (prompt, fplTeamContext, currentGW) => {
  const maxRetries = 3;

  // truncate context to prevent MAX_TOKENS
  const truncatedContext = fplTeamContext.length > 400 ? fplTeamContext.slice(0,400) + "\n...[truncated]" : fplTeamContext;

  const fullPrompt = `
Question: ${prompt}
The current Premier League season is 2025/26, and it is currently Gameweek ${currentGW}.
You are a witty, expert, and up-to-date Fantasy Premier League (FPL) transfer advisor.
Always use Google Search grounding to find the latest news, player form, injuries, transfers, and fixture difficulty.
Be specific in your player recommendations (e.g., 'Transfer out Player A for Player B').
Keep your answers concise and directly related to FPL strategy.
Do not recommend players who are no longer in the Premier League.
If a user asks a question not related to FPL, tell them to ask only FPL-related questions.

FPL TEAM (use only this squad):
${truncatedContext}
`;

  const payload = {
    contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
    tools: [{ google_search: {} }]  
  };

  for(let attempt=1; attempt<=maxRetries; attempt++){
    try {
      const response = await axios.post(`${GEMINI_API_URL}?key=${GOOGLE_API_KEY}`, payload,{
        headers: {"Content-Type":"application/json"}
      });

      const candidate = response.data.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text || candidate?.content?.parts?.map(p=>p.text).join("\n") || null;

      if(!text){
        console.error("Raw Gemini Response:", JSON.stringify(response.data,null,2));
        throw new Error("Received empty or invalid content from the AI model.");
      }

      return { text, sources: [] };
    } catch(err){
      console.error("Gemini API Error Details:", err.response?.data || err.message);
      const retryable = [500,503].includes(err.response?.status);
      if(retryable && attempt<maxRetries){
        await new Promise(r=>setTimeout(r, attempt*2000));
        continue;
      }
      throw new Error(`Failed after ${attempt} attempts. ${err.response?.data?.error?.message || err.message}`);
    }
  }
};

// --- Express handler ---
export const getFplAdvice = async (req,res)=>{
  const { prompt, managerId } = req.body;
  if(!prompt) return res.status(400).json({ error: "Prompt is required." });
  if(!managerId) return res.status(400).json({ error: "Manager ID is required." });

  try {
    const { context, currentGW } = await fetchAndFormatFplTeamData(managerId);
    const { text, sources } = await callGeminiApi(prompt, context, currentGW);
    return res.status(200).json({ advice:text, sources });
  } catch(err){
    return res.status(500).json({ error: err.message });
  }
};
