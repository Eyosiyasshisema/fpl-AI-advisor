import express from "express";
import { getFplAdvice } from "../controllers/chatController.js";
import { verifyToken } from "../../middlewares/jwtVerify.js";

export const chatRouter = express.Router();

// Route to get advice from the FPL Chatbot
// It requires authentication via verifyToken
chatRouter.post("/advice", verifyToken, getFplAdvice);