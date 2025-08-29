# Overview

This is a real-time chatroom application with file sharing capabilities and an integrated Snake game. Users can create and join different types of rooms: regular chat rooms for messaging and file sharing, and "funrooms" for playing multiplayer Snake. The application supports file uploads (images and text files), real-time messaging, and multiplayer gaming without requiring user authentication. All uploaded files are automatically deleted after 3 hours.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Static File Serving**: Uses Express.js to serve static HTML, CSS, and JavaScript files from the `public` directory
- **Real-time Communication**: Implements Socket.IO client for instant file upload notifications and live updates
- **Simple UI**: Pure HTML/CSS/JavaScript frontend with no frameworks, focusing on minimal complexity
- **File Preview**: Inline text file previews for small files directly in the browser

## Backend Architecture
- **Node.js with Express**: RESTful API server handling file uploads and serving static content
- **WebSocket Integration**: Socket.IO server for real-time communication between clients
- **File Upload Processing**: Multer middleware for handling multipart file uploads with size limitations (8MB max)
- **Automatic Cleanup**: In-memory file tracking with TTL-based deletion system (3-hour expiration)
- **Security Middleware**: Helmet for security headers, CORS for cross-origin requests, and compression for performance

## Data Storage
- **File System Storage**: Direct file storage in local `uploads` directory using multer disk storage
- **In-Memory File Tracking**: JavaScript Map for tracking uploaded files with metadata (no persistent database)
- **UUID-based Naming**: Generates unique filenames using UUID v4 to prevent conflicts

## File Management
- **Text File Focus**: Designed specifically for text file uploads (.txt files and similar)
- **Size Limitations**: 8MB maximum file size restriction
- **Automatic Expiration**: Files automatically deleted after 3 hours using setTimeout-based cleanup
- **Public Access**: All uploads are immediately publicly accessible via direct URLs

# External Dependencies

## Core Runtime Dependencies
- **express**: Web application framework for Node.js
- **socket.io**: Real-time bidirectional event-based communication
- **multer**: Node.js middleware for handling file uploads
- **uuid**: RFC4122 UUID generator for unique file naming

## Security and Performance
- **helmet**: Security middleware for Express applications
- **cors**: Cross-Origin Resource Sharing middleware
- **compression**: Response compression middleware
- **mime-types**: MIME type utilities for file type detection

## Platform Requirements
- **Node.js**: Runtime environment (ES modules support required)
- **File System Access**: Local storage for temporary file uploads
- **Port Configuration**: Configurable via PORT environment variable for deployment flexibility