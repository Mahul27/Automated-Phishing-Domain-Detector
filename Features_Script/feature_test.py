# Feature 1: Domain Length
def get_domain_length(domain):
    return len(domain)


# Feature 2: Number of Hyphens
def get_hyphen_count(domain):
    return domain.count("-")


# Feature 3: Number of Digits
def get_digit_count(domain):
    return sum(character.isdigit() for character in domain)


# Testing domain
domain = "Kartar-login-234.com"

print("Domain:", domain)
print("Domain Length:", get_domain_length(domain))
print("Number of Hyphens:", get_hyphen_count(domain))
print("Number of Digits:", get_digit_count(domain))