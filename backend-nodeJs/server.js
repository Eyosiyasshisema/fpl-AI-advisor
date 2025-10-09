import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { usersRouter } from "./src/routes/users.js";
import { authRouter } from "./src/routes/auth.js";
import { chatRouter } from "./src/routes/chat.js";
import { projectedPointsRouter } from "./src/routes/projectedPoints.js";


dotenv.config();

const port=process.env.PORT;
const app=express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }))
const corsOptions = {
  origin: 'http://localhost:3000'
};

app.use(cors(corsOptions));
app.use('/users', usersRouter);
app.use('/auth',authRouter);
app.use('/chat',chatRouter);
app.use('/projectedPoints',projectedPointsRouter)


app.listen(port,() => {
console.log(`server listening on port ${port}`);
})