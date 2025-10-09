
import os
from langchain.chat_models import init_chat_model
from typing import Annotated
from typing import TypedDict, Annotated, List, Union
from langchain_core.agents import AgentAction, AgentFinish
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain.agents import AgentExecutor
from google_search.search import search as google_search
from langchain_core.tools import tool
import requests
import json
import operator

os.environ["GOOGLE_API_KEY"] = "..."

class AgentState(TypedDict):
    input: str
    agent_out: Union[AgentAction, AgentFinish, None]
    intermediate_steps: Annotated[list[tuple[AgentAction, str]], operator.add]



prompt = ChatPromptTemplate.from_messages(
    [
        ("system", "You are a fantasy premier league(fpl) expert who answers questions based on the user prompt.u can use web search accordingly.Be friendly and act like the fpl manager of the user u can mock them when needed not always tho , just be friendly"),
        ("human", "{input}"),
        ("placeholder", "{agent_scratchpad}"),
    ]
)

llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0)
llm_with_tools = llm.bind_tools(
    tools=[
        GenAITool(google_search={})
    ]
)

@tool("search")
def search_tool(query: str):
    """
    Searches the web to stay up-to-date with the current FPL (Fantasy Premier League) ecosystem.
    
    This function takes a query string and performs a Google Search. It enhances
    the query by adding the FPL context to ensure the results are relevant to
    Fantasy Premier League news, player updates, and general ecosystem information.

    Args:
        query: The specific search term you want to look for (e.g., "player injuries", "transfer news").
    
    Returns:
        The search results as a string, which can be further processed by an agent or LLM.
    """
    # Create a refined search query by prepending the FPL context.
    # This helps in getting more specific results related to the fantasy game.
    search_query = f"FPL Fantasy Premier League {query}"
    
    # Perform the search using the Google Search tool.
    # The result is returned as a formatted string.
    search_results = google_search(queries=[search_query])
    
    return search_results

def get_manager_id_from_app_context():
    """
    Retrieves the user's FPL manager ID from the application's context.
    
    Returns:
        The integer manager ID.
    """
    # Replace this with the actual logic to get the manager ID.
    # For example: return user_session.get('fpl_manager_id')
    return 1234567 # Placeholder ID for demonstration purposes

@tool("YourTeam")
def yourteam_tool():
    """
    Fetches the current FPL team for the user based on their manager ID.
    
    This tool automatically retrieves the manager ID from the app's context,
    finds the current gameweek, and then calls the FPL API to get the user's
    current team, captain, and vice-captain.
    
    Returns:
        A JSON string containing the user's current FPL team information.
    """
    # 1. Get the manager ID from the application's context.
    manager_id = get_manager_id_from_app_context()
    
    # 2. Get the current gameweek from the FPL API.
    # The 'bootstrap-static' endpoint contains general information, including the current gameweek.
    try:
        bootstrap_url = "https://fantasy.premierleague.com/api/bootstrap-static/"
        bootstrap_response = requests.get(bootstrap_url)
        bootstrap_response.raise_for_status()
        bootstrap_data = bootstrap_response.json()
        
        current_gameweek = None
        for event in bootstrap_data.get('events', []):
            if event.get('is_current'):
                current_gameweek = event.get('id')
                break
        
        if not current_gameweek:
            return json.dumps({"error": "Could not determine the current gameweek."})
            
    except requests.exceptions.RequestException as e:
        return json.dumps({"error": f"Error fetching current gameweek data: {e}"})
        
    # 3. Use the manager ID and current gameweek to get the team.
    # The 'picks' endpoint provides the team selection for a specific gameweek.
    try:
        team_url = f"https://fantasy.premierleague.com/api/entry/{manager_id}/event/{current_gameweek}/picks/"
        team_response = requests.get(team_url)
        team_response.raise_for_status()
        team_data = team_response.json()
        
        # We can extract the team and other relevant information here.
        # This includes the players selected, their position, captain/vice-captain status, etc.
        team_info = {
            "entry_history": team_data.get('entry_history'),
            "picks": team_data.get('picks'),
            "active_chip": team_data.get('active_chip'),
        }
        
        return json.dumps(team_info)
        
    except requests.exceptions.RequestException as e:
        return json.dumps({"error": f"Error fetching team data for manager {manager_id}: {e}"})
