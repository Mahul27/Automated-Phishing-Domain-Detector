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

-- ==================================================
-- WEEK 8 DATABASE DEVELOPMENT --
-- ==================================================

-- Creating the domain_features table now
CREATE TABLE IF NOT EXISTS domain_features (
          feature_id INT NOT NULL AUTO_INCREMENT,
          scan_id INT NOT NULL,
          domain_age INT NULL,
          registration_period INT NULL,
          domain_length INT NOT NULL,
          hyphen_count INT NOT NULL,
          digit_count INT NOT NULL,
          shannon_entropy DECIMAL(8,5) NOT NULL,
          brand_keyword_detection TINYINT NOT NULL,
          typosquatting_similarity DECIMAL (5,4) NOT NULL,
          ssl_certificate_age INT NULL,
          tld VARCHAR(63) NOT NULL,
          
          PRIMARY KEY (feature_id),
          UNIQUE KEY uq_domain_features_scan_id (scan_id),
          
          CONSTRAINT fk_domain_features_scan
          FOREIGN KEY (scan_id)
          REFERENCES scan_results(scan_id)

);


 -- Creating the new table model_outputs table
 CREATE TABLE IF NOT EXISTS model_outputs (
     output_id INT NOT NULL AUTO_INCREMENT,
     scan_id INT NOT NULL,
     model_name VARCHAR(50) NOT NULL,
     confidence_score DECIMAL(5,4) NOT NULL,
     explanation TEXT NULL,
     
     PRIMARY KEY (output_id),
     
     CONSTRAINT fk_model_outputs_scan
       FOREIGN KEY (scan_id)
       REFERENCES scan_results(scan_id)
       
);

-- Selecting the project database
USE automated_phishing_detector;

-- Checking that the all 5 project tables are available
SHOW TABLES;

