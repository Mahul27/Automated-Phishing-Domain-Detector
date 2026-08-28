-- ================================================
-- IT7510 CAPSTONE PROJECT
-- Automated Phishing Domain Detector
-- Week 7 - Database Development
-- ================================================



-- 1st Step: Create the project database
CREATE DATABASE IF NOT EXISTS automated_phishing_detector;



-- 2nd Step: Using the database in which we want tables
USE automated_phishing_detector;

-- 3rd Step: Creating the app_users table in the MySQL
CREATE TABLE IF NOT EXISTS app_users (

-- creates a automatic user number 
		user_id INT AUTO_INCREMENT PRIMARY KEY,
        
-- THE Supabase user ID
        supabase_user_id  CHAR(36) NOT NULL UNIQUE,
        
-- Date and time that user was added
	   created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
       
);



-- Step 4: Creating the domains table
CREATE TABLE IF NOT EXISTS domains (

-- Automatic domain number in the table 
   domain_id INT AUTO_INCREMENT PRIMARY KEY,
   
-- Store the domain name
   domain_name VARCHAR(253) NOT NULL UNIQUE,
   
-- Date and Time the domain was added 
created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);



-- 5th Step: Creating the scan_results table
CREATE TABLE IF NOT EXISTS scan_results (
  -- Automatic scan the number
      scan_id INT AUTO_INCREMENT PRIMARY KEY,
      
  -- User who made the scan
      user_id INT NOT NULL,
      
-- The domain that was scanned
	  domain_id INT NOT NULL,
      
-- THE Date and Time of the scan
      scan_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
-- storing the prediction result
     prediction_result VARCHAR(25) NOT NULL,

-- Store the risk score
risk_score DECIMAL(5,2) NOT NULL,

-- CONNECT the scan to the app_users
   FOREIGN KEY (user_id)
   REFERENCES app_users(user_id),
   
-- Connect the scan to the domains
   FOREIGN KEY (domain_id)
   REFERENCES domains(domain_id)
   
);


-- Checking the tables that are created now
SHOW TABLES;

