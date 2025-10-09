import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

export const verifyToken = ((req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {

        return res.status(401).json({ error: 'Unauthorized', message: 'Authentication token missing or malformed.' });
    }

    const token = authHeader.split(' ')[1];
    
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Forbidden', message: 'Token is invalid or expired. Please log in again.' });
        }
        req.user = decoded; 
        next();
    });
});