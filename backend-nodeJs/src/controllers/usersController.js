import axios from "axios";
import {query} from "../../db.js"
import jwt from "jsonwebtoken"; 
import { validationResult } from 'express-validator';
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";



import dotenv from "dotenv";
dotenv.config();

export const registerUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { username, email, password } = req.body;
  const saltRounds = 10;

  try {
    const checkResult = await query("SELECT email FROM auth WHERE email = $1", [email]);
    if (checkResult.rows.length > 0) {
      return res.status(409).json({ success: false, message: "Email already exists", error: "email_exists" });
    } else {
      bcrypt.hash(password, saltRounds, async (err, hashedPassword) => {
        if (err) {
          res.status(500).json({ success: false, message: "error hashing your password", error: "hashing error" });
          console.error(err);
        } else {
          try {
            const newUserResult = await query("INSERT INTO auth (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email", [username, email, hashedPassword]);
            const user = newUserResult.rows[0]; 
            const newUserId = user.id;
            await query("INSERT INTO users (user_id) VALUES ($1)", [newUserId]);
            const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
            const refreshToken = uuidv4();
            await query("UPDATE auth SET refresh_token = $1 WHERE id = $2", [refreshToken, user.id]);
            
            return res.status(201).json({
                success: true,
                message: "Registration successful",
                token,
                refreshToken,
                userId: user.id,
                username: user.username, 
                email: user.email,     
                managerId: null, 
            });
          } catch (error) {
            res.status(500).json({ success: false, message: "general error", error: "general error" });
            console.error(error);
          }
        }
      });
    }
  } catch (error) {
    return handleGeneralError(res, error);
  }
};
export const loginUser = async (req, res) => {
    const { email, password } = req.body;
    try {
        const checkResult = await query("SELECT email FROM auth WHERE email = $1", [email]);
        if (checkResult.rows.length > 0) {
            try {
                const result = await query("SELECT * from auth WHERE email = $1", [email]);
                if (result.rows.length > 0) {
                    const user = result.rows[0];
                    const hashedPassword = user.password;
                    const isMatch = await bcrypt.compare(password, hashedPassword);

                    if (isMatch) {
                        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
                        const refreshToken = uuidv4();
                        
                        try {
                            const userDetailsResult = await query("SELECT managerid FROM users WHERE user_id = $1", [user.id]);
                            const managerId = userDetailsResult.rows.length > 0 ? userDetailsResult.rows[0].managerid : null;

                            await query("UPDATE auth SET refresh_token = $1 WHERE id = $2", [refreshToken, user.id]);

                            return res.status(200).json({
                                success: true,
                                message: "Login successful",
                                token,
                                refreshToken,
                                userId: user.id,
                                username: user.username,
                                email: user.email,
                                managerId: managerId,
                            });
                        } catch (dbError) {
                            console.error(dbError);
                            return res.status(500).json({ success: false, message: "general error", error: "dbError" });
                        }
                    } else {
                        return res.status(401).json({ success: false, message: "Invalid credentials", error: "incorrect_password" });
                    }
                }
            } catch (error) {
                console.error(error);
                return res.status(500).json({ success: false, message: "general error", error: "general error" });
            }
        } else {
            return res.status(404).json({ success: false, message: "invalid email", error: "email not found during login" });
        }
    } catch (error) {
        console.error(error);
        return handleGeneralError(res, error);
    }
};
export const getManagerId = async (req, res) => {
  const userId = req.user.userId; 
  const { managerId } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: User ID not found in token.' });
  }

  try {
    const fplApiResponse = await fetch(`https://fantasy.premierleague.com/api/entry/${managerId}/`);
    if (!fplApiResponse.ok) {
      const errorData = await fplApiResponse.json();
      return res.status(fplApiResponse.status).json({ message: errorData.detail || 'Invalid FPL Manager ID.' });
    }
    const fplData = await fplApiResponse.json();
    const managerName = fplData.player_first_name + ' ' + fplData.player_last_name;

    const sqlQuery = `
      UPDATE users
      SET managerid = $1, fpl_manager_name = $2
      WHERE user_id = $3
      RETURNING user_id, managerid, fpl_manager_name;
    `;
    const values = [managerId, managerName, userId];

    const result = await query(sqlQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found or not updated.' });
    }

    res.status(200).json({
      message: 'Manager ID successfully saved.',
      managerId: result.rows[0].managerid
    });

  } catch (error) {
    console.error('Error in getManagerId:', error);
    res.status(500).json({ error: 'Failed to save manager ID.' });
  }
};
export const getFplManagerName = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: 'Manager ID not provided' });
  }

  const endpoint = `https://fantasy.premierleague.com/api/entry/${id}/`;

  try {
    const response = await axios.get(endpoint);

    if (response.status !== 200) {
      return res.status(response.status).json({ message: `Error fetching FPL data. Status: ${response.status}` });
    }

    const data = response.data;

    const managerName = `${data.player_first_name} ${data.player_last_name}`;
    const teamName = data.name;
    return res.status(200).json({ managerName, teamName });

  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ message: 'Manager not found' });
    }
    console.error('API call error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getLiveGameWeekScore = async(req,res)=>{
     const {id}= req.params;
     if(!id){
      return res.status(404).json({message:"manager id not provided"});
     }
     const endpoint= `https://fantasy.premierleague.com/api/entry/${id}/`;
     try {
      const response= await axios.get(endpoint);
      if(response.status!=200){
        return res.status(response.status).json({message:"cant fetch your score"});
      }
       const data= response.data;
       const gameWeekPoints = `${data.summary_event_points}`;
       const overallPoints= `${data.summary_overall_points}`;

       return res.status(200).json({gameWeekPoints,overallPoints});

     } catch (error) {

      if (error.response && error.response.status === 404) {
      return res.status(404).json({ message: 'Manager not found' });

    }

    console.error('API call error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
     }
}

export const getRank = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(404).json({ message: "manager id not provided" });
  }
  const endpoint = `https://fantasy.premierleague.com/api/entry/${id}/`;
  try {
    const response = await axios.get(endpoint);
    if (response.status != 200) {
      return res.status(response.status).json({ message: "can't fetch ur rank" });
    }
    const data = response.data;
    const leagues = data.leagues.classic.map(league => ({
      name: league.name,
      rank: league.entry_rank
    }));
    console.log('Backend sending leagues:', leagues); 
    return res.status(200).json({ leagues });

  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ message: 'Manager not found' });
    }
    console.error('API call error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}

export const getGameWeekChart = async (req,res)=>{
const { id } = req.params;
  if (!id) {
    return res.status(404).json({ message: "manager id not provided" });
  }
  const endpoint = `https://fantasy.premierleague.com/api/entry/${id}/history/`;
  try {
    const response = await axios.get(endpoint);
    if (response.status != 200) {
      return res.status(response.status).json({ message: "can't fetch ur game week points" });
    }
    const data = response.data;
    const gameWeekPointsChart = data.current.map(point => ({
      gw:point.event,
      gwPoint: point.points
    }));
    console.log('Backend sending gw points:', gameWeekPointsChart); 
    return res.status(200).json({ gameWeekPointsChart });
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ message: 'Manager not found' });
    }
    console.error('API call error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}