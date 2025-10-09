import express from "express";
import * as authController from "../controllers/usersController.js"

export const authRouter = express.Router();

authRouter.post("/register",authController.registerUser)
authRouter.post("/login",authController.loginUser)