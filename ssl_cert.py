import pandas as pd 
import tldextract
import socket
import ssl 
import time 
from datetime import datetime, timezone

df = pd.read_csv('Typosquat_Similarity_data.csv')  # Load the CSV file containing domain names and typosquat similarityq

CONNECT_TIMEOUT = 5  # seconds
PORT = 443  # Default port for HTTPS

def ssl_certificate_age(url):
    extracted = tldextract.extract(str(url))
    domain_name = f"{extracted.domain}.{extracted.suffix}"  # Get the main domain part with TLD
    
    context = ssl.create_default_context()

    # Retrieve the SSL certificate from the domain
    try:
        with socket.create_connection((domain_name, PORT), timeout=CONNECT_TIMEOUT) as sock:  # Opening up a connections to the domain on port 443 
            with context.wrap_socket(sock, server_hostname=domain_name) as ssock: # Ensuring we have a seucre tls connection so that the domain can return the ssl certificate
                cert = ssock.getpeercert() 
    except (socket.timeout, socket.gaierror, ConnectionRefusedError, ssl.SSLError, OSError) as e:
        print(f" {domain_name}: Connection failed: {e}") # This will print the domain name and the error message if the connection fails
        return -1 #Return -1 to indicate that the SSL certificate age could not be determined

    crt_date_issue_str = cert.get("notBefore") # Pulling the certificate issue date
    if not crt_date_issue_str: #if the IssueDate is not found (function)  
        print(f" {domain_name}: 'notBefore' field not found in certificate.") #If the certificate is not found then this line is printed as a failed connection to the user
        return -1 #Return -1 to indicate that the SSL certificate age could not be determined due to missing IssueDate field

    # Parse the issue date string into a datetime object
    try: 
        crt_date_issue = datetime.strptime(crt_date_issue_str, "%b %d %H:%M:%S %Y %Z") #Formate the date string into a datetime object
        crt_date_issue = crt_date_issue.replace(tzinfo=timezone.utc) #Have the datetime object in UTC timezone
    except ValueError as ve:
        print(f" {domain_name}: Date parsing error: {ve}") #If the date string is not in the expected format, print an error message
        return -1 #Return -1 to indicate that the SSL certificate age could not be determined due to date parsing error

    # Calculate the age of the SSL certificate in days
    age_days = (datetime.now(timezone.utc) - crt_date_issue).days #Calculate the difference between the current date and the certificate issue date in days
    print(f" {domain_name}: SSL certificate age is {age_days} days.")# Print the domain name and the calculated SSL certificate age in days
    return max(age_days, 0) #Return the SSL certificate age in days, ensuring it's not negative

# Loop through the DataFrame and calculate the SSL certificate age for each domain
ssl_certificate_ages = [] 
for i, url in enumerate(df["url"]): #This loop iterates through each URL in the DataFrame and calculates the SSL certificate age for each domain
    age = ssl_certificate_age(url) #Call the ssl_certificate_age function to get the SSL certificate age for the current domain
    ssl_certificate_ages.append(age) #Append the calculated SSL certificate age to the list
    time.sleep(3)  # Sleep for 3 second to avoid overwhelming the server

df["SSL_Cert_Age_Days"] = ssl_certificate_ages  # Add the SSL certificate age to the DataFrame

df.to_csv('New_SSL_Cert_Age_data.csv', index=False)  # Save the updated DataFrame to a new CSV file

print(f"\nSaved: SSL_Cert_Age_data.csv with the SSL certificate age for the 1000 domains.")


                