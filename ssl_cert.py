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

    try:
        with socket.create_connection((domain_name, PORT), timeout=CONNECT_TIMEOUT) as sock:  # Opening up a connections to the domain on port 443 
            with context.wrap_socket(sock, server_hostname=domain_name) as ssock: # Ensuring we have a seucre tls connection so that the domain can return the ssl certificate
                cert = ssock.getpeercert() 
    except (socket.timeout, socket.gaierror, ConnectionRefusedError, ssl.SSLError, OSError) as e:
        print(f" {domain_name}: Connection failed: {e}") # This will print the domain name and the error message if the connection fails
        return -1 #Return -1 to indicate that the SSL certificate age could not be determined

    crt_date_issue_str = cert.get("IssueDate") # Pulling the certificate issue date
    if not crt_date_issue_str: #if the IssueDate is not found (function)  
        print(f" {domain_name}: 'IssueDate' field not found in certificate.") #If the certificate is not found then this line is printed as a failed connection to the user
        return -1 #Display -1 if not found


# Next function will be to convert it to a datetime object and calculate the age of the certificate in days
#....


df["SSL_Cert_Age_Days"] = ssl_certificate_ages  # Add the SSL certificate age to the DataFrame

df.to_csv('SSL_Cert_Age_data.csv', index=False)  # Save the updated DataFrame to a new CSV file

print(f"\nSaved: SSL_Cert_Age_data.csv with the SSL certificate age for the 1000 domains.")


                