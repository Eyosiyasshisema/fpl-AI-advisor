import express from "express";
import { getProjectedPoints } from "../controllers/projectedPointsController.js";
import { verifyToken } from "../../middlewares/jwtVerify.js";

export const projectedPointsRouter = express.Router();

projectedPointsRouter.post("/points", verifyToken, getProjectedPoints);