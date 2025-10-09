import express from "express";
import * as userController from "../controllers/usersController.js";
import { verifyToken } from "../../middlewares/jwtVerify.js";

export const usersRouter = express.Router();

usersRouter.post("/managerId",verifyToken,userController.getManagerId)
usersRouter.get("/fpl-manager/:id", verifyToken,userController.getFplManagerName);
usersRouter.get("/points/:id",verifyToken,userController.getLiveGameWeekScore);
usersRouter.get("/ranks/:id",verifyToken,userController.getRank);
usersRouter.get("/gameweekChart/:id",verifyToken,userController.getGameWeekChart);