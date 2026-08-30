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
    


                