-- Initialization script for Tornado Monitor Database
-- This file is automatically executed when the MySQL container is first created

-- Ensure the database exists
CREATE DATABASE IF NOT EXISTS tornado;

-- Grant additional permissions if needed
-- The user is already created by docker-compose environment variables
GRANT ALL PRIVILEGES ON tornado.* TO 'tornado-monitor'@'%';
FLUSH PRIVILEGES;

-- Note: The application will automatically create the required tables
-- (stake_burned_events) on first run via the Database class
