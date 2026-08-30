import requests
import json

domain = "whitireiaweltec.ac.nz"

url = f"https://rdap.nz/domain/{domain}"

response = requests.get(url, timeout=15)

print("Status:", response.status_code)

data = response.json()

print(json.dumps(data, indent=4))