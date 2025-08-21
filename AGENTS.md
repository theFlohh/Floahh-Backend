# AGENTS.md - Floahh Backend Development Guide

## Commands
- **Start dev**: `npm run auto` (nodemon)
- **Start prod**: `npm start`
- **No tests**: Testing framework not set up yet

## Architecture
- **Stack**: Node.js + Express + MongoDB (Mongoose) 
- **Structure**: Routes → Controllers → Models → Services
- **Database**: MongoDB with Mongoose ODM
- **External APIs**: Spotify, YouTube, Genius API integrations
- **Auth**: JWT + Passport (Google OAuth)
- **Cron Jobs**: Daily scoring (2 AM), Weekly tiering (3 AM Monday)
- **File uploads**: Multer to `/uploads` directory

## Code Style
- **Language**: JavaScript (no TypeScript)
- **Exports**: `exports.functionName = async (req, res) => {}`
- **Async pattern**: Always use async/await, never Promises
- **Error handling**: try-catch blocks with `console.error()` logging
- **Responses**: `res.json(data)` for success, `res.status(code).json({ error: "message" })` for errors
- **Destructuring**: Always destructure req params: `const { param1, param2 } = req.body`
- **Routes**: Import controller methods into separate route files
- **Auth**: Use `req.user` from authMiddleware for authenticated routes
